#!/bin/sh

set -eu

SERVICE="unifi-routing-web.service"
PROJECT_ROOT="${UNIFI_ROUTING_ROOT:-/persistent/unifi-routing-manager}"
WEB_HOST="${UNIFI_WEB_HOST:-0.0.0.0}"
WEB_PORT="${UNIFI_WEB_PORT:-8090}"
UNIT="/etc/systemd/system/$SERVICE"
PYTHON_BIN="$(command -v python3 || true)"

if [ "$(id -u)" != "0" ]; then
  echo "ERROR: run as root" >&2
  exit 1
fi

if [ -z "$PYTHON_BIN" ]; then
  echo "ERROR: python3 not found" >&2
  exit 1
fi

if [ ! -f "$PROJECT_ROOT/web/server.py" ]; then
  echo "ERROR: missing $PROJECT_ROOT/web/server.py" >&2
  exit 1
fi

cat > "$UNIT" <<EOF
[Unit]
Description=UniFi Routing Manager Web UI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$PROJECT_ROOT
Environment=UNIFI_ROUTING_ROOT=$PROJECT_ROOT
Environment=UNIFI_WEB_HOST=$WEB_HOST
Environment=UNIFI_WEB_PORT=$WEB_PORT
EnvironmentFile=-$PROJECT_ROOT/urm.env
ExecStart=$PYTHON_BIN $PROJECT_ROOT/web/server.py
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

chmod 644 "$UNIT"
systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo "Installed and started $SERVICE"
echo "Open http://<device-lan-ip>:$WEB_PORT or place it behind a trusted HTTPS reverse proxy"
