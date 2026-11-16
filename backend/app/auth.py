import hmac
import secrets
from datetime import timedelta
from functools import wraps

from flask import Blueprint, current_app, g, jsonify, request
from pymongo import ReturnDocument
from pymongo.errors import DuplicateKeyError
from werkzeug.exceptions import BadRequest, Forbidden, TooManyRequests, Unauthorized
from werkzeug.security import check_password_hash, generate_password_hash

from .core import db, digest, email, now, payload, string

auth = Blueprint("auth", __name__, url_prefix="/api/auth")
COOKIE = "sri_admin"
DUMMY_HASH = generate_password_hash(secrets.token_urlsafe(32))


def rate_limit(scope, maximum, seconds, identity=None):
    stamp = now()
    identity = identity or request.remote_addr or "unknown"
    window = int(stamp.timestamp()) // seconds
    key = digest(f"{scope}|{identity}|{window}")
    query = {"_id": key}
    update = {
        "$inc": {"n": 1},
        "$setOnInsert": {"expires_at": stamp + timedelta(seconds=seconds * 2)},
    }
    try:
        counter = db().limits.find_one_and_update(
            query, update, upsert=True, return_document=ReturnDocument.AFTER
        )
    except DuplicateKeyError:
        counter = db().limits.find_one_and_update(
            query, {"$inc": {"n": 1}}, return_document=ReturnDocument.AFTER
        )
    if counter["n"] > maximum:
        raise TooManyRequests("Too many attempts. Please try again later.", retry_after=seconds)


def current_user():
    token = request.cookies.get(COOKIE, "")
    if not token or len(token) > 150:
        return None
    session = db().sessions.find_one({"_id": digest(token), "expires_at": {"$gt": now()}})
    if not session:
        return None
    user = db().admin_users.find_one(
        {"_id": session["user"], "active": True, "epoch": session["epoch"]}
    )
    if user:
        g.admin, g.admin_session = user, session
    return user


def admin_required(fn):
    @wraps(fn)
    def checked(*args, **kwargs):
        if not current_user():
            raise Unauthorized("Sign in to continue.")
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            supplied = request.headers.get("X-CSRF-Token", "")
            if not hmac.compare_digest(supplied.encode(), g.admin_session["csrf"].encode()):
                raise Forbidden("The session token is invalid. Reload this page.")
        return fn(*args, **kwargs)

    return checked


def plain_password(obj, key):
    value = obj.get(key)
    if not isinstance(value, str) or not 1 <= len(value) <= 256:
        raise BadRequest("Enter a valid password.")
    return value


def new_password(value):
    if not isinstance(value, str) or not 12 <= len(value) <= 256:
        raise BadRequest("Use a password between 12 and 256 characters.")
    return generate_password_hash(value)


def session_response(user):
    token, csrf = secrets.token_urlsafe(40), secrets.token_urlsafe(32)
    lifetime = current_app.config["SESSION_HOURS"] * 3600
    db().sessions.insert_one(
        {
            "_id": digest(token),
            "user": user["_id"],
            "epoch": user["epoch"],
            "csrf": csrf,
            "expires_at": now() + timedelta(seconds=lifetime),
        }
    )
    response = jsonify(email=user["email"], csrf=csrf)
    response.set_cookie(
        COOKIE,
        token,
        max_age=lifetime,
        httponly=True,
        secure=current_app.config["SECURE_COOKIES"],
        samesite="Strict",
        path="/",
    )
    return response


@auth.post("/login")
def login():
    rate_limit("login-ip", 30, 900)
    data = payload()
    ident = string(data, "email", 254).lower()
    rate_limit("login-account", 10, 900, ident)
    passwd = plain_password(data, "password")
    user = db().admin_users.find_one({"email": ident, "active": True})
    valid = check_password_hash(user["password_hash"] if user else DUMMY_HASH, passwd)
    if not user or not valid:
        raise Unauthorized("Email or password is incorrect.")
    old = request.cookies.get(COOKIE, "")
    if old:
        db().sessions.delete_one({"_id": digest(old)})
    return session_response(user)


@auth.get("/session")
@admin_required
def status():
    return {"email": g.admin["email"], "csrf": g.admin_session["csrf"]}


@auth.post("/logout")
@admin_required
def logout():
    db().sessions.delete_one({"_id": g.admin_session["_id"]})
    response = jsonify(ok=True)
    response.delete_cookie(
        COOKIE,
        path="/",
        secure=current_app.config["SECURE_COOKIES"],
        httponly=True,
        samesite="Strict",
    )
    return response


@auth.put("/account")
@admin_required
def account():
    rate_limit("account", 10, 900, str(g.admin["_id"]))
    data = payload()
    if not check_password_hash(g.admin["password_hash"], plain_password(data, "current_password")):
        raise Forbidden("Current password is incorrect.")
    update = {
        "email": email(string(data, "email", 254, required=True)).lower(),
        "updated_at": now(),
    }
    if data.get("password"):
        update["password_hash"] = new_password(data["password"])
    user = db().admin_users.find_one_and_update(
        {"_id": g.admin["_id"], "epoch": g.admin["epoch"]},
        {"$set": update, "$inc": {"epoch": 1}},
        return_document=ReturnDocument.AFTER,
    )
    if not user:
        raise Unauthorized("Sign in again.")
    db().sessions.delete_many({"user": user["_id"], "epoch": {"$lt": user["epoch"]}})
    return session_response(user)
