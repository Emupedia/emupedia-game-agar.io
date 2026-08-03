# Configure a standalone Agar.io v2 client

The client contains its server map and skin base path in `assets/js/main.js`. Use the deployment configurator instead of editing that bundle by hand:

```bash
cp clients/agarv2/deployment-config.example.json deployment-config.json
# Edit deployment-config.json, then:
node scripts/configure-agarv2-client.js deployment-config.json
```

By default, both `clients/agarv2` and `docs/agarv2` are updated. Alternate target directories can be supplied after the config path.

The server values omit the `ws://` or `wss://` prefix because the existing client chooses the protocol based on the page URL. Include the hostname, optional port, and WebSocket path.

The tool writes through a temporary file and fails when an expected declaration is missing, preventing silent partial configuration after upstream code changes.
