#!/bin/sh

set -eu

APP="/usr/lib/unifi/webapps/ROOT/app-unifi"
BASE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
INSTALL="$BASE/install.sh"
LOG="$BASE/systemd-install.log"

mkdir -p "$BASE"

if [ -f "$LOG" ]; then
  size="$(stat -c %s "$LOG" 2>/dev/null || echo 0)"
  if [ "$size" -gt 10485760 ]; then
    tail -n 5000 "$LOG" > "$LOG.trim-$$" && mv "$LOG.trim-$$" "$LOG"
  fi
fi

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

log "=== start UBNT ISP icons install wrapper ==="

if ! ls "$BASE"/*_101x101.png >/dev/null 2>&1; then
  log "No custom ISP icons configured; nothing to install."
  exit 0
fi

# Wait up to five minutes for the UniFi Network web assets.
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
