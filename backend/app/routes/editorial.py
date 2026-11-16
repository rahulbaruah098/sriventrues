from flask import Blueprint, current_app
from werkzeug.exceptions import BadRequest, NotFound, ServiceUnavailable

from ..auth import admin_required
from .newsletter import enabled
from ..core import (
    CONTENT,
    db,
    email,
    http_url,
    items,
    media_url,
    now,
    number,
    option,
    payload,
    phone,
    record,
    save_version,
    serialize,
    string,
)

editorial = Blueprint("editorial", __name__)


def singleton(kind):
    if kind not in {"founder", "approach", "site_settings"}:
        raise NotFound()
    doc = db()[kind].find_one({"_id": "main"})
    if not doc:
        raise ServiceUnavailable("Website content has not been initialised.")
    return doc


def published_page(kind):
    if kind not in {"founder", "approach"}:
        raise NotFound()
    data = singleton(kind)["published"]
    if kind == "approach":
        data["stages"] = [s for s in data["stages"] if s["enabled"]]
    return data


@editorial.get("/api/public/pages/<kind>")
def page(kind):
    return published_page(kind)


@editorial.get("/api/admin/pages/<kind>")
@admin_required
def admin_page(kind):
    if kind not in {"founder", "approach"}:
        raise NotFound()
    return serialize(singleton(kind))


@editorial.put("/api/admin/pages/<kind>")
@admin_required
def save_page(kind):
    if kind not in {"founder", "approach"}:
        raise NotFound()
    current = singleton(kind)
    data = payload()
    action = option(data.get("action"), ["draft", "publish"], "action")
    values = record(data.get("draft"))
    doc = {
        "heading": string(values, "heading", 160, required=True),
        "intro": string(values, "intro", 3000),
    }
    if kind == "approach":
        doc["stages"] = []
        for stage in items(values.get("stages"), 30):
            stage = record(stage)
            image = media_url(stage.get("image", ""))
            doc["stages"].append(
                {
                    "name": string(stage, "name", 100, required=True),
                    "description": string(stage, "description", 2500, required=True),
                    "enabled": stage.get("enabled", True) is True,
                    "image": image,
                    "alt": string(stage, "alt", 350, required=bool(image) and action == "publish"),
                }
            )
    else:
        for key, size in {"name": 150, "role": 200, "bio": 18000, "alt": 350}.items():
            doc[key] = string(values, key, size)
        doc["portrait"] = media_url(values.get("portrait", ""))
        if doc["portrait"] and not doc["alt"] and action == "publish":
            raise BadRequest("Add a description of the founder portrait.")
        doc["milestones"] = []
        for entry in items(values.get("milestones", []), 40):
            entry = record(entry)
            doc["milestones"].append(
                {
                    key: string(entry, key, size, required=key != "period")
                    for key, size in {
                        "period": 100,
                        "organisation": 240,
                        "description": 2500,
                    }.items()
                }
            )
    patch = {"draft": doc}
    if action == "publish":
        patch.update(published=doc, published_at=now())
    return save_version(db()[kind], current, data, patch)


@editorial.get("/api/public/settings")
def settings():
    current = singleton("site_settings")
    return {
        **{k: current.get(k, v) for k, v in CONTENT["settings"].items()},
        "newsletter": enabled(),
        "analytics_id": current_app.config["GA4_ID"],
    }


@editorial.get("/api/admin/settings")
@admin_required
def admin_settings():
    return serialize(singleton("site_settings"))


@editorial.put("/api/admin/settings")
@admin_required
def update_settings():
    current = singleton("site_settings")
    data = payload()
    patch = {}
    for key, size in {
        "name": 180,
        "tagline": 220,
        "email": 254,
        "phone": 32,
        "whatsapp": 32,
        "address": 800,
        "hours": 250,
        "seo_title": 160,
        "seo_description": 400,
        "privacy": 24000,
        "terms": 24000,
    }.items():
        if key in data:
            patch[key] = string(data, key, size, required=key == "name")
    if patch.get("email"):
        patch["email"] = email(patch["email"])
    for key in ("phone", "whatsapp"):
        if patch.get(key):
            phone(patch[key])
    if "logo" in data:
        patch["logo"] = media_url(data["logo"])
    if "logo_width" in data:
        patch["logo_width"] = number(data["logo_width"], "logo width", 84, 240)
    if "socials" in data:
        patch["socials"] = []
        for entry in items(data["socials"], 12):
            entry = record(entry)
            patch["socials"].append(
                {
                    "label": string(entry, "label", 60, required=True),
                    "url": http_url(string(entry, "url", 600, required=True)),
                }
            )
    if "profile_file" in data:
        patch["profile_file"] = media_url(data["profile_file"], pdf=True)
    return save_version(db().site_settings, current, data, patch)
