"""Validate Cloudflare Turnstile tokens (never trust browser-only verification)."""
import json
from urllib.error import URLError, HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from flask import current_app
from werkzeug.exceptions import BadRequest, ServiceUnavailable

VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def verify_turnstile(token):
    secret = current_app.config.get("TURNSTILE_SECRET_KEY", "").strip()
    if not secret:
        # Preserve existing workflows until the website owner configures Turnstile.
        # Production must set the secret key to enforce bot verification.
        if current_app.config.get("SECURE_COOKIES"):
            raise ServiceUnavailable("Human verification is not configured.")
        return
    if not isinstance(token, str) or not token or len(token) > 2048:
        raise BadRequest("Complete the human verification and try again.")
    data = urlencode({"secret": secret, "response": token}).encode("utf-8")
    req = Request(VERIFY_URL, data=data, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with urlopen(req, timeout=7) as response:
            result = json.loads(response.read(8192))
    except (URLError, HTTPError, OSError, ValueError) as exc:
        current_app.logger.warning("Turnstile verification service unavailable: %s", type(exc).__name__)
        raise ServiceUnavailable("Verification temporarily unavailable. Please try again.") from exc
    if not isinstance(result, dict) or result.get("success") is not True:
        raise BadRequest("Human verification failed or expired. Please try again.")
