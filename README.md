# SRI Ventures & Consulting Pvt. Ltd.

A React, Flask and MongoDB corporate website for SRI’s commercial and consulting verticals. This release includes editable source, the built frontend, staff CMS, licensed Assam photography, a pen-stroke signature introduction, deployment files and repeatable tests.

## Quick start on Windows

Install **Python 3.12** and **MongoDB Community Server 7 or 8**. Start the MongoDB service. The bundled frontend can run without installing Node.js. Open PowerShell in the extracted **sri-ventures-consulting** directory and run:

~~~powershell
.\scripts\Start-Local.ps1 -CreateAdmin
~~~

The script creates a virtual environment, installs dependencies, writes a local configuration if needed, initialises MongoDB and prompts for the administrator’s email and password. Use at least 12 characters. On later starts run:

~~~powershell
.\scripts\Start-Local.ps1
~~~

| Open in your browser | Address |
| --- | --- |
| Public site | http://localhost:5000/ |
| Staff login | http://localhost:5000/admin/login |
| Founder page | http://localhost:5000/know-the-founder/ |
| Database health | http://localhost:5000/api/health |

Use Ctrl+C to stop the server. If your Windows policy restricts script execution, use the manual commands below.

## Source development on Windows

Use **Node.js 22.12 or later**, npm, **Python 3.12** and a running MongoDB service. First-time dependency installation needs internet access. The site can run locally without external paid services.

### Terminal 1 — Flask and MongoDB

From the project root:

~~~powershell
cd backend
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
if (!(Test-Path .env)) { Copy-Item .env.example .env }
.\.venv\Scripts\python.exe -m flask --app run init-db
.\.venv\Scripts\python.exe -m flask --app run create-admin
.\.venv\Scripts\python.exe -m flask --app run run --host 127.0.0.1 --port 5000
~~~

Configure MONGODB_URI and MONGODB_DB in backend/.env before init-db if needed. The defaults connect to mongodb://127.0.0.1:27017 and use sri_website. MongoDB creates the database on the first write. init-db preserves editorial changes. Create an administrator once per staff member. On Windows, Get-Service MongoDB shows whether a service installation is running.

### Terminal 2 — React and Vite

From the project root:

~~~powershell
cd frontend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run dev
~~~

Open **http://localhost:5173/** or **http://localhost:5173/admin/login**. Use one hostname consistently. Vite proxies /api and /media to Flask. Set API_PROXY_TARGET in frontend/.env for a different backend port. Set PUBLIC_ORIGIN in backend/.env to the address visitors use. The quick-start script uses port 5000. For Vite development change it to http://localhost:5173 and restart Flask.

On Linux or macOS create the environment with python3.12 -m venv .venv and run .venv/bin/python in place of the Windows interpreter path.

## Website and staff modules

The site has dedicated corporate, Ventures, Consulting and industry pages. A visitor can browse published offers and articles, examine services and submit the appropriate enquiry. Each submission is validated, stored and assigned a reference. Published article bodies, titles, canonical URLs and structured data are available in the initial HTML served by Flask. The same server supplies the sitemap, robots.txt and public 404 responses.

| Task | Staff module |
| --- | --- |
| Publish articles with images, rich text and SEO fields | Insights & Articles |
| Edit the page introduction, reorder stages and publish | Our Approach |
| Publish a verified portrait, biography and attributed milestones | Know the Founder |
| Manage project stories, covers, galleries and outcomes | Our Work / Case Studies |
| Manage product specifications, availability and images | Product Catalogue |
| Review submissions, update status/notes and export filtered CSV | Enquiries |
| Replace the single official logo used by the navbar and footer | Company Branding |
| Enter contact details, socials, SEO, policy text and corporate profile PDF | Website Settings |
| Change sign-in email or password | Admin Account |

Initialisation publishes the approved five approach stages. The seven article concepts and proposed founder biography start as working drafts. Product and project collections start empty. The site shows the company name until a staff member uploads the official logo.

## Optional services

In backend/.env set SMTP_HOST, SMTP_PORT, SMTP_MODE (starttls or ssl), SMTP_FROM, SMTP_USER and SMTP_PASSWORD. Configure INBOX_GENERAL and optional INBOX_VENTURES, INBOX_CONSULTING and INBOX_PARTNERSHIPS. A missing specialist inbox falls back to INBOX_GENERAL. Restart Flask. Staff receive a link to the protected record and the enquirer receives the reference. The database keeps submissions if mail delivery fails.

To enable the newsletter register, configure SMTP and a private NEWSLETTER_KEY of at least 32 characters. Generate it on your own machine with python -c "import secrets; print(secrets.token_urlsafe(40))". Keep the value stable. Pending addresses expire after two days. Website Settings can export confirmed addresses with personalised unsubscribe URLs for the organisation’s newsletter sender. Include the corresponding link in each issue.

GA4_ID enables an optional analytics consent control in the footer. Google Analytics loads only after opt-in. SEARCH_VERIFICATION adds the Search Console verification meta tag to the server HTML. Both are blank initially.

## Production build

From frontend:

~~~powershell
npm ci
npm run build
~~~

The release includes frontend/dist. Serve the built project via Flask to retain crawler-readable articles, metadata and status codes. For local single-origin serving on Windows:

~~~powershell
cd ..\backend
.\.venv\Scripts\python.exe -m waitress --listen=127.0.0.1:5000 run:app
~~~

## Tests

From backend, run:

~~~powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m pytest -q
~~~

The default suite uses in-memory MongoDB-compatible fixtures. Set $env:SRI_TEST_MONGO = "mongodb://127.0.0.1:27017" before pytest to use a real test server. Each test uses a fresh randomly named sri_test_ database and removes it afterwards.

From the project root, use Playwright with the built site and a running local MongoDB server:

~~~powershell
.\backend\.venv\Scripts\python.exe -m playwright install chromium webkit
.\backend\.venv\Scripts\python.exe scripts\browser_qa.py --engine chromium
.\backend\.venv\Scripts\python.exe scripts\browser_qa.py --engine webkit
~~~

The browser suite starts a temporary Flask server and uses a disposable sri_browser_ database. Use --mongo for a different server and --screenshots for optional local captures.

## Handover files

| Path | Contents |
| --- | --- |
| frontend/src, frontend/public, frontend/dist | React source, local assets and production build |
| backend/app, backend/tests | API, SSR entry document, authentication, media, email, seeds and tests |
| shared/content.json | Public company copy, route catalogue, form fields and choices |
| scripts, deploy, docker-compose.yml | Local startup, browser QA and deployment |
| docs/ADMIN_GUIDE.md | Publishing, branding, founder and enquiry workflows |
| docs/API.md | Request/response contracts and database design |
| docs/CONTENT_GUIDE.md | Approved material and launch content dependencies |
| docs/DEPLOYMENT.md | Hosting, HTTPS, configuration, backups and restore |
| docs/VERIFICATION.md | Test results and limits |
| LICENSE-ASSETS.md | Photography and typography credits |

If a request fails, check /api/health, the terminal and the MongoDB service. If the site reports that content is uninitialised, run init-db against the same database configured for the server.

## Daily Development - Windows VS Code

Run the website in two separate VS Code PowerShell terminals.
Docker is not required.

### Terminal 1 - Flask Backend

```powershell
cd D:\TechEase\sri-ventures-consulting\backend
.\.venv\Scripts\Activate.ps1
python -m flask --app run run --host 127.0.0.1 --port 5000 --no-reload
```

Backend URL: http://localhost:5000

The --no-reload option avoids the Windows Werkzeug
auto-reloader socket error (WinError 10038).

### Terminal 2 - React + Vite Frontend

```powershell
cd D:\TechEase\sri-ventures-consulting\frontend
npm run dev
```

Frontend URL: http://localhost:5173

### MongoDB

MongoDB runs as a Windows service.

```powershell
Get-Service MongoDB
```

If the service is stopped, start it from an
elevated PowerShell terminal:

```powershell
Start-Service MongoDB
```

Default MongoDB connection:
mongodb://127.0.0.1:27017

Database: sri_website

### Website URLs

- Homepage: http://localhost:5173/
- Admin Login: http://localhost:5173/admin/login
- Know the Founder: http://localhost:5173/know-the-founder/
- Backend Health: http://localhost:5000/api/health

Keep both development terminals open.
Press Ctrl+C in each terminal to stop its server.
