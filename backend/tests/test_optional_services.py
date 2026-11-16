import asyncio
import csv
import re
from contextlib import contextmanager
from email import policy
from email.parser import BytesParser
from urllib.parse import urlsplit, parse_qs
from threading import Thread

from aiosmtpd.smtp import SMTP

from test_site import form_body


@contextmanager
def local_mailbox():
    messages = []

    class Receiver:
        async def handle_DATA(self, server, session, envelope):
            messages.append(
                BytesParser(policy=policy.default).parsebytes(envelope.original_content)
            )
            return "250 OK"

    loop = asyncio.new_event_loop()
    server = loop.run_until_complete(
        loop.create_server(lambda: SMTP(Receiver(), loop=loop), "127.0.0.1", 0)
    )
    port = server.sockets[0].getsockname()[1]
    thread = Thread(target=loop.run_forever, daemon=True)
    thread.start()
    try:
        yield port, messages
    finally:
        loop.call_soon_threadsafe(loop.stop)
        thread.join(timeout=5)
        server.close()
        loop.run_until_complete(server.wait_closed())
        pending = asyncio.all_tasks(loop)
        for task in pending:
            task.cancel()
        if pending:
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()


def test_smtp_routes_and_confirmation_register(env, staff):
    app, database, _ = env
    c, headers = staff
    with local_mailbox() as (port, messages):
        app.config.update(
            SMTP_HOST="127.0.0.1",
            SMTP_PORT=port,
            SMTP_MODE="plain",
            SMTP_FROM="sri@example.org",
            SMTP_USER="",
            INBOX_GENERAL="general@example.org",
            INBOX_CONSULTING="advisory@example.org",
            NEWSLETTER_KEY="isolated-test-configuration-only-123456",
        )
        result = c.post("/api/public/enquiries", json=form_body("consulting"))
        assert result.status_code == 201
        assert [str(x["To"]) for x in messages] == ["advisory@example.org", "reader@example.org"]
        assert result.json["reference"] in messages[1].get_body().get_content()
        assert database.enquiries.find_one()["email_status"] == "sent"
        sub = c.post(
            "/api/public/newsletter", json={"email": "reader@example.org", "consent": True}
        )
        assert sub.status_code == 202
        msg = messages[-1].get_body().get_content()
        url = re.search(r"https?://\S+", msg).group()
        confirm = parse_qs(urlsplit(url).fragment)["confirm"][0]
        export = "/api/admin/newsletter/export.csv"
        assert "reader@example.org" not in c.get(export).text
        assert (
            c.post(
                "/api/public/newsletter/manage", json={"action": "confirm", "token": confirm}
            ).status_code
            == 200
        )
        rows = list(csv.reader(c.get(export).text.lstrip("\ufeff").splitlines()))
        assert rows[1][0] == "reader@example.org"
        token = parse_qs(urlsplit(rows[1][2]).fragment)["unsubscribe"][0]
        assert (
            c.post(
                "/api/public/newsletter/manage", json={"action": "unsubscribe", "token": token}
            ).status_code
            == 200
        )
        assert "reader@example.org" not in c.get(export).text
    # The capture server is closed. Persistence must still succeed on delivery failure.
    res = c.post("/api/public/enquiries", json=form_body("general"))
    assert res.status_code == 201
    assert (
        database.enquiries.find_one({"reference": res.json["reference"]})["email_status"]
        == "delivery incomplete"
    )


def test_unconfigured_newsletter_and_legal_settings(env, staff):
    app, _, _ = env
    c, h = staff
    assert c.post("/api/public/newsletter", json={}).status_code == 503
    assert c.get("/api/public/settings").json["newsletter"] is False
    doc = c.get("/api/admin/settings").json
    new = c.put(
        "/api/admin/settings",
        headers=h,
        json={"version": doc["version"], "privacy": "Approved privacy wording."},
    )
    assert new.status_code == 200
    assert c.get("/api/public/settings").json["privacy"] == "Approved privacy wording."
