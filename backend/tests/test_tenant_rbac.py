"""Tenant isolation + RBAC: Nest users can never touch Prime data."""

import app.models.models as m
from tests.conftest import login, make_tenant, make_user


def _setup(client, db):
    make_tenant(db, "nest-library-001", "Nest Library")
    make_tenant(db, "prime-fitness-001", "Prime Fitness")
    make_user(db, "nest@x.in", role="admin", biz_id="nest-library-001")
    make_user(db, "prime@x.in", role="owner", biz_id="prime-fitness-001")
    # prime customer + payment
    c = m.Customer(business_id="prime-fitness-001", full_name="Prime Member",
                   phone="+91 90000 00001")
    db.add(c)
    db.flush()
    p = m.Payment(business_id="prime-fitness-001", customer_id=c.id, kind="admission",
                  amount=5000, paid=5000, method="card", status="paid",
                  receipt_no="PRIME-1")
    db.add(p)
    db.commit()
    return c.id, p.id


def test_cannot_read_other_business_customer(client, db):
    prime_customer, _ = _setup(client, db)
    login(client, "nest@x.in")
    r = client.get(f"/api/v1/customers/{prime_customer}")
    assert r.status_code == 404  # scoped query: invisible, not just forbidden


def test_cannot_list_other_business_data(client, db):
    _setup(client, db)
    login(client, "nest@x.in")
    r = client.get("/api/v1/customers")
    assert r.status_code == 200
    assert all(i["business_id"] == "nest-library-001" for i in r.json()["items"])
    r = client.get("/api/v1/payments")
    assert all(i["business_id"] == "nest-library-001" for i in r.json()["items"])


def test_manipulated_business_header_cannot_bypass(client, db):
    _setup(client, db)
    login(client, "nest@x.in")
    r = client.get("/api/v1/customers", headers={"X-Business-Id": "prime-fitness-001"})
    assert r.status_code == 403


def test_staff_cannot_do_owner_only(client, db):
    _setup(client, db)
    make_user(db, "staff@x.in", role="staff", biz_id="nest-library-001")
    login(client, "staff@x.in")
    # refund is owner-only
    r = client.post("/api/v1/payments/anything/refund")
    assert r.status_code in (403, 404)
    # staff invite is owner-only
    r = client.post("/api/v1/staff/invite",
                    json={"full_name": "X", "email": "x@y.in", "role": "staff"})
    assert r.status_code == 403
    # settings identity is owner-only
    r = client.patch("/api/v1/settings", json={"name": "Hacked"})
    assert r.status_code == 403


def test_admin_cannot_elevate_self(client, db):
    _setup(client, db)
    login(client, "nest@x.in")  # admin
    # role change requires owner
    r = client.patch("/api/v1/staff/anything/role", json={"role": "owner"})
    assert r.status_code in (403, 404)


def test_expired_session_blocked(client, db):
    _setup(client, db)
    r = client.get("/api/v1/customers", headers={"Authorization": "Bearer invalid.token.here"})
    assert r.status_code == 401
