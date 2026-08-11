import importlib.util
import socket
import time
import unittest
from pathlib import Path


ROOT = Path(__file__).parents[1]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


server = load("urm_server_relay_tests", ROOT / "web" / "server.py")
relay = load("urm_telegram_relay_tests", ROOT / "relay" / "telegram_ws_relay.py")


class TelegramRelayTests(unittest.TestCase):
    def test_client_frame_is_masked_and_decoded(self):
        left, right = socket.socketpair()
        try:
            left.sendall(server.websocket_frame('{"hello":"world"}'))
            with right.makefile("rb") as stream:
                opcode, payload = relay.read_frame(stream)
            self.assertEqual(opcode, 1)
            self.assertEqual(payload, b'{"hello":"world"}')
        finally:
            left.close()
            right.close()

    def test_nonce_replay_is_rejected(self):
        nonce = "relay-test-nonce-1234"
        self.assertTrue(relay.accept_nonce(int(time.time()), nonce))
        self.assertFalse(relay.accept_nonce(int(time.time()), nonce))

    def test_websocket_accept_vector(self):
        self.assertEqual(relay.websocket_accept("dGhlIHNhbXBsZSBub25jZQ=="), "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=")


if __name__ == "__main__":
    unittest.main()
