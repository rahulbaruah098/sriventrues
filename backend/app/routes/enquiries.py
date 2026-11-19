import csv
import io
import secrets
import uuid
from email.message import EmailMessage

from flask import Blueprint, Response, current_app, g, request, stream_with_context
from pymongo.errors import DuplicateKeyError
from werkzeug.exceptions import BadRequest, Conflict

from ..auth import admin_required, rate_limit
from ..mail import deliver
from ..turnstile import verify_turnstile
from ..core import (
    CONTENT,
    STATUSES,
    by_id,
    db,
    email,
    now,
    option,
    paginated,
    payload,
    phone,
    record,
    save_version,
    search_filter,
    serialize,
    string,
)

enquiries = Blueprint("enquiries", __name__)


def notify(doc):
    config = current_app.config
    if not config["SMTP_HOST"] or not config["SMTP_FROM"]:
        return "not configured"
    details = doc["data"]
    dest = config.get("INBOX_" + doc["type"].upper()) or config["INBOX_GENERAL"]
    messages = []
    if dest:
        m = EmailMessage()
        m["To"], m["From"], m["Reply-To"] = dest, config["SMTP_FROM"], details["email"]
        m["Subject"] = f"SRI {doc['type']} enquiry {doc['reference']}"
        m.set_content(
            f"A new {doc['type']} enquiry is available in the staff inbox.\nReference: {doc['reference']}\n"
            f"{config['PUBLIC_ORIGIN']}/admin/enquiries/{doc['_id']}"
        )
        messages.append(m)
    m = EmailMessage()
    m["To"], m["From"] = details["email"], config["SMTP_FROM"]
    m["Subject"] = f"Your SRI enquiry {doc['reference']}"
    m.set_content(
        f"Thank you for contacting SRI. We received your {doc['type']} enquiry.\n"
        f"Please retain this reference for follow-up: {doc['reference']}."
    )
    messages.append(m)
    if deliver(messages):
        return "sent" if dest else "acknowledgement sent"
    return "delivery incomplete"


@enquiries.post("/api/public/enquiries")
def submit():
    rate_limit("enquiries", 12, 600)
    obj = payload()
    kind = option(obj.get("type"), CONTENT["forms"], "enquiry journey")
    verify_turnstile(obj.get("turnstile_token"))
    if obj.get("website") or obj.get("consent") is not True:
        raise BadRequest("Check the form and confirm the contact permission.")
    try:
        request_id = str(uuid.UUID(obj.get("request_id", ""), version=4))
        if request_id != obj.get("request_id"):
            raise ValueError
    except (ValueError, TypeError, AttributeError) as exc:
        raise BadRequest("A valid submission ID is required.") from exc
    source, data = record(obj.get("data")), {}
    for f in CONTENT["forms"][kind]:
        key = f["key"]
        val = string(source, key, 3500 if f["type"] == "textarea" else 260, required=f["required"])
        if val and f["type"] == "email":
            val = email(val)
        if val and f["type"] == "tel":
            val = phone(val)
        if val and f.get("options"):
            option(val, f["options"], f["label"])
        data[key] = val
    stamp = now()
    doc = {
        "reference": "SRI-" + stamp.strftime("%Y") + "-" + secrets.token_hex(5).upper(),
        "type": kind,
        "request_id": request_id,
        "data": data,
        "status": "New",
        "notes": "",
        "version": 1,
        "created_at": stamp,
        "updated_at": stamp,
        "consent_at": stamp,
        "email_status": "pending",
    }
    try:
        doc["_id"] = db().enquiries.insert_one(doc).inserted_id
    except DuplicateKeyError:
        previous = db().enquiries.find_one({"request_id": request_id})
        if not previous or previous["type"] != kind or previous["data"] != data:
            raise Conflict("This submission identifier was already used. Start a fresh enquiry.")
        return {"reference": previous["reference"]}
    db().enquiries.update_one({"_id": doc["_id"]}, {"$set": {"email_status": notify(doc)}})
    return {"reference": doc["reference"]}, 201


def filters():
    query = search_filter(
        ["reference", "data.name", "data.organisation", "data.email", "data.phone"]
    )
    for key, choices in [("status", STATUSES), ("type", CONTENT["forms"])]:
        if request.args.get(key):
            query[key] = option(request.args[key], choices, key)
    sort = option(request.args.get("sort", "newest"), ["newest", "oldest", "name"], "sort order")
    return query, {
        "newest": [("created_at", -1)],
        "oldest": [("created_at", 1)],
        "name": [("data.name", 1)],
    }[sort] + [("_id", 1)]


@enquiries.get("/api/admin/enquiries")
@admin_required
def inbox():
    query, sort = filters()
    return paginated(
        db().enquiries,
        query,
        sort,
        {
            "reference": 1,
            "type": 1,
            "data.name": 1,
            "data.organisation": 1,
            "data.email": 1,
            "data.phone": 1,
            "status": 1,
            "created_at": 1,
            "version": 1,
        },
    )


@enquiries.get("/api/admin/enquiries/export.csv")
@admin_required
def export():
    query, sort = filters()

    def row(cells):
        out = io.StringIO()
        # Neutralise spreadsheet formulas, including values preceded by whitespace.
        csv.writer(out).writerow(
            [
                "'" + str(v)
                if str(v).lstrip().startswith(("=", "-", "+", "@"))
                or str(v).startswith(("\t", "\r", "\n"))
                else str(v)
                for v in cells
            ]
        )
        return out.getvalue()

    def generate():
        yield "\ufeff" + row(
            [
                "Reference",
                "Name",
                "Organisation",
                "Email",
                "Phone",
                "Journey",
                "Status",
                "Submitted UTC",
            ]
        )
        for item in db().enquiries.find(query).sort(sort):
            data = item["data"]
            yield row(
                [
                    item["reference"],
                    data["name"],
                    data.get("organisation", ""),
                    data["email"],
                    data["phone"],
                    item["type"],
                    item["status"],
                    serialize(item["created_at"]),
                ]
            )

    return Response(
        stream_with_context(generate()),
        mimetype="text/csv",
        headers={"Content-Disposition": 'attachment; filename="sri-enquiries.csv"'},
    )


@enquiries.get("/api/admin/enquiries/<identifier>")
@admin_required
def detail(identifier):
    return serialize(by_id(db().enquiries, identifier))


@enquiries.put("/api/admin/enquiries/<identifier>")
@admin_required
def follow_up(identifier):
    doc = by_id(db().enquiries, identifier)
    obj = payload()
    status = option(obj.get("status"), STATUSES, "status")
    patch = {"status": status, "notes": string(obj, "notes", 16000), "handled_by": g.admin["email"]}
    if status == "Responded" and doc["status"] != status:
        patch["responded_at"] = now()
    return save_version(db().enquiries, doc, obj, patch)
