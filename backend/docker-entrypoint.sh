#!/bin/sh
set -e

echo "Waiting for the database to become reachable..."
python3 - <<'PYEOF'
import os, socket, time
from urllib.parse import urlparse

database_url = os.environ.get("DATABASE_URL")
if database_url:
    parsed = urlparse(database_url)
    host = parsed.hostname or "db"
    port = parsed.port or 5432
else:
    host = os.environ.get("DB_HOST", "db")
    port = int(os.environ.get("DB_PORT", "5432"))

print(f"  -> {host}:{port}")
deadline = time.time() + 60
while True:
    try:
        with socket.create_connection((host, port), timeout=2):
            break
    except OSError:
        if time.time() > deadline:
            raise SystemExit(f"Timed out waiting for {host}:{port}")
        time.sleep(1)
PYEOF

echo "Database is reachable. Running migrations..."
python manage.py migrate --noinput

echo "Seeding initial data (idempotent)..."
python manage.py seed_initial_data

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting gunicorn..."
# $PORT is injected by Railway (and similar PaaS) and must be respected; falls
# back to 8000 for docker-compose, which the Caddyfile expects (backend:8000).
exec gunicorn groupfund.wsgi --bind "0.0.0.0:${PORT:-8000}" --workers 3 --log-file -
