"""Use a fresh, disposable database per test. Set SRI_TEST_MONGO for real MongoDB."""

import os
import uuid
import secrets
import sys
from pathlib import Path

import mongomock
import pytest
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import create_app
from app.auth import new_password
from app.seed import initialise


@pytest.fixture
def env(tmp_path):
    uri = os.getenv("SRI_TEST_MONGO")
    client = (
        MongoClient(uri, tz_aware=True, serverSelectionTimeoutMS=4000)
        if uri
        else mongomock.MongoClient(tz_aware=True)
    )
    name = "sri_test_" + uuid.uuid4().hex
    database = client[name]
    app = create_app(
        {
            "TESTING": True,
            "MEDIA_DIR": str(tmp_path / "uploads"),
            "PUBLIC_ORIGIN": "http://localhost:5000",
            "SECURE_COOKIES": False,
            "SMTP_HOST": "",
            "ALLOWED_ORIGINS": {"http://localhost:5000"},
        },
        database=database,
    )
    password = secrets.token_urlsafe(24)
    with app.app_context():
        initialise()
        database.admin_users.insert_one(
            {
                "email": "editor@example.org",
                "epoch": 1,
                "active": True,
                "password_hash": new_password(password),
                "role": "admin",
            }
        )
    yield app, database, password
    client.drop_database(name)
    client.close()


@pytest.fixture
def staff(env):
    app, _, password = env
    c = app.test_client()
    res = c.post("/api/auth/login", json={"email": "editor@example.org", "password": password})
    assert res.status_code == 200
    return c, {"X-CSRF-Token": res.json["csrf"]}
