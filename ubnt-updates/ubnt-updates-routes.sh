#!/bin/sh

BASE="/persistent/ubnt-updates"
MAP="$BASE/wg-map.conf"
DOMAINS_FILE="$BASE/update-domains.txt"
ACTIVE_TABLE_FILE="$BASE/active-table"
ACTIVE_IFACE_FILE="$BASE/active-iface"
ACTIVE_NAME_FILE="$BASE/active-name"
LOG="$BASE/ubnt-updates-routes.log"

PRIO="110"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

select_wg() {
  if [ ! -f "$MAP" ]; then
    log "ERROR: missing $MAP"
    return 1
  fi

  while read -r table iface name; do
    [ -z "$table" ] && continue
    echo "$table" | grep -q '^#' && continue

    log "test WG table=$table iface=$iface name=$name"

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

cleanup_old_update_rules() {
  log "cleanup old UniFi update wgclt rules with priority $PRIO"

  ip rule show \
    | grep "^${PRIO}:" \
    | grep 'lookup .*wgclt' \
    | while read -r line; do
        rule="$(echo "$line" | sed 's/^[0-9]\+:\s*//')"
        log "delete old rule: $rule"
        ip rule del $rule 2>/dev/null || true
      done
}

add_rule() {
  dst="$1"
  table="$2"

  ip rule show | grep -F "to $dst lookup $table" >/dev/null 2>&1
  if [ $? -eq 0 ]; then
    log "exists $dst via $table"
  else
    log "add $dst via $table"
    ip rule add to "$dst" lookup "$table" priority "$PRIO" 2>/dev/null || true
  fi
}

add_update_routes() {
  table="$1"

  log "add UniFi update CDN networks via $table"

  # AWS CloudFront для firmware/updates
  for net in \
  13.32.0.0/15 \
  13.249.0.0/16 \
  99.84.0.0/16 \
  65.8.0.0/15 \
  108.157.0.0/16
  do
    add_rule "$net" "$table"
  done

  if [ ! -f "$DOMAINS_FILE" ]; then
    log "WARNING: missing $DOMAINS_FILE"
    return
  fi

  log "resolve UniFi update domains"

  while read -r domain; do
    [ -z "$domain" ] && continue
    echo "$domain" | grep -q '^#' && continue

    log "resolve $domain"

    dig +short "$domain" 2>/dev/null \
      | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
      | sort -u \
      | while read -r ip; do
          add_rule "$ip/32" "$table"
        done
  done < "$DOMAINS_FILE"
}

flush_update_conntrack() {
  log "flush UniFi update conntrack entries"

  # Получить IP-адреса доменов обновлений и сбросить их conntrack
  if [ -f "$DOMAINS_FILE" ]; then
    while read -r domain; do
      [ -z "$domain" ] && continue
      echo "$domain" | grep -q '^#' && continue

      dig +short "$domain" 2>/dev/null \
        | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
        | sort -u \
        | while read -r ip; do
            conntrack -D -d "$ip" 2>/dev/null || true
          done
    done < "$DOMAINS_FILE"
  fi
}

log "=== start UniFi Updates WG routing ==="

select_wg || {
  log "ABORT: no working WG selected"
  exit 1
}

TABLE="$(cat "$ACTIVE_TABLE_FILE")"
IFACE="$(cat "$ACTIVE_IFACE_FILE")"
NAME="$(cat "$ACTIVE_NAME_FILE")"

log "active WG: name=$NAME iface=$IFACE table=$TABLE"

cleanup_old_update_rules
add_update_routes "$TABLE"
flush_update_conntrack

log "=== done UniFi Updates WG routing via $NAME / $TABLE ==="

exit 0
