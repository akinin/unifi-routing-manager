# UniFi Routing Web UI

Local network web interface for the routing scripts in this project.

## Start

```sh
cd /persistent
python3 web/server.py
```

Open:

```text
http://<device-lan-ip>:8090
```

By default the server binds to `0.0.0.0`, so it is available from your local network.

## Options

Use a different data root while testing:

```sh
UNIFI_ROUTING_ROOT=/Users/akininav/Desktop/persistant python3 web/server.py
```

Use a different local port:

```sh
UNIFI_WEB_PORT=8091 python3 web/server.py
```

Bind only to the device itself:

```sh
UNIFI_WEB_HOST=127.0.0.1 python3 web/server.py
```

## Notes

Actions such as starting services, changing policy rules, and restarting DNSCrypt must be run on the target system with the same permissions required by the original scripts.
