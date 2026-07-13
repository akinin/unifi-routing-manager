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

После установки откройте `http://<udm-ip>:8090`.

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
