#!/bin/sh
# Runs as root just long enough to make /data writable by PUID:PGID, then starts the app as that user.
# (Same idea as LinuxServer images: set PUID/PGID to your NAS user so files on the share are yours.)
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

if [ "$(id -u)" = "0" ]; then
    mkdir -p /data/covers
    chown -R "$PUID:$PGID" /data
    exec su-exec "$PUID:$PGID" "$@"
fi

exec "$@"
