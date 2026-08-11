#!/usr/bin/env python3
import base64
import hashlib
import json
import os
import re
import secrets
import struct
import threading
import time
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


HOST = os.environ.get("URM_RELAY_HOST", "127.0.0.1")
PORT = int(os.environ.get("URM_RELAY_PORT", "8791"))
PATH = os.environ.get("URM_RELAY_PATH", "/telegram-ws")
SECRET = os.environ.get("URM_RELAY_SECRET", "")
MAX_MESSAGE = 64 * 1024
NONCES = {}
NONCE_LOCK = threading.Lock()
WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"


def websocket_accept(key):
    return base64.b64encode(hashlib.sha1((key + WS_GUID).encode("ascii")).digest()).decode("ascii")


def read_exact(stream, length):
    data = bytearray()
    while len(data) < length:
        chunk = stream.read(length - len(data))
        if not chunk:
            raise ConnectionError("WebSocket closed")
        data.extend(chunk)
    return bytes(data)


def read_frame(stream):
    first, second = read_exact(stream, 2)
    opcode = first & 0x0F
    if not first & 0x80:
        raise ValueError("Fragmented frames are not supported")
    if not second & 0x80:
        raise ValueError("Client frames must be masked")
    length = second & 0x7F
    if length == 126:
        length = struct.unpack("!H", read_exact(stream, 2))[0]
    elif length == 127:
        length = struct.unpack("!Q", read_exact(stream, 8))[0]
    if length > MAX_MESSAGE:
        raise ValueError("Message is too large")
    mask = read_exact(stream, 4)
    payload = read_exact(stream, length)
    return opcode, bytes(value ^ mask[index % 4] for index, value in enumerate(payload))


def write_frame(stream, payload, opcode=1):
    payload = payload if isinstance(payload, bytes) else payload.encode("utf-8")
    header = bytearray([0x80 | opcode])
    length = len(payload)
    if length < 126:
        header.append(length)
    elif length <= 0xFFFF:
        header.extend([126])
        header.extend(struct.pack("!H", length))
    else:
        header.extend([127])
        header.extend(struct.pack("!Q", length))
    stream.write(bytes(header) + payload)
    stream.flush()


def authorize(headers):
    value = headers.get("Authorization", "")
    supplied = value[7:] if value.startswith("Bearer ") else ""
    return bool(SECRET and secrets.compare_digest(supplied, SECRET))


def accept_nonce(timestamp, nonce):
    now = int(time.time())
    if abs(now - timestamp) > 90 or not re.match(r"^[A-Za-z0-9_-]{16,80}$", nonce):
        return False
    with NONCE_LOCK:
        for key, created in list(NONCES.items()):
            if now - created > 300:
                NONCES.pop(key, None)
        if nonce in NONCES:
            return False
        NONCES[nonce] = now
    return True


def telegram_send(payload):
    token = str(payload.get("botToken") or "")
    chat_id = str(payload.get("chatId") or "")
    text = str(payload.get("text") or "")
    timestamp = int(payload.get("timestamp") or 0)
    nonce = str(payload.get("nonce") or "")
    if not re.match(r"^\d+:[A-Za-z0-9_-]{20,}$", token):
        raise ValueError("Invalid Telegram bot token")
    if not re.match(r"^-?\d{1,24}$", chat_id):
        raise ValueError("Invalid Telegram chat ID")
    if not text or len(text) > 4096:
        raise ValueError("Invalid Telegram message")
    if not accept_nonce(timestamp, nonce):
        raise ValueError("Expired or repeated request")
    body = json.dumps({"chat_id": chat_id, "text": text}).encode("utf-8")
    request = urllib.request.Request(
        f"https://api.telegram.org/bot{token}/sendMessage",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "URM-Telegram-Relay/1"},
    )
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            result = json.loads(response.read(MAX_MESSAGE).decode("utf-8"))
    except urllib.error.HTTPError as error:
        detail = error.read(MAX_MESSAGE).decode("utf-8", errors="replace")
        raise ValueError(f"Telegram returned HTTP {error.code}: {detail[:300]}") from error
    if not result.get("ok"):
        raise ValueError(str(result.get("description") or "Telegram rejected the message"))
    return {"ok": True, "messageId": result.get("result", {}).get("message_id")}


class RelayHandler(BaseHTTPRequestHandler):
    server_version = "URMRelay/1"

    def log_message(self, format_string, *args):
        print(f"{self.client_address[0]} {format_string % args}")

    def do_GET(self):
        if self.path == "/health":
            body = b'{"ok":true}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path != PATH or self.headers.get("Upgrade", "").lower() != "websocket":
            self.send_error(404)
            return
        key = self.headers.get("Sec-WebSocket-Key", "")
        if not key or not authorize(self.headers):
            self.send_error(401)
            return
        self.send_response(101, "Switching Protocols")
        self.send_header("Upgrade", "websocket")
        self.send_header("Connection", "Upgrade")
        self.send_header("Sec-WebSocket-Accept", websocket_accept(key))
        self.send_header("Sec-WebSocket-Protocol", "urm-telegram-v1")
        self.end_headers()
        try:
            opcode, raw = read_frame(self.rfile)
            if opcode != 1:
                raise ValueError("Only text messages are supported")
            result = telegram_send(json.loads(raw.decode("utf-8")))
            write_frame(self.wfile, json.dumps(result, separators=(",", ":")))
        except (ValueError, KeyError, TypeError, json.JSONDecodeError, ConnectionError) as error:
            write_frame(self.wfile, json.dumps({"ok": False, "error": str(error)}, separators=(",", ":")))
        finally:
            try:
                write_frame(self.wfile, b"", opcode=8)
            except OSError:
                pass


def main():
    if len(SECRET) < 32:
        raise SystemExit("URM_RELAY_SECRET must contain at least 32 characters")
    server = ThreadingHTTPServer((HOST, PORT), RelayHandler)
    print(f"URM Telegram WSS relay listening on http://{HOST}:{PORT}{PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
