#!/bin/bash

# UniFi Routing Manager
# Управление маршрутизацией UniFi Cloud и Updates через WireGuard

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color
BOLD='\033[1m'

clear_screen() {
  clear 2>/dev/null || true
}

# Пути к проектам
CLOUD_DIR="/persistent/ubnt-cloud"
UPDATES_DIR="/persistent/ubnt-updates"
DNSCRYPT_DIR="/persistent/ubnt-dnscrypt"
ISP_ICONS_DIR="/persistent/ubnt-isp-icons"

# Кэш для IP и геолокации
CACHE_DIR="/tmp/unifi-routing-cache"
mkdir -p "$CACHE_DIR"

# Функция для получения внешнего IP
get_external_ip() {
  local iface=$1
  local cache_file="$CACHE_DIR/ip-${iface}"
  
  # Использовать кэш если свежий (< 5 минут)
  if [ -f "$cache_file" ]; then
    local age=$(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo 0)))
    if [ $age -lt 300 ]; then
      cat "$cache_file"
      return
    fi
  fi
  
  # Получить IP
  local ip=$(curl -4 --interface "$iface" --connect-timeout 3 -sS https://ifconfig.me 2>/dev/null || echo "N/A")
  echo "$ip" > "$cache_file"
  echo "$ip"
}

# Функция для получения геолокации IP
get_ip_geo() {
  local ip=$1
  local cache_file="$CACHE_DIR/geo-${ip}"
  
  if [ "$ip" = "N/A" ]; then
    echo "N/A"
    return
  fi
  
  # Использовать кэш если свежий (< 1 час)
  if [ -f "$cache_file" ]; then
    local age=$(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo 0)))
    if [ $age -lt 3600 ]; then
      cat "$cache_file"
      return
    fi
  fi
  
  # Получить геолокацию через ip-api.com
  local geo=$(curl -s --connect-timeout 3 "http://ip-api.com/json/${ip}?fields=country,countryCode,isp" 2>/dev/null)
  
  if [ $? -eq 0 ] && [ -n "$geo" ]; then
    local country=$(echo "$geo" | grep -o '"country":"[^"]*"' | cut -d'"' -f4)
    local code=$(echo "$geo" | grep -o '"countryCode":"[^"]*"' | cut -d'"' -f4)
    local isp=$(echo "$geo" | grep -o '"isp":"[^"]*"' | cut -d'"' -f4 | cut -c1-30)
    
    if [ -n "$country" ] && [ -n "$isp" ]; then
      local result="$code / $isp"
      echo "$result" > "$cache_file"
      echo "$result"
      return
    fi
  fi
  
  echo "Unknown"
}

# Функция для получения внешнего IP текущего подключения (без WG)
get_direct_ip() {
  local cache_file="$CACHE_DIR/ip-direct"
  
  # Использовать кэш если свежий (< 5 минут)
  if [ -f "$cache_file" ]; then
    local age=$(($(date +%s) - $(stat -c %Y "$cache_file" 2>/dev/null || echo 0)))
    if [ $age -lt 300 ]; then
      cat "$cache_file"
      return
    fi
  fi
  
  # Получить IP
  local ip=$(curl -4 --connect-timeout 3 -sS https://ifconfig.me 2>/dev/null || echo "N/A")
  echo "$ip" > "$cache_file"
  echo "$ip"
}

# Функция для получения интервала таймера из systemd
get_timer_interval() {
  local timer=$1
  local timer_file="/etc/systemd/system/$timer"
  
  if [ ! -f "$timer_file" ]; then
    echo "N/A"
    return
  fi
  
  # Попробовать OnUnitInactiveSec (запуск после завершения)
  local interval=$(grep "^OnUnitInactiveSec=" "$timer_file" 2>/dev/null | cut -d'=' -f2 | tr -d ' ')
  
  if [ -n "$interval" ]; then
    echo "$interval"
    return
  fi
  
  # Попробовать OnUnitActiveSec (запуск после активации)
  interval=$(grep "^OnUnitActiveSec=" "$timer_file" 2>/dev/null | cut -d'=' -f2 | tr -d ' ')
  
  if [ -n "$interval" ]; then
    echo "$interval"
    return
  fi
  
  # Попробовать OnCalendar
  interval=$(grep "^OnCalendar=" "$timer_file" 2>/dev/null | cut -d'=' -f2 | tr -d ' ')
  
  if [ -n "$interval" ]; then
    echo "$interval"
    return
  fi
  
  echo "N/A"
}

# Функция для вывода заголовка
print_header() {
  echo -e "${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║${NC}${BOLD}             AHS UniFi Routing Manager v1.4                ${NC}${CYAN}║${NC}"
  echo -e "${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  # Показать внешний IP
  echo -e "${BOLD}External IP Information:${NC}"
  
  local direct_ip=$(get_direct_ip)
  local direct_geo=$(get_ip_geo "$direct_ip")
  echo -e "  ${CYAN}Direct:${NC} $direct_ip ${YELLOW}($direct_geo)${NC}"
  
  # Показать IP через активные WG
  if [ -f "$CLOUD_DIR/active-iface" ]; then
    local cloud_iface=$(cat "$CLOUD_DIR/active-iface")
    local cloud_name=$(cat "$CLOUD_DIR/active-name")
    local cloud_ip=$(get_external_ip "$cloud_iface")
    local cloud_geo=$(get_ip_geo "$cloud_ip")
    echo -e "  ${GREEN}Cloud WG ($cloud_name):${NC} $cloud_ip ${YELLOW}($cloud_geo)${NC}"
  fi
  
  if [ -f "$UPDATES_DIR/active-iface" ]; then
    local updates_iface=$(cat "$UPDATES_DIR/active-iface")
    local updates_name=$(cat "$UPDATES_DIR/active-name")
    local updates_ip=$(get_external_ip "$updates_iface")
    local updates_geo=$(get_ip_geo "$updates_ip")
    echo -e "  ${GREEN}Updates WG ($updates_name):${NC} $updates_ip ${YELLOW}($updates_geo)${NC}"
  fi
  
  echo ""
}

# Функция для показа статуса одного проекта
show_project_status() {
  local project=$1
  local dir=$2
  local priority=$3
  
  local service="${project}-routes.service"
  local timer="${project}-routes.timer"
  
  if [ "$project" = "ubnt-cloud" ]; then
    echo -e "${BOLD}┌─ UBNT-CLOUD (priority $priority) ───────────────────────────────┐${NC}"
  else
    echo -e "${BOLD}┌─ UBNT-UPDATES (priority $priority) ─────────────────────────────┐${NC}"
  fi
  
  if [ -f "$dir/active-name" ]; then
    local active_name=$(cat "$dir/active-name")
    local active_iface=$(cat "$dir/active-iface")
    local active_table=$(cat "$dir/active-table")
    local rules_count=$(ip rule show | grep "^${priority}:" | grep wgclt | wc -l)
    local timer_status=$(systemctl is-active $timer 2>/dev/null | head -1)
    local service_enabled=$(systemctl is-enabled $timer 2>/dev/null | head -1)
    local timer_interval=$(get_timer_interval "$timer")
    
    [ -z "$timer_status" ] && timer_status="inactive"
    [ -z "$service_enabled" ] && service_enabled="disabled"

    echo -e "│ ${GREEN}Active WG:${NC} $active_name ($active_iface)"
    echo -e "│ ${GREEN}Table:${NC} $active_table"
    echo -e "│ ${GREEN}Rules:${NC} $rules_count"
    
    if [ "$timer_status" = "active" ]; then
      echo -e "│ ${GREEN}Timer:${NC} $timer_status ($service_enabled)"
    else
      echo -e "│ ${RED}Timer:${NC} $timer_status ($service_enabled)"
    fi
    
    echo -e "│ ${GREEN}Interval:${NC} $timer_interval"

    if [ -f "$dir/${project}-routes.log" ]; then
      local last_run=$(tail -1 "$dir/${project}-routes.log" 2>/dev/null | cut -d' ' -f1-2)
      if [ -n "$last_run" ]; then
        echo -e "│ ${GREEN}Last run:${NC} $last_run"
      fi
    fi
  else
    echo -e "│ ${YELLOW}Status: NOT CONFIGURED${NC}"
  fi
  
  echo -e "${BOLD}└───────────────────────────────────────────────────────────┘${NC}"
}

# Функция для показа статуса DNSCrypt
show_dnscrypt_status() {
  local domains_count=0
  local forwarding_count=0
  local dnscrypt_status
  local last_run

  dnscrypt_status=$(systemctl is-active dnscrypt-proxy 2>/dev/null || true)
  [ -z "$dnscrypt_status" ] && dnscrypt_status="inactive"

  [ -f "$DNSCRYPT_DIR/domains.txt" ] && \
    domains_count=$(grep -c '' "$DNSCRYPT_DIR/domains.txt" 2>/dev/null || echo 0)

  [ -f "/run/dnscrypt-forwarding.txt" ] && \
    forwarding_count=$(grep -c '' "/run/dnscrypt-forwarding.txt" 2>/dev/null || echo 0)

  last_run=$(tail -1 "$DNSCRYPT_DIR/ubnt-dnscrypt.log" 2>/dev/null | cut -d' ' -f1-2)

  echo -e "${BOLD}┌─ UBNT-DNSCRYPT ───────────────────────────────────────────┐${NC}"

  if [ "$dnscrypt_status" = "active" ]; then
    echo -e "│ ${GREEN}dnscrypt-proxy:${NC} $dnscrypt_status"
  else
    echo -e "│ ${RED}dnscrypt-proxy:${NC} $dnscrypt_status"
  fi

  echo -e "│ ${GREEN}Domains (persistent):${NC} $domains_count"
  echo -e "│ ${GREEN}Forwarding rules (/run):${NC} $forwarding_count"

  if [ -n "$last_run" ]; then
    echo -e "│ ${GREEN}Last run:${NC} $last_run"
  else
    echo -e "│ ${YELLOW}Last run:${NC} never"
  fi

  echo -e "${BOLD}└───────────────────────────────────────────────────────────┘${NC}"
}

# Функция для показа статуса ISP icons
show_isp_icons_status() {
  local install_script="$ISP_ICONS_DIR/install.sh"
  local wrapper_script="$ISP_ICONS_DIR/install-systemd-wrapper.sh"
  local icons_count=0
  local last_run

  [ -d "$ISP_ICONS_DIR" ] && icons_count=$(find "$ISP_ICONS_DIR" -maxdepth 1 -name '*_101x101.png' 2>/dev/null | wc -l)
  last_run=$(tail -1 "$ISP_ICONS_DIR/systemd-install.log" 2>/dev/null)

  echo -e "${BOLD}┌─ UBNT-ISP-ICONS ───────────────────────────────────────────┐${NC}"

  if [ -d "$ISP_ICONS_DIR" ]; then
    echo -e "│ ${GREEN}Directory:${NC} $ISP_ICONS_DIR"
  else
    echo -e "│ ${RED}Directory:${NC} missing"
  fi

  if [ -x "$install_script" ]; then
    echo -e "│ ${GREEN}Install script:${NC} executable"
  else
    echo -e "│ ${YELLOW}Install script:${NC} missing or not executable"
  fi

  if [ -x "$wrapper_script" ]; then
    echo -e "│ ${GREEN}Wrapper:${NC} executable"
  else
    echo -e "│ ${YELLOW}Wrapper:${NC} missing or not executable"
  fi

  echo -e "│ ${GREEN}Icons:${NC} $icons_count"

  if [ -n "$last_run" ]; then
    echo -e "│ ${GREEN}Last log:${NC} $last_run"
  else
    echo -e "│ ${YELLOW}Last log:${NC} never"
  fi

  echo -e "${BOLD}└───────────────────────────────────────────────────────────┘${NC}"
}

# Функция для показа полного статуса
show_status() {
  print_header
  
  # Cloud
  show_project_status "ubnt-cloud" "$CLOUD_DIR" "100"
  echo ""
  
  # Updates
  show_project_status "ubnt-updates" "$UPDATES_DIR" "110"

  echo ""

  # DNSCrypt
  show_dnscrypt_status

  echo ""

  # ISP Icons
  show_isp_icons_status
  
  echo ""
  echo -e "${BOLD}┌─ WireGuard Tunnels ───────────────────────────────────────┐${NC}"
  
  if command -v wg &> /dev/null; then
    local current_iface=""
    wg show | grep -E 'interface:|endpoint:|latest handshake:' | while read line; do
      if echo "$line" | grep -q "interface:"; then
        current_iface=$(echo $line | sed 's/interface: //')
        
        # Получить IP и геолокацию для интерфейса
        local wg_ip=$(get_external_ip "$current_iface")
        local wg_geo=$(get_ip_geo "$wg_ip")
        
        echo -e "│ ${CYAN}$current_iface${NC} → $wg_ip ${YELLOW}($wg_geo)${NC}"
      elif echo "$line" | grep -q "endpoint:"; then
        echo -e "│   endpoint: $(echo $line | sed 's/.*endpoint: //')"
      elif echo "$line" | grep -q "latest handshake:"; then
        local handshake=$(echo $line | sed 's/.*latest handshake: //')
        if echo "$handshake" | grep -qE 'second|minute'; then
          echo -e "│   handshake: ${GREEN}$handshake${NC}"
        elif echo "$handshake" | grep -q 'hour'; then
          echo -e "│   handshake: ${YELLOW}$handshake${NC}"
        else
          echo -e "│   handshake: ${RED}$handshake${NC}"
        fi
      fi
    done
  else
    echo -e "│ ${YELLOW}WireGuard not available${NC}"
  fi
  
  echo -e "${BOLD}└───────────────────────────────────────────────────────────┘${NC}"
}

# Функция для показа правил
show_rules() {
  local project=$1
  local priority=$2
  
  print_header
  echo -e "${BOLD}Rules for ${project^^} (priority $priority):${NC}"
  echo ""
  
  local rules=$(ip rule show | grep "^${priority}:" | grep wgclt)
  
  if [ -z "$rules" ]; then
    echo -e "${YELLOW}No rules found${NC}"
  else
    echo "$rules" | nl -w3 -s'. '
    echo ""
    echo -e "${GREEN}Total rules: $(echo "$rules" | wc -l)${NC}"
  fi
  
  echo ""
  read -p "Press Enter to continue..."
}

# Функция для запуска проекта
start_project() {
  local project=$1
  local service="${project}-routes.service"
  local timer="${project}-routes.timer"
  
  print_header
  echo -e "${BOLD}Starting ${project^^}...${NC}"
  echo ""
  
  # Включить и запустить timer
  systemctl enable $timer 2>&1 | sed 's/^/  /'
  systemctl start $timer 2>&1 | sed 's/^/  /'
  
  # Запустить service сразу
  systemctl start $service 2>&1 | sed 's/^/  /'
  
  echo ""
  echo -e "${GREEN}✓ ${project^^} started${NC}"
  echo ""
  
  # Показать статус
  systemctl status $timer --no-pager -l | head -10 | sed 's/^/  /'
  
  echo ""
  read -p "Press Enter to continue..."
}

# Функция для остановки проекта
stop_project() {
  local project=$1
  local dir=$2
  local priority=$3
  local service="${project}-routes.service"
  local timer="${project}-routes.timer"
  
  print_header
  echo -e "${BOLD}Stopping ${project^^}...${NC}"
  echo ""
  
  # Остановить timer и service
  echo "Stopping timer..."
  systemctl stop $timer 2>&1 | sed 's/^/  /'
  systemctl disable $timer 2>&1 | sed 's/^/  /'
  
  echo "Stopping service..."
  systemctl stop $service 2>&1 | sed 's/^/  /'
  
  # Удалить правила
  echo "Removing rules..."
  local removed=0
  ip rule show | grep "^${priority}:" | grep 'lookup .*wgclt' | while read -r line; do
    rule="$(echo "$line" | sed 's/^[0-9]\+:\s*//')"
    ip rule del $rule 2>/dev/null || true
    removed=$((removed + 1))
  done
  
  echo -e "  Removed rules with priority $priority"
  
  echo ""
  echo -e "${GREEN}✓ ${project^^} stopped${NC}"
  echo ""
  
  read -p "Press Enter to continue..."
}

# Функция для перезапуска проекта
restart_project() {
  local project=$1
  local service="${project}-routes.service"
  
  print_header
  echo -e "${BOLD}Restarting ${project^^}...${NC}"
  echo ""
  
  systemctl start $service 2>&1 | sed 's/^/  /'
  
  echo ""
  echo -e "${GREEN}✓ ${project^^} restarted${NC}"
  echo ""
  
  read -p "Press Enter to continue..."
}

# Функция для показа логов
show_logs() {
  local project=$1
  local dir=$2
  local lines=${3:-50}
  
  print_header
  echo -e "${BOLD}Logs for ${project^^} (last $lines lines):${NC}"
  echo ""
  
  if [ -f "$dir/${project}-routes.log" ]; then
    tail -n $lines "$dir/${project}-routes.log"
  else
    echo -e "${YELLOW}Log file not found${NC}"
  fi
  
  echo ""
  read -p "Press Enter to continue..."
}

# Функция для тестирования доступа
test_access() {
  local project=$1
  local dir=$2
  
  print_header
  echo -e "${BOLD}Testing ${project^^} access...${NC}"
  echo ""
  
  if [ ! -f "$dir/active-iface" ]; then
    echo -e "${RED}Error: No active interface found${NC}"
    read -p "Press Enter to continue..."
    return
  fi
  
  local iface=$(cat "$dir/active-iface")
  local wg_name=$(cat "$dir/active-name")
  
  echo -e "Testing via ${GREEN}$wg_name${NC} ($iface)..."
  echo ""
  
  if [ "$project" = "ubnt-cloud" ]; then
    echo "Testing UniFi Cloud domains..."
    echo ""
    
    for domain in unifi.ui.com protect.ui.com account.ui.com; do
      echo -n "  $domain: "
      result=$(curl -s -I --interface "$iface" --connect-timeout 5 "https://$domain" 2>&1 | grep -E 'HTTP|curl:' | head -1)
      if echo "$result" | grep -q "HTTP/2 [23]"; then
        echo -e "${GREEN}OK${NC} ($result)"
      elif echo "$result" | grep -q "HTTP"; then
        echo -e "${YELLOW}$result${NC}"
      else
        echo -e "${RED}FAILED${NC}"
      fi
    done
  else
    echo "Testing firmware/update domains..."
    echo ""
    
    for domain in fw-download.ubnt.com fw-update.ui.com; do
      echo -n "  $domain: "
      result=$(curl -s -I --interface "$iface" --connect-timeout 5 "https://$domain" 2>&1 | grep -E 'HTTP|curl:' | head -1)
      if echo "$result" | grep -q "HTTP"; then
        echo -e "${GREEN}$result${NC}"
      else
        echo -e "${RED}FAILED${NC}"
      fi
    done
  fi
  
  echo ""
  echo "External IP via $wg_name:"
  local ext_ip=$(get_external_ip "$iface")
  local ext_geo=$(get_ip_geo "$ext_ip")
  echo -e "  ${CYAN}$ext_ip${NC} ${YELLOW}($ext_geo)${NC}"
  
  echo ""
  echo ""
  read -p "Press Enter to continue..."
}

# Функция для управления проектом
manage_project() {
  local project=$1
  local dir=$2
  local priority=$3
  
  while true; do
    clear_screen
    print_header
    show_project_status "$project" "$dir" "$priority"
    
    echo ""
    echo -e "${BOLD}Actions for ${project^^}:${NC}"
    echo "  1) Start"
    echo "  2) Stop"
    echo "  3) Restart"
    echo "  4) Show rules"
    echo "  5) Show logs (50 lines)"
    echo "  6) Show logs (200 lines)"
    echo "  7) Test access"
    echo "  0) Back to main menu"
    echo ""
    
    read -p "Select action: " action
    
    case $action in
      1) start_project "$project" ;;
      2) stop_project "$project" "$dir" "$priority" ;;
      3) restart_project "$project" ;;
      4) show_rules "$project" "$priority" ;;
      5) show_logs "$project" "$dir" 50 ;;
      6) show_logs "$project" "$dir" 200 ;;
      7) test_access "$project" "$dir" ;;
      0) break ;;
      *) echo -e "${RED}Invalid option${NC}"; sleep 1 ;;
    esac
  done
}

# Функция для управления DNSCrypt
manage_dnscrypt() {
  while true; do
    clear_screen
    print_header
    show_dnscrypt_status

    echo ""
    echo -e "${BOLD}Actions for UBNT-DNSCRYPT:${NC}"
    echo "  1) Update all (extract + generate + restart)"
    echo "  2) Extract domains only"
    echo "  3) Generate forwarding only"
    echo "  4) Restart dnscrypt-proxy"
    echo "  5) Show domains.txt (persistent)"
    echo "  6) Show forwarding.txt (/run)"
    echo "  7) Show logs (50 lines)"
    echo "  8) Show logs (200 lines)"
    echo "  0) Back to main menu"
    echo ""

    read -p "Select action: " action

    case $action in
      1)
        clear_screen; print_header
        echo -e "${BOLD}Running full update...${NC}"; echo ""
        sh "$DNSCRYPT_DIR/ubnt-dnscrypt.sh" update
        echo ""; echo -e "${GREEN}✓ Done${NC}"; echo ""
        read -p "Press Enter to continue..."
        ;;
      2)
        clear_screen; print_header
        echo -e "${BOLD}Extracting domains...${NC}"; echo ""
        sh "$DNSCRYPT_DIR/ubnt-dnscrypt.sh" extract
        echo ""; echo -e "${GREEN}✓ Done${NC}"; echo ""
        read -p "Press Enter to continue..."
        ;;
      3)
        clear_screen; print_header
        echo -e "${BOLD}Generating forwarding rules...${NC}"; echo ""
        sh "$DNSCRYPT_DIR/ubnt-dnscrypt.sh" generate
        echo ""; echo -e "${GREEN}✓ Done${NC}"; echo ""
        read -p "Press Enter to continue..."
        ;;
      4)
        clear_screen; print_header
        echo -e "${BOLD}Restarting dnscrypt-proxy...${NC}"; echo ""
        sh "$DNSCRYPT_DIR/ubnt-dnscrypt.sh" restart
        echo ""; echo -e "${GREEN}✓ Done${NC}"; echo ""
        read -p "Press Enter to continue..."
        ;;
      5)
        clear_screen; print_header
        echo -e "${BOLD}$DNSCRYPT_DIR/domains.txt:${NC}"; echo ""
        if [ -f "$DNSCRYPT_DIR/domains.txt" ]; then
          cat "$DNSCRYPT_DIR/domains.txt" | sed 's/^/  /'
        else
          echo -e "  ${YELLOW}File not found${NC}"
        fi
        echo ""; read -p "Press Enter to continue..."
        ;;
      6)
        clear_screen; print_header
        echo -e "${BOLD}/run/dnscrypt-forwarding.txt:${NC}"; echo ""
        if [ -f "/run/dnscrypt-forwarding.txt" ]; then
          cat "/run/dnscrypt-forwarding.txt" | sed 's/^/  /'
        else
          echo -e "  ${YELLOW}File not found${NC}"
        fi
        echo ""; read -p "Press Enter to continue..."
        ;;
      7)
        clear_screen; print_header
        echo -e "${BOLD}Logs for UBNT-DNSCRYPT (last 50 lines):${NC}"; echo ""
        if [ -f "$DNSCRYPT_DIR/ubnt-dnscrypt.log" ]; then
          tail -50 "$DNSCRYPT_DIR/ubnt-dnscrypt.log"
        else
          echo -e "  ${YELLOW}Log file not found${NC}"
        fi
        echo ""; read -p "Press Enter to continue..."
        ;;
      8)
        clear_screen; print_header
        echo -e "${BOLD}Logs for UBNT-DNSCRYPT (last 200 lines):${NC}"; echo ""
        if [ -f "$DNSCRYPT_DIR/ubnt-dnscrypt.log" ]; then
          tail -200 "$DNSCRYPT_DIR/ubnt-dnscrypt.log"
        else
          echo -e "  ${YELLOW}Log file not found${NC}"
        fi
        echo ""; read -p "Press Enter to continue..."
        ;;
      0) break ;;
      *) echo -e "${RED}Invalid option${NC}"; sleep 1 ;;
    esac
  done
}

# Функция для управления ISP icons
manage_isp_icons() {
  while true; do
    clear_screen
    print_header
    show_isp_icons_status

    echo ""
    echo -e "${BOLD}Actions for UBNT-ISP-ICONS:${NC}"
    echo "  1) Install / patch icons"
    echo "  2) Show logs (50 lines)"
    echo "  3) Show logs (200 lines)"
    echo "  0) Back to main menu"
    echo ""

    read -p "Select action: " action

    case $action in
      1)
        clear_screen; print_header
        echo -e "${BOLD}Installing ISP icons...${NC}"; echo ""
        sh "$ISP_ICONS_DIR/install.sh"
        echo ""; echo -e "${GREEN}✓ Done${NC}"; echo ""
        read -p "Press Enter to continue..."
        ;;
      2)
        clear_screen; print_header
        echo -e "${BOLD}Logs for UBNT-ISP-ICONS (last 50 lines):${NC}"; echo ""
        if [ -f "$ISP_ICONS_DIR/systemd-install.log" ]; then
          tail -50 "$ISP_ICONS_DIR/systemd-install.log"
        else
          echo -e "  ${YELLOW}Log file not found${NC}"
        fi
        echo ""; read -p "Press Enter to continue..."
        ;;
      3)
        clear_screen; print_header
        echo -e "${BOLD}Logs for UBNT-ISP-ICONS (last 200 lines):${NC}"; echo ""
        if [ -f "$ISP_ICONS_DIR/systemd-install.log" ]; then
          tail -200 "$ISP_ICONS_DIR/systemd-install.log"
        else
          echo -e "  ${YELLOW}Log file not found${NC}"
        fi
        echo ""; read -p "Press Enter to continue..."
        ;;
      0) break ;;
      *) echo -e "${RED}Invalid option${NC}"; sleep 1 ;;
    esac
  done
}

# Функция для создания backup
create_backup() {
  print_header
  echo -e "${BOLD}Creating backup...${NC}"
  echo ""
  
  local backup_file="/persistent/unifi-routing-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
  
  tar czf "$backup_file" \
    /persistent/ubnt-cloud \
    /persistent/ubnt-updates \
    /persistent/ubnt-dnscrypt \
    /persistent/ubnt-isp-icons \
    /etc/systemd/system/ubnt-cloud-routes.* \
    /etc/systemd/system/ubnt-updates-routes.* \
    /persistent/unifi-routing-manager.sh \
    2>&1 | sed 's/^/  /'
  
  echo ""
  echo -e "${GREEN}✓ Backup created:${NC}"
  ls -lh "$backup_file" | sed 's/^/  /'
  
  echo ""
  read -p "Press Enter to continue..."
}

# Функция для остановки всех проектов
stop_all() {
  print_header
  echo -e "${BOLD}Stopping all projects...${NC}"
  echo ""
  
  echo "Stopping ubnt-cloud..."
  systemctl stop ubnt-cloud-routes.timer 2>&1 | sed 's/^/  /'
  systemctl disable ubnt-cloud-routes.timer 2>&1 | sed 's/^/  /'
  
  echo "Stopping ubnt-updates..."
  systemctl stop ubnt-updates-routes.timer 2>&1 | sed 's/^/  /'
  systemctl disable ubnt-updates-routes.timer 2>&1 | sed 's/^/  /'
  
  echo "Removing all rules..."
  for prio in 100 110; do
    ip rule show | grep "^${prio}:" | grep 'lookup .*wgclt' | while read -r line; do
      rule="$(echo "$line" | sed 's/^[0-9]\+:\s*//')"
      ip rule del $rule 2>/dev/null || true
    done
  done
  
  echo ""
  echo -e "${GREEN}✓ All projects stopped${NC}"
  echo ""
  
  read -p "Press Enter to continue..."
}

# Функция для запуска всех проектов
start_all() {
  print_header
  echo -e "${BOLD}Starting all projects...${NC}"
  echo ""
  
  echo "Starting ubnt-cloud..."
  systemctl enable ubnt-cloud-routes.timer 2>&1 | sed 's/^/  /'
  systemctl start ubnt-cloud-routes.timer 2>&1 | sed 's/^/  /'
  systemctl start ubnt-cloud-routes.service 2>&1 | sed 's/^/  /'
  
  echo ""
  echo "Starting ubnt-updates..."
  systemctl enable ubnt-updates-routes.timer 2>&1 | sed 's/^/  /'
  systemctl start ubnt-updates-routes.timer 2>&1 | sed 's/^/  /'
  systemctl start ubnt-updates-routes.service 2>&1 | sed 's/^/  /'

  echo ""
  echo "Updating DNSCrypt..."
  sh "$DNSCRYPT_DIR/ubnt-dnscrypt.sh" update 2>&1 | sed 's/^/  /'

  echo ""
  echo "Installing ISP icons..."
  sh "$ISP_ICONS_DIR/install.sh" 2>&1 | sed 's/^/  /'
  
  echo ""
  echo -e "${GREEN}✓ All projects started${NC}"
  echo ""
  
  read -p "Press Enter to continue..."
}

# Главное меню
main_menu() {
  while true; do
    clear_screen
    show_status

    echo ""
    echo -e "${BOLD}Main Menu:${NC}"
    echo "  1) Manage UniFi Cloud"
    echo "  2) Manage UniFi Updates"
    echo "  3) Manage DNSCrypt"
    echo "  4) Manage ISP Icons"
    echo "  5) Start all"
    echo "  6) Stop all"
    echo "  7) Create backup"
    echo "  0) Exit"
    echo ""

    read -p "Select option: " option

    case $option in
      1) manage_project "ubnt-cloud" "$CLOUD_DIR" "100" ;;
      2) manage_project "ubnt-updates" "$UPDATES_DIR" "110" ;;
      3) manage_dnscrypt ;;
      4) manage_isp_icons ;;
      5) start_all ;;
      6) stop_all ;;
      7) create_backup ;;
      0)
        clear_screen
        echo -e "${GREEN}Goodbye!${NC}"
        exit 0
        ;;
      *)
        echo -e "${RED}Invalid option${NC}"
        sleep 1
        ;;
    esac
  done
}

# Запуск
main_menu
