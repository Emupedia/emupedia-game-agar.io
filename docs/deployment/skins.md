# Self-hosting the Agar.io skin collection

The published client expects a large built-in skin collection. A symbolic link that points outside the web root can be rejected by Apache depending on `Options FollowSymLinks`, filesystem permissions, and the virtual-host directory policy.

For a standalone deployment, install the collection as a real directory inside the document root:

```bash
sudo ./scripts/sync-agarv2-skins.sh /var/www/agar
```

The updater:

- checks out only `docs/skins3`;
- rejects obviously incomplete downloads;
- converts an old `skins` symbolic link into a real directory;
- keeps `skins/custom` across refreshes;
- applies web-readable permissions to built-in skins;
- keeps the custom upload directory writable only by the configured web user.

Environment overrides:

```text
WEB_USER=www-data
WEB_GROUP=www-data
MINIMUM_SKIN_COUNT=1000
SKIN_REPOSITORY=https://github.com/Emupedia/emupedia-game-agar.io.git
```
