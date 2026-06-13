#!/bin/sh
# Shared startup prep: wait for the database, run migrations, seed initial
# data, and collect static files. Used by docker-entrypoint.sh (both the
# standalone backend image and the combined Railway image).
set -e

# Always run from the Django project root (backend/), regardless of caller's cwd.
cd "$(dirname "$0")/.."

echo "Waiting for the database to become reachable..."
python3 - <<'PYEOF'
import os, socket, time
from urllib.parse import urlparse

database_url = os.environ.get("DATABASE_URL")
db_name = os.environ.get("DB_NAME")

if database_url:
    parsed = urlparse(database_url)
    if not (parsed.hostname and parsed.scheme.startswith("postgres")):
        # An unresolved Railway variable reference (e.g. the literal string
        # "${{Postgres.DATABASE_URL}}", or a typo'd/renamed Postgres service
        # name) parses to a URL with no hostname. Waiting on it would hang
        # until the timeout and crash the container, so treat it like
        # DATABASE_URL was never set (settings.py falls back the same way).
        print(f"  -> DATABASE_URL did not resolve to a valid Postgres URL (got {database_url!r}); falling back to DB_NAME/SQLite, skipping wait.")
        database_url = None

if database_url or db_name:
    if database_url:
        parsed = urlparse(database_url)
        host = parsed.hostname
        port = parsed.port or 5432
    else:
        host = os.environ.get("DB_HOST", "db")
        port = int(os.environ.get("DB_PORT", "5432"))

    print(f"  -> {host}:{port}")
    deadline = time.time() + 120
    while True:
        try:
            with socket.create_connection((host, port), timeout=2):
                break
        except OSError:
            if time.time() > deadline:
                raise SystemExit(f"Timed out waiting for {host}:{port}")
            time.sleep(1)
else:
    # Neither DATABASE_URL nor DB_NAME is set — settings.py falls back to a
    # local SQLite database, which needs no network wait.
    print("  -> No DATABASE_URL/DB_NAME set; using local SQLite, skipping wait.")
PYEOF

echo "Database is reachable. Running migrations..."
python manage.py migrate --noinput

echo "Seeding initial data (idempotent)..."
python manage.py seed_initial_data

if [ -n "$DJANGO_SUPERUSER_EMAIL" ] && [ -n "$DJANGO_SUPERUSER_PASSWORD" ]; then
  echo "Ensuring Django superuser exists..."
  python manage.py shell -c "
import os
from accounts.models import Member
email = os.environ['DJANGO_SUPERUSER_EMAIL']
if Member.objects.filter(email=email).exists():
    print(f'Superuser already exists: {email}')
else:
    Member.objects.create_superuser(
        email=email,
        password=os.environ['DJANGO_SUPERUSER_PASSWORD'],
        full_name=os.environ.get('DJANGO_SUPERUSER_FULL_NAME', email.split('@')[0]),
    )
    print(f'Superuser created: {email}')
"
fi

echo "Collecting static files..."
python manage.py collectstatic --noinput
