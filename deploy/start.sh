#!/bin/sh
set -eu
python -m flask --app run init-db
exec gunicorn --bind 0.0.0.0:8000 --workers "${WEB_WORKERS:-2}" --threads 4 --timeout 45 --access-logfile - run:app
