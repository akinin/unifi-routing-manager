#!/bin/sh

BASE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$BASE/.." && pwd)"

COMMON_MAP="$PROJECT_ROOT/wg-map.conf"
MAP="${UNIFI_WG_MAP:-$COMMON_MAP}"
DOMAINS_FILE="$BASE/update-domains.txt"
NETWORKS_FILE="$BASE/networks.txt"
MANUAL_NETWORKS_FILE="$BASE/networks-manual.txt"
ADDRESSES_FILE="$BASE/addresses.txt"

ACTIVE_TABLE_FILE="$BASE/active-table"
ACTIVE_IFACE_FILE="$BASE/active-iface"
ACTIVE_NAME_FILE="$BASE/active-name"

LOG="$BASE/ubnt-updates-routes.log"
LOCK="/tmp/ubnt-updates-routes.lock"

PRIO="110"
RESOLVE_TRIES="3"
DNS_RESOLVER="${UNIFI_UPDATES_DNS_RESOLVER:-1.1.1.1}"

CDN_NETWORKS="
${DNS_RESOLVER}/32
13.32.0.0/15
13.249.0.0/16
99.84.0.0/16
65.8.0.0/15
108.157.0.0/16
"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

trim_log() {
  [ -f "$LOG" ] || return 0
  size="$(stat -c %s "$LOG" 2>/dev/null || echo 0)"
  [ "$size" -le 10485760 ] || {
    tail -n 5000 "$LOG" > "$LOG.trim-$$" && mv "$LOG.trim-$$" "$LOG"
  }
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
  [ -f "$NETWORKS_FILE" ] || touch "$NETWORKS_FILE"
  [ -f "$MANUAL_NETWORKS_FILE" ] || touch "$MANUAL_NETWORKS_FILE"
  [ -f "$ADDRESSES_FILE" ] || touch "$ADDRESSES_FILE"
  [ -f "$LOG" ] || touch "$LOG"
  trim_log
}

list_entries() {
  grep -v '^[[:space:]]*#' "$1" 2>/dev/null | sed '/^[[:space:]]*$/d'
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

apply_cdn_networks() {
  table="$1"

  log "apply CDN networks via $table"
  {
    echo "$CDN_NETWORKS" | sed '/^[[:space:]]*$/d'
    list_entries "$MANUAL_NETWORKS_FILE"
  } | sort -u > "$NETWORKS_FILE"

  list_entries "$NETWORKS_FILE" | while read -r net; do
    is_cidr4 "$net" || {
      log "skip invalid network: $net"
      continue
    }

    add_rule "$net" "$table"
  done
}

apply_domains() {
  table="$1"
  tmp="/tmp/ubnt-updates-addresses.txt"
  : > "$tmp"

  log "resolve update domains from $DOMAINS_FILE via $DNS_RESOLVER, tries=$RESOLVE_TRIES"

  list_entries "$DOMAINS_FILE" | while read -r domain; do
    log "resolve $domain"

    i=1
    while [ "$i" -le "$RESOLVE_TRIES" ]; do
      dig @"$DNS_RESOLVER" +short A "$domain" 2>/dev/null \
        | sort -u \
        | while read -r ip; do
            is_ipv4 "$ip" || continue
            echo "$ip" >> "$tmp"
            add_rule "$ip/32" "$table"
          done
      sleep 1
      i=$((i+1))
    done
  done

  sort -u "$tmp" > "$ADDRESSES_FILE"
  rm -f "$tmp"
}

flush_selected_conntrack() {
  log "flush conntrack for update domains"

  list_entries "$DOMAINS_FILE" | while read -r domain; do
    dig @"$DNS_RESOLVER" +short A "$domain" 2>/dev/null \
      | sort -u \
      | while read -r ip; do
          is_ipv4 "$ip" || continue
          conntrack -D -d "$ip" >/dev/null 2>&1 || true
        done
  done
}

summary() {
  table="$1"
  iface="$2"
  name="$3"

  domains_count="$(list_entries "$DOMAINS_FILE" | wc -l)"
  rules_count="$(ip rule show | grep "^$PRIO:" | grep -F "lookup $table" | wc -l)"

  log "summary: domains=$domains_count rules=$rules_count name=$name iface=$iface table=$table"
}

main() {
  if ! mkdir "$LOCK" 2>/dev/null; then
    log "SKIP: another instance is running"
    exit 0
  fi

  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT INT TERM

  ensure_files

  log "=== start UniFi Updates WG routing ==="

  select_wg || {
    log "ABORT: no working WG selected"
    exit 1
  }

  TABLE="$(cat "$ACTIVE_TABLE_FILE")"
  IFACE="$(cat "$ACTIVE_IFACE_FILE")"
  NAME="$(cat "$ACTIVE_NAME_FILE")"

  log "active WG: name=$NAME iface=$IFACE table=$TABLE"

  cleanup_rules
  apply_cdn_networks "$TABLE"
  apply_domains "$TABLE"
  flush_selected_conntrack

  ip route flush cache >/dev/null 2>&1 || true

  summary "$TABLE" "$IFACE" "$NAME"

  log "=== done UniFi Updates WG routing via $NAME / $TABLE ==="

  exit 0
}

main "$@"
