#!/usr/bin/env bash
set -Eeuo pipefail

web_root="${1:-/var/www/agar}"
web_user="${WEB_USER:-www-data}"
web_group="${WEB_GROUP:-www-data}"
repository="${SKIN_REPOSITORY:-https://github.com/Emupedia/emupedia-game-agar.io.git}"
checkout="$(mktemp -d /tmp/emupedia-skins.XXXXXX)"
custom_backup="$checkout/custom-backup"

cleanup() {
    rm -rf -- "$checkout"
}
trap cleanup EXIT

for command in git rsync find; do
    command -v "$command" >/dev/null 2>&1 || {
        echo "Missing required command: $command" >&2
        exit 1
    }
done

git clone --depth=1 --filter=blob:none --sparse "$repository" "$checkout/repository"
git -C "$checkout/repository" sparse-checkout set docs/skins3

skin_source="$checkout/repository/docs/skins3"
skin_count="$(find "$skin_source" -maxdepth 1 -type f -name '*.png' | wc -l)"
if [ "$skin_count" -lt "${MINIMUM_SKIN_COUNT:-1000}" ]; then
    echo "Downloaded skin collection looks incomplete: $skin_count PNG files." >&2
    exit 1
fi

if [ -L "$web_root/skins" ]; then
    resolved="$(readlink -f -- "$web_root/skins" || true)"
    if [ -n "$resolved" ] && [ -d "$resolved/custom" ]; then
        install -d -m 0700 "$custom_backup"
        rsync -a "$resolved/custom/" "$custom_backup/"
    fi
    unlink -- "$web_root/skins"
elif [ -e "$web_root/skins" ] && [ ! -d "$web_root/skins" ]; then
    echo "$web_root/skins is not a directory." >&2
    exit 1
fi

install -d -m 0755 "$web_root/skins"
rsync -a --delete --exclude 'custom/' "$skin_source/" "$web_root/skins/"
find "$web_root/skins" -type d -exec chmod 0755 {} +
find "$web_root/skins" -type f -exec chmod 0644 {} +

install -d -o "$web_user" -g "$web_group" -m 0750 "$web_root/skins/custom"
if [ -d "$custom_backup" ]; then
    rsync -a "$custom_backup/" "$web_root/skins/custom/"
fi
chown -R "$web_user:$web_group" "$web_root/skins/custom"

echo "Installed $skin_count built-in skins in $web_root/skins and retained custom uploads."
