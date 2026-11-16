# Deployment

Serve the website on one HTTPS origin using a reverse proxy, Flask under Gunicorn, a private MongoDB instance and persistent media storage. Set the public hostname after verifying SRI’s domain ownership.

## Docker Compose

1. Install Docker Engine and its Compose plugin. Copy the root .env.example to .env and backend/.env.example to backend/.env.
2. In the root .env set different URL-safe MONGO_ROOT_PASSWORD and MONGO_APP_PASSWORD values. Generate each with python -c "import secrets; print(secrets.token_urlsafe(40))". MongoDB uses the first for its administrative account and the second for a database-scoped readWrite application user.
3. For a local trial use APP_ENV=development and PUBLIC_ORIGIN=http://localhost:8000. For a live service set APP_ENV=production, PUBLIC_ORIGIN=https://your-verified-host and TRUST_PROXY=1 when there is exactly one trusted reverse proxy. Enter mail settings in backend/.env.
4. Start the project and register the first staff member.

~~~sh
docker compose up -d --build
docker compose ps
docker compose exec web python -m flask --app run create-admin
~~~

The web entrypoint initialises MongoDB before starting Gunicorn. The web service listens on 127.0.0.1:8000 on the host. The database stays on the internal Compose network. Database files and uploads use named volumes. Mongo init scripts run when the data volume is empty. Existing database passwords must be rotated in MongoDB as well as in the configuration.

The supplied deploy/Caddyfile.example terminates TLS on the host. Set SRI_DOMAIN in Caddy’s environment and point DNS at the server. Accept inbound TCP 80 and 443 for certificate provisioning and HTTPS. Proxy all paths including media, admin, sitemap and article details. Enable forwarded-address trust only when the backend is reachable exclusively through that proxy.

~~~sh
docker compose logs --tail=100 web
curl -fsS https://YOUR-VERIFIED-HOST/api/health
~~~

Sign in over the configured origin, submit an enquiry, open a published article’s raw HTML and verify logo replacement in the header and footer.

## Existing Linux host

Build frontend/dist using npm ci and npm run build. Keep frontend/dist, backend and shared in the repository layout. Create the Python environment, install backend/requirements.txt and configure backend/.env. Use an authenticated database user and a persistent absolute MEDIA_DIR writable by the application account. Initialise the database and create the first staff login.

Run the following from backend under a non-root service account and your process manager:

~~~sh
.venv/bin/gunicorn --bind 127.0.0.1:8000 --workers 2 --threads 4 --timeout 45 run:app
~~~

Use the HTTPS proxy described above. The application expects the root path of the origin. Keep live and staging database names, credentials, origins and media paths separate.

## Backups and recovery

- Restrict .env files to the service account or use your infrastructure secret store. Production enables Secure and HttpOnly cookies. Passwords are salted and hashed, and MongoDB stores digests of session cookies.
- Coordinate database and media backups. With writes paused, create a mongodump archive of the application database and copy the media volume. Encrypt backups and use the organisation's retention schedule.
- Restore into a separate database and media directory. Run init-db to check indexes. Compare counts, load an image, sign in and record a test enquiry before switching a recovered instance into service.
- Back up the newsletter signing key if enabled. Changing it invalidates existing confirmation and unsubscribe links.
- For multiple application instances share the same persistent media storage. The storage write/read operations in app/routes/media.py can be adapted to private object storage while preserving checks for draft and published references.
- Send staging tests to the configured inboxes and an actual recipient mailbox. Delivery to these destinations depends on SRI's production SMTP and DNS configuration.
- Apply the organisation's retention policy to logs, enquiries and exports. Keep request payloads, private email addresses and session credentials out of public logs and caches.
- Hashed frontend assets can be served with immutable caching. Dynamic pages, authenticated API responses and drafts bypass shared caches. Logo replacements use a new URL.
- Run the API and browser suites after dependency upgrades. Review the executed checks and environment limitations in VERIFICATION.md.
