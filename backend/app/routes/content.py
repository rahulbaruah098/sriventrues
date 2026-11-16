from flask import Blueprint, request
from werkzeug.exceptions import BadRequest, Conflict, NotFound

from ..auth import admin_required
from ..core import (
    CONTENT,
    KINDS,
    SLUG_RE,
    by_id,
    db,
    items,
    media_url,
    now,
    number,
    option,
    paginated,
    payload,
    record,
    save_version,
    search_filter,
    serialize,
    string,
)
from ..richtext import plain, sanitise

content = Blueprint("content", __name__)
SUMMARY = {
    "body": 0,
    "challenge": 0,
    "intervention": 0,
    "outcomes": 0,
    "gallery": 0,
    "inline_media": 0,
    "seed_key": 0,
}
SORTS = {
    "articles": [("featured", -1), ("published_at", -1), ("_id", -1)],
    "products": [("order", 1), ("title", 1), ("_id", 1)],
    "case-studies": [("order", 1), ("published_at", -1), ("_id", 1)],
}


def collection(kind):
    if kind not in KINDS:
        raise NotFound("Collection not found.")
    return db()[KINDS[kind]]


def listing(kind, public):
    coll = collection(kind)
    query = search_filter(["title", "excerpt", "category", "manufacturer"])
    if public:
        query["status"] = "published"
    elif request.args.get("status"):
        query["status"] = option(request.args["status"], ["published", "draft"], "status")
    category = string(request.args, "category", 180)
    if category:
        query["category"] = category
    sort = SORTS[kind] if public else [("updated_at", -1), ("_id", -1)]
    if public and kind == "articles" and request.args.get("sort") == "latest":
        sort = [("published_at", -1), ("_id", -1)]
    return paginated(coll, query, sort, SUMMARY)


@content.get("/api/public/content/<kind>")
def public_list(kind):
    return listing(kind, True)


@content.get("/api/public/content/<kind>/<slug>")
def public_detail(kind, slug):
    doc = collection(kind).find_one(
        {"slug": slug, "status": "published"}, {"seed_key": 0, "inline_media": 0}
    )
    if not doc:
        raise NotFound("This item is unavailable.")
    return serialize(doc)


@content.get("/api/admin/content/<kind>")
@admin_required
def admin_list(kind):
    return listing(kind, False)


@content.get("/api/admin/content/<kind>/<identifier>")
@admin_required
def edit_data(kind, identifier):
    return serialize(by_id(collection(kind), identifier))


def parse_content(kind, data):
    status = option(data.get("status", "draft"), ["published", "draft"], "publication status")
    live = status == "published"
    doc = {
        k: string(data, k, n)
        for k, n in {
            "excerpt": 1200,
            "cover_alt": 350,
            "seo_title": 160,
            "seo_description": 400,
        }.items()
    }
    doc.update(
        title=string(data, "title", 220, required=True),
        slug=string(data, "slug", 180, required=True),
        status=status,
        cover=media_url(data.get("cover", "")),
        order=number(data.get("order", 0), "ordering", 0, 99999),
    )
    if not SLUG_RE.fullmatch(doc["slug"]):
        raise BadRequest("Use lowercase letters, numbers and single hyphens in the slug.")
    if doc["cover"] and live and not doc["cover_alt"]:
        raise BadRequest("Describe the cover image before publishing.")
    doc["category"] = string(data, "category", 180, required=live)
    if live and not doc["excerpt"]:
        raise BadRequest("Add a short summary before publishing.")
    if kind == "articles":
        if doc["category"]:
            option(doc["category"], CONTENT["articleCategories"], "article category")
        doc["author"] = string(data, "author", 150)
        doc["body"], doc["inline_media"] = sanitise(string(data, "body", 160000))
        if live and not plain(doc["body"]):
            raise BadRequest("Write the article body before publishing.")
        doc["featured"] = data.get("featured") is True
    else:
        doc["gallery"] = []
        for entry in items(data.get("gallery", []), 18):
            entry = record(entry)
            url = media_url(entry.get("url", ""))
            if not url:
                raise BadRequest("Choose a gallery image.")
            doc["gallery"].append({"url": url, "alt": string(entry, "alt", 350, required=live)})
        if kind == "case-studies":
            for key in ("client", "role", "challenge", "intervention", "outcomes", "vertical"):
                doc[key] = string(
                    data,
                    key,
                    6000,
                    required=live and key in {"role", "challenge", "intervention", "outcomes"},
                )
            if doc["vertical"]:
                option(
                    doc["vertical"],
                    ["SRI Ventures", "SRI Consulting", "Both verticals"],
                    "vertical",
                )
            doc["related_services"] = [
                option(p, CONTENT["pages"], "related page")
                for p in items(data.get("related_services", []), 12)
            ]
        else:
            if doc["category"]:
                option(
                    doc["category"], [v["title"] for v in CONTENT["ventures"]], "product category"
                )
            for key in (
                "description",
                "manufacturer",
                "pack_size",
                "specifications",
                "availability",
            ):
                doc[key] = string(
                    data, key, 6000 if key in {"description", "specifications"} else 300
                )
    return doc


@content.post("/api/admin/content/<kind>")
@admin_required
def create_item(kind):
    coll = collection(kind)
    doc = parse_content(kind, payload())
    stamp = now()
    doc.update(
        created_at=stamp,
        updated_at=stamp,
        published_at=stamp if doc["status"] == "published" else None,
        version=1,
    )
    doc["_id"] = coll.insert_one(doc).inserted_id
    return serialize(doc), 201


@content.put("/api/admin/content/<kind>/<identifier>")
@admin_required
def update_item(kind, identifier):
    coll = collection(kind)
    current = by_id(coll, identifier)
    data = payload()
    patch = parse_content(kind, data)
    if patch["status"] == "published" and not current.get("published_at"):
        patch["published_at"] = now()
    return save_version(coll, current, data, patch)


@content.delete("/api/admin/content/<kind>/<identifier>")
@admin_required
def delete_item(kind, identifier):
    coll = collection(kind)
    doc = by_id(coll, identifier)
    version = number(payload().get("version"), "record version", 1, 2_000_000_000)
    if not coll.delete_one({"_id": doc["_id"], "version": version}).deleted_count:
        raise Conflict("This record changed. Reload it before deleting.")
    return {"ok": True}
