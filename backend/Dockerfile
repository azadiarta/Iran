# Backend (Django + DRF) production image.
# Build context is the repository root (see docker-compose.yml) because
# requirements.txt lives at the repo root while the Django project lives in backend/.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# Build-time-only dependencies are purged afterwards to keep the final image small;
# libpq5/libjpeg62-turbo/zlib1g remain because Pillow/psycopg2 need them at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libpq5 libjpeg62-turbo zlib1g \
        build-essential libpq-dev libjpeg-dev zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && apt-get purge -y --auto-remove build-essential libpq-dev libjpeg-dev zlib1g-dev

COPY backend/ /app/

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
