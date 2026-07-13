#!/usr/bin/env python3
import json
import os
import sys
import subprocess
import time
import re
import threading
import zlib
import struct
import hashlib
import hmac
import secrets
import base64
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


APP_DIR = Path(__file__).resolve().parent
PROJECT_HOME = APP_DIR.parent
ROOT = Path(os.environ.get("UNIFI_ROUTING_ROOT", "/persistent/unifi-routing-manager")).resolve()
HOST = os.environ.get("UNIFI_WEB_HOST", "0.0.0.0")
PORT = int(os.environ.get("UNIFI_WEB_PORT", "8090"))

PROJECTS = {
    "cloud": {
        "title": "UniFi Cloud",
        "dir": ROOT / "ubnt-cloud",
        "service": "ubnt-cloud-routes.service",
        "timer": "ubnt-cloud-routes.timer",
        "script": ROOT / "ubnt-cloud" / "ubnt-cloud-routes.sh",
        "priority": "100",
        "log": "ubnt-cloud-routes.log",
        "files": {
            "domains": "domains.txt",
            "networks": "networks.txt",
            "addresses": "addresses.txt",
        },
    },
    "updates": {
        "title": "UniFi Updates",
        "dir": ROOT / "ubnt-updates",
        "service": "ubnt-updates-routes.service",
        "timer": "ubnt-updates-routes.timer",
        "script": ROOT / "ubnt-updates" / "ubnt-updates-routes.sh",
        "priority": "110",
        "log": "ubnt-updates-routes.log",
        "files": {
            "domains": "update-domains.txt",
            "networks": "networks-manual.txt",
            "addresses": "addresses.txt",
        },
    },
}

DNSCRYPT = {
    "dir": ROOT / "ubnt-dnscrypt",
    "script": ROOT / "ubnt-dnscrypt" / "ubnt-dnscrypt.sh",
    "log": "ubnt-dnscrypt.log",
}

ISP_ICONS = {
    "dir": ROOT / "ubnt-isp-icons",
    "script": ROOT / "ubnt-isp-icons" / "install.sh",
    "log": "systemd-install.log",
    "asn_dir": "/usr/lib/unifi/webapps/ROOT/app-unifi/react/images/topology/isp/asn",
    "name_dir": "/usr/lib/unifi/webapps/ROOT/app-unifi/react/images/topology/isp/name",
}

WEB_SERVICE = "unifi-routing-web.service"
NET_CACHE = {}
NET_CACHE_LOCK = threading.Lock()
AUTH_FILE = PROJECT_HOME / "urm-auth.json"
AVATAR_DIR = PROJECT_HOME / "web-data"
SESSION_TTL = 86400
EDITABLE_FILES = {
    "cloud.domains": ROOT / "ubnt-cloud" / "domains.txt",
    "cloud.networks": ROOT / "ubnt-cloud" / "networks-manual.txt",
    "updates.domains": ROOT / "ubnt-updates" / "update-domains.txt",
    "updates.networks": ROOT / "ubnt-updates" / "networks-manual.txt",
    "wg.map": ROOT / "wg-map.conf",
}


def read_text(path, default=""):
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return default


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def read_json(path, default=None):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return default if default is not None else {}


def hash_password(password, salt=None, iterations=210000):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("ascii"), iterations)
    return salt, base64.b64encode(digest).decode("ascii")


def ensure_auth_config():
    data = read_json(AUTH_FILE, {})
    if data.get("username") and data.get("passwordHash") and data.get("sessionSecret"):
        return data
    raise RuntimeError(
        f"Missing or invalid authentication config: {AUTH_FILE}. "
        "Run the installer interactively to create it."
    )


def verify_password(password, config):
    salt = config.get("passwordSalt", "")
    expected = config.get("passwordHash", "")
    if not salt or not expected:
        return False
    # Existing installations used 120000 iterations without recording the value.
    iterations = int(config.get("passwordIterations", 120000))
    _, digest = hash_password(password, salt, iterations)
    return hmac.compare_digest(digest, expected)


def make_session(username):
    config = ensure_auth_config()
    expires = int(time.time()) + SESSION_TTL
    payload = f"{username}:{expires}"
    signature = hmac.new(config["sessionSecret"].encode("ascii"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{payload}:{signature}".encode("utf-8")).decode("ascii")


def parse_cookies(header):
    cookies = {}
    for part in (header or "").split(";"):
        if "=" in part:
            key, value = part.strip().split("=", 1)
            cookies[key] = value
    return cookies


def verify_session(cookie):
    if not cookie:
        return False
    config = ensure_auth_config()
    try:
        decoded = base64.urlsafe_b64decode(cookie.encode("ascii")).decode("utf-8")
        username, expires, signature = decoded.rsplit(":", 2)
    except (ValueError, UnicodeDecodeError):
        return False
    if username != config.get("username") or int(expires) < int(time.time()):
        return False
    payload = f"{username}:{expires}"
    expected = hmac.new(config["sessionSecret"].encode("ascii"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


def avatar_url(config=None):
    config = config or ensure_auth_config()
    avatar = config.get("avatar") or ""
    return f"/api/avatar/{Path(avatar).name}" if avatar else ""


def safe_asset_name(filename, allowed=(".png", ".svg", ".ico", ".jpg", ".jpeg")):
    name = Path(filename or "").name
    suffix = Path(name).suffix.lower()
    if suffix not in allowed:
        return ""
    if not re.match(r"^[A-Za-z0-9_.-]+$", name):
        return ""
    return name


def list_entries(path):
    items = []
    try:
        for line in path.read_text(encoding="utf-8", errors="replace").splitlines():
            value = line.strip()
            if value and not value.startswith("#"):
                items.append(value)
    except OSError:
        pass
    return items


def tail(path, lines=80):
    try:
        data = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return "\n".join(data[-lines:])
    except OSError:
        return ""


def human_event(line):
    if not line:
        return {"time": "", "message": "No recent activity"}

    match = re.match(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\s+(.*)$", line.strip())
    event_time = match.group(1) if match else ""
    message = match.group(2) if match else line.strip()

    replacements = [
        (r"^=== done UniFi Cloud WG routing via (.+?) / (.+?) ===$", r"Cloud routing via \1"),
        (r"^=== done UniFi Updates WG routing via (.+?) / (.+?) ===$", r"Update routing via \1"),
        (r"^=== start UniFi Cloud WG routing ===$", "Cloud routing update started"),
        (r"^=== start UniFi Updates WG routing ===$", "Update routing refresh started"),
        (r"^selected WG table=(.+?) iface=(.+?) name=(.+?)$", r"Selected WireGuard tunnel \3 on \2"),
        (r"^active WG: name=(.+?) iface=(.+?) table=(.+?)$", r"Active WireGuard tunnel is \1 on \2"),
        (r"^summary: domains=(\d+) networks=(\d+) addresses=(\d+) rules=(\d+) name=(.+?) iface=(.+?) table=(.+?)$", r"\4 rules active for \1 domains, \2 networks and \3 addresses"),
        (r"^summary: domains=(\d+) rules=(\d+) name=(.+?) iface=(.+?) table=(.+?)$", r"\2 update rules active for \1 domains"),
        (r"^summary: domains=(\d+) forwarding=(\d+) dnscrypt-proxy=(.+?)$", r"DNSCrypt has \2 forwarding rules; service is \3"),
        (r"^generated (\d+) rules -> .*$", r"Generated \1 forwarding rules"),
        (r"^extracted (\d+) domains -> .*$", r"Extracted \1 root domains"),
        (r"^dnscrypt-proxy restarted OK(?: pid=\d+)?$", "DNSCrypt service restarted"),
        (r"^dns cache cleared via HUP to dnsmasq pid=\d+$", "DNS cache cleared"),
        (r"^ERROR: (.*)$", r"Error: \1"),
        (r"^WARNING: (.*)$", r"Warning: \1"),
    ]

    for pattern, replacement in replacements:
        if re.search(pattern, message):
            message = re.sub(pattern, replacement, message)
            break

    message = message.replace("===", "").strip()
    return {"time": event_time, "message": message or "No recent activity"}


def run(command, timeout=20):
    try:
        completed = subprocess.run(
            command,
            text=True,
            capture_output=True,
            timeout=timeout,
            check=False,
        )
        return {
            "ok": completed.returncode == 0,
            "code": completed.returncode,
            "output": (completed.stdout + completed.stderr).strip(),
        }
    except FileNotFoundError:
        return {"ok": False, "code": 127, "output": f"Command not found: {command[0]}"}
    except subprocess.TimeoutExpired:
        return {"ok": False, "code": 124, "output": "Command timed out"}


def cached_value(key, ttl, producer):
    now = time.time()
    with NET_CACHE_LOCK:
        cached = NET_CACHE.get(key)
        if cached and now - cached["time"] < ttl:
            return cached["value"]

    value = producer()
    with NET_CACHE_LOCK:
        NET_CACHE[key] = {"time": now, "value": value}
    return value


def external_ip(iface=None):
    key = f"external-ip:{iface or 'direct'}"

    def produce():
        command = ["curl", "-4", "--connect-timeout", "3", "-sS"]
        if iface:
            command.extend(["--interface", iface])
        command.append("https://ifconfig.me")
        result = run(command, timeout=6)
        value = result["output"].splitlines()[0].strip() if result["ok"] and result["output"] else "N/A"
        return value if re.match(r"^\d+\.\d+\.\d+\.\d+$", value) else "N/A"

    return cached_value(key, 300, produce)


def ip_geo(ip):
    key = f"ip-geo:{ip}"

    def produce():
        if not ip or ip == "N/A":
            return {"country": "N/A", "countryCode": "N/A", "isp": "N/A", "asn": "", "asname": ""}

        result = run(
            ["curl", "--connect-timeout", "3", "-sS", f"http://ip-api.com/json/{ip}?fields=country,countryCode,isp,as,asname"],
            timeout=6,
        )
        if not result["ok"] or not result["output"]:
            return {"country": "Unknown", "countryCode": "Unknown", "isp": "Unknown", "asn": "", "asname": ""}

        try:
            data = json.loads(result["output"])
        except json.JSONDecodeError:
            return {"country": "Unknown", "countryCode": "Unknown", "isp": "Unknown", "asn": "", "asname": ""}

        as_text = data.get("as") or ""
        asn_match = re.search(r"\bAS(\d+)\b", as_text)

        return {
            "country": data.get("country") or "Unknown",
            "countryCode": data.get("countryCode") or "Unknown",
            "isp": data.get("isp") or "Unknown",
            "asn": asn_match.group(1) if asn_match else "",
            "asname": data.get("asname") or "",
        }

    return cached_value(key, 3600, produce)


def slugify(value):
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "provider"


def wg_map_names():
    names = {}
    for path in (ROOT / "wg-map.conf",):
        for line in read_text(path, "").splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split(None, 2)
            if len(parts) >= 2:
                names[parts[1]] = parts[2] if len(parts) > 2 else parts[1]
        if names:
            break
    return names


def download_url(url, path, timeout=12):
    if not re.match(r"^https://", url or ""):
        return False, "Only https URLs are allowed"
    path.parent.mkdir(parents=True, exist_ok=True)
    result = run(["curl", "-fsSL", "--connect-timeout", "5", "--max-time", str(timeout), url, "-o", str(path)], timeout=timeout + 4)
    if not result["ok"]:
        try:
            path.unlink()
        except OSError:
            pass
        return False, result["output"] or "Download failed"
    return True, f"Downloaded {path.name}"


def country_flag_filename(country_code):
    code = (country_code or "").lower()
    return f"{code}.svg" if re.match(r"^[a-z]{2}$", code) else ""


def country_flag_url(country_code):
    filename = country_flag_filename(country_code)
    path = ISP_ICONS["dir"] / "flags" / filename if filename else None
    if path and path.exists():
        return f"/api/asset/flags/{filename}"
    return ""


def ensure_country_flag(country_code):
    filename = country_flag_filename(country_code)
    if not filename:
        return ""
    path = ISP_ICONS["dir"] / "flags" / filename
    if not path.exists():
        download_url(f"https://static.2ip.io/images/flags/4x3/{filename}", path)
    return country_flag_url(country_code)


def provider_icon_filename(isp="", asn=""):
    if asn:
        base = f"{asn}_101x101.png"
        path = ISP_ICONS["dir"] / base
        marker = path.with_suffix(path.suffix + ".source")
        if path.exists() and marker.exists() and marker.read_text(encoding="utf-8", errors="ignore").strip() == "2ip":
            return base
    slug_path = ISP_ICONS["dir"] / f"{slugify(isp)}_101x101.png"
    if slug_path.exists():
        return slug_path.name
    return ""


def provider_icon_url(filename):
    return f"/api/asset/providers/{filename}" if filename else ""


def ensure_provider_icon(isp="", asn=""):
    if asn:
        filename = f"{asn}_101x101.png"
        path = ISP_ICONS["dir"] / filename
        marker = path.with_suffix(path.suffix + ".source")
        if marker.exists() and marker.read_text(encoding="utf-8", errors="ignore").strip() == "2ip" and path.exists():
            return filename
        ok, _ = download_url(f"https://static.2ip.io/asn_favicons/{asn}.png", path)
        if ok:
            marker.write_text("2ip\n", encoding="utf-8")
            return filename
    filename = provider_icon_filename(isp, asn)
    if filename:
        return filename
    filename = f"{slugify(isp)}_101x101.png"
    path = ISP_ICONS["dir"] / filename
    if not path.exists() and isp not in ("N/A", "Unknown"):
        path.write_bytes(generated_icon_png(isp))
    return filename if path.exists() else ""


def connection_status(label, iface=None, active_for=None):
    ip = external_ip(iface)
    geo = ip_geo(ip)
    return {
        "label": label,
        "iface": iface or "",
        "ip": ip,
        "country": geo["country"],
        "countryCode": geo["countryCode"],
        "isp": geo["isp"],
        "asn": geo.get("asn", ""),
        "asname": geo.get("asname", ""),
        "icon": provider_icon_url(ensure_provider_icon(geo["isp"], geo.get("asn", ""))),
        "flag": ensure_country_flag(geo["countryCode"]),
        "activeFor": active_for or [],
        "active": bool(active_for),
    }


def wireguard_interfaces():
    result = run(["sh", "-lc", "command -v wg >/dev/null 2>&1 && wg show interfaces || true"], timeout=8)
    if not result["ok"] or not result["output"]:
        return []
    return [item for item in result["output"].split() if item]


def connections_status(projects):
    active_by_iface = {}
    for project in projects:
        iface = project.get("activeIface")
        if iface and iface not in ("unknown", "not configured"):
            active_by_iface.setdefault(iface, []).append(project["title"].replace("UniFi ", ""))

    connections = [connection_status("ISP", active_for=[])]
    names = wg_map_names()
    for iface in wireguard_interfaces():
        active_for = active_by_iface.get(iface, [])
        label = names.get(iface, iface)
        for project in projects:
            if project.get("activeIface") == iface and project.get("activeName") not in ("unknown", "not configured"):
                label = project["activeName"]
                break
        connections.append(connection_status(label, iface=iface, active_for=active_for))
    try:
        generate_provider_icons(connections)
        for item in connections:
            item["icon"] = provider_icon_url(provider_icon_filename(item.get("isp", ""), item.get("asn", "")))
    except OSError:
        pass
    return connections


GLYPHS = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10111", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "10010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["10010", "10010", "10010", "11111", "00010", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
}


def initials(value):
    words = re.findall(r"[A-Za-z0-9]+", value or "")
    if not words:
        return "IP"
    if len(words) == 1:
        return words[0][:2].upper()
    return (words[0][0] + words[1][0]).upper()


def png_chunk(kind, data):
    body = kind + data
    return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)


def generated_icon_png(label, size=101):
    seed = sum(ord(ch) for ch in label)
    bg = ((seed * 37) % 156 + 40, (seed * 53) % 136 + 50, (seed * 71) % 126 + 70)
    fg = (255, 255, 255)
    pixels = [[bg for _ in range(size)] for _ in range(size)]

    text = initials(label)
    scale = 8 if len(text) == 2 else 10
    char_w = 5 * scale
    char_h = 7 * scale
    gap = 2 * scale
    total_w = len(text) * char_w + max(0, len(text) - 1) * gap
    start_x = (size - total_w) // 2
    start_y = (size - char_h) // 2

    for idx, ch in enumerate(text):
        glyph = GLYPHS.get(ch, GLYPHS["I"])
        offset_x = start_x + idx * (char_w + gap)
        for row, pattern in enumerate(glyph):
            for col, bit in enumerate(pattern):
                if bit != "1":
                    continue
                for y in range(start_y + row * scale, start_y + (row + 1) * scale):
                    for x in range(offset_x + col * scale, offset_x + (col + 1) * scale):
                        if 0 <= x < size and 0 <= y < size:
                            pixels[y][x] = fg

    raw = b"".join(b"\x00" + b"".join(bytes(pixel) for pixel in row) for row in pixels)
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + png_chunk(b"IDAT", zlib.compress(raw, 9))
        + png_chunk(b"IEND", b"")
    )


def generate_provider_icons(connections=None):
    connections = connections or connections_status([project_status(key, config) for key, config in PROJECTS.items()])
    ISP_ICONS["dir"].mkdir(parents=True, exist_ok=True)
    created = []
    for item in connections:
        isp = item.get("isp") or item.get("label") or "Provider"
        if isp in ("N/A", "Unknown"):
            continue
        if item.get("asn"):
            filename = f"{item['asn']}_101x101.png"
            path = ISP_ICONS["dir"] / filename
            marker = path.with_suffix(path.suffix + ".source")
            ok, _ = download_url(f"https://static.2ip.io/asn_favicons/{item['asn']}.png", path)
            if ok:
                marker.write_text("2ip\n", encoding="utf-8")
                created.append(filename)
                continue
        filename = f"{slugify(isp)}_101x101.png"
        path = ISP_ICONS["dir"] / filename
        if not path.exists():
            path.write_bytes(generated_icon_png(isp))
            created.append(filename)
    return created


def systemctl(*args):
    return run(["systemctl", *args], timeout=15)


def systemctl_value(*args):
    result = systemctl(*args)
    if result["code"] == 127:
        return "unavailable"
    value = result["output"].splitlines()[0].strip() if result["output"] else "unknown"
    return value or "unknown"


def rules_count(priority, table):
    result = run(
        [
            "sh",
            "-lc",
            f"command -v ip >/dev/null 2>&1 || exit 127; ip rule show | grep '^{priority}:' | grep -F 'lookup {table}' | wc -l",
        ],
        timeout=8,
    )
    if result["ok"]:
        return result["output"].strip() or "0"
    return "unknown"


def iface_friendly_name(iface):
    if not iface:
        return ""
    return wg_map_names().get(iface, iface)


def route_to(target):
    result = run(["sh", "-lc", f"ip route get {target} 2>/dev/null | head -1"], timeout=6)
    line = result["output"] if result["ok"] else ""
    iface = ""
    match = re.search(r"\bdev\s+(\S+)", line)
    if match:
        iface = match.group(1)
    return {"target": target, "iface": iface, "name": iface_friendly_name(iface), "raw": line}


def project_status(key, config):
    base = config["dir"]
    table = read_text(base / "active-table", "unknown")
    iface = read_text(base / "active-iface", "unknown")
    name = read_text(base / "active-name", "not configured")
    log_path = base / config["log"]

    counts = {}
    samples = {}
    for label, filename in config["files"].items():
        entries = list_entries(base / filename)
        counts[label] = len(entries)
        samples[label] = entries[:8]

    timer = systemctl_value("is-active", config["timer"])
    enabled = systemctl_value("is-enabled", config["timer"])

    return {
        "key": key,
        "title": config["title"],
        "configured": (base / "active-name").exists(),
        "activeName": name,
        "activeIface": iface,
        "activeTable": table,
        "timer": timer,
        "enabled": enabled,
        "rules": rules_count(config["priority"], table) if table != "unknown" else "unknown",
        "counts": counts,
        "samples": samples,
        "lastLog": tail(log_path, 1),
        "lastEvent": human_event(tail(log_path, 1)),
    }


def dnscrypt_status():
    base = DNSCRYPT["dir"]
    forwarding = Path("/run/dnscrypt-forwarding.txt")
    proxy_service = "active" if run(["pgrep", "-x", "dnscrypt-proxy"], timeout=3)["ok"] else "inactive"
    domains = len(list_entries(base / "domains.txt"))
    forwarding_rules = len(list_entries(forwarding))
    service = "active" if proxy_service == "active" or forwarding_rules > 0 else proxy_service
    return {
        "service": service,
        "proxyService": proxy_service,
        "domains": domains,
        "samples": list_entries(base / "domains.txt")[:16],
        "forwarding": forwarding_rules,
        "timer": systemctl_value("is-active", "ubnt-dnscrypt.timer"),
        "enabled": systemctl_value("is-enabled", "ubnt-dnscrypt.timer"),
        "route": route_to("1.1.1.1"),
        "lastLog": tail(base / DNSCRYPT["log"], 1),
        "lastEvent": human_event(tail(base / DNSCRYPT["log"], 1)),
    }


def isp_icons_status():
    base = ISP_ICONS["dir"]
    icons = []
    try:
        icons = sorted(path.name for path in base.glob("*_101x101.png"))
    except OSError:
        pass
    return {
        "directory": str(base),
        "exists": base.exists(),
        "icons": len(icons),
        "items": [{"name": name, "url": provider_icon_url(name)} for name in icons],
        "lastLog": tail(base / ISP_ICONS["log"], 1),
        "lastEvent": human_event(tail(base / ISP_ICONS["log"], 1)),
    }


def editable_payload():
    files = {}
    for key, path in EDITABLE_FILES.items():
        files[key] = {
            "key": key,
            "path": str(path),
            "exists": path.exists(),
            "content": read_text(path, ""),
        }
    return {"files": files}


def save_editable_file(key, content):
    path = EDITABLE_FILES.get(key)
    if not path:
        return {"ok": False, "output": "Unknown editable file"}
    if "\x00" in content:
        return {"ok": False, "output": "Invalid content"}

    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        backup = path.with_name(f"{path.name}.bak-web-{time.strftime('%Y%m%d-%H%M%S')}")
        backup.write_text(path.read_text(encoding="utf-8", errors="replace"), encoding="utf-8")
    path.write_text(content.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n", encoding="utf-8")

    if key == "cloud.networks":
        update_result = run(["sh", str(ROOT / "ubnt-cloud" / "update-aws-networks.sh")], timeout=120)
        return {"ok": update_result["ok"], "output": f"Saved {path}\n{update_result['output']}".strip()}

    return {"ok": True, "output": f"Saved {path}"}


def download_asset(kind, url, filename):
    name = safe_asset_name(filename, allowed=(".png", ".svg", ".ico"))
    if not name:
        return {"ok": False, "output": "Allowed formats: png, svg, ico. Use a safe file name."}
    if kind == "country":
        path = ISP_ICONS["dir"] / "flags" / name
    elif kind == "provider":
        if not name.endswith("_101x101.png") and name.endswith(".png"):
            name = f"{Path(name).stem}_101x101.png"
        path = ISP_ICONS["dir"] / name
    else:
        return {"ok": False, "output": "Unknown asset type"}
    ok, output = download_url(url, path)
    return {"ok": ok, "output": output}


def status_payload():
    projects = [project_status(key, config) for key, config in PROJECTS.items()]
    return {
        "root": str(ROOT),
        "host": HOST,
        "port": PORT,
        "web": {
            "service": systemctl_value("is-active", WEB_SERVICE),
            "enabled": systemctl_value("is-enabled", WEB_SERVICE),
        },
        "generatedAt": int(time.time()),
        "projects": projects,
        "connections": connections_status(projects),
        "dnscrypt": dnscrypt_status(),
        "ispIcons": isp_icons_status(),
    }


def action_command(action):
    commands = {
        "cloud.start": [
            ["systemctl", "enable", "ubnt-cloud-routes.timer"],
            ["systemctl", "start", "ubnt-cloud-routes.timer"],
            ["systemctl", "start", "ubnt-cloud-routes.service"],
        ],
        "cloud.restart": [["systemctl", "start", "ubnt-cloud-routes.service"]],
        "cloud.stop": [
            ["systemctl", "stop", "ubnt-cloud-routes.timer"],
            ["systemctl", "disable", "ubnt-cloud-routes.timer"],
            ["systemctl", "stop", "ubnt-cloud-routes.service"],
            ["sh", "-lc", "ip rule show | grep '^100:' | while read -r line; do rule=$(echo \"$line\" | sed 's/^[0-9]\\+:[[:space:]]*//'); ip rule del $rule 2>/dev/null || true; done"],
        ],
        "updates.start": [
            ["systemctl", "enable", "ubnt-updates-routes.timer"],
            ["systemctl", "start", "ubnt-updates-routes.timer"],
            ["systemctl", "start", "ubnt-updates-routes.service"],
        ],
        "updates.restart": [["systemctl", "start", "ubnt-updates-routes.service"]],
        "updates.stop": [
            ["systemctl", "stop", "ubnt-updates-routes.timer"],
            ["systemctl", "disable", "ubnt-updates-routes.timer"],
            ["systemctl", "stop", "ubnt-updates-routes.service"],
            ["sh", "-lc", "ip rule show | grep '^110:' | while read -r line; do rule=$(echo \"$line\" | sed 's/^[0-9]\\+:[[:space:]]*//'); ip rule del $rule 2>/dev/null || true; done"],
        ],
        "dnscrypt.start": [
            ["systemctl", "enable", "ubnt-dnscrypt.timer"],
            ["systemctl", "start", "ubnt-dnscrypt.timer"],
            ["sh", str(DNSCRYPT["script"]), "update"],
        ],
        "dnscrypt.update": [["sh", str(DNSCRYPT["script"]), "update"]],
        "dnscrypt.extract": [["sh", str(DNSCRYPT["script"]), "extract"]],
        "dnscrypt.generate": [["sh", str(DNSCRYPT["script"]), "generate"]],
        "dnscrypt.restart": [["sh", str(DNSCRYPT["script"]), "update"]],
        "dnscrypt.flush-cache": [["sh", str(DNSCRYPT["script"]), "flush-cache"]],
        "dnscrypt.stop": [
            ["systemctl", "stop", "ubnt-dnscrypt.timer"],
            ["systemctl", "disable", "ubnt-dnscrypt.timer"],
            ["sh", str(DNSCRYPT["script"]), "stop"],
        ],
        "icons.install": [["sh", str(ISP_ICONS["script"])]],
        "icons.uninstall": [["sh", str(ISP_ICONS["script"]), "uninstall"]],
        "system.update": [["systemctl", "--no-block", "start", "unifi-routing-update.service"]],
    }
    return commands.get(action)


def perform_action(action):
    if action == "icons.discover":
        projects = [project_status(key, config) for key, config in PROJECTS.items()]
        created = generate_provider_icons(connections_status(projects))
        install = run(["sh", str(ISP_ICONS["script"])], timeout=90)
        return {
            "ok": install["ok"],
            "output": f"Generated icons: {', '.join(created) if created else 'already up to date'}\n{install['output']}".strip(),
        }

    commands = action_command(action)
    if not commands:
        return {"ok": False, "output": "Unknown action"}

    output = []
    ok = True
    for command in commands:
        result = run(command, timeout=90)
        ok = ok and result["ok"]
        output.append(f"$ {' '.join(command)}\n{result['output']}".strip())
        if not result["ok"]:
            break
    return {"ok": ok, "output": "\n\n".join(output)}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(APP_DIR / "static"), **kwargs)

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def is_authenticated(self):
        cookies = parse_cookies(self.headers.get("Cookie", ""))
        return verify_session(cookies.get("urm_session"))

    def require_auth(self):
        if self.is_authenticated():
            return True
        self.send_json({"ok": False, "output": "Unauthorized"}, 401)
        return False

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/auth/me":
            config = ensure_auth_config()
            self.send_json({
                "authenticated": self.is_authenticated(),
                "name": config.get("name", ""),
                "username": config.get("username", ""),
                "avatar": avatar_url(config),
            })
            return
        if parsed.path.startswith("/api/avatar/"):
            filename = safe_asset_name(Path(parsed.path).name, allowed=(".png", ".jpg", ".jpeg"))
            path = AVATAR_DIR / filename if filename else None
            if not path or not path.exists():
                self.send_error(404)
                return
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/jpeg" if path.suffix.lower() in (".jpg", ".jpeg") else "image/png")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path.startswith("/api/") and not self.require_auth():
            return
        if parsed.path == "/api/status":
            self.send_json(status_payload())
            return
        if parsed.path == "/api/files":
            self.send_json(editable_payload())
            return
        if parsed.path.startswith("/api/asset/providers/"):
            filename = Path(parsed.path).name
            path = ISP_ICONS["dir"] / filename
            if not re.match(r"^[A-Za-z0-9_.-]+_101x101\.png$", filename) or not path.exists():
                self.send_error(404)
                return
            body = path.read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path.startswith("/api/asset/flags/"):
            filename = Path(parsed.path).name
            path = ISP_ICONS["dir"] / "flags" / filename
            if not safe_asset_name(filename, allowed=(".png", ".svg", ".ico")) or not path.exists():
                self.send_error(404)
                return
            body = path.read_bytes()
            content_type = "image/svg+xml" if path.suffix.lower() == ".svg" else "image/x-icon" if path.suffix.lower() == ".ico" else "image/png"
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/logs":
            query = parse_qs(parsed.query)
            target = query.get("target", ["cloud"])[0]
            lines = min(int(query.get("lines", ["120"])[0]), 500)
            log_paths = {
                "cloud": PROJECTS["cloud"]["dir"] / PROJECTS["cloud"]["log"],
                "updates": PROJECTS["updates"]["dir"] / PROJECTS["updates"]["log"],
                "dnscrypt": DNSCRYPT["dir"] / DNSCRYPT["log"],
                "icons": ISP_ICONS["dir"] / ISP_ICONS["log"],
            }
            path = log_paths.get(target)
            self.send_json({"target": target, "log": tail(path, lines) if path else ""})
            return
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path not in ("/api/action", "/api/files", "/api/auth/login", "/api/auth/logout", "/api/auth/avatar", "/api/assets/download"):
            self.send_json({"ok": False, "output": "Not found"}, 404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_json({"ok": False, "output": "Invalid JSON"}, 400)
            return
        if parsed.path == "/api/auth/login":
            config = ensure_auth_config()
            if payload.get("username") == config.get("username") and verify_password(payload.get("password", ""), config):
                session = make_session(config["username"])
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Set-Cookie", f"urm_session={session}; Path=/; HttpOnly; SameSite=Lax; Max-Age={SESSION_TTL}")
                body = json.dumps({"ok": True, "name": config.get("name", ""), "avatar": avatar_url(config)}, ensure_ascii=False).encode("utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            self.send_json({"ok": False, "output": "Invalid login or password"}, 403)
            return
        if parsed.path == "/api/auth/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", "urm_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax")
            body = b'{"ok": true}'
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if not self.require_auth():
            return
        if parsed.path == "/api/auth/avatar":
            filename = safe_asset_name(payload.get("filename", ""), allowed=(".png", ".jpg", ".jpeg"))
            data_url = payload.get("data", "")
            if not filename or "," not in data_url:
                self.send_json({"ok": False, "output": "Invalid avatar"}, 400)
                return
            try:
                raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
            except ValueError:
                self.send_json({"ok": False, "output": "Invalid avatar data"}, 400)
                return
            if len(raw) > 512 * 1024:
                self.send_json({"ok": False, "output": "Avatar is too large"}, 400)
                return
            AVATAR_DIR.mkdir(parents=True, exist_ok=True)
            path = AVATAR_DIR / filename
            path.write_bytes(raw)
            config = ensure_auth_config()
            config["avatar"] = str(path)
            write_json(AUTH_FILE, config)
            self.send_json({"ok": True, "avatar": avatar_url(config)})
            return
        if parsed.path == "/api/assets/download":
            self.send_json(download_asset(payload.get("kind", ""), payload.get("url", ""), payload.get("filename", "")))
            return
        if parsed.path == "/api/files":
            self.send_json(save_editable_file(payload.get("key", ""), payload.get("content", "")))
            return
        self.send_json(perform_action(payload.get("action", "")))


def main():
    try:
        ensure_auth_config()
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)

    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as error:
        if error.errno == 98:
            print(f"Port {PORT} is already in use.")
            print(f"Try another port: UNIFI_WEB_PORT=8091 python3 web/server.py")
            sys.exit(1)
        raise
    display_host = "device-lan-ip" if HOST == "0.0.0.0" else HOST
    print(f"UniFi Routing Web UI: http://{display_host}:{PORT}")
    print(f"Bind address: {HOST}")
    print(f"Data root: {ROOT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
