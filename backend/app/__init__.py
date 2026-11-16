import os
import re
from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit

import click
from dotenv import load_dotenv
from flask import Flask, Response, current_app, jsonify, request
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, DuplicateKeyError, ExecutionTimeout
from werkzeug.exceptions import Forbidden, HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix

from .auth import admin_required, auth, new_password
from .core import KINDS, ROOT, db, email, now, serialize
from .routes.content import content
from .routes.editorial import editorial
from .routes.enquiries import enquiries
from .routes.media import media, used
from .routes.newsletter import newsletter
from .routes.site import site
from .seed import initialise


def create_app(config=None, database=None):
    load_dotenv(ROOT / "backend/.env")
    app = Flask(__name__, static_folder=None)
    production = os.getenv("APP_ENV", "development").lower() == "production"
    origin = os.getenv("PUBLIC_ORIGIN", "http://localhost:5173").rstrip("/")
    app.config.update(
        PUBLIC_ORIGIN=origin,
        SECURE_COOKIES=production,
        SESSION_HOURS=8,
        MEDIA_DIR=os.getenv("MEDIA_DIR") or str(ROOT / "backend/uploads"),
        DIST_DIR=os.getenv("DIST_DIR") or str(ROOT / "frontend/dist"),
        NEWSLETTER_KEY=os.getenv("NEWSLETTER_KEY", ""),
        GA4_ID=os.getenv("GA4_ID", "").strip(),
        SEARCH_VERIFICATION=os.getenv("SEARCH_VERIFICATION", "").strip(),
        MAX_CONTENT_LENGTH=9 * 1024 * 1024,
        MAX_FORM_MEMORY_SIZE=200_000,
        ALLOWED_ORIGINS={
            s.strip().rstrip("/") for s in os.getenv("CORS_ORIGINS", origin).split(",") if s.strip()
        }
        | {origin},
        SMTP_PORT=int(os.getenv("SMTP_PORT", "587")),
        SMTP_MODE=os.getenv("SMTP_MODE", "starttls").lower(),
    )
    for key in (
        "SMTP_HOST",
        "SMTP_FROM",
        "SMTP_USER",
        "SMTP_PASSWORD",
        "INBOX_GENERAL",
        "INBOX_VENTURES",
        "INBOX_CONSULTING",
        "INBOX_PARTNERSHIPS",
    ):
        app.config[key] = os.getenv(key, "")
    if config:
        app.config.update(config)
    if app.config["NEWSLETTER_KEY"] and len(app.config["NEWSLETTER_KEY"]) < 32:
        raise ValueError("Use a newsletter signing key of at least 32 characters.")
    if app.config["GA4_ID"] and not re.fullmatch(r"G-[A-Z0-9]{4,20}", app.config["GA4_ID"]):
        raise ValueError("Check the GA4 measurement ID.")
    origin_url = urlsplit(app.config["PUBLIC_ORIGIN"])
    if (
        not origin_url.hostname
        or origin_url.path
        or origin_url.query
        or origin_url.fragment
        or origin_url.username
        or origin_url.scheme not in {"http", "https"}
        or (production and origin_url.scheme != "https")
    ):
        raise ValueError("Set PUBLIC_ORIGIN to the website origin, using HTTPS in production.")
    if "*" in app.config["ALLOWED_ORIGINS"]:
        raise ValueError("Use explicit origins for CORS.")
    if app.config["SMTP_MODE"] not in {"ssl", "starttls", "plain"} or (
        production and app.config["SMTP_MODE"] == "plain" and app.config["SMTP_HOST"]
    ):
        raise ValueError("Use TLS for production email.")
    if os.getenv("TRUST_PROXY", "0") == "1":
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1)
    if database is None:
        client = MongoClient(
            os.getenv("MONGODB_URI") or "mongodb://127.0.0.1:27017",
            tz_aware=True,
            serverSelectionTimeoutMS=3500,
            connectTimeoutMS=3500,
            socketTimeoutMS=12000,
        )
        database = client[os.getenv("MONGODB_DB") or "sri_website"]
    app.extensions["sri_db"] = database
    for blueprint in (auth, content, editorial, enquiries, newsletter, media, site):
        app.register_blueprint(blueprint)

    @app.before_request
    def origin_check():
        origin = request.headers.get("Origin")
        if request.path.startswith("/api/") and (request.method not in {"GET", "HEAD"}):
            if origin and origin not in app.config["ALLOWED_ORIGINS"]:
                raise Forbidden("This origin cannot access the API.")
            if request.headers.get("Sec-Fetch-Site") == "cross-site" and not origin:
                raise Forbidden("Cross-site request denied.")

    @app.after_request
    def headers(res):
        res.headers.setdefault("X-Content-Type-Options", "nosniff")
        res.headers.setdefault("X-Frame-Options", "DENY")
        res.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        res.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        res.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "font-src 'self'; img-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
        )
        if (
            app.config["GA4_ID"]
            and res.mimetype == "text/html"
            and not request.path.startswith("/admin")
        ):
            res.headers["Content-Security-Policy"] = (
                res.headers["Content-Security-Policy"]
                .replace("script-src 'self'", "script-src 'self' https://www.googletagmanager.com")
                .replace(
                    "img-src 'self' data: blob:",
                    "img-src 'self' data: blob: https://*.google-analytics.com https://www.googletagmanager.com",
                )
            )
            res.headers["Content-Security-Policy"] += (
                "; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com"
            )
        if production:
            res.headers["Strict-Transport-Security"] = "max-age=31536000"
        if request.path.startswith(("/api/", "/admin")):
            res.headers["Cache-Control"] = "private, no-store"
            res.headers["X-Robots-Tag"] = "noindex, nofollow"
        origin = request.headers.get("Origin")
        if request.path.startswith("/api/") and origin in app.config["ALLOWED_ORIGINS"]:
            res.headers.update(
                {
                    "Access-Control-Allow-Origin": origin,
                    "Access-Control-Allow-Credentials": "true",
                    "Access-Control-Allow-Headers": "Content-Type, X-CSRF-Token",
                    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                }
            )
            res.vary.add("Origin")
        return res

    @app.errorhandler(HTTPException)
    def http_error(exc):
        response = jsonify(error=exc.description)
        response.status_code = exc.code
        if exc.code == 429:
            response.headers["Retry-After"] = str(getattr(exc, "retry_after", 600))
        return response

    @app.errorhandler(DuplicateKeyError)
    def duplicate(_):
        return jsonify(error="That slug or account identity is already in use."), 409

    @app.errorhandler(ConnectionFailure)
    @app.errorhandler(ExecutionTimeout)
    def offline(_):
        if request.path.startswith(("/api/", "/media/")):
            return jsonify(error="The service is temporarily unavailable. Please try again."), 503
        return Response(
            "<!doctype html><meta name=viewport content='width=device-width,initial-scale=1'>"
            "<title>Temporarily unavailable | SRI</title><main><h1>Temporarily unavailable</h1>"
            "<p>Please try again shortly.</p></main>",
            503,
            mimetype="text/html",
            headers={"Retry-After": "30"},
        )

    @app.errorhandler(Exception)
    def unexpected(exc):
        app.logger.exception("Unhandled request error")
        return jsonify(error="The request could not be completed."), 500

    @app.get("/api/health")
    def health():
        db().command("ping")
        return {"status": "ok"}

    @app.get("/api/admin/dashboard")
    @admin_required
    def dashboard():
        database = db()
        updates = []
        for kind, coll in KINDS.items():
            for doc in (
                database[coll]
                .find({}, {"title": 1, "updated_at": 1})
                .sort("updated_at", -1)
                .limit(5)
            ):
                updates.append({**doc, "kind": kind})
        for kind in ("approach", "founder"):
            doc = database[kind].find_one({"_id": "main"})
            if doc:
                updates.append(
                    {
                        "_id": kind,
                        "kind": kind,
                        "title": doc["draft"]["heading"],
                        "updated_at": doc["updated_at"],
                    }
                )
        counts = {
            "published_articles": database.articles.count_documents({"status": "published"}),
            "draft_articles": database.articles.count_documents({"status": "draft"}),
            "published_cases": database.case_studies.count_documents({"status": "published"}),
            "enquiries": database.enquiries.count_documents({}),
            "new_enquiries": database.enquiries.count_documents({"status": "New"}),
        }
        recent = (
            database.enquiries.find(
                {}, {"reference": 1, "type": 1, "created_at": 1, "data.name": 1}
            )
            .sort("created_at", -1)
            .limit(6)
        )
        return {
            "counts": counts,
            "recent": serialize(list(recent)),
            "updates": serialize(sorted(updates, key=lambda d: d["updated_at"], reverse=True)[:7]),
        }

    @app.cli.command("init-db")
    def init_db():
        initialise()
        click.echo("Indexes and editorial defaults are ready.")

    @app.cli.command("create-admin")
    @click.option("--email", "address", prompt="Administrator email")
    @click.password_option(confirmation_prompt=True)
    def create_admin(address, password):
        initialise()
        try:
            db().admin_users.insert_one(
                {
                    "email": email(address).lower(),
                    "password_hash": new_password(password),
                    "role": "admin",
                    "epoch": 1,
                    "active": True,
                    "created_at": now(),
                    "updated_at": now(),
                }
            )
        except DuplicateKeyError:
            raise click.ClickException("This administrator already exists.")
        except HTTPException as exc:
            raise click.ClickException(exc.description)
        click.echo("Administrator created.")

    @app.cli.command("prune-media")
    @click.option(
        "--apply", is_flag=True, help="Remove unused files while all editorial writes are stopped."
    )
    def prune_media(apply):
        count = 0
        for asset in db().media_assets.find({"created_at": {"$lt": now() - timedelta(days=7)}}):
            if not used(asset["url"], published_only=False):
                count += 1
                if apply:
                    (Path(current_app.config["MEDIA_DIR"]) / asset["stored_name"]).unlink(
                        missing_ok=True
                    )
                    db().media_assets.delete_one({"_id": asset["_id"]})
        click.echo(f"{count} unreferenced file(s) {'removed' if apply else 'eligible'}.")

    return app
