#!/bin/sh

set -eu

APP="/usr/lib/unifi/webapps/ROOT/app-unifi"
BASE="/persistent/ubnt-isp-icons"
INSTALL="$BASE/install.sh"
LOG="$BASE/systemd-install.log"

mkdir -p "$BASE"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

log "=== start UBNT ISP icons install wrapper ==="

# Ждём до 5 минут появления UniFi web assets.
i=0
while [ "$i" -lt 60 ]; do
  if [ -d "$APP/react/js" ] && ls "$APP"/react/js/swai.*.js >/dev/null 2>&1; then
    log "UniFi assets found"
    break
  fi

  log "waiting for UniFi assets, attempt=$i"
  i=$((i + 1))
  sleep 5
done

if ! ls "$APP"/react/js/swai.*.js >/dev/null 2>&1; then
  log "ERROR: swai bundle not found after timeout"
  exit 1
fi

if [ ! -x "$INSTALL" ]; then
  log "ERROR: install.sh not executable or missing: $INSTALL"
  exit 1
fi

log "running install.sh"

"$INSTALL" >> "$LOG" 2>&1

log "=== done UBNT ISP icons install wrapper ==="
