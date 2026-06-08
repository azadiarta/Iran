#!/bin/sh
set -e

echo "Waiting for database at ${DB_HOST:-db}:${DB_PORT:-5432}..."
python3 - <<'PYEOF'
import os, socket, time
host = os.environ.get("DB_HOST", "db")
port = int(os.environ.get("DB_PORT", "5432"))
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
exec gunicorn groupfund.wsgi --bind 0.0.0.0:8000 --workers 3 --log-file -
