#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="${UNIFI_ROUTING_ROOT:-$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)}"
WEB_HOST="${UNIFI_WEB_HOST:-0.0.0.0}"
WEB_PORT="${UNIFI_WEB_PORT:-8090}"
AUTH_FILE="$PROJECT_ROOT/urm-auth.json"
MODE="${1:-install}"

require_root() {
  [ "$(id -u)" = "0" ] || {
    echo "ERROR: run as root" >&2
    exit 1
  }
}

require_file() {
  [ -f "$1" ] || {
    echo "ERROR: missing $1" >&2
    exit 1
  }
}

write_unit() {
  path="$1"
  content="$2"
  printf '%s\n' "$content" > "$path"
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

  systemctl enable ubnt-dnscrypt.timer
  systemctl restart ubnt-dnscrypt.timer
}

install_update_service() {
  write_unit "/etc/systemd/system/unifi-routing-update.service" "[Unit]
Description=Update UniFi Routing Manager from GitHub
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/bin/urm-update"
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
  require_file "$PROJECT_ROOT/urm-update.sh"

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

  cat > /usr/bin/urm-update <<EOF
#!/bin/sh
TMP="/tmp/urm-update-\$\$.sh"
cp "$PROJECT_ROOT/urm-update.sh" "\$TMP" || exit 1
chmod 700 "\$TMP"
/bin/sh "\$TMP" update
RC=\$?
rm -f "\$TMP"
exit \$RC
EOF
  chmod 755 /usr/bin/urm-update

  rm -f /persistent/unifi-routing-manager.sh
}

ensure_runtime_files() {
  mkdir -p \
    "$PROJECT_ROOT/ubnt-cloud" \
    "$PROJECT_ROOT/ubnt-updates" \
    "$PROJECT_ROOT/ubnt-dnscrypt" \
    "$PROJECT_ROOT/ubnt-isp-icons" \
    "$PROJECT_ROOT/web-data"
  touch \
    "$PROJECT_ROOT/ubnt-cloud/addresses.txt" \
    "$PROJECT_ROOT/ubnt-cloud/networks.txt" \
    "$PROJECT_ROOT/ubnt-cloud/networks-aws-generated.txt" \
    "$PROJECT_ROOT/ubnt-cloud/networks-manual.txt" \
    "$PROJECT_ROOT/ubnt-updates/addresses.txt" \
    "$PROJECT_ROOT/ubnt-updates/networks.txt" \
    "$PROJECT_ROOT/ubnt-updates/networks-manual.txt" \
    "$PROJECT_ROOT/ubnt-dnscrypt/domains.txt"
}

remove_legacy_units() {
  systemctl disable --now \
    custom-unifi-icons.timer custom-unifi-icons.service \
    ubnt-cloud-aws-networks.timer ubnt-cloud-aws-networks.service \
    2>/dev/null || true
  rm -f \
    /etc/systemd/system/custom-unifi-icons.service \
    /etc/systemd/system/custom-unifi-icons.timer \
    /etc/systemd/system/ubnt-cloud-aws-networks.service \
    /etc/systemd/system/ubnt-cloud-aws-networks.timer
  systemctl reset-failed custom-unifi-icons.service ubnt-cloud-aws-networks.service 2>/dev/null || true
}

configure_wg_map() {
  shared_map="$PROJECT_ROOT/wg-map.conf"
  [ -s "$shared_map" ] && return 0

  if [ "$MODE" = "update" ]; then
    echo "ERROR: missing or empty $shared_map" >&2
    echo "Run the installer interactively to configure WireGuard routes." >&2
    exit 1
  fi

  echo "Enter WireGuard map rows. Format: <table> <iface> <name>"
  echo "Example: 180.wgclt7 wgclt7 WG-DE"
  echo "Submit an empty line to finish."
  : > "$shared_map"
  while :; do
    printf '> '
    read -r row || true
    [ -n "$row" ] || break
    echo "$row" >> "$shared_map"
  done

  [ -s "$shared_map" ] || {
    rm -f "$shared_map"
    echo "ERROR: at least one WireGuard map row is required" >&2
    exit 1
  }
  chmod 600 "$shared_map"
}

configure_auth() {
  [ -f "$AUTH_FILE" ] && {
    chmod 600 "$AUTH_FILE"
    return 0
  }

  if [ "$MODE" = "update" ]; then
    echo "ERROR: missing $AUTH_FILE; refusing to start Web UI with default credentials" >&2
    exit 1
  fi

  printf 'Display name: '
  read -r display_name
  printf 'Login: '
  read -r login
  [ -n "$login" ] || login="admin"

  while :; do
    printf 'Password: '
    stty -echo 2>/dev/null || true
    read -r password
    stty echo 2>/dev/null || true
    echo
    [ -n "$password" ] && break
    echo "Password cannot be empty."
  done

  {
    printf '%s\n' "$display_name"
    printf '%s\n' "$login"
    printf '%s' "$password"
  } | python3 -c '
import base64
import hashlib
import json
import secrets
import sys
from pathlib import Path

path = sys.argv[1]
name = sys.stdin.readline().rstrip("\n")
username = sys.stdin.readline().rstrip("\n")
password = sys.stdin.read()
salt = secrets.token_hex(16)
digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 210000)
Path(path).parent.mkdir(parents=True, exist_ok=True)
Path(path).write_text(json.dumps({
    "name": name or "Administrator",
    "username": username,
    "passwordSalt": salt,
    "passwordHash": base64.b64encode(digest).decode(),
    "passwordIterations": 210000,
    "sessionSecret": secrets.token_hex(32),
    "avatar": "",
}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
' "$AUTH_FILE"

  unset display_name login password
  chmod 600 "$AUTH_FILE"
}

install_all() {
  require_root
  require_file "$PROJECT_ROOT/web/install-service.sh"
  remove_legacy_units
  ensure_runtime_files
  configure_wg_map
  configure_auth

  /bin/sh "$PROJECT_ROOT/ubnt-cloud/update-aws-networks.sh" || true

  install_routing_timer "ubnt-cloud-routes" "UniFi Cloud policy routing" \
    "$PROJECT_ROOT/ubnt-cloud/ubnt-cloud-routes.sh" "2min" "15min"
  install_routing_timer "ubnt-updates-routes" "UniFi firmware update policy routing" \
    "$PROJECT_ROOT/ubnt-updates/ubnt-updates-routes.sh" "3min" "30min"
  install_dnscrypt_timer
  install_update_service
  install_isp_icons_service
  install_cli_shortcuts

  systemctl daemon-reload
  install_web_service
  systemctl start ubnt-cloud-routes.service || true
  systemctl start ubnt-updates-routes.service || true
  systemctl start ubnt-dnscrypt.service || true
  systemctl restart ubnt-isp-icons.service || true

  echo "Installation complete."
  echo "Project: $PROJECT_ROOT"
  echo "Web UI: http://<device-lan-ip>:$WEB_PORT"
  echo "Update command: urm-update"
}

uninstall_all() {
  require_root
  systemctl stop unifi-routing-web.service unifi-routing-update.service \
    ubnt-cloud-routes.timer ubnt-updates-routes.timer ubnt-dnscrypt.timer \
    ubnt-isp-icons.service 2>/dev/null || true
  systemctl disable unifi-routing-web.service ubnt-cloud-routes.timer \
    ubnt-updates-routes.timer ubnt-dnscrypt.timer ubnt-isp-icons.service 2>/dev/null || true
  rm -f \
    /etc/systemd/system/unifi-routing-web.service \
    /etc/systemd/system/unifi-routing-update.service \
    /etc/systemd/system/ubnt-cloud-routes.service \
    /etc/systemd/system/ubnt-cloud-routes.timer \
    /etc/systemd/system/ubnt-updates-routes.service \
    /etc/systemd/system/ubnt-updates-routes.timer \
    /etc/systemd/system/ubnt-dnscrypt.service \
    /etc/systemd/system/ubnt-dnscrypt.timer \
    /etc/systemd/system/ubnt-isp-icons.service \
    /usr/bin/urm /usr/bin/unifi-routing /usr/bin/urm-update \
    /persistent/unifi-routing-manager.sh
  systemctl daemon-reload
  echo "Services removed. Project files and credentials remain in $PROJECT_ROOT."
}

case "$MODE" in
  install|update)
    install_all
    ;;
  uninstall|remove)
    uninstall_all
    ;;
  *)
    echo "Usage: $0 [install|update|uninstall]" >&2
    exit 2
    ;;
esac
