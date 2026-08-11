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

log() {
  echo "[urm-update] $*"
}

fail() {
  log "ERROR: $*" >&2
  exit 1
}

[ "$(id -u)" = "0" ] || fail "run as root"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v tar >/dev/null 2>&1 || fail "tar is required"

if ! mkdir "$LOCK" 2>/dev/null; then
  fail "another update is already running"
fi

cleanup() {
  case "$WORK" in
    /tmp/urm-update-*) rm -rf "$WORK" ;;
  esac
  rmdir "$LOCK" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

case "$INSTALL_DIR" in
  /*) ;;
  *) fail "install path must be absolute" ;;
esac
[ "$INSTALL_DIR" != "/" ] && [ "$INSTALL_DIR" != "/persistent" ] || fail "unsafe install path: $INSTALL_DIR"
case "$LEGACY_DIR" in
  /*) ;;
  *) fail "legacy path must be absolute" ;;
esac
[ "$LEGACY_DIR" != "/" ] && [ "$LEGACY_DIR" != "/persistent" ] || fail "unsafe legacy path: $LEGACY_DIR"

mkdir -p "$WORK/archive"
log "downloading $REPO@$BRANCH"
curl -fL --retry 3 --connect-timeout 15 "$ARCHIVE_URL" -o "$WORK/source.tar.gz"
tar -xzf "$WORK/source.tar.gz" -C "$WORK/archive"

SOURCE="$(find "$WORK/archive" -mindepth 1 -maxdepth 1 -type d | sed -n '1p')"
[ -n "$SOURCE" ] && [ -f "$SOURCE/scripts/install-local.sh" ] || fail "invalid release archive"

if [ -d "$LEGACY_DIR" ] && [ ! -e "$INSTALL_DIR" ]; then
  log "migrating $LEGACY_DIR -> $INSTALL_DIR"
  mv "$LEGACY_DIR" "$INSTALL_DIR"
fi

mkdir -p "$INSTALL_DIR"
log "updating files in $INSTALL_DIR"
cp -R "$SOURCE/." "$INSTALL_DIR/"

# Remove obsolete tracked/runtime artifacts from older layouts.
rm -rf "$INSTALL_DIR/.git"
rm -f \
  "$INSTALL_DIR/ubnt-cloud/wg-map.conf" \
  "$INSTALL_DIR/ubnt-updates/wg-map.conf" \
  "$INSTALL_DIR/ubnt-isp-icons/legacy-isp-icons.js"

chmod 755 \
  "$INSTALL_DIR/install.sh" \
  "$INSTALL_DIR/urm-update.sh" \
  "$INSTALL_DIR/scripts/install-local.sh" \
  "$INSTALL_DIR/unifi-routing-manager.sh" \
  "$INSTALL_DIR/ubnt-cloud/ubnt-cloud-routes.sh" \
  "$INSTALL_DIR/ubnt-cloud/update-aws-networks.sh" \
  "$INSTALL_DIR/ubnt-updates/ubnt-updates-routes.sh" \
  "$INSTALL_DIR/ubnt-dnscrypt/ubnt-dnscrypt.sh" \
  "$INSTALL_DIR/ubnt-isp-icons/install.sh" \
  "$INSTALL_DIR/ubnt-isp-icons/install-systemd-wrapper.sh" \
  "$INSTALL_DIR/web/install-service.sh"

printf '%s %s\n' "$BRANCH" "$(date '+%Y-%m-%d %H:%M:%S')" > "$INSTALL_DIR/.urm-version"
/bin/sh "$INSTALL_DIR/scripts/install-local.sh" "$MODE"

log "complete"
log "Web UI: http://<UDM-IP>:${UNIFI_WEB_PORT:-8090}"
