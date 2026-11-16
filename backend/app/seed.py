"""Idempotent publication defaults. Never overwrite editorial changes."""

import json
import re
from pathlib import Path

from .core import CONTENT, KINDS, db, now

SEED = json.loads(Path(__file__).with_name("seed_data.json").read_text(encoding="utf-8"))


def initialise():
    database = db()
    database.subscribers.create_index("expires_at", expireAfterSeconds=0)
    database.admin_users.create_index("email", unique=True)
    database.sessions.create_index("expires_at", expireAfterSeconds=0)
    database.limits.create_index("expires_at", expireAfterSeconds=0)
    database.media_assets.create_index("url", unique=True)
    database.enquiries.create_index("reference", unique=True)
    database.enquiries.create_index("request_id", unique=True)
    database.enquiries.create_index([("status", 1), ("type", 1), ("created_at", -1)])
    for coll in KINDS.values():
        database[coll].create_index("slug", unique=True)
        database[coll].create_index([("status", 1), ("published_at", -1)])
        database[coll].create_index([("status", 1), ("order", 1)])
    database.articles.create_index("seed_key", unique=True, sparse=True)
    stamp = now()
    common = {"version": 1, "created_at": stamp, "updated_at": stamp}

    def singleton(coll, values):
        database[coll].update_one(
            {"_id": "main"}, {"$setOnInsert": {**common, **values}}, upsert=True
        )

    singleton("site_settings", CONTENT["settings"])
    for kind in ("approach", "founder"):
        public = SEED[kind]
        draft = {**public, "bio": SEED["founderDraft"]} if kind == "founder" else public
        singleton(kind, {"draft": draft, "published": public, "published_at": stamp})
    # One-time migration marker prevents intentionally deleted draft concepts returning on restart.
    if not database.seed_versions.find_one({"_id": "concepts-v1"}):
        for concept in SEED["concepts"]:
            slug = re.sub(r"[^a-z0-9]+", "-", concept["title"].lower()).strip("-")
            values = {
                **common,
                **concept,
                "slug": slug,
                "status": "draft",
                "excerpt": "",
                "body": "",
                "cover": "",
                "cover_alt": "",
                "author": "",
                "order": 0,
                "featured": False,
                "seo_title": "",
                "seo_description": "",
                "published_at": None,
            }
            database.articles.update_one({"seed_key": slug}, {"$setOnInsert": values}, upsert=True)
        database.seed_versions.update_one(
            {"_id": "concepts-v1"}, {"$setOnInsert": {"at": stamp}}, upsert=True
        )
