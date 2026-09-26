"""Deterministic dev seed: Nest Library + Prime Fitness tenants, staff, business data.

Usage:
  py scripts/seed.py [--reset]
Never run against production.
"""

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.core.db import Base, SessionLocal, engine  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.models import models as m  # noqa: E402

PASSWORD = "Nest@123"

PLANS = [
    ("monthly", 1, 2000.0),
    ("quarterly", 3, 5500.0),
    ("half-yearly", 6, 10000.0),
    ("yearly", 12, 18000.0),
    ("day-pass", 0, 200.0),
]


def _months(plan: str) -> int:
    return dict((n, mo) for n, mo, _ in PLANS)[plan]


def _price(plan: str) -> float:
    return dict((n, p) for n, _, p in PLANS)[plan]


def add_months(dt: datetime, months: int) -> datetime:
    if months == 0:
        return dt + timedelta(days=1)
    month = dt.month - 1 + months
    return dt.replace(year=dt.year + month // 12, month=month % 12 + 1)


def seed_business(db, *, biz_id: str, name: str, btype: str, seed_customers: bool):
    biz = db.get(m.Business, biz_id)
    if not biz:
        biz = m.Business(id=biz_id, name=name, type=btype, phone="+91 98000 44444",
                         email=f"hello@{biz_id}.in", address="2nd Floor, MG Road, Pune 411001",
                         timezone="Asia/Kolkata", currency="INR")
        db.add(biz)
    if not db.get(m.BusinessSettings, biz_id):
        db.add(m.BusinessSettings(business_id=biz_id, name=name,
                                  phone="+91 98000 44444", email=f"hello@{biz_id}.in",
                                  address="2nd Floor, MG Road, Pune 411001",
                                  opening_hours="Mon–Sun · 7:00 AM – 10:00 PM"))
    if not db.get(m.WhatsAppSettings, biz_id):
        db.add(m.WhatsAppSettings(business_id=biz_id, provider="log", enabled=False))
    for pname, months, price in PLANS:
        exists = db.query(m.MembershipPlan).filter_by(business_id=biz_id, name=pname).first()
        if not exists:
            db.add(m.MembershipPlan(business_id=biz_id, name=pname, months=months, price=price))
    if not seed_customers:
        db.commit()
        return biz
    now = datetime.now(timezone.utc)
    people = [
        ("Aarav Mehta", "+91 98211 22334", "yearly", -380, 1.0, "upi"),
        ("Diya Sharma", "+91 99301 44556", "quarterly", -90, 1.0, "card"),
        ("Kabir Rao", "+91 98111 90876", "half-yearly", -180, 1.0, "upi"),
        ("Ananya Iyer", "+91 97690 11223", "monthly", -120, 0.6, "cash"),
        ("Rohan Verma", "+91 98901 33445", "monthly", -40, 1.0, "upi"),
        ("Sneha Kulkarni", "+91 97020 55667", "quarterly", -70, 1.0, "card"),
        ("Rahul Sharma", "+91 98110 55667", "monthly", -30, 1.0, "upi"),
        ("Pooja Nair", "+91 98200 77889", "monthly", -25, 0.5, "upi"),
    ]
    for i, (name_, phone, plan, joined_delta, ratio, method) in enumerate(people):
        joined = now + timedelta(days=joined_delta)
        expires = add_months(joined, _months(plan))
        amount = _price(plan)
        paid = round(amount * ratio)
        status = "paid" if paid >= amount else ("partial" if paid > 0 else "pending")
        c = m.Customer(business_id=biz_id, full_name=name_, phone=phone, joined_at=joined)
        db.add(c)
        db.flush()
        db.add(m.Membership(business_id=biz_id, customer_id=c.id, plan=plan, status="active",
                            start_at=joined, expires_at=expires, amount=amount, paid=paid))
        db.add(m.Payment(business_id=biz_id, customer_id=c.id, plan=plan, kind="admission",
                         amount=amount, paid=paid, method=method, status=status,
                         received_at=joined, receipt_no=f"SEED-{biz_id[:4]}-{i:04d}"))
        db.add(m.Renewal(business_id=biz_id, customer_id=c.id, plan=plan, due_at=expires,
                         amount=amount, status="upcoming"))
        db.add(m.Activity(business_id=biz_id, actor="Seed", action="created admission",
                          detail=f"{name_} — {plan}", kind="admission", customer_id=c.id,
                          created_at=joined))
    # a recent receipt inside the current month so revenue analytics are non-empty
    c = db.query(m.Customer).filter_by(business_id=biz_id).first()
    if c:
        db.add(m.Payment(business_id=biz_id, customer_id=c.id, plan="monthly", kind="other",
                         amount=1500, paid=1500, method="upi", status="paid",
                         received_at=now - timedelta(hours=2), receipt_no="SEED-RECENT-1"))
    leads = [
        ("Ishaan Patel", "+91 98111 00021", "new", "Walk-in"),
        ("Myra Nair", "+91 98200 00022", "follow-up", "Instagram"),
        ("Arjun Singh", "+91 98300 00023", "interested", "Referral"),
    ]
    for name_, phone, stage, source in leads:
        db.add(m.Lead(business_id=biz_id, full_name=name_, phone=phone, stage=stage,
                      source=source, interested_plan="monthly", assigned_to="Priya Sharma"))
    db.add(m.Notification(business_id=biz_id, title="Welcome to the Nest Staff API",
                          body="Seed data loaded. Connect WhatsApp in Settings to enable reminders.",
                          kind="system"))
    db.commit()
    return biz


def seed_users(db):
    users = [
        ("owner@nestlibrary.in", "Nest Owner", "owner", "nest-library-001"),
        ("rahul@nestlibrary.in", "Rahul Verma", "admin", "nest-library-001"),
        ("priya@nestlibrary.in", "Priya Sharma", "staff", "nest-library-001"),
        ("prime.owner@primefitness.in", "Prime Owner", "owner", "prime-fitness-001"),
    ]
    for email, name, role, biz_id in users:
        u = db.query(m.User).filter_by(email=email).first()
        if not u:
            u = m.User(full_name=name, email=email, password_hash=hash_password(PASSWORD))
            db.add(u)
            db.flush()
        link = db.query(m.Membership2Business).filter_by(
            user_id=u.id, business_id=biz_id).first()
        if not link:
            db.add(m.Membership2Business(user_id=u.id, business_id=biz_id, role=role))
    # a prime-only customer to prove tenant isolation in tests/demos
    if not db.query(m.Customer).filter_by(business_id="prime-fitness-001").first():
        c = m.Customer(business_id="prime-fitness-001", full_name="Prime Member One",
                       phone="+91 90000 00001")
        db.add(c)
        db.flush()
        now = datetime.now(timezone.utc)
        db.add(m.Payment(business_id="prime-fitness-001", customer_id=c.id, kind="admission",
                         amount=5000, paid=5000, method="card", status="paid",
                         received_at=now, receipt_no="PRIME-1"))
    db.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="drop and recreate all tables")
    args = ap.parse_args()
    if args.reset:
        Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_business(db, biz_id="nest-library-001", name="Nest Library",
                      btype="library", seed_customers=True)
        seed_business(db, biz_id="prime-fitness-001", name="Prime Fitness",
                      btype="gym", seed_customers=False)
        seed_users(db)
    finally:
        db.close()
    print(f"Seed complete. Demo password: {PASSWORD} (dev only)")


if __name__ == "__main__":
    main()
