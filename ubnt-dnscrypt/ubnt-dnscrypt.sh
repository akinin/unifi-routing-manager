#!/bin/sh

BASE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$BASE/.." && pwd)"
CLOUD_DIR="$PROJECT_ROOT/ubnt-cloud"
UPDATES_DIR="$PROJECT_ROOT/ubnt-updates"

DOMAINS_FILE="$BASE/domains.txt"
FORWARDING_FILE="/run/dnscrypt-forwarding.txt"
RESOLVER="1.1.1.1"
DNS_PRIO="120"
DNSCRYPT_CONFIG="${UNIFI_DNSCRYPT_CONFIG:-/run/dnscrypt-proxy.toml}"
DNSCRYPT_BIN="${UNIFI_DNSCRYPT_BIN:-/usr/sbin/dnscrypt-proxy}"
DNSMASQ_PID_FILE="${UNIFI_DNSMASQ_PID_FILE:-/run/dnsmasq-main.pid}"

LOG="$BASE/ubnt-dnscrypt.log"
LOCK="/tmp/ubnt-dnscrypt.lock"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" >> "$LOG"
}

ensure_files() {
  mkdir -p "$BASE"
  [ -f "$DOMAINS_FILE" ] || touch "$DOMAINS_FILE"
  [ -f "$LOG" ] || touch "$LOG"
}

list_entries() {
  grep -v '^[[:space:]]*#' "$1" 2>/dev/null | sed '/^[[:space:]]*$/d'
}

cleanup_dns_route() {
  while :; do
    line="$(ip rule show | sed -n "/^$DNS_PRIO:/p" | sed -n '1p')"
    [ -z "$line" ] && break

    rule="$(echo "$line" | sed "s/^$DNS_PRIO:[[:space:]]*//")"
    log "delete dns route rule: $rule"
    ip rule del $rule >/dev/null 2>&1 || break
  done
}

select_dns_route() {
  for dir in "$CLOUD_DIR" "$UPDATES_DIR"; do
    table="$(cat "$dir/active-table" 2>/dev/null || true)"
    iface="$(cat "$dir/active-iface" 2>/dev/null || true)"

    [ -n "$table" ] || continue
    [ "$table" != "unknown" ] || continue
    [ -n "$iface" ] || continue
    [ "$iface" != "unknown" ] || continue

    echo "$table|$iface"
    return 0
  done

  return 1
}

apply_dns_route() {
  route="$(select_dns_route || true)"
  cleanup_dns_route

  if [ -z "$route" ]; then
    log "dns route: no active WireGuard table"
    return 0
  fi

  table="${route%%|*}"
  iface="${route#*|}"
  ip rule add to "$RESOLVER/32" lookup "$table" priority "$DNS_PRIO" >/dev/null 2>&1 || true
  log "dns route: $RESOLVER via $table ($iface)"
}

root_domain() {
  echo "$1" | awk -F. 'NF >= 2 {print $(NF-1)"."$NF}'
}

extract_domains() {
  log "=== extract domains ==="
  > "$DOMAINS_FILE"

  for src in "$CLOUD_DIR/domains.txt" "$UPDATES_DIR/update-domains.txt"; do
    [ -f "$src" ] || {
      log "WARNING: missing $src"
      continue
    }

    log "reading $src"

    list_entries "$src" | while read -r domain; do
      root="$(root_domain "$domain")"
      [ -z "$root" ] && continue

      grep -Fxq "$root" "$DOMAINS_FILE" || {
        echo "$root" >> "$DOMAINS_FILE"
        log "add $domain -> $root"
      }
    done
  done

  sort -u "$DOMAINS_FILE" > /tmp/ubnt-dnscrypt-domains.txt
  cat /tmp/ubnt-dnscrypt-domains.txt > "$DOMAINS_FILE"
  rm -f /tmp/ubnt-dnscrypt-domains.txt
  log "extracted $(wc -l < "$DOMAINS_FILE") domains -> $DOMAINS_FILE"
}

generate_forwarding() {
  log "=== generate forwarding ==="
  mkdir -p "$(dirname "$FORWARDING_FILE")"
  > "$FORWARDING_FILE"

  list_entries "$DOMAINS_FILE" | while read -r root; do
    printf "%-30s %s\n" "$root" "$RESOLVER" >> "$FORWARDING_FILE"
    log "forward $root -> $RESOLVER"
  done

  apply_dns_route
  log "generated $(wc -l < "$FORWARDING_FILE") rules -> $FORWARDING_FILE"
}

configure_dnscrypt() {
  tmp="/tmp/ubnt-dnscrypt-proxy.toml"

  [ -f "$DNSCRYPT_CONFIG" ] || {
    log "ERROR: dnscrypt config not found: $DNSCRYPT_CONFIG"
    return 1
  }

  [ -x "$DNSCRYPT_BIN" ] || {
    log "ERROR: dnscrypt binary not found: $DNSCRYPT_BIN"
    return 1
  }

  awk \
    -v forwarding="forwarding_rules = '$FORWARDING_FILE'" \
    -v hot_reload="enable_hot_reload = true" '
      BEGIN { added = 0 }
      /^[[:space:]]*forwarding_rules[[:space:]]*=/ { next }
      /^[[:space:]]*enable_hot_reload[[:space:]]*=/ { next }
      /^\[/ && !added {
        print forwarding
        print hot_reload
        added = 1
      }
      { print }
      END {
        if (!added) {
          print forwarding
          print hot_reload
        }
      }
    ' "$DNSCRYPT_CONFIG" > "$tmp" || return 1

  if ! "$DNSCRYPT_BIN" -check -config "$tmp" >/dev/null 2>&1; then
    log "ERROR: generated dnscrypt config failed validation"
    rm -f "$tmp"
    return 1
  fi

  cat "$tmp" > "$DNSCRYPT_CONFIG"
  rm -f "$tmp"
  log "configured forwarding_rules=$FORWARDING_FILE in $DNSCRYPT_CONFIG"
}

flush_dns_cache() {
  pid="$(cat "$DNSMASQ_PID_FILE" 2>/dev/null || true)"

  if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
    log "ERROR: dnsmasq main process not found"
    return 1
  fi

  kill -HUP "$pid" || return 1
  log "dns cache cleared via HUP to dnsmasq pid=$pid"
}

restart_dnscrypt() {
  log "restarting dnscrypt-proxy"

  if systemctl list-unit-files dnscrypt-proxy.service 2>/dev/null | grep -q '^dnscrypt-proxy.service'; then
    systemctl restart dnscrypt-proxy >/dev/null 2>&1 || return 1
    log "dnscrypt-proxy restarted OK"
    return 0
  fi

  old_pid="$(pgrep -xo dnscrypt-proxy 2>/dev/null || true)"
  [ -n "$old_pid" ] || {
    log "ERROR: dnscrypt-proxy process not found"
    return 1
  }

  kill -TERM "$old_pid" || return 1

  i=1
  while [ "$i" -le 15 ]; do
    new_pid="$(pgrep -xo dnscrypt-proxy 2>/dev/null || true)"
    if [ -n "$new_pid" ] && [ "$new_pid" != "$old_pid" ]; then
      log "dnscrypt-proxy restarted OK pid=$new_pid"
      return 0
    fi
    sleep 1
    i=$((i+1))
  done

  log "ERROR: dnscrypt-proxy was not restarted by ubios"
  return 1
}

summary() {
  domains_count="$(list_entries "$DOMAINS_FILE" | wc -l)"
  forwarding_count="$(list_entries "$FORWARDING_FILE" | wc -l)"
  if pgrep -x dnscrypt-proxy >/dev/null 2>&1; then
    dnscrypt_status="active"
  else
    dnscrypt_status="inactive"
  fi

  log "summary: domains=$domains_count forwarding=$forwarding_count dnscrypt-proxy=$dnscrypt_status"
}

update_all() {
  log "=== start full update ==="

  extract_domains
  generate_forwarding
  configure_dnscrypt || return 1
  restart_dnscrypt || return 1
  flush_dns_cache || true
  summary

  log "=== done ==="
}

main() {
  if ! mkdir "$LOCK" 2>/dev/null; then
    log "SKIP: another instance is running"
    exit 0
  fi

  trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT INT TERM

  ensure_files

  case "$1" in
    extract)
      extract_domains
      summary
      ;;
    generate)
      generate_forwarding
      summary
      ;;
    restart)
      rc=0
      configure_dnscrypt && restart_dnscrypt || rc=$?
      summary
      return "$rc"
      ;;
    flush-cache)
      rc=0
      flush_dns_cache || rc=$?
      summary
      return "$rc"
      ;;
    stop)
      cleanup_dns_route
      summary
      ;;
    update|"")
      update_all
      ;;
    *)
      echo "Usage: $0 [extract|generate|restart|flush-cache|stop|update]" >&2
      exit 2
      ;;
  esac
}

main "$@"
