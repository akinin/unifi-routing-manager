# UniFi Route Manager

UniFi Route Manager помогает на UDM Pro направлять трафик UniFi Cloud, обновлений UniFi и DNSCrypt через выбранные WireGuard-туннели. В проект входит Web UI с авторизацией, статусами, логами, редакторами списков и управлением ISP-иконками.

## Возможности

- Выбор рабочего WireGuard-туннеля из `wg-map.conf`.
- Policy routing для UniFi Cloud и UniFi Updates.
- DNSCrypt forwarding rules для доменов UniFi.
- Web UI на `:8090` с простой авторизацией.
- Редактирование доменов, ручных сетей и WireGuard map из Web UI.
- Статус Direct/ISP и всех WireGuard-интерфейсов с IP, страной, провайдером, флагом и иконкой.
- Автозагрузка provider icons с `static.2ip.io/asn_favicons/<ASN>.png`.
- Автозагрузка флагов стран с `static.2ip.io/images/flags/4x3/<cc>.svg`.
- Ручная загрузка provider/country assets по URL с ограничением `png`, `svg`, `ico`.
- Установка, обновление и удаление через один `install.sh`.

## Структура

Чистая установка размещает проект в одном каталоге:

```text
/persistent/unifi-route-manager
├── install.sh
├── wg-map.conf
├── urm-auth.json
├── ubnt-cloud/
├── ubnt-updates/
├── ubnt-dnscrypt/
├── ubnt-isp-icons/
└── web/
```

Для совместимости создаются symlink-пути:

## Требования

- UniFi UDM Pro / UniFi OS.
- SSH-доступ под `root`.
- Рабочие WireGuard-интерфейсы.
- `git`, `systemd`, `python3`, `curl`, `dig`, `ip`.

## Установка

Подключитесь к UDM по SSH:

```sh
ssh root@<udm-ip>
```

Скачайте проект:

```sh
cd /persistent
git clone git@git.akinin.su:akininav/unifi-route-manager.git unifi-route-manager
cd /persistent/unifi-route-manager
chmod +x install.sh
```

Запустите установщик:

```sh
/bin/sh install.sh
```

В меню выберите:

```text
1) Install
2) Update
3) Uninstall
```

При первой установке скрипт попросит заполнить `wg-map.conf` и создать Web UI пользователя: имя, логин и пароль.

Формат `wg-map.conf`:

```text
<routing-table> <wireguard-interface> <friendly-name>
```

Пример:

```text
180.wgclt7 wgclt7 WG-DE
178.wgclt8 wgclt8 WG-CH
002.wgclt9 wgclt9 WG-GE
```

После установки откройте:

```text
http://<udm-ip>:8090
```

## Обновление

```sh
cd /persistent/unifi-route-manager
git pull
/bin/sh install.sh
```

Выберите `Update`. Пользовательские списки, auth-файл, логи и generated icons сохраняются.

## Удаление

```sh
cd /persistent/unifi-route-manager
/bin/sh install.sh
```

Выберите `Uninstall`. Systemd-службы и shortcuts будут удалены, файлы проекта останутся на диске.

## Web UI

Web UI защищён одной локальной учётной записью. Конфиг хранится здесь:

```text
/persistent/unifi-route-manager/urm-auth.json
```

В Web UI доступны:

- Connections: ISP и WireGuard-туннели с IP, страной, флагом, провайдером и активными тегами Cloud/Updates.
- UniFi Cloud: статус, правила, домены, сети, resolved IP.
- UniFi Updates: статус, правила, домены, сети, resolved IP.
- DNSCrypt: статус forwarding, timer, route до resolver, домены.
- ISP Icons: discover/install/uninstall, ручная загрузка provider icons и флагов.
- Logs: по умолчанию свернуты.
- Theme: светлая/тёмная тема.
- Auto refresh: выбор интервала обновления.

## Службы

Установщик создаёт:

- `unifi-routing-web.service`
- `ubnt-cloud-routes.service`
- `ubnt-cloud-routes.timer`
- `ubnt-updates-routes.service`
- `ubnt-updates-routes.timer`
- `ubnt-dnscrypt.service`
- `ubnt-dnscrypt.timer`
- `ubnt-isp-icons.service`

Проверка:

```sh
systemctl status unifi-routing-web.service --no-pager
systemctl list-timers 'ubnt-*' --no-pager
```

## CLI

После установки доступны:

```sh
urm
unifi-routing
```

## Диагностика

Проверить Web UI:

```sh
curl http://127.0.0.1:8090/api/auth/me
journalctl -u unifi-routing-web.service -n 100 --no-pager
```

Проверить маршруты:

```sh
ip rule show | grep -E '^(100|110):'
tail -100 /persistent/unifi-route-manager/ubnt-cloud/ubnt-cloud-routes.log
tail -100 /persistent/unifi-route-manager/ubnt-updates/ubnt-updates-routes.log
```

Проверить DNSCrypt:

```sh
tail -100 /persistent/unifi-route-manager/ubnt-dnscrypt/ubnt-dnscrypt.log
cat /run/dnscrypt-forwarding.txt
```

Проверить ISP Icons:

```sh
tail -100 /persistent/unifi-route-manager/ubnt-isp-icons/systemd-install.log
ls -la /usr/lib/unifi/webapps/ROOT/app-unifi/react/images/topology/isp/asn
```

## Безопасность

Web UI предназначен для локальной доверенной сети. Не публикуйте порт `8090` в интернет. Для удалённого доступа используйте VPN или SSH-туннель.
