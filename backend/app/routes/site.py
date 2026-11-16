"""Serve the Vite application with readable first-response HTML and per-route metadata."""

import json
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, tostring

from flask import (
    Blueprint,
    Response,
    current_app,
    redirect,
    render_template_string,
    request,
    send_from_directory,
)
from markupsafe import Markup, escape
from werkzeug.exceptions import NotFound, ServiceUnavailable

from ..core import BASES, CONTENT, KINDS, db
from .editorial import published_page, settings

site = Blueprint("site", __name__)
NAV = [
    "/about/",
    "/ventures/",
    "/consulting/",
    "/industries/",
    "/our-approach/",
    "/our-work/",
    "/insights/",
    "/know-the-founder/",
    "/partnerships/",
    "/contact/",
]


def link(path, label):
    return f'<a href="{escape(path)}">{escape(label)}</a>'


def paragraph(text):
    return f"<p>{escape(text)}</p>" if text else ""


def dynamic(kind, slug):
    doc = db()[KINDS[kind]].find_one({"slug": slug, "status": "published"})
    if not doc:
        raise NotFound()
    body = paragraph(doc.get("excerpt"))
    if doc.get("cover"):
        body += f'<img src="{escape(doc["cover"])}" alt="{escape(doc.get("cover_alt", ""))}">'
    if kind == "articles":
        body += doc.get("body", "")  # Sanitised on all editorial writes.
    else:
        fields = (
            (
                ("challenge", "Challenge"),
                ("role", "SRI’s role"),
                ("intervention", "Method"),
                ("outcomes", "Outcomes"),
            )
            if kind == "case-studies"
            else (
                ("description", "Product details"),
                ("specifications", "Specifications"),
                ("pack_size", "Pack size"),
                ("availability", "Availability"),
            )
        )
        for key, title in fields:
            if doc.get(key):
                body += "<h2>" + title + "</h2>" + paragraph(doc[key])
    return doc, body


def page_content(path, conf):
    if path not in CONTENT["pages"]:
        for kind, base in BASES.items():
            if path.startswith(base):
                slug = path[len(base) :].strip("/")
                doc, body = dynamic(kind, slug)
                return {
                    "heading": doc["title"],
                    "title": doc.get("seo_title") or doc["title"],
                    "description": doc.get("seo_description") or doc.get("excerpt", ""),
                    "body": body,
                    "image": doc.get("cover", ""),
                    "type": "article" if kind == "articles" else "website",
                    "author": doc.get("author"),
                    "date": doc.get("published_at"),
                }
        raise NotFound()
    page = CONTENT["pages"][path]
    result = {
        "heading": page["title"],
        "title": page["title"],
        "description": page["description"],
        "body": "",
    }
    if path == "/":
        result.update(
            title=conf.get("seo_title") or conf["name"],
            description=conf.get("seo_description") or page["description"],
            image="/images/seedlings-1200.webp",
        )
    if path in ("/our-approach/", "/know-the-founder/"):
        data = published_page("approach" if path == "/our-approach/" else "founder")
        result.update(title=data["heading"], heading=data["heading"], description=data["intro"])
        if "stages" in data:
            result["body"] += "".join(
                f"<h2>{escape(s['name'])}</h2>" + paragraph(s["description"])
                for s in data["stages"]
            )
        else:
            result.update(image=data.get("portrait", ""))
            result["body"] += (
                paragraph(data["name"]) + paragraph(data["role"]) + paragraph(data["bio"])
            )
            for m in data["milestones"]:
                result["body"] += paragraph(
                    " · ".join([m["period"], m["organisation"], m["description"]])
                )
    for group in ("ventures", "consulting", "industries"):
        for item in CONTENT[group]:
            dest = f"/{group}/{item['slug']}/"
            if path == dest:
                result["body"] += "".join(paragraph(x) for x in item.get("items", []))
            if path == f"/{group}/":
                result["body"] += paragraph("") + link(dest, item["title"]) + " "
    for kind, base in BASES.items():
        if base == path or (kind == "articles" and path == "/"):
            for doc in (
                db()[KINDS[kind]]
                .find({"status": "published"}, {"slug": 1, "title": 1})
                .sort("published_at", -1)
                .limit(24)
            ):
                result["body"] += "<p>" + link(base + doc["slug"] + "/", doc["title"]) + "</p>"
    if path in {"/privacy/", "/terms/"}:
        result["body"] += paragraph(conf.get(path.strip("/"), ""))
    return result


@site.get("/robots.txt")
def robots():
    origin = current_app.config["PUBLIC_ORIGIN"]
    return Response(
        f"User-agent: *\nDisallow: /admin\nDisallow: /api/\nSitemap: {origin}/sitemap.xml\n",
        mimetype="text/plain",
    )


@site.get("/sitemap.xml")
def sitemap():
    root = Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    origin = current_app.config["PUBLIC_ORIGIN"]

    def add(path, stamp=None):
        node = SubElement(root, "url")
        SubElement(node, "loc").text = origin + path
        if stamp:
            SubElement(node, "lastmod").text = stamp.date().isoformat()

    for path in CONTENT["pages"]:
        if path != "/newsletter/":
            add(path)
    for kind, base in BASES.items():
        for doc in db()[KINDS[kind]].find({"status": "published"}, {"slug": 1, "updated_at": 1}):
            add(base + doc["slug"] + "/", doc["updated_at"])
    return Response(
        tostring(root, encoding="utf-8", xml_declaration=True), mimetype="application/xml"
    )


@site.get("/", defaults={"path": ""})
@site.get("/<path:path>")
def shell(path):
    dist = Path(current_app.config["DIST_DIR"])
    if path.startswith(("api/", "media/")):
        raise NotFound()
    if path.startswith(("assets/", "fonts/", "images/")) or path in {"entry.js", "signature.svg"}:
        res = send_from_directory(dist, path)
        res.headers["Cache-Control"] = (
            "public, max-age=31536000, immutable"
            if path.startswith("assets/")
            else "public, max-age=86400"
        )
        return res
    if path == "about/know-the-founder/":
        return redirect("/know-the-founder/", code=308)
    index = dist / "index.html"
    if not index.exists():
        raise ServiceUnavailable("Start Vite for development or build the frontend.")
    is_admin = path == "admin" or path.startswith("admin/")
    canonical = "/" + path.strip("/") + ("/" if path.strip("/") else "")
    origin = current_app.config["PUBLIC_ORIGIN"]
    title = "SRI staff administration"
    head, body, status = '<meta name="robots" content="noindex,nofollow">', "", 200
    if not is_admin:
        conf = settings()
        try:
            page = page_content(canonical, conf)
        except NotFound:
            page = {
                "heading": "Page not found",
                "title": "Page not found",
                "description": "Return to the SRI homepage.",
                "body": link("/", "Home"),
            }
            status = 404
        if status == 200 and request.path != canonical:
            return redirect(
                canonical + (("?" + request.query_string.decode()) if request.query_string else ""),
                code=308,
            )
        title = page["title"] if canonical == "/" else page["title"] + " | " + conf["name"]
        desc, absolute = page["description"], origin + canonical
        article = page.get("type") == "article"
        structured = {
            "@context": "https://schema.org",
            "@type": "Article" if article else "WebPage",
            "name": page["heading"],
            "url": absolute,
            "description": desc,
        }
        if article:
            structured.update(
                headline=page["heading"], publisher={"@type": "Organization", "name": conf["name"]}
            )
            if page.get("date"):
                structured["datePublished"] = (
                    page["date"].isoformat() + "Z"
                    if not page["date"].tzinfo
                    else page["date"].isoformat()
                )
            if page.get("author"):
                structured["author"] = {"@type": "Person", "name": page["author"]}
        if page.get("image"):
            structured["image"] = origin + page["image"]
        head = render_template_string(
            META,
            title=title,
            desc=desc,
            url=absolute,
            kind=page.get("type", "website"),
            image=structured.get("image"),
            published=structured.get("datePublished"),
            author=page.get("author"),
            structured=Markup(json.dumps(structured, ensure_ascii=False).replace("<", r"\u003c")),
            status=404 if canonical == "/newsletter/" else status,
        )
        verification = current_app.config["SEARCH_VERIFICATION"]
        if verification:
            head += f'<meta name="google-site-verification" content="{escape(verification)}">'
        links = " ".join(link(p, CONTENT["pages"][p]["title"]) for p in NAV)
        body = f'<main class="server-page"><nav aria-label="Main">{links}</nav><h1>{escape(page["heading"])}</h1>{paragraph(desc)}{page["body"]}</main>'
    html = index.read_text(encoding="utf-8").replace(
        "<title>SRI</title>", f"<title>{escape(title)}</title>"
    )
    html = html.replace("<!--sri-head-->", head).replace("<!--sri-body-->", body)
    return Response(
        html, status=status, mimetype="text/html", headers={"Cache-Control": "no-store"}
    )


META = """<meta name="description" content="{{ desc }}"><link rel="canonical" href="{{ url }}">
<meta property="og:title" content="{{ title }}"><meta property="og:description" content="{{ desc }}">
<meta property="og:type" content="{{ kind }}"><meta property="og:url" content="{{ url }}">
{% if image %}<meta property="og:image" content="{{ image }}">{% endif %}
{% if published %}<meta property="article:published_time" content="{{ published }}">{% endif %}
{% if author %}<meta property="article:author" content="{{ author }}">{% endif %}
{% if status == 404 %}<meta name="robots" content="noindex">{% endif %}
<script id="page-schema" type="application/ld+json">{{ structured }}</script>"""
