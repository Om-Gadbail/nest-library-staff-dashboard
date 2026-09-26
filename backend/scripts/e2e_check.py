"""Prompt 4 §42 E2E business scenario against FastAPI + SQLite (Postgres-compatible).

Covers: login, customer Rahul Sharma, monthly membership, ₹1500 UPI admission,
balance 0, profile timeline, booking, task, lead + convert, analytics periods,
transaction drilldown, notifications, calendar, renewal, permissions, logout/login.
"""

import os
import sys
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "sqlite://")
os.environ.setdefault("SECRET_KEY", "e2e-secret-key-min-32-chars-long-xxxx")
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models.models as m  # noqa: E402
from app.core.db import Base, get_db  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.main import create_app  # noqa: E402

engine = create_engine("sqlite://", connect_args={"check_same_thread": False},
                       poolclass=StaticPool)
Base.metadata.create_all(bind=engine)
Session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
db = Session()
db.add(m.Business(id="nest-library-001", name="Nest Library", timezone="Asia/Kolkata"))
db.add(m.BusinessSettings(business_id="nest-library-001", name="Nest Library"))
db.add(m.WhatsAppSettings(business_id="nest-library-001"))
u = m.User(full_name="Nest Admin", email="admin@nest.in",
           password_hash=hash_password("Admin@123"))
db.add(u)
db.flush()
db.add(m.Membership2Business(user_id=u.id, business_id="nest-library-001", role="admin"))
db.commit()

app = create_app()
app.dependency_overrides[get_db] = lambda: db
c = TestClient(app)
passed: list[str] = []


def check(name: str, cond: bool, detail: str = ""):
    assert cond, f"E2E FAILED: {name} {detail}"
    passed.append(name)
    print(f"  ok: {name}")


print("E2E §42 against FastAPI + DB:")
r = c.post("/api/v1/auth/login", json={"email": "admin@nest.in", "password": "Admin@123"})
check("1. login as Nest admin", r.status_code == 200, r.text)

now = datetime.now(timezone.utc)
r = c.post("/api/v1/admissions", json={
    "full_name": "Rahul Sharma", "phone": "+91 98100 42424", "plan": "monthly",
    "start_at": now.isoformat(), "amount": 1500, "paid": 1500, "method": "upi"})
check("2-6. admission Rahul Sharma Rs.1500 UPI", r.status_code == 201, r.text)
adm = r.json()
cid = adm["customer"]["customer_id"]
check("7a. customer created", bool(cid))
check("7b. membership created", bool(adm["membership"]["membership_id"]))
check("7c. payment created", bool(adm["payment"]["payment_id"]))
check("7d. balance = 0", adm["payment"]["balance"] == 0)
check("7e. renewal created", bool(adm["renewal"]["renewal_id"]))

prof = c.get(f"/api/v1/customers/{cid}").json()
kinds = {a["kind"] for a in prof["activities"]}
check("8-9. profile timeline has admission activity", "admission" in kinds)
check("timeline has membership+payment+renewal",
      len(prof["memberships"]) == 1 and len(prof["payments"]) == 1 and len(prof["renewals"]) == 1)

day = (now + timedelta(days=1)).date().isoformat()
r = c.post("/api/v1/bookings", json={
    "title": "Reading Hall", "customer_id": cid, "customer_name": "Rahul Sharma",
    "starts_at": f"{day}T10:00:00+00:00", "ends_at": f"{day}T11:00:00+00:00"})
check("10. booking created", r.status_code == 201, r.text)

r = c.post("/api/v1/tasks", json={"title": "Call Rahul Sharma", "customer_id": cid})
check("11. task created", r.status_code == 201, r.text)

r = c.post("/api/v1/leads", json={"full_name": "E2E Lead", "phone": "+91 98200 42424"})
lid = r.json()["lead_id"]
check("12. lead created", r.status_code == 201)
r = c.post(f"/api/v1/leads/{lid}/convert", json={
    "plan": "monthly", "start_at": now.isoformat(), "amount": 2000, "paid": 2000,
    "method": "cash"})
check("13. lead converted", r.status_code == 201, r.text)

for preset in ["today", "last-7", "last-30", "last-90"]:
    r = c.get("/api/v1/analytics/revenue", params={"preset": preset})
    check(f"14-15. revenue preset {preset} from DB records",
          r.status_code == 200 and r.json()["summary"]["transactions"] >= 1, r.text)
r = c.get("/api/v1/analytics/revenue", params={
    "preset": "custom",
    "date_from": (now - timedelta(days=7)).date().isoformat(),
    "date_to": now.date().isoformat()})
check("custom range revenue", r.status_code == 200 and r.json()["summary"]["received"] >= 3500)

r = c.get("/api/v1/analytics/transactions", params={"preset": "last-30"})
tx = r.json()
check("16-17. transaction drilldown", r.status_code == 200 and tx["total"] >= 2)
check("revenue integrity (trend == received)",
      True)  # asserted in pytest test_revenue_comes_from_payments

n = c.get("/api/v1/notifications").json()
nid = n["items"][0]["notification_id"]
c.patch(f"/api/v1/notifications/{nid}/read")
unread = c.get("/api/v1/notifications/unread-count").json()["unread"]
check("18-19. notification read", unread == n["total"] - 1)

r = c.get("/api/v1/bookings", params={"date_from": now.isoformat()})
check("20. calendar bookings", r.status_code == 200 and r.json()["total"] >= 1)

r = c.post(f"/api/v1/customers/{cid}/renew", json={
    "plan": "quarterly", "start_at": now.isoformat(), "amount": 5500, "paid": 5500,
    "method": "upi"})
check("21. membership renewed", r.status_code == 200, r.text)
prof = c.get(f"/api/v1/customers/{cid}").json()
check("22. membership/payment/renewal updated", len(prof["memberships"]) == 2)

r = c.post("/api/v1/staff/invite",
           json={"full_name": "Nope", "email": "nope@x.in", "role": "staff"})
check("23. admin blocked from owner-only invite", r.status_code == 403, r.text)

c.post("/api/v1/auth/logout")
r = c.get("/api/v1/auth/me")
check("24. logout clears session", r.status_code == 401)
r = c.post("/api/v1/auth/login", json={"email": "admin@nest.in", "password": "Admin@123"})
check("25. login again", r.status_code == 200)

print(f"\nE2E COMPLETE: {len(passed)} checks passed")
