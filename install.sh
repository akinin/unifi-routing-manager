#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="${UNIFI_ROUTING_ROOT:-$SCRIPT_DIR}"
WEB_HOST="${UNIFI_WEB_HOST:-0.0.0.0}"
WEB_PORT="${UNIFI_WEB_PORT:-8090}"
AUTH_FILE="$PROJECT_ROOT/urm-auth.json"

require_root() {
  if [ "$(id -u)" != "0" ]; then
    echo "ERROR: run as root" >&2
    exit 1
  fi
}

require_file() {
  if [ ! -f "$1" ]; then
    echo "ERROR: missing $1" >&2
    exit 1
  fi
}

write_unit() {
  path="$1"
  content="$2"
  printf "%s\n" "$content" > "$path"
  chmod 644 "$path"
}

install_routing_timer() {
  name="$1"
  description="$2"
  script="$3"
  boot_delay="$4"
  interval="$5"

  require_file "$script"

  write_unit "/etc/systemd/system/$name.service" "[Unit]
Description=$description
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/sh $script"

  write_unit "/etc/systemd/system/$name.timer" "[Unit]
Description=Run $description periodically

[Timer]
OnBootSec=$boot_delay
OnUnitInactiveSec=$interval
AccuracySec=30s
Persistent=true
Unit=$name.service

[Install]
WantedBy=timers.target"

  systemctl daemon-reload
  systemctl enable "$name.timer"
  systemctl restart "$name.timer"
}

install_dnscrypt_timer() {
  require_file "$PROJECT_ROOT/ubnt-dnscrypt/ubnt-dnscrypt.sh"

  write_unit "/etc/systemd/system/ubnt-dnscrypt.service" "[Unit]
Description=Update DNSCrypt forwarding rules for UniFi domains
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/sh $PROJECT_ROOT/ubnt-dnscrypt/ubnt-dnscrypt.sh update"

  write_unit "/etc/systemd/system/ubnt-dnscrypt.timer" "[Unit]
Description=Run UniFi DNSCrypt forwarding updates periodically

[Timer]
OnBootSec=4min
OnUnitInactiveSec=1h
AccuracySec=1min
Persistent=true
Unit=ubnt-dnscrypt.service

[Install]
WantedBy=timers.target"

  systemctl daemon-reload
  systemctl enable ubnt-dnscrypt.timer
  systemctl restart ubnt-dnscrypt.timer
}

install_isp_icons_service() {
  require_file "$PROJECT_ROOT/ubnt-isp-icons/install-systemd-wrapper.sh"

  write_unit "/etc/systemd/system/ubnt-isp-icons.service" "[Unit]
Description=Install custom ISP icons into UniFi Network UI
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/bin/sh $PROJECT_ROOT/ubnt-isp-icons/install-systemd-wrapper.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target"

  systemctl daemon-reload
  systemctl enable ubnt-isp-icons.service
}

install_web_service() {
  UNIFI_ROUTING_ROOT="$PROJECT_ROOT" \
  UNIFI_WEB_HOST="$WEB_HOST" \
  UNIFI_WEB_PORT="$WEB_PORT" \
    /bin/sh "$PROJECT_ROOT/web/install-service.sh"
}

install_cli_shortcuts() {
  require_file "$PROJECT_ROOT/unifi-routing-manager.sh"

  cat > /usr/bin/urm <<EOF
#!/bin/sh
exec /bin/bash "$PROJECT_ROOT/unifi-routing-manager.sh" "\$@"
EOF
  chmod 755 /usr/bin/urm

  cat > /usr/bin/unifi-routing <<EOF
#!/bin/sh
exec /bin/bash "$PROJECT_ROOT/unifi-routing-manager.sh" "\$@"
EOF
  chmod 755 /usr/bin/unifi-routing

  cat > /persistent/unifi-routing-manager.sh <<EOF
#!/bin/sh
exec /bin/bash "$PROJECT_ROOT/unifi-routing-manager.sh" "\$@"
EOF
  chmod 755 /persistent/unifi-routing-manager.sh
}

install_shared_wg_map() {
  shared_map="$PROJECT_ROOT/wg-map.conf"
  [ -f "$shared_map" ] && return 0

  if [ -f "$PROJECT_ROOT/ubnt-cloud/wg-map.conf" ]; then
    cp "$PROJECT_ROOT/ubnt-cloud/wg-map.conf" "$shared_map"
  elif [ -f "$PROJECT_ROOT/ubnt-updates/wg-map.conf" ]; then
    cp "$PROJECT_ROOT/ubnt-updates/wg-map.conf" "$shared_map"
  else
    touch "$shared_map"
  fi

  chmod 644 "$shared_map"
}

configure_wg_map() {
  shared_map="$PROJECT_ROOT/wg-map.conf"
  [ -f "$shared_map" ] && return 0

  echo "Enter WireGuard map rows. Format: <table> <iface> <name>"
  echo "Example: 180.wgclt7 wgclt7 WG-DE"
  echo "Submit an empty line to finish."
  : > "$shared_map"
  while :; do
    printf "> "
    read -r row || true
    [ -n "$row" ] || break
    echo "$row" >> "$shared_map"
  done
  chmod 644 "$shared_map"
}

configure_auth() {
  [ -f "$AUTH_FILE" ] && return 0

  printf "Display name: "
  read -r display_name
  printf "Login: "
  read -r login
  printf "Password: "
  stty -echo 2>/dev/null || true
  read -r password
  stty echo 2>/dev/null || true
  echo

  python3 - "$AUTH_FILE" "$display_name" "$login" "$password" <<'PY'
import base64
import hashlib
import json
import secrets
import sys
from pathlib import Path

path, name, username, password = sys.argv[1:5]
salt = secrets.token_hex(16)
digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 120000)
Path(path).parent.mkdir(parents=True, exist_ok=True)
Path(path).write_text(json.dumps({
    "name": name or "Administrator",
    "username": username or "admin",
    "passwordSalt": salt,
    "passwordHash": base64.b64encode(digest).decode(),
    "sessionSecret": secrets.token_hex(32),
    "avatar": "",
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY
  chmod 600 "$AUTH_FILE"
}

install_all() {
  require_root
  require_file "$PROJECT_ROOT/web/install-service.sh"
  configure_wg_map
  configure_auth
  install_shared_wg_map

  install_routing_timer \
    "ubnt-cloud-routes" \
    "UniFi Cloud policy routing" \
    "$PROJECT_ROOT/ubnt-cloud/ubnt-cloud-routes.sh" \
    "2min" \
    "15min"

  install_routing_timer \
    "ubnt-updates-routes" \
    "UniFi firmware update policy routing" \
    "$PROJECT_ROOT/ubnt-updates/ubnt-updates-routes.sh" \
    "3min" \
    "30min"

  install_dnscrypt_timer
  install_isp_icons_service
  install_web_service
  install_cli_shortcuts

  systemctl daemon-reload
  systemctl start ubnt-cloud-routes.service || true
  systemctl start ubnt-updates-routes.service || true
  systemctl start ubnt-dnscrypt.service || true
  systemctl start ubnt-isp-icons.service || true

  echo "Installation complete."
  echo "Web UI: http://<device-lan-ip>:$WEB_PORT"
}

uninstall_all() {
  require_root
  systemctl stop unifi-routing-web.service ubnt-cloud-routes.timer ubnt-updates-routes.timer ubnt-dnscrypt.timer ubnt-isp-icons.service 2>/dev/null || true
  systemctl disable unifi-routing-web.service ubnt-cloud-routes.timer ubnt-updates-routes.timer ubnt-dnscrypt.timer ubnt-isp-icons.service 2>/dev/null || true
  rm -f /etc/systemd/system/unifi-routing-web.service \
    /etc/systemd/system/ubnt-cloud-routes.service /etc/systemd/system/ubnt-cloud-routes.timer \
    /etc/systemd/system/ubnt-updates-routes.service /etc/systemd/system/ubnt-updates-routes.timer \
    /etc/systemd/system/ubnt-dnscrypt.service /etc/systemd/system/ubnt-dnscrypt.timer \
    /etc/systemd/system/ubnt-isp-icons.service /usr/bin/urm /usr/bin/unifi-routing
  systemctl daemon-reload
  echo "Services removed. Project files are left in place."
}

case "${1:-menu}" in
  install)
    install_all
    ;;
  update)
    install_all
    ;;
  uninstall|remove)
    uninstall_all
    ;;
  menu|*)
    echo "UniFi Route Manager"
    echo "1) Install"
    echo "2) Update"
    echo "3) Uninstall"
    printf "Select: "
    read -r choice
    case "$choice" in
      1) install_all ;;
      2) install_all ;;
      3) uninstall_all ;;
      *) echo "Cancelled" ;;
    esac
    ;;
esac
