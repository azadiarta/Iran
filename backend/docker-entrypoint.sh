#!/bin/sh
set -e

"$(dirname "$0")/scripts/prepare.sh"

echo "Starting gunicorn..."
# $PORT is injected by Railway (and similar PaaS) and must be respected; falls
# back to 8000 for docker-compose, which the Caddyfile expects (backend:8000).
exec gunicorn groupfund.wsgi --bind "0.0.0.0:${PORT:-8000}" --workers 3 --log-file -
