# Release verification

The project was exercised on Linux with Node 24.22.1, Python 3.12.14, Flask 3.1.3 and a standalone MongoDB 7.0.16 instance. The browser suites used Chromium and WebKit. All test content, user accounts and MongoDB data were disposable and are excluded from the distribution.

| Check | Observed result |
| --- | --- |
| Frontend dependency installation and release build | npm ci and npm run build succeeded. React, Vite, Tailwind, GSAP, Motion and the rich-text editor compiled into the bundled production frontend. |
| Python runtime | Dependencies installed in an isolated Python environment. Flask registered the API, public HTML routes and management commands. |
| API and integration suite | 17 tests passed against a real MongoDB server. Coverage includes authentication, password change, CSRF, throttling, validation, publishing, optimistic concurrency, logo/media validation, draft visibility, settings, inquiry filtering and CSV export. |
| Seed and publication rules | Repeated initialisation retained edits and did not resurrect deleted draft concepts. The seven original concepts start as drafts. |
| Forms and email | All four journeys stored a reference. Retrying the same submission returned that reference. A local SMTP receiver captured the acknowledgement and consulting notification. A simulated delivery interruption preserved the database record. |
| Newsletter | A confirmation email reached the local SMTP receiver. The test confirmed the subscriber, checked the protected export, followed the unsubscribe workflow and verified removal. |
| Public navigation | All 38 registered public addresses, including legal, credits and newsletter preferences, opened with one shared header/footer. Nonexistent addresses returned 404. Published product, case and article details were also exercised. |
| Staff-to-public publishing | Edited an article through the rich editor, confirmed that its draft URL returned 404, published it, and checked the raw HTML body and metadata. Founder working drafts stayed private. Publishing updated the founder page, and approach publishing updated both the homepage and dedicated page. |
| Branding and business handoff | Uploaded a temporary test logo through the staff UI, verified both public instances referenced the same URL, submitted a product quotation enquiry, changed its status, then exported the filtered record. |
| Device widths | Chromium and WebKit exercised 320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560 and 3440 CSS pixels across the homepage, consulting enquiry form, staff inbox and founder editor. The test also checked public routes at 320px and a narrow-height landscape viewport. |
| Motion and keyboard | The initial signature was visible, then released the page. Navigation and history did not replay it. Reduced-motion browsing skipped the intro. Escape closed the mobile menu and returned focus to the trigger. |
| Automated accessibility sample | axe-core reported zero violations for the selected WCAG A/AA rules on the homepage, founder, consulting contact, login, journal and approach pages. Desktop, tablet and mobile screenshots were inspected. |
| Media packaging | Checked the real width of every responsive photo rendition and matched public source assets to the production build. Sources and licences are listed in LICENSE-ASSETS.md and on the public credits page. |
| Serving and persistence | Gunicorn and Waitress successfully served the production build, MongoDB health and server-side canonical metadata. An enquiry survived a database restart and application restart. The Vite development entry and API proxy were also exercised. |
| Archive | ZIP integrity, required source/configuration paths and exclusions were checked. Backend smoke checks were repeated from an extracted release. |

## Deployment-specific checks

Viewport checks used browser engines with emulated dimensions. Native Safari on physical iPhones/iPads, Android hardware, Windows PowerShell execution and the Docker Compose engine were outside the test host. The supplied stack and launcher should be smoke-tested on the intended host. Live DNS/TLS, the official domain, external mailbox delivery, Search Console, Google Analytics reporting and field Core Web Vitals depend on SRI’s deployment and accounts. This is an accessibility test sample, not an independent conformance audit.

See the root README for the exact test commands and Windows startup instructions.
