#!/bin/sh

set -eu

REPO="${URM_GITHUB_REPO:-akinin/unifi-routing-manager}"
BRANCH="${URM_GITHUB_BRANCH:-main}"
INSTALL_DIR="${URM_INSTALL_DIR:-/persistent/unifi-routing-manager}"
LEGACY_DIR="${URM_LEGACY_DIR:-/persistent/unifi-route-manager}"
ARCHIVE_URL="https://github.com/$REPO/archive/refs/heads/$BRANCH.tar.gz"
MODE="${1:-update}"
LOCK="/tmp/urm-update.lock"
WORK="/tmp/urm-update-$$"
PARENT_DIR="$(dirname "$INSTALL_DIR")"
INSTALL_NAME="$(basename "$INSTALL_DIR")"
STAGE_DIR="$PARENT_DIR/.$INSTALL_NAME.stage-$$"
PREVIOUS_DIR="$PARENT_DIR/.$INSTALL_NAME.previous-$$"
UPDATE_BACKUP_DIR="${URM_UPDATE_BACKUP_DIR:-/persistent/urm-backups}"
SWAPPED=0

log() {
  echo "[urm-update] $*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

rollback() {
  [ "$SWAPPED" = "1" ] || return 0
  log "health check failed; restoring previous installation"
  systemctl stop unifi-routing-web.service 2>/dev/null || true
  if [ -d "$INSTALL_DIR" ] && [ -d "$PREVIOUS_DIR" ]; then
    mv "$INSTALL_DIR" "$WORK/failed-install" 2>/dev/null || true
    mv "$PREVIOUS_DIR" "$INSTALL_DIR"
    /bin/sh "$INSTALL_DIR/scripts/install-local.sh" update || true
  fi
  SWAPPED=0
}

cleanup() {
  result=$?
  trap - EXIT INT TERM
  if [ "$result" != "0" ]; then
    rollback
  fi
  case "$WORK" in /tmp/urm-update-*) rm -rf "$WORK" ;; esac
  case "$STAGE_DIR" in "$PARENT_DIR"/.*.stage-*) rm -rf "$STAGE_DIR" ;; esac
  rmdir "$LOCK" 2>/dev/null || true
  exit "$result"
}

[ "$(id -u)" = "0" ] || fail "run as root"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"
command -v python3 >/dev/null 2>&1 || fail "python3 is required"

case "$INSTALL_DIR" in /*) ;; *) fail "install path must be absolute" ;; esac
[ "$INSTALL_DIR" != "/" ] && [ "$INSTALL_DIR" != "/persistent" ] || fail "unsafe install path: $INSTALL_DIR"
case "$LEGACY_DIR" in /*) ;; *) fail "legacy path must be absolute" ;; esac
[ "$LEGACY_DIR" != "/" ] && [ "$LEGACY_DIR" != "/persistent" ] || fail "unsafe legacy path: $LEGACY_DIR"

if ! mkdir "$LOCK" 2>/dev/null; then
  fail "another update is already running"
fi
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

mkdir -p "$WORK/archive"
log "downloading $REPO@$BRANCH"
curl -fL --retry 3 --connect-timeout 15 "$ARCHIVE_URL" -o "$WORK/source.tar.gz"
tar -xzf "$WORK/source.tar.gz" -C "$WORK/archive"
SOURCE="$(find "$WORK/archive" -mindepth 1 -maxdepth 1 -type d | sed -n '1p')"
[ -n "$SOURCE" ] && [ -f "$SOURCE/scripts/install-local.sh" ] && [ -f "$SOURCE/web/server.py" ] || fail "invalid release archive"

if [ -d "$LEGACY_DIR" ] && [ ! -e "$INSTALL_DIR" ]; then
  log "migrating $LEGACY_DIR -> $INSTALL_DIR"
  mv "$LEGACY_DIR" "$INSTALL_DIR"
fi

rm -rf "$STAGE_DIR" "$PREVIOUS_DIR"
mkdir -p "$STAGE_DIR"
cp -R "$SOURCE/." "$STAGE_DIR/"

# Carry only local configuration and user assets into staging. Runtime logs can
# grow very large on UDM persistent storage, so keep just a useful recent tail.
if [ -d "$INSTALL_DIR" ]; then
  for relative in \
    urm-auth.json urm.env wg-map.conf notification-settings.json monitor-history.json events.json \
    ubnt-cloud/domains.txt ubnt-cloud/networks-manual.txt \
    ubnt-updates/update-domains.txt ubnt-updates/networks-manual.txt; do
    if [ -f "$INSTALL_DIR/$relative" ]; then
      mkdir -p "$(dirname "$STAGE_DIR/$relative")"
      cp -p "$INSTALL_DIR/$relative" "$STAGE_DIR/$relative"
    fi
  done
  for relative in web-data backups; do
    if [ -d "$INSTALL_DIR/$relative" ]; then
      rm -rf "$STAGE_DIR/$relative"
      cp -a "$INSTALL_DIR/$relative" "$STAGE_DIR/$relative"
    fi
  done
  mkdir -p "$STAGE_DIR/ubnt-isp-icons/flags"
  for asset in "$INSTALL_DIR"/ubnt-isp-icons/*_101x101.png "$INSTALL_DIR"/ubnt-isp-icons/*.aliases "$INSTALL_DIR"/ubnt-isp-icons/*.source; do
    [ -f "$asset" ] && cp -p "$asset" "$STAGE_DIR/ubnt-isp-icons/"
  done
  if [ -d "$INSTALL_DIR/ubnt-isp-icons/flags" ]; then
    cp -a "$INSTALL_DIR/ubnt-isp-icons/flags/." "$STAGE_DIR/ubnt-isp-icons/flags/"
  fi
  for relative in \
    ubnt-cloud/ubnt-cloud-routes.log \
    ubnt-updates/ubnt-updates-routes.log \
    ubnt-dnscrypt/ubnt-dnscrypt.log \
    ubnt-isp-icons/systemd-install.log; do
    if [ -f "$INSTALL_DIR/$relative" ]; then
      mkdir -p "$(dirname "$STAGE_DIR/$relative")"
      tail -n 5000 "$INSTALL_DIR/$relative" > "$STAGE_DIR/$relative"
    fi
  done
fi

rm -rf "$STAGE_DIR/.git"
rm -f \
  "$STAGE_DIR/ubnt-cloud/wg-map.conf" \
  "$STAGE_DIR/ubnt-updates/wg-map.conf" \
  "$STAGE_DIR/ubnt-isp-icons/legacy-isp-icons.js"

chmod 755 \
  "$STAGE_DIR/install.sh" \
  "$STAGE_DIR/urm-update.sh" \
  "$STAGE_DIR/scripts/install-local.sh" \
  "$STAGE_DIR/unifi-routing-manager.sh" \
  "$STAGE_DIR/ubnt-cloud/ubnt-cloud-routes.sh" \
  "$STAGE_DIR/ubnt-cloud/update-aws-networks.sh" \
  "$STAGE_DIR/ubnt-updates/ubnt-updates-routes.sh" \
  "$STAGE_DIR/ubnt-dnscrypt/ubnt-dnscrypt.sh" \
  "$STAGE_DIR/ubnt-isp-icons/install.sh" \
  "$STAGE_DIR/ubnt-isp-icons/install-systemd-wrapper.sh" \
  "$STAGE_DIR/web/install-service.sh"

log "validating staged release"
PYTHONPYCACHEPREFIX="$WORK/pycache" python3 -m py_compile "$STAGE_DIR/web/server.py"
for script in "$STAGE_DIR"/urm-update.sh "$STAGE_DIR"/scripts/*.sh "$STAGE_DIR"/ubnt-*/*.sh; do
  /bin/sh -n "$script"
done
[ -s "$STAGE_DIR/wg-map.conf" ] || fail "staged release is missing wg-map.conf"
[ -s "$STAGE_DIR/urm-auth.json" ] || fail "staged release is missing authentication settings"

if [ -d "$INSTALL_DIR" ]; then
  mkdir -p "$UPDATE_BACKUP_DIR"
  BACKUP_FILE="$UPDATE_BACKUP_DIR/urm-before-$(date '+%Y%m%d-%H%M%S').tar.gz"
  log "creating update backup $BACKUP_FILE"
  tar -czf "$BACKUP_FILE" -C "$PARENT_DIR" "$INSTALL_NAME"
fi

printf '%s %s\n' "$BRANCH" "$(date '+%Y-%m-%d %H:%M:%S')" > "$STAGE_DIR/.urm-version"
if [ -d "$INSTALL_DIR" ]; then
  mv "$INSTALL_DIR" "$PREVIOUS_DIR"
fi
mv "$STAGE_DIR" "$INSTALL_DIR"
SWAPPED=1

log "installing staged release"
/bin/sh "$INSTALL_DIR/scripts/install-local.sh" "$MODE"

log "checking Web UI health"
healthy=0
attempt=0
while [ "$attempt" -lt 30 ]; do
  if curl -fsS --connect-timeout 2 "http://127.0.0.1:${UNIFI_WEB_PORT:-8090}/api/auth/me" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  attempt=$((attempt + 1))
  sleep 2
done
[ "$healthy" = "1" ] || fail "new Web UI did not pass the health check"

if [ -d "$PREVIOUS_DIR" ]; then
  rm -rf "$PREVIOUS_DIR"
fi
SWAPPED=0
log "complete"
log "Web UI backend: http://<UDM-IP>:${UNIFI_WEB_PORT:-8090}"
