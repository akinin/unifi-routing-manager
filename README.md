# UniFi Routing Manager

UniFi Routing Manager (URM) управляет policy routing на UniFi UDM Pro/Pro Max: направляет UniFi Cloud, загрузку обновлений и запросы DNSCrypt через выбранные WireGuard-туннели. В комплект входят Web UI, CLI, systemd-таймеры и управление локальными ISP-иконками.

## Быстрая установка

Подключитесь к UDM по SSH под `root` и выполните:

```sh
bash -c "$(curl -fsSL https://raw.githubusercontent.com/akinin/unifi-routing-manager/main/install.sh)"
```

Установщик попросит:

- одну или несколько строк WireGuard в формате `<routing-table> <interface> <name>`;
- отображаемое имя, логин и пароль для Web UI.

Пример WireGuard map:

```text
180.wgclt7 wgclt7 WG-DE
178.wgclt8 wgclt8 WG-CH
```

Проект устанавливается в `/persistent/unifi-routing-manager`. Существующая установка в `/persistent/unifi-route-manager` переносится автоматически с сохранением настроек, логов, списков, иконок и авторизации.

После установки backend доступен на `http://<udm-ip>:8090`. Для обычной работы рекомендуется HTTPS reverse proxy. В текущей установке используется `https://urm.olshaniki.com` через Nginx Proxy Manager; прямые HTTP-запросы перенаправляются туда через `UNIFI_PUBLIC_URL` в `urm.env`.

## Обновление

Из SSH-консоли:

```sh
urm-update
```

Либо нажмите **Update URM / Обновить URM** в верхней панели Web UI. Обновление загружается из ветки `main`, сохраняет локальные конфиги и перезапускает службы.

## Возможности

- единый `wg-map.conf` для всех маршрутов;
- policy routing для UniFi Cloud и UniFi Updates;
- DNSCrypt forwarding для доменов UniFi и очистка DNS-кэша из Web UI;
- статусы интерфейсов, внешних IP, стран и провайдеров;
- редактирование доменов, сетей и WireGuard map;
- просмотр журналов и управление systemd-службами;
- добавление и установка локальных ISP-иконок;
- ручное и Web-обновление проекта.
- диагностика интерфейсов, policy rules, таблиц и внешнего IP;
- проверка конфигурации перед записью и атомарное сохранение;
- резервные копии конфигурации с восстановлением из Web UI;
- Passkey/WebAuthn для Touch ID и Face ID при работе через доверенный HTTPS;
- уведомления Telegram через защищённый WSS relay с резервным прямым HTTPS;
- центр событий со сбоями каналов, восстановлениями, сменами IP и статусом доставки уведомлений;
- staging-обновление с health-check и автоматическим rollback.

## HTTPS и Passkey

Backend можно оставить на LAN-порту `8090`, а TLS завершать на Nginx Proxy Manager. Пример локального файла `/persistent/unifi-routing-manager/urm.env`:

```text
UNIFI_PUBLIC_URL=https://urm.example.com
```

Reverse proxy должен передавать исходный `Host` и `X-Forwarded-Proto: https`. После входа по паролю откройте профиль и нажмите **Добавить Face ID / Touch ID**. WebAuthn недоступен по обычному HTTP и с недоверенным сертификатом.

## Telegram через WSS

Каталог `relay/` содержит минимальный WebSocket relay для Telegram Bot API. Он принимает только операцию `sendMessage`, проверяет общий секрет, время и одноразовый nonce, после чего отправляет сообщение в Telegram по HTTPS. Bot token хранится на UDM и передаётся relay только внутри TLS/WSS.

Relay рекомендуется запускать на локальном reverse-proxy узле, слушать только `127.0.0.1` и публиковать отдельный путь, например `wss://urm.example.com/telegram-ws`. В разделе **Настройки → Уведомления** выберите `WSS с резервным HTTPS`, укажите URL и общий секрет длиной не менее 32 символов. При недоступности relay режим `auto` автоматически использует прямой Telegram HTTPS API.

## Резервные копии и обновления

Web UI сохраняет до 20 конфигурационных снимков в `backups/`. Снимок автоматически создаётся перед изменением или восстановлением конфигурации. Обновлятор сначала проверяет новую версию в staging-каталоге, создаёт полный архив в `/persistent/urm-backups`, атомарно переключает установку и откатывается, если Web UI не проходит health-check.

## Файлы и локальные данные

Репозиторий содержит только исходные списки и примеры. Установщик создаёт локально и не отправляет в Git:

- `urm-auth.json` — соль, PBKDF2-хеш пароля и секрет сессий;
- `wg-map.conf` — таблицы и WireGuard-интерфейсы;
- generated network/address lists, логи, кэш и пользовательские иконки;
- `web-data/` — загруженные аватар и логотип URM.

Логин и пароль не записываются в установочные команды, URL или аргументы процессов. Пароль вводится скрыто и сохраняется только как PBKDF2-хеш. Не публикуйте порт `8090` в интернет; используйте LAN, VPN или SSH-туннель.

## CLI

```sh
urm                 # интерактивное управление
unifi-routing       # алиас URM
urm-update          # обновление из GitHub
```

Удалить службы, оставив настройки и файлы проекта:

```sh
/bin/sh /persistent/unifi-routing-manager/scripts/install-local.sh uninstall
```

## Службы

- `unifi-routing-web.service`
- `unifi-routing-update.service`
- `ubnt-cloud-routes.service` / `.timer`
- `ubnt-updates-routes.service` / `.timer`
- `ubnt-dnscrypt.service` / `.timer`
- `ubnt-isp-icons.service`

Проверка:

```sh
systemctl status unifi-routing-web.service --no-pager
systemctl list-timers 'ubnt-*' --no-pager
journalctl -u unifi-routing-update.service -n 100 --no-pager
```

## Диагностика

```sh
curl http://127.0.0.1:8090/api/auth/me
ip rule show | grep -E '^(100|110):'
tail -100 /persistent/unifi-routing-manager/ubnt-cloud/ubnt-cloud-routes.log
tail -100 /persistent/unifi-routing-manager/ubnt-updates/ubnt-updates-routes.log
tail -100 /persistent/unifi-routing-manager/ubnt-dnscrypt/ubnt-dnscrypt.log
```

Основные зависимости уже входят в UniFi OS: `bash`, `sh`, `curl`, `tar`, `python3`, `systemd`, `ip` и DNS-утилиты.
