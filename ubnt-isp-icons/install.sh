#!/bin/sh

set -eu

PROJECT="ubnt-isp-icons"
SRC="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
APP="/usr/lib/unifi/webapps/ROOT/app-unifi"
ASN_DIR="$APP/react/images/topology/isp/asn"
ISP_DIR="$APP/react/images/topology/isp/name"

log() {
  echo "[$PROJECT] $*"
}

installed_name_for() {
  basename "$1" | sed 's/_[0-9][0-9]*x[0-9][0-9]*\.png$//' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/_/g; s/^_*//; s/_*$//'
}

install_name_alias() {
  ICON="$1"
  ALIAS="$2"
  [ -n "$ALIAS" ] || return 0
  case "$ALIAS" in
    *[!a-z0-9_]*) return 0 ;;
  esac
  cp "$ICON" "$ISP_DIR/${ALIAS}_101x101.png"
  log "Installed name alias ${ALIAS}_101x101.png"
}

uninstall_icons() {
  log "Removing installed ISP icons..."

  for ICON in "$SRC"/*_101x101.png; do
    [ -f "$ICON" ] || continue
    NAME="$(basename "$ICON")"
    SLUG="$(installed_name_for "$ICON")"
    rm -f "$ASN_DIR/$NAME" "$ISP_DIR/${SLUG}_101x101.png"
    if [ -f "$ICON.aliases" ]; then
      while IFS= read -r ALIAS; do
        [ -n "$ALIAS" ] && rm -f "$ISP_DIR/${ALIAS}_101x101.png"
      done < "$ICON.aliases"
    fi
  done

  log "Done."
}

patch_unifi_paths() {
  HTML="$APP/index.html"

  if [ -f "$HTML" ]; then
    cp "$HTML" "$HTML.bak-remove-custom-isp-js"
    sed -i 's#<script src="/custom-icons/isp-icons.js"></script>##g' "$HTML"
    sed -i 's#<script src="custom-icons/isp-icons.js"></script>##g' "$HTML"
    sed -i 's#<script src="react/js/isp-icons.js"></script>##g' "$HTML"
    sed -i 's#<script src="angular/[^"]*/custom-icons/isp-icons.js"></script>##g' "$HTML"
    sed -i 's#<script src="/app-assets/network/react/js/isp-icons.js"></script>##g' "$HTML"
  fi

  for BUNDLE in "$APP"/react/js/swai.*.js; do
    [ -f "$BUNDLE" ] || continue

    log "Patching $BUNDLE"
    cp "$BUNDLE" "$BUNDLE.bak-app-assets-isp-paths"

    sed -i 's#asnPath:"/manage/angular/[^"]*/custom-icons/asn/"#asnPath:`${o}/asn/`#g' "$BUNDLE"
    sed -i 's#ispPath:"/manage/angular/[^"]*/custom-icons/isp/"#ispPath:`${o}/isp/`#g' "$BUNDLE"
    sed -i 's#asnPath:"/app-assets/network/react/images/topology/isp/asn/"#asnPath:`${o}/asn/`#g' "$BUNDLE"
    sed -i 's#ispPath:"/app-assets/network/react/images/topology/isp/name/"#ispPath:`${o}/isp/`#g' "$BUNDLE"
    sed -i 's#asnPath:`${o}/asn/`#asnPath:"/app-assets/network/react/images/topology/isp/asn/"#g' "$BUNDLE"
    sed -i 's#ispPath:`${o}/isp/`#ispPath:"/app-assets/network/react/images/topology/isp/name/"#g' "$BUNDLE"
  done
}

if [ "${1:-}" = "uninstall" ]; then
  uninstall_icons
  exit 0
fi

log "Installing native ISP icons via /app-assets/network/react..."

if ! ls "$SRC"/*_101x101.png >/dev/null 2>&1; then
  log "No custom ISP icons configured; nothing to install."
  exit 0
fi

mkdir -p "$ASN_DIR" "$ISP_DIR"
chmod 755 "$ASN_DIR" "$ISP_DIR"

for ICON in "$SRC"/*_101x101.png; do
  [ -f "$ICON" ] || continue
  NAME="$(basename "$ICON")"
  SLUG="$(installed_name_for "$ICON")"

  cp "$ICON" "$ASN_DIR/$NAME"
  install_name_alias "$ICON" "$SLUG"
  if [ -f "$ICON.aliases" ]; then
    while IFS= read -r ALIAS; do
      install_name_alias "$ICON" "$ALIAS"
    done < "$ICON.aliases"
  fi
  log "Installed $NAME -> $ASN_DIR/$NAME and $ISP_DIR/${SLUG}_101x101.png"
done

chmod 644 "$ASN_DIR/"*_101x101.png "$ISP_DIR/"*_101x101.png
patch_unifi_paths

log "Verifying installed files:"
for ICON in "$SRC"/*_101x101.png; do
  [ -f "$ICON" ] || continue
  NAME="$(basename "$ICON")"
  [ -s "$ASN_DIR/$NAME" ] || {
    log "ERROR: missing installed ASN icon $ASN_DIR/$NAME"
    exit 1
  }
done

log "Done."
