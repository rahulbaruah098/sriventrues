"""Optional confirmed subscriber register. Links use purpose-bound signed tokens."""

import csv
import io
import secrets
from datetime import timedelta
from email.message import EmailMessage

from flask import Blueprint, Response, current_app, stream_with_context
from itsdangerous import BadSignature, URLSafeSerializer
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from werkzeug.exceptions import BadRequest, ServiceUnavailable

from ..auth import admin_required, rate_limit
from ..core import db, digest, email, now, option, payload, string
from ..mail import deliver

newsletter = Blueprint("newsletter", __name__)


def enabled():
    return bool(
        current_app.config["NEWSLETTER_KEY"]
        and current_app.config["SMTP_HOST"]
        and current_app.config["SMTP_FROM"]
    )


def signer(action):
    return URLSafeSerializer(current_app.config["NEWSLETTER_KEY"], salt="sri-newsletter-" + action)


def management_link(row, action):
    token = signer(action).dumps([row["_id"], row["nonce"]])
    return current_app.config["PUBLIC_ORIGIN"] + "/newsletter/#" + action + "=" + token


@newsletter.post("/api/public/newsletter")
def subscribe():
    if not enabled():
        raise ServiceUnavailable("Subscriptions are currently unavailable.")
    rate_limit("newsletter", 6, 600)
    data = payload()
    if data.get("consent") is not True or data.get("website"):
        raise BadRequest("Confirm your subscription request.")
    address = email(string(data, "email", 254, required=True)).lower()
    rate_limit("newsletter-recipient", 3, 3600, address)
    key = digest(address)
    if not db().subscribers.find_one({"_id": key, "status": "confirmed"}):
        stamp = now()
        try:
            row = db().subscribers.find_one_and_update(
                {"_id": key, "status": {"$ne": "confirmed"}},
                {
                    "$setOnInsert": {
                        "nonce": secrets.token_urlsafe(24),
                        "email": address,
                        "status": "pending",
                        "created_at": stamp,
                    },
                    "$set": {"expires_at": stamp + timedelta(days=2)},
                },
                upsert=True,
                return_document=ReturnDocument.AFTER,
            )
        except DuplicateKeyError:
            row = None  # Concurrent confirmation wins.
        if row:
            m = EmailMessage()
            m["Subject"] = "Confirm your SRI Insights subscription"
            m["From"], m["To"] = current_app.config["SMTP_FROM"], address
            m.set_content(
                "Confirm within two days to receive SRI Insights by email.\n\n"
                + management_link(row, "confirm")
                + "\n\nIf you did not request this, you can ignore this message."
            )
            if not deliver([m]):
                raise ServiceUnavailable(
                    "The confirmation email could not be sent. Please try again later."
                )
    return {"ok": True}, 202


@newsletter.post("/api/public/newsletter/manage")
def manage():
    if not current_app.config["NEWSLETTER_KEY"]:
        raise ServiceUnavailable("Newsletter preferences are temporarily unavailable.")
    rate_limit("newsletter-manage", 30, 600)
    data = payload()
    action = option(data.get("action"), ["confirm", "unsubscribe"], "action")
    try:
        ident, nonce = signer(action).loads(string(data, "token", 1600, required=True))
    except (BadSignature, ValueError, TypeError) as exc:
        raise BadRequest("This email link is invalid. Request a new one from Insights.") from exc
    query = {"_id": ident, "nonce": nonce}
    if action == "unsubscribe":
        db().subscribers.delete_one(query)
    elif not db().subscribers.find_one({**query, "status": "confirmed"}):
        changed = db().subscribers.update_one(
            {**query, "status": "pending", "expires_at": {"$gt": now()}},
            {"$set": {"status": "confirmed", "confirmed_at": now()}, "$unset": {"expires_at": ""}},
        )
        if not changed.matched_count:
            raise BadRequest(
                "The confirmation link has expired. Request a fresh link from Insights."
            )
    return {"ok": True}


@newsletter.get("/api/admin/newsletter/export.csv")
@admin_required
def export_list():
    if not current_app.config["NEWSLETTER_KEY"]:
        raise ServiceUnavailable("Configure newsletter signing before exporting.")

    def rows():
        yield "\ufeffEmail,Confirmed UTC,Unsubscribe URL\r\n"
        for row in db().subscribers.find({"status": "confirmed"}).sort("confirmed_at", -1):
            out = io.StringIO()
            address = row["email"]
            if address.startswith(("=", "+", "-", "@")):
                address = "'" + address
            csv.writer(out).writerow(
                [address, row["confirmed_at"].isoformat(), management_link(row, "unsubscribe")]
            )
            yield out.getvalue()

    return Response(
        stream_with_context(rows()),
        mimetype="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sri-insights-subscribers.csv"'},
    )
