#!/bin/sh

BASE="/persistent/ubnt-cloud"
JSON="/tmp/aws-ip-ranges.json"
GENERATED="$BASE/networks-aws-generated.txt"
NETWORKS="$BASE/networks.txt"
LOG="$BASE/ubnt-cloud-routes.log"

echo "$(date '+%Y-%m-%d %H:%M:%S') update AWS networks from ip-ranges.json" >> "$LOG"

curl -fsSL https://ip-ranges.amazonaws.com/ip-ranges.json -o "$JSON" || {
  echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: failed to download AWS ip-ranges.json" >> "$LOG"
  echo "ERROR: failed to download AWS ip-ranges.json"
  exit 1
}

python3 - "$JSON" "$GENERATED" <<'PY'
import json
import sys

json_path = sys.argv[1]
out_path = sys.argv[2]

with open(json_path, "r") as f:
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

with open(out_path, "w") as f:
    f.write("# Generated from https://ip-ranges.amazonaws.com/ip-ranges.json\n")
    f.write("# Includes: GLOBAL CLOUDFRONT + us-west-2 AMAZON/EC2\n")
    f.write("# Generated automatically\n")
    for cidr in sorted(wanted):
        f.write(cidr + "\n")

print(len(wanted))
PY

COUNT="$(grep -v '^[[:space:]]*#' "$GENERATED" | sed '/^[[:space:]]*$/d' | wc -l)"

echo "$(date '+%Y-%m-%d %H:%M:%S') generated AWS networks: $COUNT -> $GENERATED" >> "$LOG"
echo "generated AWS networks: $COUNT"

cp "$NETWORKS" "$NETWORKS.bak.$(date +%Y%m%d-%H%M%S)"

{
  echo "# Manual networks + AWS generated networks"
  echo "# Updated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo
  grep -v '^[[:space:]]*#' "$NETWORKS" 2>/dev/null | sed '/^[[:space:]]*$/d'
  grep -v '^[[:space:]]*#' "$GENERATED" 2>/dev/null | sed '/^[[:space:]]*$/d'
} | sort -u > /tmp/networks.txt.new

cat /tmp/networks.txt.new > "$NETWORKS"
rm -f /tmp/networks.txt.new

FINAL_COUNT="$(grep -v '^[[:space:]]*#' "$NETWORKS" | sed '/^[[:space:]]*$/d' | wc -l)"

echo "$(date '+%Y-%m-%d %H:%M:%S') final networks count: $FINAL_COUNT -> $NETWORKS" >> "$LOG"
echo "final networks count: $FINAL_COUNT"
