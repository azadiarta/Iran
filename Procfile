release: cd backend && python manage.py migrate --noinput && python manage.py seed_initial_data && python manage.py collectstatic --noinput
web: cd backend && gunicorn groupfund.wsgi --bind 0.0.0.0:$PORT --log-file -
