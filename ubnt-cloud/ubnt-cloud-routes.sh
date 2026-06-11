#!/bin/sh

BASE="/persistent/ubnt-cloud"

MAP="$BASE/wg-map.conf"
DOMAINS_FILE="$BASE/domains.txt"
ADDRESSES_FILE="$BASE/addresses.txt"
NETWORKS_FILE="$BASE/networks.txt"

ACTIVE_TABLE_FILE="$BASE/active-table"
ACTIVE_IFACE_FILE="$BASE/active-iface"
ACTIVE_NAME_FILE="$BASE/active-name"

LOG="$BASE/ubnt-cloud-routes.log"
LOCK="/tmp/ubnt-cloud-routes.lock"

PRIO="100"
RESOLVE_TRIES="3"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

is_ipv4() {
  echo "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
}

is_cidr4() {
  echo "$1" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+/[0-9]+$'
}

ensure_files() {
  mkdir -p "$BASE"
  [ -f "$MAP" ] || touch "$MAP"
  [ -f "$DOMAINS_FILE" ] || touch "$DOMAINS_FILE"
  [ -f "$ADDRESSES_FILE" ] || touch "$ADDRESSES_FILE"
  [ -f "$NETWORKS_FILE" ] || touch "$NETWORKS_FILE"
  [ -f "$LOG" ] || touch "$LOG"
}

select_wg() {
  if [ ! -f "$MAP" ]; then
    log "ERROR: missing $MAP"
    return 1
  fi

  while read -r table iface name; do
    [ -z "$table" ] && continue
    echo "$table" | grep -q '^#' && continue

    [ -z "$iface" ] && continue
    [ -z "$name" ] && name="$iface"

    log "test WG table=$table iface=$iface name=$name"

    ip link show "$iface" >/dev/null 2>&1 || {
      log "fail $name: interface $iface not found"
      continue
    }

    ip route show table "$table" 2>/dev/null | grep -q '^default ' || {
      log "fail $name: no default route in table $table"
      continue
    }

    ping -c 2 -W 2 -I "$iface" 1.1.1.1 >/dev/null 2>&1 || {
      log "fail $name: ping via $iface failed"
      continue
    }

    echo "$table" > "$ACTIVE_TABLE_FILE"
    echo "$iface" > "$ACTIVE_IFACE_FILE"
    echo "$name" > "$ACTIVE_NAME_FILE"

    log "selected WG table=$table iface=$iface name=$name"
    return 0
  done < "$MAP"

  log "ERROR: no working WG found"
  return 1
}

cleanup_rules() {
  log "cleanup rules with priority $PRIO"

  while :; do
    line="$(ip rule show | sed -n "/^$PRIO:/p" | sed -n '1p')"
    [ -z "$line" ] && break

    rule="$(echo "$line" | sed 's/^[0-9]\+:[[:space:]]*//')"
    log "delete rule: $rule"
    ip rule del $rule >/dev/null 2>&1 || break
  done

  ip route flush cache >/dev/null 2>&1 || true
}

add_rule() {
  dst="$1"
  table="$2"

  [ -z "$dst" ] && return 0
  [ -z "$table" ] && return 0

  ip rule show | grep -F "to $dst lookup $table" >/dev/null 2>&1

  if [ $? -eq 0 ]; then
    log "exists $dst via $table"
  else
    log "add $dst via $table"
    ip rule add to "$dst" lookup "$table" priority "$PRIO" >/dev/null 2>&1 || true
  fi
}

normalize_addresses() {
  tmp="/tmp/ubnt-cloud-addresses-normalized.txt"

  grep -v '^[[:space:]]*#' "$ADDRESSES_FILE" 2>/dev/null \
    | sed '/^[[:space:]]*$/d' \
    | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
    | sort -u > "$tmp"

  cat "$tmp" > "$ADDRESSES_FILE"
  rm -f "$tmp"
}

learn_addresses_from_domains() {
  tmp="/tmp/ubnt-cloud-learned-addresses.txt"
  : > "$tmp"

  log "resolve domains from $DOMAINS_FILE, tries=$RESOLVE_TRIES"

  grep -v '^[[:space:]]*#' "$DOMAINS_FILE" 2>/dev/null \
    | sed '/^[[:space:]]*$/d' \
    | while read -r domain; do
        log "resolve $domain"

        i=1
        while [ "$i" -le "$RESOLVE_TRIES" ]; do
          dig +short A "$domain" 2>/dev/null \
            | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' >> "$tmp"
          sleep 1
          i=$((i+1))
        done
      done

  cat "$tmp" >> "$ADDRESSES_FILE"
  rm -f "$tmp"

  normalize_addresses
}

apply_networks() {
  table="$1"

  log "apply networks from $NETWORKS_FILE via $table"

  grep -v '^[[:space:]]*#' "$NETWORKS_FILE" 2>/dev/null \
    | sed '/^[[:space:]]*$/d' \
    | while read -r net; do
        is_cidr4 "$net" || {
          log "skip invalid network: $net"
          continue
        }

        add_rule "$net" "$table"
      done
}

apply_addresses() {
  table="$1"

  log "apply addresses from $ADDRESSES_FILE via $table"

  grep -v '^[[:space:]]*#' "$ADDRESSES_FILE" 2>/dev/null \
    | sed '/^[[:space:]]*$/d' \
    | while read -r ip; do
        is_ipv4 "$ip" || {
          log "skip invalid IP: $ip"
          continue
        }

        add_rule "$ip/32" "$table"
      done
}

flush_selected_conntrack() {
  log "flush conntrack for addresses from $ADDRESSES_FILE"

  grep -v '^[[:space:]]*#' "$ADDRESSES_FILE" 2>/dev/null \
    | sed '/^[[:space:]]*$/d' \
    | while read -r ip; do
        is_ipv4 "$ip" || continue
        conntrack -D -d "$ip" >/dev/null 2>&1 || true
      done
}

summary() {
  table="$1"
  iface="$2"
  name="$3"

  domains_count="$(grep -v '^[[:space:]]*#' "$DOMAINS_FILE" 2>/dev/null | sed '/^[[:space:]]*$/d' | wc -l)"
  networks_count="$(grep -v '^[[:space:]]*#' "$NETWORKS_FILE" 2>/dev/null | sed '/^[[:space:]]*$/d' | wc -l)"
  addresses_count="$(grep -v '^[[:space:]]*#' "$ADDRESSES_FILE" 2>/dev/null | sed '/^[[:space:]]*$/d' | wc -l)"
  rules_count="$(ip rule show | grep "^$PRIO:" | grep -F "lookup $table" | wc -l)"

  log "summary: domains=$domains_count networks=$networks_count addresses=$addresses_count rules=$rules_count name=$name iface=$iface table=$table"
}

main() {
  if ! mkdir "$LOCK" 2>/dev/null; then
    log "SKIP: another instance is running"
    exit 0
  fi

  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT INT TERM

  ensure_files

  log "=== start UniFi Cloud WG routing ==="

  select_wg || {
    log "ABORT: no working WG selected"
    exit 1
  }

  TABLE="$(cat "$ACTIVE_TABLE_FILE")"
  IFACE="$(cat "$ACTIVE_IFACE_FILE")"
  NAME="$(cat "$ACTIVE_NAME_FILE")"

  log "active WG: name=$NAME iface=$IFACE table=$TABLE"

  learn_addresses_from_domains

  cleanup_rules

  apply_networks "$TABLE"
  apply_addresses "$TABLE"

  flush_selected_conntrack

  ip route flush cache >/dev/null 2>&1 || true

  summary "$TABLE" "$IFACE" "$NAME"

  log "=== done UniFi Cloud WG routing via $NAME / $TABLE ==="

  exit 0
}

main "$@"
