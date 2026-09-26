"""End-to-end business flows against the real API + DB."""

from datetime import datetime, timedelta, timezone

from tests.conftest import login, make_tenant, make_user


def _owner(client, db):
    make_tenant(db)
    make_user(db, "owner@x.in", role="owner")
    login(client, "owner@x.in")


def test_full_admission_flow(client, db):
    _owner(client, db)
    now = datetime.now(timezone.utc)
    r = client.post("/api/v1/admissions", json={
        "full_name": "Rahul Sharma", "phone": "+91 98100 12345",
        "plan": "monthly", "start_at": now.isoformat(),
        "amount": 1500, "paid": 1500, "method": "upi"})
    assert r.status_code == 201, r.text
    data = r.json()
    cid = data["customer"]["customer_id"]
    assert data["payment"]["balance"] == 0
    assert data["payment"]["status"] == "paid"
    # profile shows full timeline
    prof = client.get(f"/api/v1/customers/{cid}")
    assert prof.status_code == 200
    p = prof.json()
    assert len(p["memberships"]) == 1
    assert len(p["payments"]) == 1
    assert len(p["renewals"]) == 1
    assert any(a["kind"] == "admission" for a in p["activities"])
    # notification created
    n = client.get("/api/v1/notifications")
    assert n.json()["total"] >= 1
    # mark read
    nid = n.json()["items"][0]["notification_id"]
    assert client.patch(f"/api/v1/notifications/{nid}/read").status_code == 200


def test_admission_validation_and_rollback(client, db):
    _owner(client, db)
    now = datetime.now(timezone.utc)
    bad = client.post("/api/v1/admissions", json={
        "full_name": "X", "phone": "123", "plan": "monthly",
        "start_at": now.isoformat(), "amount": 100, "paid": 200, "method": "upi"})
    assert bad.status_code in (400, 409, 422)
    r = client.get("/api/v1/customers")
    assert r.json()["total"] == 0  # nothing partially created


def test_lead_convert_with_duplicate_guard(client, db):
    _owner(client, db)
    now = datetime.now(timezone.utc)
    client.post("/api/v1/admissions", json={
        "full_name": "Dup Person", "phone": "+91 98100 99999", "plan": "monthly",
        "start_at": now.isoformat(), "amount": 2000, "paid": 2000, "method": "cash"})
    lead = client.post("/api/v1/leads", json={
        "full_name": "Dup Person", "phone": "+91 98100 99999", "source": "Walk-in"})
    lid = lead.json()["lead_id"]
    conv = client.post(f"/api/v1/leads/{lid}/convert", json={
        "plan": "monthly", "start_at": now.isoformat(),
        "amount": 2000, "paid": 2000, "method": "upi"})
    assert conv.status_code == 409  # duplicate detected
    assert "customer_id" in conv.json()["error"]["details"]
    # explicit link allowed
    cid = conv.json()["error"]["details"]["customer_id"]
    conv2 = client.post(f"/api/v1/leads/{lid}/convert", json={
        "plan": "monthly", "start_at": now.isoformat(), "amount": 2000, "paid": 2000,
        "method": "upi", "allow_link": True, "link_customer_id": cid})
    assert conv2.status_code == 201, conv2.text


def test_booking_conflict_and_override(client, db):
    make_tenant(db)
    make_user(db, "owner@x.in", role="owner")
    make_user(db, "staff@x.in", role="staff")
    login(client, "staff@x.in")
    day = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    b1 = {"title": "Room A", "customer_name": "C1", "staff": "Priya",
          "starts_at": f"{day}T10:00:00+00:00", "ends_at": f"{day}T12:00:00+00:00"}
    assert client.post("/api/v1/bookings", json=b1).status_code == 201
    overlap = dict(b1, title="Room B", customer_name="C2")
    r = client.post("/api/v1/bookings", json=overlap)
    assert r.status_code == 409  # staff cannot override
    login(client, "owner@x.in")
    r = client.post("/api/v1/bookings", json={**overlap, "allow_overlap": True})
    assert r.status_code == 201  # owner override works


def test_revenue_comes_from_payments(client, db):
    _owner(client, db)
    now = datetime.now(timezone.utc)
    client.post("/api/v1/admissions", json={
        "full_name": "Rev One", "phone": "+91 98100 11111", "plan": "monthly",
        "start_at": now.isoformat(), "amount": 2000, "paid": 2000, "method": "upi"})
    r = client.get("/api/v1/analytics/revenue", params={"preset": "last-30"})
    assert r.status_code == 200
    body = r.json()
    assert body["summary"]["received"] >= 2000
    assert body["summary"]["transactions"] >= 1
    assert len(body["trend"]) > 0
    assert sum(t["revenue"] for t in body["trend"]) == body["summary"]["received"]
    assert any(m["name"] == "upi" for m in body["by_method"])


def test_renewal_and_refund(client, db):
    _owner(client, db)
    now = datetime.now(timezone.utc)
    adm = client.post("/api/v1/admissions", json={
        "full_name": "Ren One", "phone": "+91 98100 22222", "plan": "monthly",
        "start_at": now.isoformat(), "amount": 2000, "paid": 2000, "method": "cash"}).json()
    cid = adm["customer"]["customer_id"]
    r = client.post(f"/api/v1/customers/{cid}/renew", json={
        "plan": "quarterly", "start_at": now.isoformat(),
        "amount": 5500, "paid": 5500, "method": "upi"})
    assert r.status_code == 200
    prof = client.get(f"/api/v1/customers/{cid}").json()
    assert len(prof["memberships"]) == 2
    pid = adm["payment"]["payment_id"]
    assert client.post(f"/api/v1/payments/{pid}/refund").status_code == 200
    rev = client.get("/api/v1/analytics/revenue", params={"preset": "last-30"}).json()
    assert rev["summary"]["refunds"] >= 2000


def test_whatsapp_unconfigured_state(client, db):
    _owner(client, db)
    s = client.get("/api/v1/whatsapp/settings").json()
    assert s["configured"] is False
    r = client.post("/api/v1/whatsapp/send", json={
        "recipient": "+91 98100 12345", "template": "hello", "body": "Hi"})
    assert r.status_code == 503
    assert r.json()["error"]["details"]["code"] == "WHATSAPP_NOT_CONFIGURED"


def test_renewal_automation_idempotent(client, db):
    _owner(client, db)
    first = client.post("/api/v1/jobs/renewal-check").json()
    second = client.post("/api/v1/jobs/renewal-check").json()
    assert second["created"] == 0  # no duplicates on second run
    assert first["created"] + first["skipped"] >= 0


def test_search_and_tasks(client, db):
    _owner(client, db)
    now = datetime.now(timezone.utc)
    client.post("/api/v1/admissions", json={
        "full_name": "Search Me", "phone": "+91 98100 33333", "plan": "monthly",
        "start_at": now.isoformat(), "amount": 2000, "paid": 1000, "method": "upi"})
    r = client.get("/api/v1/search", params={"q": "Search Me"})
    assert r.status_code == 200
    assert len(r.json()["customers"]) == 1
    t = client.post("/api/v1/tasks", json={"title": "Call Search Me"}).json()
    assert client.patch(f"/api/v1/tasks/{t['task_id']}",
                        json={"status": "done"}).status_code == 200
