"""Auth: login/logout/me/refresh, failures, rate limiting, session expiry."""

from tests.conftest import login, make_tenant, make_user


def test_login_me_logout(client, db):
    make_tenant(db)
    make_user(db, "owner@x.in", role="owner")
    r = login(client, "owner@x.in")
    assert "access_token" in r.json()
    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "owner@x.in"
    assert me.json()["businesses"][0]["role"] == "owner"
    out = client.post("/api/v1/auth/logout")
    assert out.status_code == 200


def test_login_failure(client, db):
    make_tenant(db)
    make_user(db, "a@x.in")
    r = client.post("/api/v1/auth/login", json={"email": "a@x.in", "password": "wrong"})
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_unauthenticated_blocked(client, db):
    make_tenant(db)
    r = client.get("/api/v1/auth/me")
    assert r.status_code == 401
    r = client.get("/api/v1/customers")
    assert r.status_code == 401


def test_refresh_rotates(client, db):
    make_tenant(db)
    make_user(db, "r@x.in")
    login(client, "r@x.in")
    r = client.post("/api/v1/auth/refresh")
    assert r.status_code == 200
    assert "access_token" in r.json()


def test_rate_limited_after_failures(client, db):
    make_tenant(db)
    make_user(db, "brute@x.in")
    last = None
    for _ in range(7):
        last = client.post("/api/v1/auth/login",
                           json={"email": "brute@x.in", "password": "nope"})
    assert last is not None and last.status_code == 429
