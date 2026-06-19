#!/bin/sh

set -eu

PROJECT="ubnt-isp-icons"
SRC="/persistent/ubnt-isp-icons"
APP="/usr/lib/unifi/webapps/ROOT/app-unifi"
ASN_DIR="$APP/react/images/topology/isp/asn"
ISP_DIR="$APP/react/images/topology/isp/name"

log() {
  echo "[$PROJECT] $*"
}

installed_name_for() {
  basename "$1" | sed 's/_[0-9][0-9]*x[0-9][0-9]*\.png$//' | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/_/g; s/^_*//; s/_*$//'
}

uninstall_icons() {
  log "Removing installed ISP icons..."

  for ICON in "$SRC"/*_101x101.png; do
    [ -f "$ICON" ] || continue
    NAME="$(basename "$ICON")"
    SLUG="$(installed_name_for "$ICON")"
    rm -f "$ASN_DIR/$NAME" "$ISP_DIR/${SLUG}_101x101.png"
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
  log "ERROR: missing $SRC/*_101x101.png"
  exit 1
fi

mkdir -p "$ASN_DIR" "$ISP_DIR"
chmod 755 "$ASN_DIR" "$ISP_DIR"

for ICON in "$SRC"/*_101x101.png; do
  [ -f "$ICON" ] || continue
  NAME="$(basename "$ICON")"
  SLUG="$(installed_name_for "$ICON")"

  cp "$ICON" "$ASN_DIR/$NAME"
  cp "$ICON" "$ISP_DIR/${SLUG}_101x101.png"
  log "Installed $NAME -> $ASN_DIR/$NAME and $ISP_DIR/${SLUG}_101x101.png"
done

chmod 644 "$ASN_DIR/"*_101x101.png "$ISP_DIR/"*_101x101.png
patch_unifi_paths

log "Verifying local URLs with curl:"
for ICON in "$SRC"/*_101x101.png; do
  [ -f "$ICON" ] || continue
  curl -k -I "https://127.0.0.1/app-assets/network/react/images/topology/isp/asn/$(basename "$ICON")" || true
done

log "Done."
