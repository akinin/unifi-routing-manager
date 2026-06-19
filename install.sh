#!/bin/sh

set -eu

PROJECT_ROOT="${UNIFI_ROUTING_ROOT:-/persistent}"
WEB_HOST="${UNIFI_WEB_HOST:-0.0.0.0}"
WEB_PORT="${UNIFI_WEB_PORT:-8090}"

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

require_root
require_file "$PROJECT_ROOT/web/install-service.sh"

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

systemctl daemon-reload
systemctl start ubnt-cloud-routes.service || true
systemctl start ubnt-updates-routes.service || true
systemctl start ubnt-dnscrypt.service || true
systemctl start ubnt-isp-icons.service || true

echo "Installation complete."
echo "Web UI: http://<device-lan-ip>:$WEB_PORT"
