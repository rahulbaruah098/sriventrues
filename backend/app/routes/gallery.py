"""Public gallery and protected editor. Image files use the existing media upload pipeline."""
from flask import Blueprint, request
from werkzeug.exceptions import BadRequest, Conflict
from ..auth import admin_required
from ..core import by_id, db, media_url, now, number, option, paginated, payload, serialize, string

gallery = Blueprint("gallery", __name__)

def images():
    return db().gallery_images

def validate(data):
    url = media_url(data.get("image", ""))
    if not url or url.endswith(".svg"):
        raise BadRequest("Upload a JPG, PNG or WEBP photograph.")
    return {
        "image": url,
        "caption": string(data, "caption", 300),
        "alt": string(data, "alt", 220) or string(data, "caption", 220) or "Gallery photograph",
        "status": option(data.get("status", "draft"), ["draft", "published"], "status"),
        "order": number(data.get("order", 0), "display order", 0, 99999),
    }

@gallery.get("/api/public/gallery")
def public_gallery():
    return paginated(images(), {"status": "published"}, [("order", 1), ("created_at", -1)])

@gallery.get("/api/admin/gallery")
@admin_required
def admin_gallery():
    return paginated(images(), {}, [("order", 1), ("created_at", -1)])

@gallery.post("/api/admin/gallery")
@admin_required
def create():
    stamp = now()
    entry = {**validate(payload()), "created_at": stamp, "updated_at": stamp, "version": 1}
    result = images().insert_one(entry)
    return serialize(images().find_one({"_id": result.inserted_id})), 201

@gallery.put("/api/admin/gallery/<identifier>")
@admin_required
def update(identifier):
    current = by_id(images(), identifier)
    data = payload()
    version = number(data.get("version"), "version", 1, 2_000_000_000)
    result = images().update_one(
        {"_id": current["_id"], "version": version},
        {"$set": {**validate(data), "updated_at": now()}, "$inc": {"version": 1}},
    )
    if not result.matched_count:
        raise Conflict("This image changed. Reload before saving.")
    return serialize(images().find_one({"_id": current["_id"]}))

@gallery.delete("/api/admin/gallery/<identifier>")
@admin_required
def delete(identifier):
    current = by_id(images(), identifier)
    version = number(payload().get("version"), "version", 1, 2_000_000_000)
    if not images().delete_one({"_id": current["_id"], "version": version}).deleted_count:
        raise Conflict("This image changed. Reload before deleting.")
    return {"ok": True}
