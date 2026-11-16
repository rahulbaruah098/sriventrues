"""Shared request, configuration and MongoDB helpers."""

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

from bson import ObjectId
from flask import current_app, request
from werkzeug.exceptions import BadRequest, Conflict, NotFound
from email_validator import EmailNotValidError, validate_email

ROOT = Path(__file__).resolve().parents[2]
CONTENT = json.loads((ROOT / "shared/content.json").read_text(encoding="utf-8"))
KINDS = {"articles": "articles", "case-studies": "case_studies", "products": "products"}
BASES = {"articles": "/insights/", "case-studies": "/our-work/", "products": "/ventures/products/"}
STATUSES = ["New", "In Progress", "Responded", "Closed"]
MEDIA_RE = re.compile(r"^/media/[0-9a-f]{32}\.(?:webp|png|svg|jpg|pdf)$")
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def now():
    return datetime.now(timezone.utc)


def db():
    return current_app.extensions["sri_db"]


def payload():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise BadRequest("Send a JSON object.")
    return data


def string(obj, key, limit=250, *, required=False):
    value = obj.get(key, "")
    if not isinstance(value, str):
        raise BadRequest(f"{key} must be text.")
    value = value.strip()
    if (required and not value) or len(value) > limit or "\x00" in value:
        raise BadRequest(f"Check {key} (up to {limit} characters).")
    return value


def number(value, label, low, high):
    if isinstance(value, bool) or not re.fullmatch(r"\d+", str(value)) or len(str(value)) > 10:
        raise BadRequest(f"Check {label}.")
    n = int(value)
    if not low <= n <= high:
        raise BadRequest(f"{label} must be between {low} and {high}.")
    return n


def option(value, allowed, label):
    if not isinstance(value, str) or value not in allowed:
        raise BadRequest(f"Select a valid {label}.")
    return value


def email(value):
    try:
        return validate_email(value, check_deliverability=False).normalized
    except EmailNotValidError as exc:
        raise BadRequest("Enter a valid email address.") from exc


def phone(value):
    if (
        not re.fullmatch(r"[+\d()\s.-]{6,32}", value)
        or not 6 <= sum(c.isdigit() for c in value) <= 15
    ):
        raise BadRequest("Enter a valid telephone number including country or area code.")
    return value


def http_url(value):
    try:
        u = urlsplit(value)
        valid = u.scheme in ("https", "http") and u.hostname and not u.username and not u.password
    except ValueError:
        valid = False
    if not valid or any(c.isspace() for c in value):
        raise BadRequest("Enter a complete http or https URL.")
    return value


def items(value, limit):
    if not isinstance(value, list) or len(value) > limit:
        raise BadRequest(f"Use a list with at most {limit} entries.")
    return value


def record(value):
    if not isinstance(value, dict):
        raise BadRequest("Check the structure of the submitted item.")
    return value


def by_id(coll, value):
    if not ObjectId.is_valid(value):
        raise NotFound("Record not found.")
    doc = coll.find_one({"_id": ObjectId(value)})
    if not doc:
        raise NotFound("Record not found.")
    return doc


def serialize(value):
    if isinstance(value, dict):
        return {("id" if k == "_id" else k): serialize(v) for k, v in value.items()}
    if isinstance(value, list):
        return [serialize(x) for x in value]
    if isinstance(value, datetime):
        return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, ObjectId):
        return str(value)
    return value


def paginated(coll, query, sort, projection=None):
    page = number(request.args.get("page", 1), "page", 1, 100000)
    size = number(request.args.get("limit", 12), "limit", 1, 100)
    total = coll.count_documents(query)
    rows = coll.find(query, projection).sort(sort).skip((page - 1) * size).limit(size)
    return {"items": serialize(list(rows)), "total": total, "page": page, "limit": size}


def search_filter(fields):
    term = string(request.args, "q", 120)
    if term:
        return {"$or": [{key: {"$regex": re.escape(term), "$options": "i"}} for key in fields]}
    return {}


def save_version(coll, current, data, patch):
    version = number(data.get("version"), "record version", 1, 2_000_000_000)
    result = coll.update_one(
        {"_id": current["_id"], "version": version},
        {"$set": {**patch, "updated_at": now()}, "$inc": {"version": 1}},
    )
    if not result.matched_count:
        raise Conflict("This record changed. Reload it before saving again.")
    return serialize(coll.find_one({"_id": current["_id"]}))


def media_url(value, *, pdf=False):
    if value == "":
        return ""
    if not isinstance(value, str) or not MEDIA_RE.fullmatch(value) or value.endswith(".pdf") != pdf:
        raise BadRequest("Choose an uploaded file of the appropriate type.")
    if not db().media_assets.find_one({"url": value}, {"_id": 1}):
        raise BadRequest("Uploaded file could not be found.")
    return value


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()
