# Backend (Django + DRF) production image.
# Build context is the repository root (see docker-compose.yml) because
# requirements.txt lives at the repo root while the Django project lives in backend/.
FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# No apt packages needed: every compiled dependency (psycopg2-binary, Pillow)
# ships manylinux wheels that bundle their native libraries (libpq, libjpeg,
# zlib), so installing straight from PyPI keeps the image small and the build
# independent of Debian mirrors.
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --only-binary :all: -r requirements.txt

COPY backend/ /app/

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/app/docker-entrypoint.sh"]
