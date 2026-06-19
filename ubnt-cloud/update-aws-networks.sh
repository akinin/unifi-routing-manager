#!/bin/sh

BASE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
JSON="/tmp/aws-ip-ranges.json"
GENERATED="$BASE/networks-aws-generated.txt"
NETWORKS="$BASE/networks.txt"
MANUAL="$BASE/networks-manual.txt"
LOG="$BASE/ubnt-cloud-routes.log"
LOCK="/tmp/ubnt-cloud-aws-networks.lock"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

ensure_files() {
  mkdir -p "$BASE"
  [ -f "$NETWORKS" ] || touch "$NETWORKS"
  [ -f "$MANUAL" ] || touch "$MANUAL"
  [ -f "$LOG" ] || touch "$LOG"
}

list_entries() {
  grep -v '^[[:space:]]*#' "$1" 2>/dev/null | sed '/^[[:space:]]*$/d'
}

init_manual_networks() {
  generated_file="$1"

  [ ! -s "$MANUAL" ] || return 0
  [ -f "$generated_file" ] || return 0

  list_entries "$generated_file" > /tmp/networks-aws-generated.current
  list_entries "$NETWORKS" | grep -Fvx -f /tmp/networks-aws-generated.current > "$MANUAL" || true
  rm -f /tmp/networks-aws-generated.current

  log "initialized manual networks file: $MANUAL"
}

ensure_files

if ! mkdir "$LOCK" 2>/dev/null; then
  log "SKIP: AWS networks update already running"
  exit 0
fi

trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT INT TERM

log "=== start AWS networks update ==="

init_manual_networks "$GENERATED"

curl -fsSL https://ip-ranges.amazonaws.com/ip-ranges.json -o "$JSON" || {
  log "ERROR: failed to download AWS ip-ranges.json"
  echo "ERROR: failed to download AWS ip-ranges.json"
  exit 1
}

python3 - "$JSON" "$GENERATED" <<'PY'
import json
import sys

json_path = sys.argv[1]
out_path = sys.argv[2]

with open(json_path, "r", encoding="utf-8") as f:
    data = json.load(f)

wanted = set()

for p in data.get("prefixes", []):
    ip = p.get("ip_prefix")
    region = p.get("region")
    service = p.get("service")

    if not ip:
        continue

    if region == "GLOBAL" and service == "CLOUDFRONT":
        wanted.add(ip)

    if region == "us-west-2" and service in ("AMAZON", "EC2"):
        wanted.add(ip)

with open(out_path, "w", encoding="utf-8") as f:
    f.write("# Generated from https://ip-ranges.amazonaws.com/ip-ranges.json\n")
    f.write("# Includes: GLOBAL CLOUDFRONT + us-west-2 AMAZON/EC2\n")
    f.write("# Generated automatically\n")
    for cidr in sorted(wanted):
        f.write(cidr + "\n")

print(len(wanted))
PY

COUNT="$(list_entries "$GENERATED" | wc -l)"

log "generated AWS networks: $COUNT -> $GENERATED"
echo "generated AWS networks: $COUNT"

if [ ! -s "$MANUAL" ]; then
  init_manual_networks "$GENERATED"
fi

{
  echo "# Manual networks + AWS generated networks"
  echo "# Manual entries: $MANUAL"
  echo "# Generated entries: $GENERATED"
  echo "# Updated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  list_entries "$MANUAL"
  list_entries "$GENERATED"
} | sort -u > /tmp/networks.txt.new

cat /tmp/networks.txt.new > "$NETWORKS"
rm -f /tmp/networks.txt.new

FINAL_COUNT="$(list_entries "$NETWORKS" | wc -l)"

log "final networks count: $FINAL_COUNT -> $NETWORKS"
log "=== done AWS networks update ==="
echo "final networks count: $FINAL_COUNT"
