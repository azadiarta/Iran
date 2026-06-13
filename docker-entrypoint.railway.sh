#!/bin/bash
# Entrypoint for the combined Railway image (Dockerfile.railway): runs the
# Django backend (gunicorn, internal-only) and the Next.js frontend
# (standalone server, public) as two processes in one container.
set -e

/app/backend/scripts/prepare.sh

echo "Starting gunicorn (internal, 127.0.0.1:8000)..."
(cd /app/backend && exec gunicorn groupfund.wsgi --bind 127.0.0.1:8000 --workers 3 --log-file -) &
BACKEND_PID=$!

echo "Starting Next.js (public, port ${PORT:-3000})..."
export PORT="${PORT:-3000}"
export HOSTNAME=0.0.0.0
(cd /app/frontend && exec node server.js) &
FRONTEND_PID=$!

# If either process exits, stop the other and exit so Railway restarts the
# whole container (restartPolicy in railway.json).
wait -n "$BACKEND_PID" "$FRONTEND_PID"
exit_code=$?
kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
exit "$exit_code"
