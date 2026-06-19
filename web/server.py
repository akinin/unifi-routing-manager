#!/usr/bin/env python3
import json
import os
import sys
import subprocess
import time
import re
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


APP_DIR = Path(__file__).resolve().parent
ROOT = Path(os.environ.get("UNIFI_ROUTING_ROOT", "/persistent")).resolve()
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
}

WEB_SERVICE = "unifi-routing-web.service"
NET_CACHE = {}
NET_CACHE_LOCK = threading.Lock()


def read_text(path, default=""):
    try:
        return path.read_text(encoding="utf-8", errors="replace").strip()
    except OSError:
        return default


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
        (r"^dnscrypt-proxy restarted OK$", "DNSCrypt service restarted"),
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
            return {"country": "N/A", "countryCode": "N/A", "isp": "N/A"}

        result = run(
            ["curl", "--connect-timeout", "3", "-sS", f"http://ip-api.com/json/{ip}?fields=country,countryCode,isp"],
            timeout=6,
        )
        if not result["ok"] or not result["output"]:
            return {"country": "Unknown", "countryCode": "Unknown", "isp": "Unknown"}

        try:
            data = json.loads(result["output"])
        except json.JSONDecodeError:
            return {"country": "Unknown", "countryCode": "Unknown", "isp": "Unknown"}

        return {
            "country": data.get("country") or "Unknown",
            "countryCode": data.get("countryCode") or "Unknown",
            "isp": data.get("isp") or "Unknown",
        }

    return cached_value(key, 3600, produce)


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

    connections = [connection_status("Direct", active_for=[])]
    for iface in wireguard_interfaces():
        active_for = active_by_iface.get(iface, [])
        label = iface
        for project in projects:
            if project.get("activeIface") == iface and project.get("activeName") not in ("unknown", "not configured"):
                label = project["activeName"]
                break
        connections.append(connection_status(label, iface=iface, active_for=active_for))
    return connections


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
    proxy_service = systemctl_value("is-active", "dnscrypt-proxy")
    domains = len(list_entries(base / "domains.txt"))
    forwarding_rules = len(list_entries(forwarding))
    service = "active" if proxy_service == "active" or forwarding_rules > 0 else proxy_service
    return {
        "service": service,
        "proxyService": proxy_service,
        "domains": domains,
        "forwarding": forwarding_rules,
        "lastLog": tail(base / DNSCRYPT["log"], 1),
        "lastEvent": human_event(tail(base / DNSCRYPT["log"], 1)),
    }


def isp_icons_status():
    base = ISP_ICONS["dir"]
    icons = 0
    try:
        icons = len(list(base.glob("*_101x101.png")))
    except OSError:
        pass
    return {
        "directory": str(base),
        "exists": base.exists(),
        "icons": icons,
        "lastLog": tail(base / ISP_ICONS["log"], 1),
        "lastEvent": human_event(tail(base / ISP_ICONS["log"], 1)),
    }


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
        "dnscrypt.update": [["sh", str(DNSCRYPT["script"]), "update"]],
        "dnscrypt.extract": [["sh", str(DNSCRYPT["script"]), "extract"]],
        "dnscrypt.generate": [["sh", str(DNSCRYPT["script"]), "generate"]],
        "dnscrypt.restart": [["sh", str(DNSCRYPT["script"]), "restart"]],
        "icons.install": [["sh", str(ISP_ICONS["script"])]],
    }
    return commands.get(action)


def perform_action(action):
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

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/status":
            self.send_json(status_payload())
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
        if parsed.path != "/api/action":
            self.send_json({"ok": False, "output": "Not found"}, 404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_json({"ok": False, "output": "Invalid JSON"}, 400)
            return
        self.send_json(perform_action(payload.get("action", "")))


def main():
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
