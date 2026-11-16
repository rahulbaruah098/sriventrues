import io
import uuid

from PIL import Image
import pytest
from app.core import CONTENT
from app.seed import initialise


def cover_bytes():
    buff = io.BytesIO()
    Image.new("RGBA", (80, 34), (100, 110, 120, 128)).save(buff, "PNG")
    buff.seek(0)
    return buff


def upload(c, h, purpose="content"):
    r = c.post(
        "/api/admin/media",
        headers=h,
        data={"purpose": purpose, "file": (cover_bytes(), "approved.png", "image/png")},
    )
    assert r.status_code == 201, r.json
    return r.json["url"]


def test_seed_is_repeatable_and_respects_edits(env):
    app, database, _ = env
    key = database.articles.find_one()["_id"]
    database.articles.delete_one({"_id": key})
    database.site_settings.update_one({"_id": "main"}, {"$set": {"tagline": "Edited"}})
    with app.app_context():
        initialise()
        initialise()
    assert database.articles.count_documents({}) == 6
    assert database.articles.count_documents({"status": "published"}) == 0
    assert database.site_settings.find_one()["tagline"] == "Edited"


def test_authentication_cookie_csrf_and_logout(env, staff):
    app, _, _ = env
    c, h = staff
    assert app.test_client().get("/api/admin/dashboard").status_code == 401
    assert c.get("/api/auth/session").json["csrf"] == h["X-CSRF-Token"]
    assert c.put("/api/admin/settings", json={"name": "Example"}).status_code == 403
    assert c.post("/api/auth/logout", headers=h, json={}).status_code == 200
    assert c.get("/api/auth/session").status_code == 401


def test_password_change_revokes_prior_sessions(env, staff):
    app, _, password = env
    c, h = staff
    other = app.test_client()
    other.post("/api/auth/login", json={"email": "editor@example.org", "password": password})
    r = c.put(
        "/api/auth/account",
        headers=h,
        json={"email": "new@example.org", "current_password": password, "password": password + "a"},
    )
    assert r.status_code == 200
    assert other.get("/api/auth/session").status_code == 401
    assert c.get("/api/auth/session").json["email"] == "new@example.org"


def test_login_rate_and_origin(env):
    c = env[0].test_client()
    assert (
        c.post(
            "/api/auth/login", headers={"Origin": "https://outside.example"}, json={}
        ).status_code
        == 403
    )
    for _ in range(10):
        assert (
            c.post(
                "/api/auth/login", json={"email": "unassigned@example.org", "password": "invalid"}
            ).status_code
            == 401
        )
    assert (
        c.post(
            "/api/auth/login", json={"email": "unassigned@example.org", "password": "invalid"}
        ).status_code
        == 429
    )


@pytest.mark.parametrize("kind", ["articles", "case-studies", "products"])
def test_content_publication_lifecycle(env, staff, kind):
    c, h = staff
    public = env[0].test_client()
    base = "/api/admin/content/" + kind
    image = upload(c, h)
    doc = {
        "title": "QA record",
        "slug": "qa-record",
        "excerpt": "Integration fixture.",
        "status": "draft",
        "cover": image,
        "cover_alt": "Test image",
        "category": "Agriculture & Agribusiness",
        "role": "Test role",
        "challenge": "Test challenge",
        "intervention": "Test method",
        "outcomes": "Test outcome",
        "gallery": [{"url": image, "alt": "Gallery image"}],
    }
    if kind == "articles":
        doc.update(
            category=CONTENT["articleCategories"][0],
            body="<h2>Section</h2><p><font>Editorial text</font></p>",
        )
    if kind == "products":
        doc.update(category="Farm Inputs", pack_size="QA size")
    draft = c.post(base, json=doc, headers=h)
    assert draft.status_code == 201, draft.json
    doc = draft.json
    path = "/api/public/content/" + kind + "/" + doc["slug"]
    assert public.get(path).status_code == 404
    assert public.get(image).status_code == 404
    assert c.get(image).status_code == 200
    doc["status"] = "published"
    dest = base + "/" + doc["id"]
    updated = c.put(dest, json=doc, headers=h)
    assert updated.status_code == 200, updated.json
    assert c.put(dest, json=doc, headers=h).status_code == 409
    assert public.get(image).status_code == 200
    visible = public.get(path)
    assert visible.status_code == 200
    if kind == "articles":
        assert "<font" not in visible.json["body"]
    assert public.get("/api/public/content/" + kind + "?q=QA&limit=1").json["total"] == 1
    assert c.post(base, json=doc, headers=h).status_code == 409
    doc = updated.json
    doc["status"] = "draft"
    unpublished = c.put(dest, json=doc, headers=h)
    assert unpublished.status_code == 200
    assert public.get(path).status_code == 404
    assert (
        c.delete(dest, headers=h, json={"version": unpublished.json["version"]}).status_code == 200
    )
    assert c.get(dest).status_code == 404


@pytest.mark.parametrize("kind", ["founder", "approach"])
def test_page_draft_publish_and_order(env, staff, kind):
    c, h = staff
    path = "/api/admin/pages/" + kind
    live = "/api/public/pages/" + kind
    obj = c.get(path).json
    original = c.get(live).json["heading"]
    draft = obj["draft"]
    draft["heading"] = "Revised heading"
    if kind == "approach":
        draft["stages"].reverse()
        draft["stages"][1]["enabled"] = False
    else:
        draft.update(
            name="QA founder",
            milestones=[
                {
                    "period": "QA period",
                    "organisation": "QA previous organisation",
                    "description": "Attributed milestone",
                }
            ],
        )
    r = c.put(path, headers=h, json={"action": "draft", "draft": draft, "version": obj["version"]})
    assert r.status_code == 200 and c.get(live).json["heading"] == original
    pub = c.put(
        path, headers=h, json={"action": "publish", "draft": draft, "version": r.json["version"]}
    )
    assert pub.status_code == 200
    shown = c.get(live).json
    assert shown["heading"] == "Revised heading"
    if kind == "approach":
        assert len(shown["stages"]) == 4 and shown["stages"][0]["name"] == "Grow"
    else:
        assert shown["milestones"][0]["organisation"] == "QA previous organisation"


def test_branding_replacement_and_media_validation(env, staff):
    c, h = staff
    setting = c.get("/api/admin/settings").json
    for _ in range(2):
        url = upload(c, h, "logo")
        setting = c.put(
            "/api/admin/settings",
            headers=h,
            json={"logo": url, "version": setting["version"], "logo_width": 140},
        ).json
        assert c.get("/api/public/settings").json["logo"] == url
        assert env[0].test_client().get(url).mimetype == "image/png"
    invalid = c.post(
        "/api/admin/media",
        headers=h,
        data={"file": (io.BytesIO(b"not an image"), "photo.png", "image/png")},
    )
    assert invalid.status_code == 400
    svg = b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20"><path d="M0 0L30 10" fill="navy"/></svg>'
    assert (
        c.post(
            "/api/admin/media",
            headers=h,
            data={"file": (io.BytesIO(svg), "logo.svg", "image/svg+xml")},
        ).status_code
        == 201
    )


def form_body(kind):
    result = {}
    for f in CONTENT["forms"][kind]:
        result[f["key"]] = f.get("options", ["QA submitted value"])[0]
    result.update(name="QA Reader", email="reader@example.org", phone="+91 9876543210")
    return {
        "type": kind,
        "data": result,
        "consent": True,
        "website": "",
        "request_id": str(uuid.uuid4()),
    }


@pytest.mark.parametrize("kind", list(CONTENT["forms"]))
def test_enquiry_to_follow_up_and_csv(env, staff, kind):
    c, h = staff
    public = env[0].test_client()
    obj = form_body(kind)
    r = public.post("/api/public/enquiries", json=obj)
    assert r.status_code == 201, r.json
    assert public.post("/api/public/enquiries", json=obj).json["reference"] == r.json["reference"]
    rows = c.get("/api/admin/enquiries?q=QA&type=" + kind).json
    assert rows["total"] == 1
    id = rows["items"][0]["id"]
    route = "/api/admin/enquiries/" + id
    assert public.get(route).status_code == 401
    doc = c.get(route).json
    assert doc["data"]["name"] == "QA Reader" and doc["email_status"] == "not configured"
    assert (
        c.put(
            route,
            headers=h,
            json={"version": doc["version"], "status": "Responded", "notes": "Contacted."},
        ).status_code
        == 200
    )
    assert c.get("/api/admin/enquiries?status=Responded").json["total"] == 1
    export = c.get("/api/admin/enquiries/export.csv?type=" + kind)
    assert r.json["reference"] in export.text and export.mimetype == "text/csv"
    assert c.get("/api/admin/dashboard").json["counts"]["enquiries"] == 1


def test_validation_and_unavailable_pages(env, staff):
    c, h = staff
    obj = form_body("consulting")
    obj["data"]["engagement"] = "undefined"
    assert c.post("/api/public/enquiries", json=obj).status_code == 400
    assert c.get("/api/public/content/articles?page=zero").status_code == 400
    assert (
        c.post(
            "/api/admin/content/articles",
            headers=h,
            json={"title": "Only a title", "slug": "only", "status": "published"},
        ).status_code
        == 400
    )
    assert c.get("/api/public/pages/unknown").status_code == 404
    assert b"/know-the-founder/" in c.get("/sitemap.xml").data
    assert "Disallow: /admin" in c.get("/robots.txt").text
