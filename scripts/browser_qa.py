"""End-to-end checks against a fresh MongoDB database and the built Vite frontend.

From the project root, use the backend virtual environment. Start MongoDB first.
python scripts/browser_qa.py --mongo mongodb://127.0.0.1:27017 --engine chromium
"""

import argparse
import os
import secrets
import sys
import tempfile
import threading
import uuid
from pathlib import Path

from playwright.sync_api import expect, sync_playwright
from pymongo import MongoClient
from werkzeug.serving import make_server

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
from app import create_app
from app.auth import new_password
from app.core import CONTENT
from app.seed import initialise

WIDTHS = [320, 360, 375, 390, 430, 768, 1024, 1280, 1440, 1920, 2560, 3440]


def run_checks(browser, origin, password, screenshots):
    context = browser.new_context(viewport={"width": 1440, "height": 960}, device_scale_factor=1)
    page = context.new_page()
    page.set_default_timeout(9000)
    errors = []
    page.on("pageerror", lambda e: errors.append(f"{page.url}: {e}"))

    def go(path):
        res = page.goto(origin + path, wait_until="domcontentloaded")
        assert res.status == 200, (path, res.status)
        # Let the route finish its initial reads before navigating the browser away.
        if path != "/" or page.locator(".splash").count() == 0:
            page.wait_for_load_state("networkidle")
        return res

    def snap(name):
        if screenshots:
            screenshots.mkdir(parents=True, exist_ok=True)
            page.screenshot(path=str(screenshots / (name + ".png")), timeout=15000)

    go("/")
    expect(page.locator(".splash")).to_be_visible()
    page.wait_for_function("() => { const image = document.querySelector('.splash img'); return image?.complete && image.naturalWidth > 0 }")
    page.wait_for_timeout(1300)
    snap("signature")
    expect(page.locator(".splash")).to_have_count(0, timeout=4800)
    expect(page.get_by_role("heading", level=1)).to_contain_text("opportunities")
    page.evaluate("document.fonts.ready")
    page.wait_for_timeout(550)
    snap("home-desktop")
    assert page.locator(".hero-image img").evaluate("e=>e.complete && e.naturalWidth>0")
    go("/about/")
    expect(page.locator(".splash")).to_have_count(0)
    page.go_back()
    expect(page.locator(".splash")).to_have_count(0)
    expect(page.locator(".stage h3").first).to_be_visible()
    page.wait_for_load_state("networkidle")
    page.set_viewport_size({"width": 320, "height": 740})
    for path in CONTENT["pages"]:
        go(path)
        expect(page.locator(".site-header")).to_be_visible()
        expect(page.locator(".site h1")).to_have_count(1)
        expect(page.locator(".site-footer")).to_have_count(1)
        assert "Page not found" not in page.locator(".site h1").inner_text(), path
        page.evaluate("document.fonts.ready")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), path
    page.set_viewport_size({"width": 1440, "height": 960})
    res = page.goto(origin + "/unknown-public-address/")
    assert res.status == 404
    expect(page.locator(".site h1")).to_have_text("Page not found.")
    print(
        f"PASS {len(CONTENT['pages'])} dedicated public routes, initial signature, shared layout, navigation and 404.",
        flush=True,
    )

    go("/admin/login")
    page.get_by_label("Email", exact=False).fill("qa-editor@example.org")
    page.get_by_label("Password", exact=False).fill(password)
    page.get_by_role("button", name="Sign in", exact=True).click()
    expect(page.get_by_role("heading", name="Dashboard")).to_be_visible()
    page.get_by_role("link", name="Insights & Articles", exact=True).click()
    page.get_by_role("link", name="New article").click()
    page.get_by_label("Title", exact=False).first.fill("Browser QA article")
    page.get_by_label("Category", exact=False).select_option(CONTENT["articleCategories"][0])
    page.get_by_label("Summary / excerpt").fill(
        "An editorial workflow test in a disposable database."
    )
    page.get_by_role("textbox", name="Article body").fill(
        "An approved body entered through the staff editor."
    )
    page.get_by_role("button", name="Save draft").click()
    expect(page.get_by_role("heading", name="Edit article")).to_be_visible()
    draft_url = "/insights/browser-qa-article/"
    assert context.request.get(origin + draft_url).status == 404
    page.get_by_role("button", name="Publish", exact=True).click()
    expect(page.get_by_role("status")).to_contain_text("Published")
    raw = context.request.get(origin + draft_url)
    assert raw.status == 200 and "An approved body entered" in raw.text()
    assert (
        'type="application/ld+json"' in raw.text()
        and 'property="article:published_time"' in raw.text()
    )
    go(draft_url)
    expect(page.locator(".rich-body")).to_contain_text("An approved body")
    go("/insights/")
    expect(page.locator(".collection-tile h2")).to_contain_text("Browser QA article")

    go("/admin/founder")
    page.get_by_label("Verified founder name").fill("QA founder")
    page.get_by_role("button", name="Save working draft").click()
    expect(page.get_by_role("status")).to_contain_text("Working draft saved")
    assert "QA founder" not in context.request.get(origin + "/know-the-founder/").text()
    page.get_by_role("button", name="Publish page").click()
    expect(page.get_by_role("status")).to_contain_text("Published")
    go("/know-the-founder/")
    expect(page.locator(".founder-grid h2")).to_have_text("QA founder")

    go("/admin/approach")
    page.get_by_label("Stage name").first.fill("Listen")
    page.get_by_role("button", name="Publish page").click()
    expect(page.get_by_role("status")).to_contain_text("Published")
    for path in ["/our-approach/", "/"]:
        go(path)
        expect(page.locator(".stage h3").first).to_have_text("Listen")

    go("/admin/branding")
    page.get_by_label("Official company logo").set_input_files(
        {
            "name": "brand.svg",
            "mimeType": "image/svg+xml",
            "buffer": b'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 30"><path d="M3 5H110V22H3Z" fill="#102B50"/></svg>',
        }
    )
    expect(page.locator(".brand-preview .brand-image")).to_have_count(2)
    page.get_by_role("button", name="Save changes").click()
    expect(page.locator(".editor-form > .success")).to_have_text("Changes saved.")
    go("/")
    expect(page.locator(".nav-inner .brand-image")).to_be_visible()
    nav_src = page.locator(".nav-inner .brand-image").get_attribute("src")
    assert page.locator(".site-footer .brand-image").get_attribute("src") == nav_src
    assert context.request.get(origin + nav_src).status == 200

    go(
        "/contact/?type=ventures&category=Farm+Inputs&buyer=B2B&intent=Request+a+quote&product=QA+product"
    )
    expect(page.get_by_label("Product of interest")).to_have_value("QA product")
    for label, val in [
        ("Full name", "QA enquirer"),
        ("Email", "buyer@example.org"),
        ("Phone", "+91 9123456789"),
        ("Quantity or product requirement", "An enquiry for a test quantity."),
        ("Location", "Assam"),
    ]:
        page.get_by_label(label, exact=False).fill(val)
    page.get_by_role("checkbox").check()
    page.get_by_role("button", name="Submit enquiry").click()
    expect(page.locator(".receipt")).to_be_visible()
    reference = page.locator(".receipt strong").inner_text()
    go("/admin/enquiries")
    expect(page.locator("tbody")).to_contain_text(reference)
    page.get_by_role("link", name="View details").first.click()
    page.get_by_label("Status", exact=False).select_option("Responded")
    page.get_by_label("Internal notes").fill("Followed up in the browser check.")
    page.get_by_role("button", name="Save follow-up").click()
    expect(page.get_by_role("status")).to_contain_text("Changes saved")
    go("/admin/enquiries?status=Responded")
    expect(page.locator("tbody")).to_contain_text(reference)
    assert (
        reference
        in context.request.get(origin + "/api/admin/enquiries/export.csv?status=Responded").text()
    )
    print(
        "PASS browser workflows for article drafts, editing and publishing, founder, approach, logo and enquiry follow-up.",
        flush=True,
    )

    csrf = context.request.get(origin + "/api/auth/session").json()["csrf"]
    headers = {"X-CSRF-Token": csrf}
    for kind, extra in [
        (
            "products",
            {
                "category": "Farm Inputs",
                "description": "QA specifications.",
                "pack_size": "QA pack",
            },
        ),
        (
            "case-studies",
            {
                "category": "Rural Enterprises",
                "vertical": "SRI Consulting",
                "role": "QA role",
                "challenge": "QA challenge",
                "intervention": "QA method",
                "outcomes": "QA outcome",
            },
        ),
    ]:
        fixture = {
            "slug": "browser-check",
            "title": "QA " + kind,
            "excerpt": "Temporary browser fixture.",
            "status": "published",
            **extra,
        }
        reply = context.request.post(
            origin + "/api/admin/content/" + kind, data=fixture, headers=headers
        )
        assert reply.status == 201, reply.text()
    go("/our-work/")
    expect(page.locator(".collection-tile h2")).to_contain_text("QA case-studies")
    go("/our-work/browser-check/")
    expect(page.locator(".reading-body")).to_contain_text("QA outcome")
    go("/ventures/products/?q=QA&category=Farm+Inputs")
    expect(page.locator(".collection-tile h2")).to_contain_text("QA products")
    go("/ventures/products/browser-check/")
    page.get_by_role("link", name="Request a quote").click()
    expect(page.get_by_label("Product of interest")).to_have_value("QA products")
    expect(page.get_by_label("Product category")).to_have_value("Farm Inputs")
    go("/")
    expect(page.locator(".teaser-list")).to_have_count(2)
    page.emulate_media(reduced_motion="reduce")
    for path, selector in [
        ("/", ".hero"),
        ("/contact/?type=consulting", ".enquiry-form"),
        ("/admin/enquiries", "table"),
        ("/admin/founder", ".editor-form"),
    ]:
        go(path)
        expect(page.locator(selector)).to_be_visible()
        for width in WIDTHS:
            height = 844 if width < 600 else 980
            page.set_viewport_size({"width": width, "height": height})
            # WebKit updates viewport-unit variables on a subsequent layout frame.
            page.evaluate(
                "() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(done))))"
            )
            page.evaluate("document.fonts.ready")
            geometry = page.evaluate("""() => ({scroll:document.documentElement.scrollWidth,viewport:innerWidth,
                bad:[...document.querySelectorAll('main h1,main h2,.nav-inner,.editor-form')]
                .filter(e=>{const r=e.getBoundingClientRect();return r.width && (r.right>innerWidth+1||r.left< -1)})
                .map(e=>e.tagName+': '+e.textContent.slice(0,50))})""")
            assert geometry["scroll"] <= width + 1 and not geometry["bad"], (path, width, geometry)
            if path == "/" and width in [390, 768, 1440]:
                snap("home-" + str(width))
            if path == "/admin/enquiries" and width in [390, 1440]:
                snap("staff-" + str(width))
    page.set_viewport_size({"width": 844, "height": 390})
    go("/")
    expect(page.locator(".hero")).to_be_visible()
    assert page.evaluate("document.documentElement.scrollWidth<=innerWidth")
    page.set_viewport_size({"width": 390, "height": 844})
    page.get_by_role("button", name="Open navigation").click()
    expect(page.get_by_role("dialog")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.get_by_role("dialog")).to_have_count(0)
    expect(page.get_by_role("button", name="Open navigation")).to_be_focused()
    go("/admin")
    page.get_by_role("button", name="Sign out").click()
    expect(page.get_by_role("heading", name="Staff sign in")).to_be_visible()
    assert context.request.get(origin + "/api/admin/enquiries").status == 401
    reduced = browser.new_context(reduced_motion="reduce", viewport={"width": 375, "height": 667})
    rp = reduced.new_page()
    rp.goto(origin + "/")
    expect(rp.locator(".hero")).to_be_visible()
    assert rp.locator(".splash").count() == 0
    reduced.close()
    assert not errors, errors
    print(
        "PASS 12 widths across public and staff views, landscape, mobile menu focus, reduced motion and sign-out.",
        flush=True,
    )
    context.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mongo", default=os.getenv("SRI_TEST_MONGO", "mongodb://127.0.0.1:27017"))
    parser.add_argument("--engine", default="chromium", choices=["chromium", "webkit", "firefox"])
    parser.add_argument("--executable", help="Optional installed browser executable")
    parser.add_argument("--screenshots", type=Path, help="Optional local QA captures")
    args = parser.parse_args()
    if not (ROOT / "frontend/dist/index.html").is_file():
        parser.error("Build the frontend first with npm run build.")
    os.environ["APP_ENV"] = "testing"
    name = "sri_browser_" + uuid.uuid4().hex
    mongo = MongoClient(args.mongo, tz_aware=True, serverSelectionTimeoutMS=5000)
    password = secrets.token_urlsafe(24)
    try:
        with tempfile.TemporaryDirectory() as directory:
            app = create_app(
                {
                    "MEDIA_DIR": directory,
                    "PUBLIC_ORIGIN": "http://127.0.0.1",
                    "SMTP_HOST": "",
                    "SECURE_COOKIES": False,
                },
                mongo[name],
            )
            with app.app_context():
                initialise()
                mongo[name].admin_users.insert_one(
                    {
                        "email": "qa-editor@example.org",
                        "active": True,
                        "epoch": 1,
                        "password_hash": new_password(password),
                        "role": "admin",
                    }
                )
            server = make_server("127.0.0.1", 0, app, threaded=True)
            origin = "http://127.0.0.1:" + str(server.server_port)
            app.config.update(PUBLIC_ORIGIN=origin, ALLOWED_ORIGINS={origin})
            thread = threading.Thread(target=server.serve_forever, daemon=True)
            thread.start()
            try:
                with sync_playwright() as p:
                    browser = getattr(p, args.engine).launch(executable_path=args.executable)
                    try:
                        run_checks(browser, origin, password, args.screenshots)
                    finally:
                        browser.close()
            finally:
                server.shutdown()
                thread.join()
    finally:
        mongo.drop_database(name)
        mongo.close()


if __name__ == "__main__":
    main()
