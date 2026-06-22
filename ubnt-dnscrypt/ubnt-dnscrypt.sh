#!/bin/sh

BASE="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
PROJECT_ROOT="$(CDPATH= cd -- "$BASE/.." && pwd)"
CLOUD_DIR="$PROJECT_ROOT/ubnt-cloud"
UPDATES_DIR="$PROJECT_ROOT/ubnt-updates"

DOMAINS_FILE="$BASE/domains.txt"
FORWARDING_FILE="/run/dnscrypt-forwarding.txt"
RESOLVER="1.1.1.1"
DNS_PRIO="120"

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

restart_dnscrypt() {
  log "restarting dnscrypt-proxy"

  if ! systemctl list-unit-files dnscrypt-proxy.service >/dev/null 2>&1; then
    log "dnscrypt-proxy service not managed by systemd, skip restart"
    return 0
  fi

  if systemctl restart dnscrypt-proxy >/dev/null 2>&1; then
    log "dnscrypt-proxy restarted OK"
  else
    log "WARNING: dnscrypt-proxy restart skipped or failed"
    return 0
  fi
}

summary() {
  domains_count="$(list_entries "$DOMAINS_FILE" | wc -l)"
  forwarding_count="$(list_entries "$FORWARDING_FILE" | wc -l)"
  dnscrypt_status="$(systemctl is-active dnscrypt-proxy 2>/dev/null)"
  [ -z "$dnscrypt_status" ] && dnscrypt_status="inactive"

  log "summary: domains=$domains_count forwarding=$forwarding_count dnscrypt-proxy=$dnscrypt_status"
}

update_all() {
  log "=== start full update ==="

  extract_domains
  generate_forwarding
  restart_dnscrypt || true
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
      restart_dnscrypt || true
      summary
      ;;
    stop)
      cleanup_dns_route
      summary
      ;;
    update|"")
      update_all
      ;;
    *)
      echo "Usage: $0 [extract|generate|restart|stop|update]" >&2
      exit 2
      ;;
  esac
}

main "$@"
