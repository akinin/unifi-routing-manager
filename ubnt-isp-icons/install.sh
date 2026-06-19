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

log "Installing native ISP icons via /app-assets/network/react..."

if [ ! -f "$SRC/31213_101x101.png" ]; then
  log "ERROR: missing $SRC/31213_101x101.png"
  exit 1
fi

if [ ! -f "$SRC/44484_101x101.png" ]; then
  log "ERROR: missing $SRC/44484_101x101.png"
  exit 1
fi

mkdir -p "$ASN_DIR" "$ISP_DIR"
chmod 755 "$ASN_DIR" "$ISP_DIR"

cp "$SRC/31213_101x101.png" "$ASN_DIR/31213_101x101.png"
cp "$SRC/44484_101x101.png" "$ASN_DIR/44484_101x101.png"

# Запасной fallback по имени провайдера.
cp "$SRC/31213_101x101.png" "$ISP_DIR/megafon_101x101.png"
cp "$SRC/44484_101x101.png" "$ISP_DIR/x_trim_101x101.png"

chmod 644 "$ASN_DIR/"*_101x101.png "$ISP_DIR/"*_101x101.png

# Убираем старые DOM-инъекции, если они когда-то добавлялись.
HTML="$APP/index.html"

if [ -f "$HTML" ]; then
  cp "$HTML" "$HTML.bak-remove-custom-isp-js"

  sed -i 's#<script src="/custom-icons/isp-icons.js"></script>##g' "$HTML"
  sed -i 's#<script src="custom-icons/isp-icons.js"></script>##g' "$HTML"
  sed -i 's#<script src="react/js/isp-icons.js"></script>##g' "$HTML"
  sed -i 's#<script src="angular/[^"]*/custom-icons/isp-icons.js"></script>##g' "$HTML"
  sed -i 's#<script src="/app-assets/network/react/js/isp-icons.js"></script>##g' "$HTML"
fi

# Патчим все swai-бандлы.
for BUNDLE in "$APP"/react/js/swai.*.js; do
  [ -f "$BUNDLE" ] || continue

  log "Patching $BUNDLE"

  cp "$BUNDLE" "$BUNDLE.bak-app-assets-isp-paths"

  # Сброс возможных старых локальных патчей.
  sed -i 's#asnPath:"/manage/angular/[^"]*/custom-icons/asn/"#asnPath:`${o}/asn/`#g' "$BUNDLE"
  sed -i 's#ispPath:"/manage/angular/[^"]*/custom-icons/isp/"#ispPath:`${o}/isp/`#g' "$BUNDLE"

  sed -i 's#asnPath:"/app-assets/network/react/images/topology/isp/asn/"#asnPath:`${o}/asn/`#g' "$BUNDLE"
  sed -i 's#ispPath:"/app-assets/network/react/images/topology/isp/name/"#ispPath:`${o}/isp/`#g' "$BUNDLE"

  # Новый локальный path.
  sed -i 's#asnPath:`${o}/asn/`#asnPath:"/app-assets/network/react/images/topology/isp/asn/"#g' "$BUNDLE"
  sed -i 's#ispPath:`${o}/isp/`#ispPath:"/app-assets/network/react/images/topology/isp/name/"#g' "$BUNDLE"

  grep -o 'asnPath:[^,}]*' "$BUNDLE" | head -1 || true
  grep -o 'ispPath:[^,}]*' "$BUNDLE" | head -1 || true
done

log "Verifying local URLs with curl:"
curl -k -I https://127.0.0.1/app-assets/network/react/images/topology/isp/asn/31213_101x101.png || true
curl -k -I https://127.0.0.1/app-assets/network/react/images/topology/isp/asn/44484_101x101.png || true

log "Done."
