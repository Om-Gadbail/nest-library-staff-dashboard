"""Public website intake: Nest site -> shared backend -> Nest tenant -> CRM."""

from datetime import datetime

import pytest

import app.models.models as m
from app.core import rate_limit
from tests.conftest import make_tenant


@pytest.fixture(autouse=True)
def _fresh_limiter():
    rate_limit.reset()
    yield
    rate_limit.reset()


def _nest(db):
    make_tenant(db, "nest-library-001", "Nest Library")


def _contact(**over):
    payload = {
        "businessId": "nest",
        "name": "Aarav Mehta",
        "phone": "+91 98211 22334",
        "message": "What are the library timings on Sundays?",
        "attribution": {
            "utmSource": "google",
            "landingPath": "/contact",
            "deviceCategory": "mobile",
        },
    }
    payload.update(over)
    return payload


def test_contact_lead_creates_crm_records(client, db):
    _nest(db)
    r = client.post("/api/leads/contact", json=_contact())
    assert r.status_code == 200, r.text
    ref = r.json()["referenceId"]
    assert ref

    lead = db.query(m.Lead).filter_by(id=ref).one()
    assert lead.business_id == "nest-library-001"
    assert lead.stage == "new"
    assert lead.source == "Website-Contact"
    assert lead.full_name == "Aarav Mehta"

    assert db.query(m.Activity).filter_by(
        business_id="nest-library-001", kind="lead").count() == 1
    notif = db.query(m.Notification).filter_by(
        business_id="nest-library-001", kind="lead").one()
    assert f"/leads/{ref}" in (notif.link or "")


def test_visit_lead_maps_slot_and_follow_up(client, db):
    _nest(db)
    r = client.post("/api/leads/visit", json={
        "businessId": "nest", "name": "Diya Sharma", "phone": "+91 99301 44556",
        "preferredDate": "2026-10-05", "preferredTime": "11:30",
        "purpose": "Competitive Exam", "message": "First visit",
    })
    assert r.status_code == 200, r.text
    lead = db.query(m.Lead).filter_by(id=r.json()["referenceId"]).one()
    assert lead.business_id == "nest-library-001"
    assert lead.source == "Website-Visit"
    assert "2026-10-05 11:30" in (lead.notes or "")
    assert "Competitive Exam" in (lead.notes or "")
    assert lead.follow_up_at is not None
    # SQLite returns datetimes naive; wall-clock must match the IST slot.
    # (PostgreSQL preserves the Asia/Kolkata tzinfo end to end.)
    assert lead.follow_up_at.replace(tzinfo=None) == datetime(2026, 10, 5, 11, 30)


def test_membership_and_seat_inquiry(client, db):
    _nest(db)
    r = client.post("/api/leads/membership", json={
        "businessId": "nest", "name": "Kabir Rao", "phone": "+91 98111 90876",
        "plan": "confirmed-12m", "seatType": "confirmed",
        "duration": "12-months", "message": "",
    })
    assert r.status_code == 200, r.text
    lead = db.query(m.Lead).filter_by(id=r.json()["referenceId"]).one()
    assert lead.interested_plan == "confirmed-12m"
    assert "confirmed" in (lead.notes or "")

    r = client.post("/api/leads/seat-inquiry", json={
        "businessId": "nest", "name": "Ananya Iyer", "phone": "+91 97690 11223",
        "occupation": "student", "examGoal": "UPSC", "duration": "6-months",
        "seatPreference": "regular", "timing": "morning",
        "source": "Google", "message": "",
    })
    assert r.status_code == 200, r.text
    lead = db.query(m.Lead).filter_by(id=r.json()["referenceId"]).one()
    assert lead.source == "Website-Seat"
    assert "UPSC" in (lead.notes or "")


def test_client_business_id_is_ignored(client, db):
    """A forged businessId must never route a website lead elsewhere."""
    _nest(db)
    make_tenant(db, "prime-fitness-001", "Prime Fitness")
    r = client.post("/api/leads/contact", json=_contact(businessId="prime"))
    assert r.status_code == 200, r.text
    lead = db.query(m.Lead).filter_by(id=r.json()["referenceId"]).one()
    assert lead.business_id == "nest-library-001"
    assert db.query(m.Lead).filter_by(business_id="prime-fitness-001").count() == 0


def test_honeypot_returns_opaque_reference_without_persisting(client, db):
    _nest(db)
    r = client.post("/api/leads/contact", json=_contact(company="cheap-seo"))
    assert r.status_code == 200, r.text
    assert r.json()["referenceId"]
    assert db.query(m.Lead).count() == 0
    assert db.query(m.Notification).count() == 0


def test_validation_rejects_bad_input(client, db):
    _nest(db)
    assert client.post("/api/leads/contact",
                       json=_contact(name="X")).status_code == 422
    assert client.post("/api/leads/contact",
                       json=_contact(phone="123")).status_code == 422
    assert client.post("/api/leads/contact",
                       json=_contact(message="hi")).status_code == 422
    assert client.post("/api/leads/seat-inquiry", json={
        "businessId": "nest", "name": "Valid Name", "phone": "+91 90000 00001",
        "occupation": "astronaut", "duration": "1-month",
        "seatPreference": "regular", "timing": "morning"}).status_code == 422
    assert client.post("/api/leads/visit", json={
        "businessId": "nest", "name": "Valid Name", "phone": "+91 90000 00001",
        "preferredDate": "not-a-date", "preferredTime": "xx"}).status_code == 422
    assert db.query(m.Lead).count() == 0


def test_oversized_body_rejected(client, db):
    _nest(db)
    payload = _contact(padding="x" * 17000)
    r = client.post("/api/leads/contact", json=payload)
    assert r.status_code == 413, r.text
    assert db.query(m.Lead).count() == 0


def test_idempotency_key_prevents_duplicates(client, db):
    _nest(db)
    headers = {"Idempotency-Key": "website-contact-001"}
    first = client.post("/api/leads/contact", json=_contact(), headers=headers)
    assert first.status_code == 200, first.text
    second = client.post("/api/leads/contact", json=_contact(), headers=headers)
    assert second.status_code == 200, second.text
    assert second.json()["referenceId"] == first.json()["referenceId"]
    assert db.query(m.Lead).count() == 1

    other = client.post("/api/leads/contact", json=_contact(),
                        headers={"Idempotency-Key": "website-contact-002"})
    assert other.status_code == 200, other.text
    assert other.json()["referenceId"] != first.json()["referenceId"]
    assert db.query(m.Lead).count() == 2


def test_rate_limit_blocks_abuse(client, db):
    _nest(db)
    last = None
    for _ in range(11):
        last = client.post("/api/leads/contact", json=_contact())
    assert last is not None and last.status_code == 429, last.text


def test_public_config_nest(client, db):
    _nest(db)
    r = client.get("/api/v1/public/nest/config")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["slug"] == "nest"
    assert body["businessId"] == "nest-library-001"
    assert body["leadIntake"]["contact"] == "/api/leads/contact"
    assert body["leadIntake"]["visit"] == "/api/leads/visit"
    lowered = r.text.lower()
    assert "secret" not in lowered and "token" not in lowered


def test_public_config_unknown_slug_404(client, db):
    _nest(db)
    assert client.get("/api/v1/public/unknown/config").status_code == 404


def test_public_config_prime_tenant_still_resolves(client, db):
    _nest(db)
    make_tenant(db, "prime-fitness-001", "Prime Fitness")
    r = client.get("/api/v1/public/prime/config")
    assert r.status_code == 200, r.text
    assert r.json()["businessId"] == "prime-fitness-001"
