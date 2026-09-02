# Optional self-hosted skin uploader

This example endpoint is disabled unless a deployer installs it in a PHP-capable web root and explicitly configures its environment.

Requirements:

- PHP 8.1 or newer
- `fileinfo`
- GD with PNG, JPEG, and WebP support
- a writable custom-skin directory outside any executable PHP path

Recommended environment variables:

```text
AGAR_SKIN_UPLOAD_ORIGIN=https://example.com
AGAR_SKIN_UPLOAD_ROOT=/var/www/example.com/skins/custom
AGAR_SKIN_UPLOAD_PUBLIC_PREFIX=/skins/custom
AGAR_SKIN_UPLOAD_RATE_ROOT=/var/lib/agar/skin-upload-rate
AGAR_SKIN_UPLOAD_MAX_BYTES=2097152
AGAR_SKIN_UPLOAD_COOLDOWN=15
```

The endpoint verifies the real MIME type and dimensions, decodes the image server-side, normalizes it to a transparent 512×512 PNG, derives the filename from the normalized content, and applies a per-address cooldown.

This is storage validation, not content moderation. Public deployments still need an abuse-reporting and moderation process. Keep the feature disabled when that process is not available.
