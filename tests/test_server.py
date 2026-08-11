import importlib.util
import hashlib
import json
import struct
import subprocess
import tempfile
import unittest
from pathlib import Path


SERVER_PATH = Path(__file__).parents[1] / "web" / "server.py"
SPEC = importlib.util.spec_from_file_location("urm_server", SERVER_PATH)
server = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(server)


class ValidationTests(unittest.TestCase):
    def test_domains_and_networks(self):
        self.assertTrue(server.validate_editable_content("cloud.domains", "ui.com\n*.amazonaws.com\n")["ok"])
        self.assertFalse(server.validate_editable_content("cloud.domains", "not a domain\n")["ok"])
        self.assertTrue(server.validate_editable_content("updates.networks", "10.0.0.0/8\n192.0.2.1/32\n")["ok"])
        self.assertFalse(server.validate_editable_content("updates.networks", "999.1.1.0/24\n")["ok"])

    def test_wireguard_map(self):
        result = server.validate_editable_content("wg.map", "180.wgclt7 wgclt7 WG-DE\n")
        self.assertTrue(result["ok"])
        duplicate = server.validate_editable_content("wg.map", "180.wgclt7 wgclt7 WG-DE\n180.wgclt7 wgclt8 WG-CH\n")
        self.assertFalse(duplicate["ok"])


class BackupTests(unittest.TestCase):
    def test_backup_and_restore_roundtrip(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "wg-map.conf"
            config.write_text("old\n", encoding="utf-8")
            original = (server.ROOT, server.BACKUP_DIR, server.CONFIG_BACKUP_PATHS, server.systemctl)
            try:
                server.ROOT = root
                server.BACKUP_DIR = root / "backups"
                server.CONFIG_BACKUP_PATHS = (config,)
                server.systemctl = lambda *args: {"ok": True, "output": ""}
                item = server.create_config_backup("test")
                config.write_text("new\n", encoding="utf-8")
                result = server.restore_config_backup(item["id"])
                self.assertTrue(result["ok"])
                self.assertEqual(config.read_text(encoding="utf-8"), "old\n")
            finally:
                server.ROOT, server.BACKUP_DIR, server.CONFIG_BACKUP_PATHS, server.systemctl = original


class WebAuthnHelpersTests(unittest.TestCase):
    def test_cbor_decode(self):
        value, offset = server.cbor_decode(bytes.fromhex("a201022001"))
        self.assertEqual(value, {1: 2, -1: 1})
        self.assertEqual(offset, 5)

    def test_public_key_pem(self):
        pem = server.public_key_pem_from_cose({1: 2, 3: -7, -1: 1, -2: b"x" * 32, -3: b"y" * 32})
        self.assertIn("BEGIN PUBLIC KEY", pem)

    def test_assertion_signature(self):
        x = bytes.fromhex("6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296")
        y = bytes.fromhex("4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")
        public_pem = server.public_key_pem_from_cose({1: 2, 3: -7, -1: 1, -2: x, -3: y})
        rp_id = "urm.olshaniki.com"
        origin = f"https://{rp_id}"
        challenge_bytes = b"c" * 32
        client_data = json.dumps({"type": "webauthn.get", "challenge": server.b64url_encode(challenge_bytes), "origin": origin}, separators=(",", ":")).encode()
        auth_data = hashlib.sha256(rp_id.encode()).digest() + b"\x01" + struct.pack(">I", 1)
        private_der = bytes.fromhex("30770201010420") + (b"\0" * 31 + b"\x01") + bytes.fromhex("a00a06082a8648ce3d030107a14403420004") + x + y
        with tempfile.TemporaryDirectory() as directory:
            directory = Path(directory)
            (directory / "private.der").write_bytes(private_der)
            subprocess.run(["openssl", "ec", "-inform", "DER", "-in", directory / "private.der", "-out", directory / "private.pem"], check=True, capture_output=True)
            (directory / "signed.bin").write_bytes(auth_data + hashlib.sha256(client_data).digest())
            subprocess.run(["openssl", "dgst", "-sha256", "-sign", directory / "private.pem", "-out", directory / "signature.bin", directory / "signed.bin"], check=True)
            response = {
                "clientDataJSON": server.b64url_encode(client_data),
                "authenticatorData": server.b64url_encode(auth_data),
                "signature": server.b64url_encode((directory / "signature.bin").read_bytes()),
            }
            counter = server.verify_passkey_assertion({"publicKeyPem": public_pem}, response, {"challenge": challenge_bytes, "origin": origin, "rpId": rp_id})
            self.assertEqual(counter, 1)


if __name__ == "__main__":
    unittest.main()
