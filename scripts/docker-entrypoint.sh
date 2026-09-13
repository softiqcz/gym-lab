#!/bin/sh
set -eu
mkdir -p "$(dirname "$DATA_FILE")"
if [ ! -e "$DATA_FILE" ]; then
    cp /app/seed/workouts.json "$DATA_FILE"
fi
exec "$@"
