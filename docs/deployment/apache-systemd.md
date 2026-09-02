# Apache and systemd deployment for Agar.io v2

This example keeps the Node.js game listener private on the loopback interface and exposes it through an HTTPS WebSocket endpoint handled by Apache.

Replace `example.com`, paths, users, and certificate details with values appropriate for your host.

## Layout

```text
/var/www/example.com/agar/       published browser client
/opt/emupedia-agar/              game server
/etc/systemd/system/emupedia-agar.service
/etc/apache2/sites-available/example.com.conf
```

Do not expose the raw game port through the firewall when Apache is acting as the public endpoint.

## Server settings

Use a private listener and restrict accepted browser origins:

```json
{
  "listeningHost": "127.0.0.1",
  "listeningPort": 5000,
  "listenerTrustProxy": true,
  "listenerTrustedProxies": ["127.0.0.1", "::1"],
  "listenerAcceptedOrigins": ["https://example.com"]
}
```

## systemd service

```ini
[Unit]
Description=Emupedia Agar.io v2 server
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/emupedia-agar
Environment=NODE_ENV=production
ExecStart=/usr/bin/node /opt/emupedia-agar/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/emupedia-agar

[Install]
WantedBy=multi-user.target
```

Enable it with:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now emupedia-agar
sudo systemctl status emupedia-agar --no-pager
```

## Apache virtual host

Enable `proxy`, `proxy_http`, `proxy_wstunnel`, `headers`, `rewrite`, and `ssl` first.

```apache
<VirtualHost *:443>
    ServerName example.com
    DocumentRoot /var/www/example.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/example.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/example.com/privkey.pem

    <Directory /var/www/example.com>
        Options -Indexes
        AllowOverride None
        Require all granted
    </Directory>

    ProxyPreserveHost On
    ProxyPass        /agar-ws/ ws://127.0.0.1:5000/
    ProxyPassReverse /agar-ws/ ws://127.0.0.1:5000/

    RequestHeader set X-Real-IP "%{REMOTE_ADDR}s"
    RequestHeader set X-Forwarded-Proto "https"

    Header always set X-Content-Type-Options "nosniff"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"
</VirtualHost>
```

Set the browser client endpoint to `wss://example.com/agar-ws/` through the runtime deployment configuration.

## Verification

```bash
apache2ctl configtest
systemctl is-active apache2 emupedia-agar
journalctl -u emupedia-agar -n 100 --no-pager
ss -ltnp | grep ':5000'
```

The `ss` output should show the game port bound to `127.0.0.1`, not every interface.
