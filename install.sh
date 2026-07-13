#!/bin/sh

set -eu

RAW_BASE="${URM_RAW_BASE:-https://raw.githubusercontent.com/akinin/unifi-routing-manager/main}"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" 2>/dev/null && pwd || pwd)"
LOCAL_INSTALLER="$SCRIPT_DIR/scripts/install-local.sh"

if [ -f "$LOCAL_INSTALLER" ]; then
  exec /bin/sh "$LOCAL_INSTALLER" "${1:-install}"
fi

if [ "$(id -u)" != "0" ]; then
  echo "ERROR: run as root" >&2
  exit 1
fi

command -v curl >/dev/null 2>&1 || {
  echo "ERROR: curl is required" >&2
  exit 1
}

TMP="/tmp/urm-bootstrap-$$.sh"
trap 'rm -f "$TMP"' EXIT INT TERM

curl -fsSL "$RAW_BASE/urm-update.sh" -o "$TMP"
chmod 700 "$TMP"
/bin/sh "$TMP" install
