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
import binascii
import csv
import io
import ipaddress
import tarfile
import tempfile
import difflib
import urllib.request
import urllib.error
import socket
import ssl
from concurrent.futures import ThreadPoolExecutor
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


APP_DIR = Path(__file__).resolve().parent
PROJECT_HOME = APP_DIR.parent
ROOT = Path(os.environ.get("UNIFI_ROUTING_ROOT", "/persistent/unifi-routing-manager")).resolve()
HOST = os.environ.get("UNIFI_WEB_HOST", "0.0.0.0")
PORT = int(os.environ.get("UNIFI_WEB_PORT", "8090"))
PUBLIC_URL = os.environ.get("UNIFI_PUBLIC_URL", "").rstrip("/")

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
            "networks": "networks-manual.txt",
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
AUTH_FILE = ROOT / "urm-auth.json"
AVATAR_DIR = ROOT / "web-data"
SESSION_TTL = 86400
BACKUP_DIR = ROOT / "backups"
BACKUP_LIMIT = 20
MONITOR_FILE = ROOT / "monitor-history.json"
NOTIFICATION_FILE = ROOT / "notification-settings.json"
EVENT_FILE = ROOT / "events.json"
GEO_CACHE_FILE = ROOT / "geo-cache.json"
MONITOR_LOCK = threading.Lock()
EVENT_LOCK = threading.Lock()
GEO_LOCK = threading.Lock()
MONITOR_INTERVAL = 60
EVENT_LIMIT = 500
WEBAUTHN_CHALLENGES = {}
WEBAUTHN_LOCK = threading.Lock()
LOGIN_ATTEMPTS = {}
LOGIN_ATTEMPTS_LOCK = threading.Lock()
EDITABLE_FILES = {
    "cloud.domains": ROOT / "ubnt-cloud" / "domains.txt",
    "cloud.networks": ROOT / "ubnt-cloud" / "networks-manual.txt",
    "updates.domains": ROOT / "ubnt-updates" / "update-domains.txt",
    "updates.networks": ROOT / "ubnt-updates" / "networks-manual.txt",
    "wg.map": ROOT / "wg-map.conf",
}
VIEW_ONLY_FILES = {
    "dnscrypt.domains": {
        "path": ROOT / "ubnt-dnscrypt" / "domains.txt",
        "description": "Generated from the Cloud and Updates domain lists. Edit those source lists to change DNSCrypt forwarding.",
    },
}

CONFIG_BACKUP_PATHS = tuple(dict.fromkeys((*EDITABLE_FILES.values(), NOTIFICATION_FILE)))


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


def atomic_write_text(path, content, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.tmp-{os.getpid()}-{secrets.token_hex(3)}")
    try:
        temp.write_text(content, encoding="utf-8")
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        try:
            temp.unlink()
        except OSError:
            pass


def editable_lines(content):
    return [line.strip() for line in content.replace("\r\n", "\n").replace("\r", "\n").splitlines() if line.strip() and not line.lstrip().startswith("#")]


def change_preview(key, content):
    path = EDITABLE_FILES.get(key)
    before = read_text(path, "").splitlines() if path else []
    after = content.replace("\r\n", "\n").replace("\r", "\n").strip().splitlines()
    diff = list(difflib.unified_diff(before, after, fromfile="current", tofile="new", lineterm=""))
    added = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++"))
    removed = sum(1 for line in diff if line.startswith("-") and not line.startswith("---"))
    return {"changed": bool(diff), "added": added, "removed": removed, "diff": "\n".join(diff[:160])}


def validate_editable_content(key, content):
    if key not in EDITABLE_FILES:
        return {"ok": False, "errors": ["Unknown editable file"], "warnings": [], "entries": 0, "preview": {}}
    if not isinstance(content, str) or "\x00" in content or len(content.encode("utf-8")) > 1024 * 1024:
        return {"ok": False, "errors": ["Invalid or oversized content"], "warnings": [], "entries": 0, "preview": {}}

    lines = editable_lines(content)
    errors = []
    warnings = []
    seen = set()
    for number, value in enumerate(lines, 1):
        if value in seen:
            warnings.append(f"Duplicate entry: {value}")
        seen.add(value)
        if key.endswith(".domains"):
            domain = value[2:] if value.startswith("*.") else value
            if len(domain) > 253 or not re.match(r"^(?=.{1,253}$)(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$", domain):
                errors.append(f"Line {number}: invalid domain '{value}'")
        elif key.endswith(".networks"):
            try:
                network = ipaddress.ip_network(value, strict=False)
                if network.version != 4:
                    errors.append(f"Line {number}: only IPv4 networks are supported")
            except ValueError:
                errors.append(f"Line {number}: invalid network '{value}'")

    if key == "wg.map":
        tables = set()
        interfaces = set()
        for number, value in enumerate(lines, 1):
            parts = value.split(None, 2)
            if len(parts) != 3:
                errors.append(f"Line {number}: expected <table> <interface> <name>")
                continue
            table, iface, name = parts
            if not re.match(r"^[A-Za-z0-9_.-]+$", table):
                errors.append(f"Line {number}: invalid table '{table}'")
            if not re.match(r"^[A-Za-z0-9_.:-]+$", iface):
                errors.append(f"Line {number}: invalid interface '{iface}'")
            if not name.strip():
                errors.append(f"Line {number}: route name is empty")
            if table in tables:
                errors.append(f"Line {number}: duplicate table '{table}'")
            if iface in interfaces:
                errors.append(f"Line {number}: duplicate interface '{iface}'")
            tables.add(table)
            interfaces.add(iface)
            if not Path("/sys/class/net", iface).exists():
                warnings.append(f"Interface {iface} is not currently present")

    if not lines:
        errors.append("At least one entry is required")
    return {"ok": not errors, "errors": errors, "warnings": list(dict.fromkeys(warnings)), "entries": len(lines), "preview": change_preview(key, content)}


def backup_item(path):
    metadata = read_json(path.with_suffix(".json"), {})
    stat = path.stat()
    return {
        "id": path.name,
        "createdAt": metadata.get("createdAt", int(stat.st_mtime)),
        "reason": metadata.get("reason", "manual"),
        "size": stat.st_size,
    }


def list_config_backups():
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    items = []
    for path in BACKUP_DIR.glob("config-*.tar.gz"):
        try:
            items.append(backup_item(path))
        except OSError:
            continue
    return sorted(items, key=lambda item: item["createdAt"], reverse=True)


def create_config_backup(reason="manual"):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = time.strftime("%Y%m%d-%H%M%S")
    path = BACKUP_DIR / f"config-{stamp}-{secrets.token_hex(2)}.tar.gz"
    with tarfile.open(path, "w:gz") as archive:
        for source in CONFIG_BACKUP_PATHS:
            if source.exists():
                archive.add(source, arcname=str(source.relative_to(ROOT)), recursive=False)
    metadata = {"createdAt": int(time.time()), "reason": str(reason)[:160] or "manual"}
    write_json(path.with_suffix(".json"), metadata)
    backups = list_config_backups()
    for old in backups[BACKUP_LIMIT:]:
        old_path = BACKUP_DIR / old["id"]
        for candidate in (old_path, old_path.with_suffix(".json")):
            try:
                candidate.unlink()
            except OSError:
                pass
    return backup_item(path)


def restore_config_backup(backup_id):
    if not re.match(r"^config-[0-9]{8}-[0-9]{6}-[a-f0-9]{4}\.tar\.gz$", backup_id or ""):
        return {"ok": False, "output": "Invalid backup identifier"}
    path = BACKUP_DIR / backup_id
    if not path.exists():
        return {"ok": False, "output": "Backup not found"}
    allowed = {str(item.relative_to(ROOT)): item for item in CONFIG_BACKUP_PATHS}
    create_config_backup(f"before restore {backup_id}")
    restored = []
    try:
        with tarfile.open(path, "r:gz") as archive:
            for member in archive.getmembers():
                target = allowed.get(member.name)
                if not target or not member.isfile():
                    raise ValueError(f"Unexpected backup entry: {member.name}")
                source = archive.extractfile(member)
                if source is None:
                    raise ValueError(f"Cannot read backup entry: {member.name}")
                atomic_write_text(target, source.read().decode("utf-8"), 0o600)
                restored.append(member.name)
    except (OSError, tarfile.TarError, UnicodeDecodeError, ValueError) as error:
        return {"ok": False, "output": f"Restore failed: {error}"}
    results = []
    for service in ("ubnt-cloud-routes.service", "ubnt-updates-routes.service", "ubnt-dnscrypt.service"):
        results.append(systemctl("start", service))
    ok = all(result["ok"] for result in results)
    return {"ok": ok, "output": f"Restored {len(restored)} files" + ("" if ok else "; one or more services failed to restart")}


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


def update_auth_credentials(payload):
    config = ensure_auth_config()
    current_password = str(payload.get("currentPassword", ""))
    username = str(payload.get("username", "")).strip()
    new_password = str(payload.get("newPassword", ""))

    if not verify_password(current_password, config):
        return False, "Current password is incorrect", None
    if not username or len(username) > 64 or re.search(r"[\s:]", username):
        return False, "Login must be 1-64 characters without spaces or colons", None
    if new_password and len(new_password) < 8:
        return False, "New password must contain at least 8 characters", None
    if username == config.get("username") and not new_password:
        return False, "No account changes were provided", None

    updated = dict(config)
    updated["username"] = username
    if new_password:
        salt, digest = hash_password(new_password)
        updated["passwordSalt"] = salt
        updated["passwordHash"] = digest
        updated["passwordIterations"] = 210000

    updated["sessionSecret"] = secrets.token_hex(32)
    write_json(AUTH_FILE, updated)
    os.chmod(AUTH_FILE, 0o600)
    return True, "Login and password settings updated", updated


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
    try:
        expired = int(expires) < int(time.time())
    except ValueError:
        return False
    if username != config.get("username") or expired:
        return False
    payload = f"{username}:{expires}"
    expected = hmac.new(config["sessionSecret"].encode("ascii"), payload.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(signature, expected)


def login_allowed(address):
    now = time.time()
    with LOGIN_ATTEMPTS_LOCK:
        recent = [stamp for stamp in LOGIN_ATTEMPTS.get(address, []) if now - stamp < 300]
        LOGIN_ATTEMPTS[address] = recent
        return len(recent) < 5


def record_login_failure(address):
    with LOGIN_ATTEMPTS_LOCK:
        LOGIN_ATTEMPTS.setdefault(address, []).append(time.time())


def clear_login_failures(address):
    with LOGIN_ATTEMPTS_LOCK:
        LOGIN_ATTEMPTS.pop(address, None)


def b64url_encode(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def b64url_decode(value):
    raw = str(value or "").encode("ascii")
    return base64.urlsafe_b64decode(raw + b"=" * (-len(raw) % 4))


def new_webauthn_challenge(kind, rp_id, origin, username=""):
    token = secrets.token_urlsafe(24)
    challenge = secrets.token_bytes(32)
    with WEBAUTHN_LOCK:
        now = time.time()
        for key, item in list(WEBAUTHN_CHALLENGES.items()):
            if item["expires"] < now:
                WEBAUTHN_CHALLENGES.pop(key, None)
        WEBAUTHN_CHALLENGES[token] = {
            "kind": kind,
            "challenge": challenge,
            "rpId": rp_id,
            "origin": origin,
            "username": username,
            "expires": now + 180,
        }
    return token, challenge


def take_webauthn_challenge(token, kind):
    with WEBAUTHN_LOCK:
        item = WEBAUTHN_CHALLENGES.pop(str(token or ""), None)
    if not item or item["kind"] != kind or item["expires"] < time.time():
        raise ValueError("Passkey challenge expired or invalid")
    return item


def cbor_decode(data, offset=0):
    if offset >= len(data):
        raise ValueError("Unexpected end of CBOR data")
    initial = data[offset]
    offset += 1
    major = initial >> 5
    additional = initial & 31
    if additional < 24:
        length = additional
    elif additional == 24:
        length, offset = data[offset], offset + 1
    elif additional == 25:
        length, offset = struct.unpack(">H", data[offset:offset + 2])[0], offset + 2
    elif additional == 26:
        length, offset = struct.unpack(">I", data[offset:offset + 4])[0], offset + 4
    elif additional == 27:
        length, offset = struct.unpack(">Q", data[offset:offset + 8])[0], offset + 8
    else:
        raise ValueError("Unsupported CBOR length")
    if major == 0:
        return length, offset
    if major == 1:
        return -1 - length, offset
    if major in (2, 3):
        end = offset + length
        if end > len(data):
            raise ValueError("Truncated CBOR value")
        value = data[offset:end]
        return (value if major == 2 else value.decode("utf-8")), end
    if major == 4:
        result = []
        for _ in range(length):
            value, offset = cbor_decode(data, offset)
            result.append(value)
        return result, offset
    if major == 5:
        result = {}
        for _ in range(length):
            key, offset = cbor_decode(data, offset)
            value, offset = cbor_decode(data, offset)
            result[key] = value
        return result, offset
    if major == 7 and additional in (20, 21, 22):
        return ({20: False, 21: True, 22: None}[additional]), offset
    raise ValueError("Unsupported CBOR type")


def public_key_pem_from_cose(cose):
    if cose.get(1) != 2 or cose.get(3) != -7 or cose.get(-1) != 1:
        raise ValueError("Only ES256 passkeys are supported")
    x = cose.get(-2, b"")
    y = cose.get(-3, b"")
    if len(x) != 32 or len(y) != 32:
        raise ValueError("Invalid passkey public key")
    # SubjectPublicKeyInfo for id-ecPublicKey / prime256v1 and an uncompressed EC point.
    der = bytes.fromhex("3059301306072a8648ce3d020106082a8648ce3d03010703420004") + x + y
    encoded = base64.b64encode(der).decode("ascii")
    return "-----BEGIN PUBLIC KEY-----\n" + "\n".join(encoded[index:index + 64] for index in range(0, len(encoded), 64)) + "\n-----END PUBLIC KEY-----\n"


def verify_client_data(encoded, challenge, expected_type, origin):
    raw = b64url_decode(encoded)
    data = json.loads(raw.decode("utf-8"))
    if data.get("type") != expected_type or not hmac.compare_digest(data.get("challenge", ""), b64url_encode(challenge)):
        raise ValueError("Invalid Passkey client data")
    if data.get("origin") != origin:
        raise ValueError("Passkey origin mismatch")
    return raw


def parse_registration_auth_data(attestation_object, rp_id):
    attestation, _ = cbor_decode(attestation_object)
    auth_data = attestation.get("authData", b"") if isinstance(attestation, dict) else b""
    if len(auth_data) < 55 or not (auth_data[32] & 0x40):
        raise ValueError("Passkey attestation is missing credential data")
    if not hmac.compare_digest(auth_data[:32], hashlib.sha256(rp_id.encode("utf-8")).digest()):
        raise ValueError("Passkey RP ID mismatch")
    credential_length = struct.unpack(">H", auth_data[53:55])[0]
    end = 55 + credential_length
    credential_id = auth_data[55:end]
    cose, _ = cbor_decode(auth_data, end)
    return credential_id, public_key_pem_from_cose(cose), struct.unpack(">I", auth_data[33:37])[0]


def verify_passkey_assertion(passkey, response, challenge):
    client_data = verify_client_data(response.get("clientDataJSON", ""), challenge["challenge"], "webauthn.get", challenge["origin"])
    auth_data = b64url_decode(response.get("authenticatorData", ""))
    signature = b64url_decode(response.get("signature", ""))
    if len(auth_data) < 37 or not (auth_data[32] & 0x01):
        raise ValueError("Passkey user presence was not verified")
    expected_rp = hashlib.sha256(challenge["rpId"].encode("utf-8")).digest()
    if not hmac.compare_digest(auth_data[:32], expected_rp):
        raise ValueError("Passkey RP ID mismatch")
    signed = auth_data + hashlib.sha256(client_data).digest()
    with tempfile.TemporaryDirectory(prefix="urm-passkey-") as directory:
        key_path = Path(directory) / "key.pem"
        data_path = Path(directory) / "data.bin"
        signature_path = Path(directory) / "signature.bin"
        key_path.write_text(passkey["publicKeyPem"], encoding="ascii")
        data_path.write_bytes(signed)
        signature_path.write_bytes(signature)
        result = run(["openssl", "dgst", "-sha256", "-verify", str(key_path), "-signature", str(signature_path), str(data_path)], timeout=8)
    if not result["ok"]:
        raise ValueError("Passkey signature verification failed")
    return struct.unpack(">I", auth_data[33:37])[0]


def avatar_url(config=None):
    config = config or ensure_auth_config()
    avatar = config.get("avatar") or ""
    return f"/api/avatar/{Path(avatar).name}" if avatar else ""


def brand_logo_url(config=None):
    config = config or ensure_auth_config()
    logo = config.get("logo") or ""
    if not logo:
        return ""
    path = Path(logo)
    if path.parent != AVATAR_DIR or path.suffix.lower() not in (".png", ".jpg", ".jpeg"):
        return ""
    try:
        version = path.stat().st_mtime_ns
    except OSError:
        return ""
    return f"/api/brand/{path.name}?v={version}"


def decode_uploaded_image(payload, max_size=512 * 1024):
    data_url = str(payload.get("data", ""))
    if "," not in data_url:
        return None, "", "Invalid image"
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1], validate=True)
    except (ValueError, TypeError):
        return None, "", "Invalid image data"
    if len(raw) > max_size:
        return None, "", "Image is too large"
    if raw.startswith(b"\x89PNG\r\n\x1a\n"):
        return raw, ".png", ""
    if raw.startswith(b"\xff\xd8\xff"):
        return raw, ".jpg", ""
    return None, "", "Only PNG and JPEG images are supported"


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
        if lines <= 0:
            return ""
        with path.open("rb") as handle:
            handle.seek(0, os.SEEK_END)
            position = handle.tell()
            chunks = []
            newline_count = 0
            while position > 0 and newline_count <= lines:
                size = min(8192, position)
                position -= size
                handle.seek(position)
                chunk = handle.read(size)
                chunks.append(chunk)
                newline_count += chunk.count(b"\n")
        data = b"".join(reversed(chunks)).decode("utf-8", errors="replace").splitlines()
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


def cached_value(key, ttl, producer, cache_if=None):
    now = time.time()
    with NET_CACHE_LOCK:
        cached = NET_CACHE.get(key)
        if cached and now - cached["time"] < ttl:
            return cached["value"]

    value = producer()
    if cache_if is None or cache_if(value):
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

    return cached_value(key, 60, produce)


def ip_geo(ip):
    key = f"ip-geo:{ip}"

    def produce():
        if not ip or ip == "N/A":
            return {"country": "N/A", "countryCode": "N/A", "isp": "N/A", "asn": "", "asname": ""}

        sources = [
            (f"http://ip-api.com/json/{ip}?fields=status,country,countryCode,isp,as,asname", "ip-api"),
            (f"https://ipwho.is/{ip}", "ipwhois"),
        ]
        geo = None
        for url, source in sources:
            result = run(["curl", "-4", "--connect-timeout", "3", "--max-time", "6", "-sS", url], timeout=8)
            if not result["ok"] or not result["output"]:
                continue
            try:
                data = json.loads(result["output"])
            except json.JSONDecodeError:
                continue
            if source == "ip-api" and data.get("status") != "success":
                continue
            if source == "ipwhois" and not data.get("success"):
                continue
            if source == "ip-api":
                as_text = data.get("as") or ""
                asn_match = re.search(r"\bAS(\d+)\b", as_text)
                geo = {"country": data.get("country"), "countryCode": data.get("countryCode"), "isp": data.get("isp"), "asn": asn_match.group(1) if asn_match else "", "asname": data.get("asname") or ""}
            else:
                connection = data.get("connection") or {}
                geo = {"country": data.get("country"), "countryCode": data.get("country_code"), "isp": connection.get("isp") or connection.get("org"), "asn": str(connection.get("asn") or ""), "asname": connection.get("org") or ""}
            if geo.get("countryCode") and geo.get("isp"):
                geo = {key: value or "" for key, value in geo.items()}
                with GEO_LOCK:
                    persistent = read_json(GEO_CACHE_FILE, {})
                    persistent[ip] = {"time": int(time.time()), **geo}
                    write_json(GEO_CACHE_FILE, persistent)
                return geo
        with GEO_LOCK:
            stale = read_json(GEO_CACHE_FILE, {}).get(ip)
        if stale:
            return {key: stale.get(key, "") for key in ("country", "countryCode", "isp", "asn", "asname")}
        return {"country": "Unknown", "countryCode": "Unknown", "isp": "Unknown", "asn": "", "asname": ""}

    return cached_value(key, 3600, produce, lambda value: value.get("countryCode") not in ("", "Unknown", "N/A") and value.get("isp") not in ("", "Unknown", "N/A"))


def slugify(value):
    value = (value or "").strip().lower()
    value = re.sub(r"[^a-z0-9]+", "_", value)
    return value.strip("_") or "provider"


def provider_aliases(isp="", asname=""):
    aliases = []
    for value in (isp, asname):
        value = (value or "").strip()
        if not value:
            continue
        candidates = [value]
        candidates.append(
            re.sub(
                r"\s+(?:ltd\.?|llc|inc\.?|corp\.?|corporation|company|co\.?|pjsc|jsc|ooo|oao|zao)$",
                "",
                value,
                flags=re.IGNORECASE,
            ).strip()
        )
        for candidate in candidates:
            alias = slugify(candidate)
            if alias != "provider" and alias not in aliases:
                aliases.append(alias)
    return aliases


def write_provider_aliases(asn, isp="", asname=""):
    if not asn or not re.match(r"^\d+$", str(asn)):
        return
    aliases = provider_aliases(isp, asname)
    if aliases:
        ISP_ICONS["dir"].mkdir(parents=True, exist_ok=True)
        path = ISP_ICONS["dir"] / f"{asn}_101x101.png.aliases"
        path.write_text("\n".join(aliases) + "\n", encoding="utf-8")


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
        if path.exists():
            return base
    slug_path = ISP_ICONS["dir"] / f"{slugify(isp)}_101x101.png"
    if slug_path.exists():
        return slug_path.name
    return ""


def provider_icon_url(filename):
    return f"/api/asset/providers/{filename}" if filename else ""


def ensure_provider_icon(isp="", asn="", asname=""):
    if asn:
        filename = f"{asn}_101x101.png"
        path = ISP_ICONS["dir"] / filename
        marker = path.with_suffix(path.suffix + ".source")
        write_provider_aliases(asn, isp, asname)
        if path.exists():
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
        "type": "wireguard" if (iface or "").startswith("wg") else "wan",
        "ip": ip,
        "country": geo["country"],
        "countryCode": geo["countryCode"],
        "isp": geo["isp"],
        "asn": geo.get("asn", ""),
        "asname": geo.get("asname", ""),
        "icon": provider_icon_url(provider_icon_filename(geo["isp"], geo.get("asn", ""))),
        "flag": ensure_country_flag(geo["countryCode"]),
        "activeFor": active_for or [],
        "active": bool(active_for),
    }


def probe_connection(iface=None):
    command = ["ping", "-4", "-c", "1", "-W", "1"]
    if iface:
        command.extend(["-I", iface])
    command.append("1.1.1.1")
    started = time.monotonic()
    result = run(command, timeout=3)
    elapsed = round((time.monotonic() - started) * 1000, 1)
    match = re.search(r"time[=<]([0-9.]+)\s*ms", result["output"])
    return {"online": result["ok"], "latencyMs": float(match.group(1)) if match else (elapsed if result["ok"] else None)}


def notification_settings(include_secret=False):
    data = read_json(NOTIFICATION_FILE, {})
    result = {
        "enabled": bool(data.get("enabled")),
        "telegramChatId": str(data.get("telegramChatId") or ""),
        "telegramConfigured": bool(data.get("telegramBotToken") and data.get("telegramChatId")),
        "telegramTransport": str(data.get("telegramTransport") or "auto"),
        "telegramWssUrl": str(data.get("telegramWssUrl") or ""),
        "telegramWssConfigured": bool(data.get("telegramWssUrl") and data.get("telegramWssSecret")),
        "webhookUrl": str(data.get("webhookUrl") or ""),
        "failureThreshold": max(1, min(int(data.get("failureThreshold") or 3), 10)),
        "recoveryThreshold": max(1, min(int(data.get("recoveryThreshold") or 2), 10)),
        "retryCount": max(0, min(int(data.get("retryCount") if data.get("retryCount") is not None else 2), 5)),
        "quietHoursEnabled": bool(data.get("quietHoursEnabled")),
        "quietStart": max(0, min(int(data.get("quietStart") if data.get("quietStart") is not None else 22), 23)),
        "quietEnd": max(0, min(int(data.get("quietEnd") if data.get("quietEnd") is not None else 8), 23)),
        "dailyDigestEnabled": bool(data.get("dailyDigestEnabled")),
        "dailyDigestHour": max(0, min(int(data.get("dailyDigestHour") if data.get("dailyDigestHour") is not None else 9), 23)),
    }
    if include_secret:
        result["telegramBotToken"] = str(data.get("telegramBotToken") or "")
        result["telegramWssSecret"] = str(data.get("telegramWssSecret") or "")
    return result


def save_notification_settings(payload):
    current = notification_settings(include_secret=True)
    token = str(payload.get("telegramBotToken") or "").strip() or current.get("telegramBotToken", "")
    chat_id = str(payload.get("telegramChatId") or "").strip()
    webhook = str(payload.get("webhookUrl") or "").strip()
    transport = str(payload.get("telegramTransport") or "auto").strip()
    wss_url = str(payload.get("telegramWssUrl") or "").strip()
    wss_secret = str(payload.get("telegramWssSecret") or "").strip() or current.get("telegramWssSecret", "")
    if token and not re.match(r"^\d+:[A-Za-z0-9_-]{20,}$", token):
        return {"ok": False, "output": "Invalid Telegram bot token"}
    if webhook and not webhook.startswith("https://"):
        return {"ok": False, "output": "Webhook URL must use HTTPS"}
    if transport not in ("auto", "wss", "direct"):
        return {"ok": False, "output": "Invalid Telegram transport"}
    if wss_url and urlparse(wss_url).scheme != "wss":
        return {"ok": False, "output": "Telegram relay URL must use WSS"}
    if wss_secret and len(wss_secret) < 32:
        return {"ok": False, "output": "Telegram relay secret must contain at least 32 characters"}
    def bounded(name, default, minimum, maximum):
        try:
            return max(minimum, min(int(payload.get(name, default)), maximum))
        except (TypeError, ValueError):
            return default
    data = {"enabled": bool(payload.get("enabled")), "telegramBotToken": token, "telegramChatId": chat_id, "telegramTransport": transport, "telegramWssUrl": wss_url, "telegramWssSecret": wss_secret, "webhookUrl": webhook,
            "failureThreshold": bounded("failureThreshold", current.get("failureThreshold", 3), 1, 10), "recoveryThreshold": bounded("recoveryThreshold", current.get("recoveryThreshold", 2), 1, 10),
            "retryCount": bounded("retryCount", current.get("retryCount", 2), 0, 5), "quietHoursEnabled": bool(payload.get("quietHoursEnabled")),
            "quietStart": bounded("quietStart", current.get("quietStart", 22), 0, 23), "quietEnd": bounded("quietEnd", current.get("quietEnd", 8), 0, 23),
            "dailyDigestEnabled": bool(payload.get("dailyDigestEnabled")), "dailyDigestHour": bounded("dailyDigestHour", current.get("dailyDigestHour", 9), 0, 23)}
    write_json(NOTIFICATION_FILE, data)
    os.chmod(NOTIFICATION_FILE, 0o600)
    return {"ok": True, "settings": notification_settings(), "output": "Notification settings saved"}


def websocket_frame(payload):
    payload = payload.encode("utf-8")
    mask = secrets.token_bytes(4)
    length = len(payload)
    header = bytearray([0x81])
    if length < 126:
        header.append(0x80 | length)
    elif length <= 0xFFFF:
        header.append(0x80 | 126)
        header.extend(struct.pack("!H", length))
    else:
        header.append(0x80 | 127)
        header.extend(struct.pack("!Q", length))
    return bytes(header) + mask + bytes(value ^ mask[index % 4] for index, value in enumerate(payload))


def socket_read_exact(connection, length):
    data = bytearray()
    while len(data) < length:
        chunk = connection.recv(length - len(data))
        if not chunk:
            raise OSError("WSS relay closed the connection")
        data.extend(chunk)
    return bytes(data)


def websocket_read_json(connection):
    first, second = socket_read_exact(connection, 2)
    opcode, length = first & 0x0F, second & 0x7F
    if second & 0x80:
        raise OSError("WSS server response must not be masked")
    if length == 126:
        length = struct.unpack("!H", socket_read_exact(connection, 2))[0]
    elif length == 127:
        length = struct.unpack("!Q", socket_read_exact(connection, 8))[0]
    if opcode != 1 or length > 64 * 1024:
        raise OSError("Invalid WSS relay response")
    return json.loads(socket_read_exact(connection, length).decode("utf-8"))


def telegram_send_wss(url, relay_secret, bot_token, chat_id, message):
    parsed = urlparse(url)
    if parsed.scheme != "wss" or not parsed.hostname:
        raise ValueError("Invalid WSS relay URL")
    port = parsed.port or 443
    path = parsed.path or "/"
    if parsed.query:
        path += f"?{parsed.query}"
    key = base64.b64encode(secrets.token_bytes(16)).decode("ascii")
    expected_accept = base64.b64encode(hashlib.sha1((key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode("ascii")).digest()).decode("ascii")
    context = ssl.create_default_context()
    with socket.create_connection((parsed.hostname, port), timeout=8) as tcp:
        with context.wrap_socket(tcp, server_hostname=parsed.hostname) as connection:
            connection.settimeout(12)
            request = (
                f"GET {path} HTTP/1.1\r\nHost: {parsed.hostname}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: urm-telegram-v1\r\n"
                f"Authorization: Bearer {relay_secret}\r\nUser-Agent: URM/1\r\n\r\n"
            )
            connection.sendall(request.encode("ascii"))
            response = bytearray()
            while b"\r\n\r\n" not in response and len(response) < 16 * 1024:
                response.extend(connection.recv(2048))
            headers = response.decode("iso-8859-1", errors="replace")
            if not headers.startswith("HTTP/1.1 101") or f"Sec-WebSocket-Accept: {expected_accept}".lower() not in headers.lower():
                raise OSError(f"WSS relay upgrade failed: {headers.splitlines()[0] if headers else 'empty response'}")
            payload = json.dumps({"botToken": bot_token, "chatId": chat_id, "text": message, "timestamp": int(time.time()), "nonce": b64url_encode(secrets.token_bytes(18))}, separators=(",", ":"))
            connection.sendall(websocket_frame(payload))
            result = websocket_read_json(connection)
            if not result.get("ok"):
                raise OSError(str(result.get("error") or "WSS relay rejected the message"))
            return True


def add_event(kind, severity, source, details=None, notification="not_requested", notification_message=""):
    event = {
        "id": f"{int(time.time() * 1000)}-{secrets.token_hex(3)}",
        "time": int(time.time()),
        "kind": str(kind),
        "severity": severity if severity in ("info", "warning", "critical", "success") else "info",
        "source": str(source or "URM")[:120],
        "details": details if isinstance(details, dict) else {},
        "read": False,
        "notification": notification,
    }
    if notification_message:
        event["notificationMessage"] = str(notification_message)[:4096]
    with EVENT_LOCK:
        data = read_json(EVENT_FILE, {"events": []})
        events = data.get("events") if isinstance(data.get("events"), list) else []
        if events and events[-1].get("kind") == event["kind"] and events[-1].get("source") == event["source"] and event["time"] - int(events[-1].get("time") or 0) <= 300:
            existing = events[-1]
            existing.update({"time": event["time"], "details": event["details"], "read": False, "notification": notification, "count": int(existing.get("count") or 1) + 1})
            if notification_message:
                existing["notificationMessage"] = event["notificationMessage"]
            write_json(EVENT_FILE, {"events": events[-EVENT_LIMIT:], "updatedAt": event["time"]})
            return existing["id"]
        events.append(event)
        write_json(EVENT_FILE, {"events": events[-EVENT_LIMIT:], "updatedAt": event["time"]})
    return event["id"]


def update_event_notification(event_id, result):
    if not event_id:
        return
    with EVENT_LOCK:
        data = read_json(EVENT_FILE, {"events": []})
        changed = False
        for event in data.get("events", []):
            if event.get("id") == event_id:
                event["notification"] = result.get("notification") or ("sent" if result.get("ok") else "failed")
                event["notificationOutput"] = str(result.get("output") or "")[:240]
                changed = True
                break
        if changed:
            data["updatedAt"] = int(time.time())
            write_json(EVENT_FILE, data)


def events_payload(kind="all", unread_only=False, limit=200):
    data = read_json(EVENT_FILE, {"events": []})
    all_events = data.get("events") if isinstance(data.get("events"), list) else []
    unread = sum(1 for event in all_events if not event.get("read"))
    events = [{key: value for key, value in event.items() if key != "notificationMessage"} for event in reversed(all_events)]
    if kind != "all":
        events = [event for event in events if event.get("kind") == kind]
    if unread_only:
        events = [event for event in events if not event.get("read")]
    return {"events": events[:max(1, min(int(limit), 500))], "unread": unread, "total": len(all_events), "updatedAt": data.get("updatedAt", 0)}


def events_export(export_format):
    events = events_payload(limit=500)["events"]
    if export_format == "json":
        return json.dumps({"events": events}, ensure_ascii=False, indent=2).encode("utf-8"), "application/json", "urm-events.json"
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["time", "kind", "severity", "source", "read", "notification", "details"])
    for event in events:
        writer.writerow([event.get("time"), event.get("kind"), event.get("severity"), event.get("source"), event.get("read"), event.get("notification"), json.dumps(event.get("details", {}), ensure_ascii=False)])
    return output.getvalue().encode("utf-8-sig"), "text/csv; charset=utf-8", "urm-events.csv"


def events_action(payload):
    action = str(payload.get("action") or "")
    event_id = str(payload.get("id") or "")
    with EVENT_LOCK:
        data = read_json(EVENT_FILE, {"events": []})
        events = data.get("events") if isinstance(data.get("events"), list) else []
        if action == "mark_read":
            for event in events:
                if event.get("id") == event_id:
                    event["read"] = True
                    break
        elif action == "mark_all_read":
            for event in events:
                event["read"] = True
        elif action == "clear_read":
            events = [event for event in events if not event.get("read")]
        else:
            return {"ok": False, "output": "Invalid event action"}
        write_json(EVENT_FILE, {"events": events[-EVENT_LIMIT:], "updatedAt": int(time.time())})
    return {"ok": True, "output": "Events updated"}


def in_quiet_hours(settings, now=None):
    if not settings.get("quietHoursEnabled"):
        return False
    hour = (now or time.localtime()).tm_hour
    start, end = settings.get("quietStart", 22), settings.get("quietEnd", 8)
    if start == end:
        return False
    return start <= hour < end if start < end else hour >= start or hour < end


def send_notification(message, event_id=None, force=False):
    settings = notification_settings(include_secret=True)
    if not settings.get("enabled"):
        result = {"ok": False, "output": "Notifications are disabled"}
        update_event_notification(event_id, result)
        return result
    if not force and in_quiet_hours(settings):
        result = {"ok": False, "notification": "deferred", "output": "Deferred until quiet hours end"}
        update_event_notification(event_id, result)
        return result
    results, targets = [], 0
    for attempt in range(settings.get("retryCount", 2) + 1):
        results, targets = [], 0
        token, chat_id = settings.get("telegramBotToken"), settings.get("telegramChatId")
        if token and chat_id:
            targets += 1
            delivered = False
            transport = settings.get("telegramTransport", "auto")
            if transport in ("auto", "wss") and settings.get("telegramWssUrl") and settings.get("telegramWssSecret"):
                try:
                    delivered = telegram_send_wss(settings["telegramWssUrl"], settings["telegramWssSecret"], token, chat_id, message)
                except (OSError, ValueError, ssl.SSLError, json.JSONDecodeError):
                    delivered = False
            if not delivered and transport in ("auto", "direct"):
                url = f"https://api.telegram.org/bot{token}/sendMessage"
                body = json.dumps({"chat_id": chat_id, "text": message}).encode("utf-8")
                try:
                    with urllib.request.urlopen(urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}), timeout=8) as response:
                        delivered = response.status == 200
                except OSError:
                    delivered = False
            results.append(delivered)
        webhook = settings.get("webhookUrl")
        if webhook:
            targets += 1
            body = json.dumps({"text": message, "source": "URM", "timestamp": int(time.time())}).encode("utf-8")
            try:
                with urllib.request.urlopen(urllib.request.Request(webhook, data=body, headers={"Content-Type": "application/json"}), timeout=8) as response:
                    results.append(200 <= response.status < 300)
            except OSError:
                results.append(False)
        if targets and all(results):
            break
        if not targets:
            break
        if attempt < settings.get("retryCount", 2):
            time.sleep(min(2 ** attempt, 4))
    result = {"ok": bool(targets and all(results)), "output": f"Delivered to {sum(results)}/{targets} targets" if targets else "No notification target configured"}
    update_event_notification(event_id, result)
    return result


def record_monitoring(connections):
    now = int(time.time())
    changes = []
    settings = notification_settings()
    with MONITOR_LOCK:
        data = read_json(MONITOR_FILE, {"connections": {}})
        history = data.setdefault("connections", {})
        labels = data.setdefault("labels", {})
        states = data.setdefault("states", {})
        for item in connections:
            key = item.get("iface") or item.get("label") or "direct"
            labels[key] = item.get("label") or key
            samples = history.setdefault(key, [])
            if samples and now - int(samples[-1].get("time") or 0) < 55:
                continue
            sample = {"time": now, "online": bool(item.get("online")), "latencyMs": item.get("latencyMs"), "ip": item.get("ip", "N/A")}
            previous = samples[-1] if samples else None
            state = states.setdefault(key, {"online": sample["online"], "successes": 0, "failures": 0, "outageStartedAt": 0})
            if sample["online"]:
                state["successes"] = int(state.get("successes") or 0) + 1
                state["failures"] = 0
                if not state.get("online") and state["successes"] >= settings["recoveryThreshold"]:
                    state["online"] = True
                    duration = max(0, now - int(state.get("outageStartedAt") or now))
                    state["outageStartedAt"] = 0
                    changes.append({"kind": "channel_online", "severity": "success", "source": item.get("label", key),
                                    "details": {"connection": item.get("label", key), "interface": key, "status": "online", "durationSec": duration},
                                    "message": f"URM: {item.get('label', key)} is online after {duration // 60}m {duration % 60}s"})
            else:
                state["failures"] = int(state.get("failures") or 0) + 1
                state["successes"] = 0
                if state.get("online") and state["failures"] >= settings["failureThreshold"]:
                    state["online"] = False
                    state["outageStartedAt"] = now
                    changes.append({"kind": "channel_offline", "severity": "critical", "source": item.get("label", key),
                                    "details": {"connection": item.get("label", key), "interface": key, "status": "offline"},
                                    "message": f"URM: {item.get('label', key)} is offline"})
            sample["stableOnline"] = bool(state.get("online"))
            samples.append(sample)
            history[key] = samples[-10080:]
            if previous:
                if state.get("online") and previous.get("ip") not in (None, "N/A") and previous.get("ip") != sample["ip"]:
                    changes.append({
                        "kind": "ip_changed",
                        "severity": "warning",
                        "source": item.get("label", key),
                        "details": {"connection": item.get("label", key), "interface": key, "oldIp": previous.get("ip"), "newIp": sample["ip"]},
                        "message": f"URM: {item.get('label', key)} external IP changed: {previous.get('ip')} → {sample['ip']}",
                    })
        data["updatedAt"] = now
        write_json(MONITOR_FILE, data)
    for change in changes:
        event_id = add_event(change["kind"], change["severity"], change["source"], change["details"], notification="pending", notification_message=change["message"])
        threading.Thread(target=send_notification, args=(change["message"], event_id), daemon=True).start()


def monitored_connections():
    projects = [
        {"title": config["title"], "activeIface": read_text(config["dir"] / "active-iface", "unknown"), "activeName": read_text(config["dir"] / "active-name", "not configured")}
        for config in PROJECTS.values()
    ]
    connections = connections_status(projects)
    with ThreadPoolExecutor(max_workers=min(8, len(connections))) as executor:
        probes = list(executor.map(lambda item: probe_connection(item.get("iface") or None), connections))
    for item, probe in zip(connections, probes):
        item.update(probe)
    record_monitoring(connections)
    return connections


def monitoring_payload(limit=30):
    data = read_json(MONITOR_FILE, {"connections": {}, "updatedAt": 0})
    labels = data.get("labels", {})
    items = []
    for key, samples in data.get("connections", {}).items():
        recent = samples[-max(2, min(int(limit), 10080)):]
        online_count = sum(1 for sample in recent if sample.get("stableOnline", sample.get("online")))
        stride = max(1, (len(recent) + 499) // 500)
        display_samples = recent[::stride]
        if recent and display_samples[-1] is not recent[-1]:
            display_samples.append(recent[-1])
        items.append({"id": key, "label": labels.get(key, key), "samples": display_samples, "availability": round(100 * online_count / len(recent), 1) if recent else 0})
    return {"updatedAt": data.get("updatedAt", 0), "items": items, "notifications": notification_settings()}


def flush_deferred_notifications():
    if in_quiet_hours(notification_settings()):
        return
    data = read_json(EVENT_FILE, {"events": []})
    for event in data.get("events", []):
        if event.get("notification") == "deferred" and event.get("notificationMessage"):
            send_notification(event["notificationMessage"], event.get("id"), force=True)


def maybe_send_daily_digest():
    settings = notification_settings()
    now = time.localtime()
    if not settings.get("dailyDigestEnabled") or now.tm_hour != settings.get("dailyDigestHour"):
        return
    today = time.strftime("%Y-%m-%d", now)
    with MONITOR_LOCK:
        data = read_json(MONITOR_FILE, {"connections": {}})
        if data.get("digestDate") == today:
            return
        data["digestDate"] = today
        write_json(MONITOR_FILE, data)
    cutoff = int(time.time()) - 86400
    events = [event for event in read_json(EVENT_FILE, {"events": []}).get("events", []) if int(event.get("time") or 0) >= cutoff]
    outages = sum(1 for event in events if event.get("kind") == "channel_offline")
    ip_changes = sum(1 for event in events if event.get("kind") == "ip_changed")
    lines = ["URM daily summary", f"Outages: {outages}", f"External IP changes: {ip_changes}"]
    for item in monitoring_payload(1440).get("items", []):
        lines.append(f"{item['label']}: {item['availability']}% availability")
    message = "\n".join(lines)
    event_id = add_event("daily_digest", "info", "URM", {"outages": outages, "ipChanges": ip_changes}, notification="pending", notification_message=message)
    send_notification(message, event_id)


def monitor_worker():
    while True:
        try:
            monitored_connections()
            flush_deferred_notifications()
            maybe_send_daily_digest()
        except Exception as error:
            print(f"Monitoring error: {error}", file=sys.stderr)
        time.sleep(MONITOR_INTERVAL)


def wireguard_interfaces():
    result = run(["sh", "-lc", "command -v wg >/dev/null 2>&1 && wg show interfaces || true"], timeout=8)
    if not result["ok"] or not result["output"]:
        return []
    return [item for item in result["output"].split() if item]


def wan_interfaces():
    result = run(["ip", "-4", "route", "show", "table", "all"], timeout=8)
    if not result["ok"]:
        return []
    interfaces = []
    for line in result["output"].splitlines():
        if not line.startswith("default "):
            continue
        match = re.search(r"\bdev\s+(eth\d+)\b", line)
        if match and match.group(1) not in interfaces:
            interfaces.append(match.group(1))
    return interfaces


def connections_status(projects):
    active_by_iface = {}
    for project in projects:
        iface = project.get("activeIface")
        if iface and iface not in ("unknown", "not configured"):
            active_by_iface.setdefault(iface, []).append(project["title"].replace("UniFi ", ""))

    specs = []
    wan_ifaces = wan_interfaces()
    for index, iface in enumerate(wan_ifaces, 1):
        specs.append((f"WAN{index}", iface, active_by_iface.get(iface, [])))
    if not specs:
        specs.append(("ISP", None, []))
    names = wg_map_names()
    for iface in wireguard_interfaces():
        active_for = active_by_iface.get(iface, [])
        label = names.get(iface, iface)
        for project in projects:
            if project.get("activeIface") == iface and project.get("activeName") not in ("unknown", "not configured"):
                label = project["activeName"]
                break
        specs.append((label, iface, active_for))
    with ThreadPoolExecutor(max_workers=min(8, len(specs))) as executor:
        connections = list(executor.map(lambda spec: connection_status(spec[0], spec[1], spec[2]), specs))
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
    if connections is None:
        connections = connections_status([project_status(key, config) for key, config in PROJECTS.items()])
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
            write_provider_aliases(item["asn"], isp, item.get("asname", ""))
            if path.exists():
                continue
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
    if not re.match(r"^[0-9A-Fa-f:.]+$", target or ""):
        return {"target": target, "iface": "", "name": "", "raw": "invalid target"}
    result = run(["ip", "route", "get", target], timeout=6)
    line = result["output"].splitlines()[0] if result["ok"] and result["output"] else ""
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
            "readOnly": False,
            "description": "",
        }
    for key, spec in VIEW_ONLY_FILES.items():
        path = spec["path"]
        files[key] = {
            "key": key,
            "path": str(path),
            "exists": path.exists(),
            "content": read_text(path, ""),
            "readOnly": True,
            "description": spec.get("description", ""),
        }
    return {"files": files}


def save_editable_file(key, content):
    path = EDITABLE_FILES.get(key)
    if not path:
        return {"ok": False, "output": "Unknown editable file"}
    validation = validate_editable_content(key, content)
    if not validation["ok"]:
        return {"ok": False, "output": "Validation failed", "validation": validation}

    path.parent.mkdir(parents=True, exist_ok=True)
    backup = create_config_backup(f"before editing {key}")
    normalized = content.replace("\r\n", "\n").replace("\r", "\n").rstrip() + "\n"
    atomic_write_text(path, normalized, 0o600)

    if key == "cloud.networks":
        update_result = run(["sh", str(ROOT / "ubnt-cloud" / "update-aws-networks.sh")], timeout=120)
        return {"ok": update_result["ok"], "output": f"Saved {path}\n{update_result['output']}".strip(), "backup": backup, "validation": validation}

    return {"ok": True, "output": f"Saved {path}", "backup": backup, "validation": validation}


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
    if ok and kind == "provider":
        marker = path.with_suffix(path.suffix + ".source")
        marker.write_text("manual\n", encoding="utf-8")
    return {"ok": ok, "output": output}


def diagnostic_check(key, label, ok, detail=""):
    return {"key": key, "label": label, "ok": bool(ok), "detail": str(detail or "")}


def diagnostic_target(config):
    addresses = list_entries(config["dir"] / config["files"]["addresses"])
    for value in addresses:
        try:
            return str(ipaddress.ip_address(value))
        except ValueError:
            continue
    networks = list_entries(config["dir"] / config["files"]["networks"])
    for value in networks:
        try:
            network = ipaddress.ip_network(value, strict=False)
            if network.version == 4:
                return str(network.network_address + (1 if network.num_addresses > 1 else 0))
        except ValueError:
            continue
    return "1.1.1.1"


def diagnose_project(key, config):
    status = project_status(key, config)
    iface = status["activeIface"]
    table = status["activeTable"]
    target = diagnostic_target(config)
    checks = [
        diagnostic_check("configured", "Configuration", status["configured"], status["activeName"]),
        diagnostic_check("timer", "Timer", status["timer"] == "active", status["timer"]),
    ]
    iface_ok = bool(iface and iface not in ("unknown", "not configured") and Path("/sys/class/net", iface).exists())
    checks.append(diagnostic_check("interface", "Interface", iface_ok, iface))
    table_result = run(["ip", "route", "show", "table", table], timeout=6) if table not in ("", "unknown") else {"ok": False, "output": ""}
    checks.append(diagnostic_check("table", "Routing table", table_result["ok"] and bool(table_result["output"]), table))
    rule_count = status["rules"]
    checks.append(diagnostic_check("rules", "Policy rules", str(rule_count).isdigit() and int(rule_count) > 0, rule_count))
    route = route_to(target)
    checks.append(diagnostic_check("route", "Route test", bool(route["iface"]) and route["iface"] == iface, route["raw"] or target))
    public_ip = external_ip(iface) if iface_ok else "N/A"
    checks.append(diagnostic_check("internet", "External IP", public_ip != "N/A", public_ip))
    return {"key": key, "title": config["title"], "checks": checks, "ok": all(check["ok"] for check in checks)}


def diagnostics_payload():
    started = time.monotonic()
    with ThreadPoolExecutor(max_workers=3) as executor:
        project_futures = [executor.submit(diagnose_project, key, config) for key, config in PROJECTS.items()]
        projects = [future.result() for future in project_futures]
    dns = dnscrypt_status()
    dns_checks = [
        diagnostic_check("timer", "Timer", dns["timer"] == "active", dns["timer"]),
        diagnostic_check("proxy", "DNSCrypt proxy", dns["proxyService"] == "active", dns["proxyService"]),
        diagnostic_check("forwarding", "Forwarding rules", dns["forwarding"] > 0, dns["forwarding"]),
        diagnostic_check("route", "DNS route", bool(dns["route"].get("iface")), dns["route"].get("raw", "")),
    ]
    connectivity_checks = []
    for key, title, url in (("telegram", "Telegram API", "https://api.telegram.org"), ("unifi", "UniFi Cloud", "https://unifi.ui.com")):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "URM/1"}), timeout=8) as response:
                connectivity_checks.append(diagnostic_check(key, title, response.status < 500, f"HTTP {response.status}"))
        except urllib.error.HTTPError as error:
            connectivity_checks.append(diagnostic_check(key, title, error.code < 500, f"HTTP {error.code}"))
        except OSError as error:
            connectivity_checks.append(diagnostic_check(key, title, False, str(error)))
    relay_url = notification_settings().get("telegramWssUrl")
    if relay_url:
        parsed = urlparse(relay_url)
        try:
            with socket.create_connection((parsed.hostname, parsed.port or 443), timeout=6) as tcp:
                with ssl.create_default_context().wrap_socket(tcp, server_hostname=parsed.hostname):
                    connectivity_checks.append(diagnostic_check("wss", "Telegram WSS relay", True, parsed.hostname))
        except OSError as error:
            connectivity_checks.append(diagnostic_check("wss", "Telegram WSS relay", False, str(error)))
    sections = projects + [{"key": "dnscrypt", "title": "DNSCrypt", "checks": dns_checks, "ok": all(item["ok"] for item in dns_checks)},
                           {"key": "connectivity", "title": "External services", "checks": connectivity_checks, "ok": all(item["ok"] for item in connectivity_checks)}]
    total = sum(len(section["checks"]) for section in sections)
    passed = sum(sum(1 for check in section["checks"] if check["ok"]) for section in sections)
    return {
        "ok": passed == total,
        "passed": passed,
        "total": total,
        "durationMs": round((time.monotonic() - started) * 1000),
        "generatedAt": int(time.time()),
        "sections": sections,
    }


def overview_payload():
    project_items = list(PROJECTS.items())
    with ThreadPoolExecutor(max_workers=6) as executor:
        project_futures = [executor.submit(project_status, key, config) for key, config in project_items]
        dnscrypt_future = executor.submit(dnscrypt_status)
        icons_future = executor.submit(isp_icons_status)
        web_active_future = executor.submit(systemctl_value, "is-active", WEB_SERVICE)
        web_enabled_future = executor.submit(systemctl_value, "is-enabled", WEB_SERVICE)
        projects = [future.result() for future in project_futures]
        dnscrypt = dnscrypt_future.result()
        isp_icons = icons_future.result()
    return {
        "root": str(ROOT),
        "host": HOST,
        "port": PORT,
        "web": {
            "service": web_active_future.result(),
            "enabled": web_enabled_future.result(),
        },
        "generatedAt": int(time.time()),
        "projects": projects,
        "dnscrypt": dnscrypt,
        "ispIcons": isp_icons,
    }


def status_payload():
    payload = overview_payload()
    payload["connections"] = connections_status(payload["projects"])
    return payload


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

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        self.send_header("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'")
        super().end_headers()

    def is_authenticated(self):
        cookies = parse_cookies(self.headers.get("Cookie", ""))
        return verify_session(cookies.get("urm_session"))

    def require_auth(self):
        if self.is_authenticated():
            return True
        self.send_json({"ok": False, "output": "Unauthorized"}, 401)
        return False

    def webauthn_context(self):
        origin = self.headers.get("Origin", "")
        parsed_origin = urlparse(origin)
        host = (self.headers.get("Host", "").split(":", 1)[0] or "").strip("[]")
        if parsed_origin.scheme != "https" or not parsed_origin.hostname or parsed_origin.hostname != host:
            raise ValueError("Passkeys require this page to be opened over trusted HTTPS")
        return parsed_origin.hostname, origin

    def redirect_to_https(self):
        if not PUBLIC_URL or self.client_address[0] in ("127.0.0.1", "::1") or self.headers.get("X-Forwarded-Proto", "").lower() == "https":
            return False
        self.send_response(308)
        self.send_header("Location", f"{PUBLIC_URL}{self.path}")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        return True

    def do_GET(self):
        if self.redirect_to_https():
            return
        parsed = urlparse(self.path)
        if parsed.path == "/api/auth/me":
            config = ensure_auth_config()
            self.send_json({
                "authenticated": self.is_authenticated(),
                "name": config.get("name", ""),
                "username": config.get("username", ""),
                "avatar": avatar_url(config),
                "logo": brand_logo_url(config),
                "passkeys": len(config.get("passkeys") or []),
            })
            return
        if parsed.path.startswith("/api/brand/"):
            config = ensure_auth_config()
            configured = Path(config.get("logo") or "")
            filename = safe_asset_name(Path(parsed.path).name, allowed=(".png", ".jpg", ".jpeg"))
            path = configured if filename and configured.parent == AVATAR_DIR and configured.name == filename else None
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
        if parsed.path == "/api/overview":
            self.send_json(overview_payload())
            return
        if parsed.path == "/api/connections":
            self.send_json({"connections": monitored_connections(), "generatedAt": int(time.time())})
            return
        if parsed.path == "/api/monitoring":
            query = parse_qs(parsed.query)
            try:
                limit = int(query.get("limit", ["30"])[0])
            except ValueError:
                limit = 30
            self.send_json(monitoring_payload(limit))
            return
        if parsed.path == "/api/notifications":
            self.send_json(notification_settings())
            return
        if parsed.path == "/api/events":
            query = parse_qs(parsed.query)
            kind = query.get("kind", ["all"])[0]
            unread_only = query.get("unread", ["0"])[0] == "1"
            try:
                limit = int(query.get("limit", ["200"])[0])
            except ValueError:
                limit = 200
            self.send_json(events_payload(kind=kind, unread_only=unread_only, limit=limit))
            return
        if parsed.path == "/api/events/export":
            export_format = parse_qs(parsed.query).get("format", ["csv"])[0]
            body, content_type, filename = events_export("json" if export_format == "json" else "csv")
            self.send_response(200)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/files":
            self.send_json(editable_payload())
            return
        if parsed.path == "/api/backups":
            self.send_json({"backups": list_config_backups()})
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
        if PUBLIC_URL and self.client_address[0] not in ("127.0.0.1", "::1") and self.headers.get("X-Forwarded-Proto", "").lower() != "https":
            self.send_json({"ok": False, "output": "HTTPS is required"}, 403)
            return
        parsed = urlparse(self.path)
        if parsed.path not in ("/api/action", "/api/files", "/api/files/validate", "/api/diagnostics", "/api/backups/create", "/api/backups/restore", "/api/notifications", "/api/notifications/test", "/api/events", "/api/auth/login", "/api/auth/logout", "/api/auth/passkey/options", "/api/auth/passkey/verify", "/api/auth/passkey/register/options", "/api/auth/passkey/register", "/api/auth/avatar", "/api/auth/logo", "/api/auth/profile", "/api/assets/download"):
            self.send_json({"ok": False, "output": "Not found"}, 404)
            return
        origin = self.headers.get("Origin", "")
        if origin and urlparse(origin).netloc != self.headers.get("Host", ""):
            self.send_json({"ok": False, "output": "Origin mismatch"}, 403)
            return
        length = int(self.headers.get("Content-Length", "0"))
        if length > 2 * 1024 * 1024:
            self.send_json({"ok": False, "output": "Request is too large"}, 413)
            return
        try:
            payload = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self.send_json({"ok": False, "output": "Invalid JSON"}, 400)
            return
        if parsed.path == "/api/auth/login":
            address = self.client_address[0]
            if not login_allowed(address):
                self.send_json({"ok": False, "output": "Too many login attempts. Try again in a few minutes."}, 429)
                return
            config = ensure_auth_config()
            if payload.get("username") == config.get("username") and verify_password(payload.get("password", ""), config):
                clear_login_failures(address)
                session = make_session(config["username"])
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Set-Cookie", f"urm_session={session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age={SESSION_TTL}")
                body = json.dumps({"ok": True, "name": config.get("name", ""), "avatar": avatar_url(config)}, ensure_ascii=False).encode("utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            record_login_failure(address)
            self.send_json({"ok": False, "output": "Invalid login or password"}, 403)
            return
        if parsed.path == "/api/auth/passkey/options":
            try:
                rp_id, origin = self.webauthn_context()
                config = ensure_auth_config()
                passkeys = config.get("passkeys") or []
                if not passkeys:
                    raise ValueError("No Passkeys are registered")
                token, challenge = new_webauthn_challenge("authenticate", rp_id, origin, config["username"])
                self.send_json({
                    "ok": True,
                    "token": token,
                    "publicKey": {
                        "challenge": b64url_encode(challenge),
                        "rpId": rp_id,
                        "timeout": 60000,
                        "userVerification": "required",
                        "allowCredentials": [{"type": "public-key", "id": item["id"]} for item in passkeys],
                    },
                })
            except (ValueError, RuntimeError) as error:
                self.send_json({"ok": False, "output": str(error)}, 400)
            return
        if parsed.path == "/api/auth/passkey/verify":
            try:
                challenge = take_webauthn_challenge(payload.get("token"), "authenticate")
                config = ensure_auth_config()
                credential_id = str(payload.get("credential", {}).get("id", ""))
                passkey = next((item for item in config.get("passkeys", []) if item.get("id") == credential_id), None)
                if not passkey:
                    raise ValueError("Unknown Passkey")
                counter = verify_passkey_assertion(passkey, payload.get("credential", {}).get("response", {}), challenge)
                previous_counter = int(passkey.get("signCount", 0))
                if previous_counter and counter and counter <= previous_counter:
                    raise ValueError("Passkey counter replay detected")
                passkey["signCount"] = max(int(passkey.get("signCount", 0)), counter)
                write_json(AUTH_FILE, config)
                os.chmod(AUTH_FILE, 0o600)
                session = make_session(config["username"])
                body = json.dumps({"ok": True}, ensure_ascii=False).encode("utf-8")
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Cache-Control", "no-store")
                self.send_header("Set-Cookie", f"urm_session={session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age={SESSION_TTL}")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except (ValueError, TypeError, RuntimeError, OSError, struct.error, binascii.Error, json.JSONDecodeError) as error:
                self.send_json({"ok": False, "output": str(error)}, 403)
            return
        if parsed.path == "/api/auth/logout":
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Set-Cookie", "urm_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict")
            body = b'{"ok": true}'
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if not self.require_auth():
            return
        if parsed.path == "/api/auth/passkey/register/options":
            try:
                rp_id, origin = self.webauthn_context()
                config = ensure_auth_config()
                token, challenge = new_webauthn_challenge("register", rp_id, origin, config["username"])
                user_id = hashlib.sha256(config["username"].encode("utf-8")).digest()[:16]
                self.send_json({
                    "ok": True,
                    "token": token,
                    "publicKey": {
                        "challenge": b64url_encode(challenge),
                        "rp": {"name": "UniFi Routing Manager", "id": rp_id},
                        "user": {"id": b64url_encode(user_id), "name": config["username"], "displayName": config.get("name") or config["username"]},
                        "pubKeyCredParams": [{"type": "public-key", "alg": -7}],
                        "timeout": 60000,
                        "attestation": "none",
                        "authenticatorSelection": {"residentKey": "preferred", "userVerification": "required"},
                        "excludeCredentials": [{"type": "public-key", "id": item["id"]} for item in config.get("passkeys", [])],
                    },
                })
            except (ValueError, RuntimeError) as error:
                self.send_json({"ok": False, "output": str(error)}, 400)
            return
        if parsed.path == "/api/auth/passkey/register":
            try:
                challenge = take_webauthn_challenge(payload.get("token"), "register")
                credential = payload.get("credential", {})
                client_data = verify_client_data(credential.get("response", {}).get("clientDataJSON", ""), challenge["challenge"], "webauthn.create", challenge["origin"])
                if not client_data:
                    raise ValueError("Invalid Passkey registration")
                credential_id, public_key, counter = parse_registration_auth_data(b64url_decode(credential.get("response", {}).get("attestationObject", "")), challenge["rpId"])
                encoded_id = b64url_encode(credential_id)
                if encoded_id != credential.get("id"):
                    raise ValueError("Passkey credential ID mismatch")
                config = ensure_auth_config()
                passkeys = [item for item in config.get("passkeys", []) if item.get("id") != encoded_id]
                passkeys.append({"id": encoded_id, "publicKeyPem": public_key, "signCount": counter, "createdAt": int(time.time()), "name": str(payload.get("name") or "Passkey")[:64]})
                config["passkeys"] = passkeys
                write_json(AUTH_FILE, config)
                os.chmod(AUTH_FILE, 0o600)
                self.send_json({"ok": True, "count": len(passkeys)})
            except (ValueError, TypeError, RuntimeError, OSError, struct.error, binascii.Error, json.JSONDecodeError) as error:
                self.send_json({"ok": False, "output": str(error)}, 400)
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
        if parsed.path == "/api/auth/logo":
            raw, suffix, error = decode_uploaded_image(payload)
            if error:
                self.send_json({"ok": False, "output": error}, 400)
                return
            AVATAR_DIR.mkdir(parents=True, exist_ok=True)
            path = AVATAR_DIR / f"brand-logo{suffix}"
            config = ensure_auth_config()
            previous = Path(config.get("logo") or "")
            path.write_bytes(raw)
            if previous != path and previous.parent == AVATAR_DIR and previous.exists():
                previous.unlink()
            config["logo"] = str(path)
            write_json(AUTH_FILE, config)
            os.chmod(AUTH_FILE, 0o600)
            self.send_json({"ok": True, "logo": brand_logo_url(config)})
            return
        if parsed.path == "/api/auth/profile":
            ok, output, config = update_auth_credentials(payload)
            if not ok:
                self.send_json({"ok": False, "output": output}, 400)
                return
            session = make_session(config["username"])
            body = json.dumps({
                "ok": True,
                "output": output,
                "name": config.get("name", ""),
                "username": config.get("username", ""),
                "avatar": avatar_url(config),
            }, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Set-Cookie", f"urm_session={session}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age={SESSION_TTL}")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if parsed.path == "/api/assets/download":
            self.send_json(download_asset(payload.get("kind", ""), payload.get("url", ""), payload.get("filename", "")))
            return
        if parsed.path == "/api/files/validate":
            validation = validate_editable_content(payload.get("key", ""), payload.get("content", ""))
            self.send_json(validation)
            return
        if parsed.path == "/api/notifications":
            result = save_notification_settings(payload)
            self.send_json(result, 200 if result["ok"] else 400)
            return
        if parsed.path == "/api/notifications/test":
            event_id = add_event("notification_test", "info", "Telegram", {"test": True}, notification="pending")
            result = send_notification("URM: test notification", event_id, force=True)
            self.send_json(result, 200 if result["ok"] else 400)
            return
        if parsed.path == "/api/events":
            result = events_action(payload)
            self.send_json(result, 200 if result["ok"] else 400)
            return
        if parsed.path == "/api/files":
            result = save_editable_file(payload.get("key", ""), payload.get("content", ""))
            self.send_json(result, 200 if result["ok"] else 400)
            return
        if parsed.path == "/api/diagnostics":
            self.send_json(diagnostics_payload())
            return
        if parsed.path == "/api/backups/create":
            self.send_json({"ok": True, "backup": create_config_backup("manual")})
            return
        if parsed.path == "/api/backups/restore":
            result = restore_config_backup(str(payload.get("id", "")))
            self.send_json(result, 200 if result["ok"] else 400)
            return
        self.send_json(perform_action(payload.get("action", "")))


def main():
    try:
        ensure_auth_config()
    except RuntimeError as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(1)

    if not EVENT_FILE.exists():
        add_event("system_started", "info", "URM", {"version": "events-v1"})
    threading.Thread(target=monitor_worker, daemon=True, name="urm-monitor").start()
    try:
        server = ThreadingHTTPServer((HOST, PORT), Handler)
    except OSError as error:
        if error.errno == 98:
            print(f"Port {PORT} is already in use.")
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
