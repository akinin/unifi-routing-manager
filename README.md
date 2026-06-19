# UniFi Route Manager

Набор скриптов для UniFi UDM Pro, который направляет выбранный трафик UniFi Cloud, UniFi Network updates и DNS-запросы через рабочий WireGuard-туннель. В проект также входит локальный веб-интерфейс для контроля состояния, запуска действий и просмотра логов.

## Что умеет проект

- выбирает первый рабочий WireGuard-туннель из `wg-map.conf`;
- добавляет policy routing rules для UniFi Cloud с приоритетом `100`;
- добавляет policy routing rules для обновлений UniFi с приоритетом `110`;
- резолвит домены UniFi Cloud и сохраняет IP-адреса в `addresses.txt`;
- обновляет список AWS/CloudFront сетей для UniFi Cloud;
- генерирует DNSCrypt forwarding rules для корневых доменов UniFi;
- патчит локальные ISP-иконки в UniFi Network UI;
- автоматически создаёт fallback-иконки для текущих провайдеров по ASN/ISP;
- показывает состояние и логи в Web UI на порту `8090`;
- позволяет редактировать ручные списки доменов, сетей и WireGuard map из Web UI;
- устанавливается в systemd и стартует после перезагрузки UDM.

## Структура

```text
/persistent
├── install.sh
├── unifi-routing-manager.sh
├── ubnt-cloud/
├── ubnt-updates/
├── ubnt-dnscrypt/
├── ubnt-isp-icons/
└── web/
```

Основные компоненты:

- `ubnt-cloud/ubnt-cloud-routes.sh` - маршруты для UniFi Cloud.
- `ubnt-updates/ubnt-updates-routes.sh` - маршруты для обновлений прошивок и пакетов.
- `ubnt-dnscrypt/ubnt-dnscrypt.sh` - подготовка forwarding rules для `dnscrypt-proxy`.
- `ubnt-isp-icons/install.sh` - установка пользовательских ISP-иконок в UniFi Network UI.
- `web/server.py` - локальный Web UI.
- `install.sh` - установка systemd-служб и таймеров.

## Требования

- UniFi UDM Pro / UniFi OS с доступом `root`.
- Рабочие WireGuard-интерфейсы на устройстве.
- `systemd`, `ip`, `dig`, `curl`, `python3`.
- Проект расположен в `/persistent` или путь явно передан через `UNIFI_ROUTING_ROOT`.

## Установка

Подключитесь к UDM Pro по SSH под `root` и положите проект в постоянный раздел:

```sh
cd /persistent
git clone git@git.akinin.su:akininav/unifi-route-manager.git .
```

Если `/persistent` уже содержит файлы проекта, сначала обновите их из репозитория или скопируйте новую версию поверх существующей, не удаляя ваши `.txt`, `.conf` и логи.

Сделайте скрипты исполняемыми:

```sh
chmod +x /persistent/install.sh
chmod +x /persistent/web/install-service.sh
chmod +x /persistent/ubnt-cloud/ubnt-cloud-routes.sh
chmod +x /persistent/ubnt-updates/ubnt-updates-routes.sh
chmod +x /persistent/ubnt-dnscrypt/ubnt-dnscrypt.sh
chmod +x /persistent/ubnt-isp-icons/install.sh
chmod +x /persistent/ubnt-isp-icons/install-systemd-wrapper.sh
```

Настройте WireGuard-карты для Cloud и Updates:

```sh
vi /persistent/wg-map.conf
```

Формат строки:

```text
<routing-table> <wireguard-interface> <friendly-name>
```

Пример:

```text
201 wgclt1 Finland
202 wgclt2 Germany
```

Скрипты идут сверху вниз и выбирают первый туннель, у которого есть интерфейс, default route в указанной таблице и успешный ping через интерфейс.

Для совместимости старые файлы `/persistent/ubnt-cloud/wg-map.conf` и `/persistent/ubnt-updates/wg-map.conf` всё ещё поддерживаются как fallback, но основной файл теперь общий: `/persistent/wg-map.conf`.

Запустите установку:

```sh
/bin/sh /persistent/install.sh
```

Установщик создаст и включит:

- `ubnt-cloud-routes.timer` - каждые 15 минут после завершения предыдущего запуска;
- `ubnt-updates-routes.timer` - каждые 30 минут;
- `ubnt-dnscrypt.timer` - каждый час;
- `ubnt-isp-icons.service` - установка иконок после старта системы;
- `unifi-routing-web.service` - Web UI с автозапуском.

После установки откройте:

```text
http://<ip-адрес-udm>:8090
```

## Настройка Web UI

По умолчанию Web UI слушает все LAN-интерфейсы на порту `8090`.

Можно изменить адрес и порт перед установкой:

```sh
UNIFI_WEB_HOST=0.0.0.0 UNIFI_WEB_PORT=8091 /bin/sh /persistent/web/install-service.sh
```

Если проект находится не в `/persistent`:

```sh
UNIFI_ROUTING_ROOT=/persistant /bin/sh /persistant/web/install-service.sh
```

Проверка состояния:

```sh
systemctl status unifi-routing-web.service --no-pager
```

Перезапуск:

```sh
systemctl restart unifi-routing-web.service
```

## Настройка доменов и сетей

UniFi Cloud:

- `/persistent/ubnt-cloud/domains.txt` - домены, которые нужно резолвить и вести через Cloud WG.
- `/persistent/ubnt-cloud/networks.txt` - CIDR-сети, которые нужно вести через Cloud WG.
- `/persistent/ubnt-cloud/addresses.txt` - сгенерированные IPv4-адреса из доменов.

UniFi Updates:

- `/persistent/ubnt-updates/update-domains.txt` - домены обновлений.
- встроенный список CDN-сетей находится в `ubnt-updates-routes.sh`.

DNSCrypt:

- `/persistent/ubnt-dnscrypt/domains.txt` генерируется из Cloud и Updates доменов.
- `/run/dnscrypt-forwarding.txt` создаётся для `dnscrypt-proxy`.
- Web UI считает DNSCrypt активным, когда forwarding rules успешно сгенерированы; отдельный `dnscrypt-proxy` unit на UDM может не выглядеть как постоянно активный сервис.

## Обновление AWS сетей

Для UniFi Cloud можно обновить AWS/CloudFront CIDR:

```sh
/bin/sh /persistent/ubnt-cloud/update-aws-networks.sh
systemctl start ubnt-cloud-routes.service
```

Скрипт сохраняет ручные сети в `networks-manual.txt`, генерирует `networks-aws-generated.txt` и собирает итоговый `networks.txt`.

## Команды обслуживания

Статус таймеров:

```sh
systemctl list-timers 'ubnt-*' --no-pager
```

Ручной запуск маршрутов:

```sh
systemctl start ubnt-cloud-routes.service
systemctl start ubnt-updates-routes.service
```

Ручное обновление DNSCrypt:

```sh
systemctl start ubnt-dnscrypt.service
```

Переустановка ISP-иконок:

```sh
systemctl start ubnt-isp-icons.service
```

Просмотр policy rules:

```sh
ip rule show | grep -E '^(100|110):'
```

## Логи

Логи лежат рядом с компонентами:

- `/persistent/ubnt-cloud/ubnt-cloud-routes.log`
- `/persistent/ubnt-updates/ubnt-updates-routes.log`
- `/persistent/ubnt-dnscrypt/ubnt-dnscrypt.log`
- `/persistent/ubnt-isp-icons/systemd-install.log`

Логи systemd:

```sh
journalctl -u unifi-routing-web.service -n 100 --no-pager
journalctl -u ubnt-cloud-routes.service -n 100 --no-pager
journalctl -u ubnt-updates-routes.service -n 100 --no-pager
```

## Обновление проекта

```sh
cd /persistent
git pull
/bin/sh /persistent/install.sh
```

После обновления установщик безопасно перезапишет unit-файлы systemd, перечитает конфигурацию и перезапустит Web UI. Пользовательские списки доменов, сетей, WireGuard-карты и логи не удаляются.

## Данные и структура

Рекомендуемая структура после чистой установки:

```text
/persistent/unifi-route-manager
```

Для совместимости старые пути `/persistent/ubnt-cloud`, `/persistent/ubnt-updates`, `/persistent/ubnt-dnscrypt`, `/persistent/ubnt-isp-icons`, `/persistent/web`, `/persistent/wg-map.conf` и `/persistent/unifi-routing-manager.sh` могут быть symlink-ярлыками на файлы внутри `/persistent/unifi-route-manager`. Это позволяет держать проект в одном каталоге и не ломать существующие systemd-службы.

Общая WireGuard-карта находится в `/persistent/wg-map.conf` и указывает на `/persistent/unifi-route-manager/wg-map.conf`.

## Диагностика

Если правила не появляются:

```sh
cat /persistent/ubnt-cloud/wg-map.conf
ip link show
ip route show table <routing-table>
tail -100 /persistent/ubnt-cloud/ubnt-cloud-routes.log
```

Если Web UI не открывается:

```sh
systemctl status unifi-routing-web.service --no-pager
journalctl -u unifi-routing-web.service -n 100 --no-pager
ss -lntp | grep 8090
```

Если ISP-иконки пропали после обновления UniFi Network:

```sh
systemctl start ubnt-isp-icons.service
tail -100 /persistent/ubnt-isp-icons/systemd-install.log
```

## Безопасность

Web UI рассчитан на локальную доверенную сеть и не добавляет отдельную авторизацию. Не публикуйте порт `8090` в интернет. Для удалённого доступа используйте VPN или SSH-туннель.
