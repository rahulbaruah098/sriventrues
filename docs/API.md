# API reference

All times are UTC ISO 8601 in JSON. The staff interface displays India Standard Time. Use the same origin for the public application, staff area, API and media. Vite proxies local development requests. See `shared/content.json` for the exact published route catalogue, enquiry fields and allowed choices.

## Public reads and submissions

| Method | Path | Response |
| --- | --- | --- |
| GET | /api/health | Database ping and status |
| GET | /api/public/settings | Public identity, logo URL/width, contact channels, SEO and website notices |
| GET | /api/public/pages/approach or /founder | Current published page. Disabled approach stages are excluded |
| GET | /api/public/content/{kind} | Paginated published list. Use q, category, page and limit. For articles, sort=latest bypasses featured ordering |
| GET | /api/public/content/{kind}/{slug} | Published detail or 404 |
| POST | /api/public/enquiries | Store a validated enquiry and return its reference |
| GET | /media/{filename} | Published image or approved PDF. Unpublished uploads require a staff session |
| GET | /sitemap.xml and /robots.txt | Indexable public URLs and crawler instructions |

Content kinds are `articles`, `case-studies` and `products`. Lists return `items`, `total`, `page` and `limit`. The default page size is 12 and the maximum is 100. Article lists prioritise featured work, followed by publication date. Catalogue and portfolio order is ascending.

### Submit a general enquiry

Generate a fresh UUID v4 for each new submission. Reuse that UUID if a connection drops and the same submission is retried. The other journeys use the same envelope with their own required fields from the shared schema.

```json
{
  "type": "general",
  "request_id": "3d778633-089a-4088-afd3-a89d40bc1d01",
  "consent": true,
  "website": "",
  "data": {
    "name": "Example visitor",
    "email": "visitor@example.org",
    "phone": "+91 9000000000",
    "subject": "Business enquiry",
    "message": "Please contact me about a proposed engagement."
  }
}
```

The first accepted POST returns 201 with `{"reference":"SRI-…"}`. An identical retry returns the same reference with 200. The `website` field is a honeypot and must remain empty. Form email delivery is attempted after recording the submission. Staff can inspect its delivery status.

## Authentication

| Method | Path | Operation |
| --- | --- | --- |
| POST | /api/auth/login | JSON email and password. Returns email and CSRF token. Sets an opaque HttpOnly session cookie |
| GET | /api/auth/session | Current email and CSRF token |
| PUT | /api/auth/account | Current password, new email, optional new password. Rotates the session and invalidates earlier sessions |
| POST | /api/auth/logout | Invalidate the session and expire its cookie |

Send `X-CSRF-Token` on authenticated POST, PUT and DELETE requests, including uploads and logout. A session has an absolute eight-hour expiry. Use `APP_ENV=production` behind HTTPS for Secure cookies. Secrets, password hashes and raw session tokens are excluded from public API responses.

## Staff content and business operations

| Method | Path | Operation |
| --- | --- | --- |
| GET | /api/admin/dashboard | Counts, recent enquiries and recent editorial updates |
| GET / POST | /api/admin/content/{kind} | List/search with optional status filter or create |
| GET / PUT / DELETE | /api/admin/content/{kind}/{id} | Read for editing, replace editable fields, or delete |
| GET / PUT | /api/admin/pages/{founder or approach} | Get draft and publication, save a draft, or publish |
| GET / PUT | /api/admin/settings | Get configuration or update selected fields |
| POST | /api/admin/media | Multipart field file, optional purpose logo, content or profile |
| GET | /api/admin/enquiries | Filter by type, status or q, sort newest, oldest or name |
| GET / PUT | /api/admin/enquiries/{id} | Read all fields or update status and notes |
| GET | /api/admin/enquiries/export.csv | Download rows matching the current filters |

Send the current integer `version` for updates and deletes. A stale write returns 409. Content writes validate the slug, required published fields and image references. Slugs are unique within each content kind. Article HTML is cleaned with an allowlist. An approach or founder request contains `version`, `draft` and an `action` of `draft` or `publish`.

Images accept PNG, WebP, JPEG and self-contained passive SVG. PDFs are accepted exclusively for the corporate profile and are served as downloads. The size limit is 8 MiB per file. Oversized or unsupported artwork returns a validation message. Draft image previews are accessible to signed-in staff.

## Storage and errors

| Collection | Main purpose and indexes |
| --- | --- |
| admin_users, sessions, limits | Unique administrator email, hashed session identifiers, session expiry, fixed-window throttle TTLs |
| articles, products, case_studies | Unique slug, publication date and ordering indexes |
| approach, founder | One main document with working and published snapshots |
| site_settings | One current public configuration and optimistic edit version |
| media_assets | Metadata and unique public URL. File bytes reside in the media volume |
| enquiries | Unique reference and submission UUID, filtered inbox index |
| seed_versions | Initial draft-concept migration marker |

Errors have an `error` message. Responses include 400 for malformed input, 401 for an invalid session, 403 for CSRF/origin failure, 404 for absent records, 409 for duplicate or stale records, 413 for oversized uploads, 429 for throttling and 503 when MongoDB cannot serve reads.

## Optional newsletter and analytics

The public settings response includes newsletter availability and the public GA4 measurement ID when configured. Newsletter signatures and SMTP credentials stay on the server.

| Method | Path | Operation |
| --- | --- | --- |
| POST | /api/public/newsletter | Accept an email and explicit consent, then send a confirmation link if needed |
| POST | /api/public/newsletter/manage | Confirm or unsubscribe using a purpose-bound signed token from the email |
| GET | /api/admin/newsletter/export.csv | Export only confirmed addresses with their individual unsubscribe URLs |

The subscribers collection uses a digest of the email identity as its primary key. A TTL index expires pending subscriptions. Confirmation removes the expiry. Unsubscription deletes the record. Campaign sending is handled by the organisation’s chosen mail sender.
