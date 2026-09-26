"""Renewal automation: scheduled checks with idempotent sends."""

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import models as m
from app.services import helpers as h
from app.services import whatsapp as wa


def _parse_days(raw: str) -> list[int]:
    try:
        return sorted({int(x.strip()) for x in raw.split(",") if x.strip() != ""})
    except ValueError:
        return [7, 3, 1, 0]


def run_renewal_check(db: Session, business_id: str) -> dict:
    """Create reminder jobs for memberships expiring on configured days.

    Idempotent via automation_runs (business, job, dedupe_key) + message dedupe keys.
    """
    cfg = db.get(m.WhatsAppSettings, business_id)
    days = _parse_days(cfg.reminder_days if cfg else "7,3,1,0")
    now = datetime.now(timezone.utc)
    created = 0
    skipped = 0
    memberships = (
        db.query(m.Membership)
        .filter_by(business_id=business_id, status="active")
        .all()
    )
    for mem in memberships:
        delta_days = (mem.expires_at.date() - now.date()).days
        if delta_days not in days:
            continue
        dedupe = f"renewal-{mem.id}-{delta_days}d-{mem.expires_at.date().isoformat()}"
        already = (
            db.query(m.AutomationRun)
            .filter_by(business_id=business_id, job="renewal_reminder", dedupe_key=dedupe)
            .first()
        )
        if already:
            skipped += 1
            continue
        customer = db.get(m.Customer, mem.customer_id)
        if not customer:
            continue
        body = (
            f"Hi {customer.full_name}, your {mem.plan} membership at Nest Library "
            f"expires on {mem.expires_at.date().isoformat()} "
            f"({delta_days} day(s) left). Reply to renew."
        )
        try:
            with db.begin_nested():
                db.add(m.AutomationRun(
                    business_id=business_id, job="renewal_reminder", dedupe_key=dedupe))
                wa.queue_and_send(
                    db, business_id, recipient=customer.phone,
                    template="renewal_reminder", body=body, kind="renewal_reminder",
                    customer_id=customer.id, dedupe_key=dedupe)
                h.notify(db, business_id, title=f"Renewal reminder sent: {customer.full_name}",
                         body=f"Expires in {delta_days} day(s).", kind="renewal",
                         link=f"/customers/{customer.id}", customer_id=customer.id)
            db.commit()
            created += 1
        except Exception:
            db.rollback()
            # If WhatsApp is unconfigured we still record nothing as sent;
            # count as skipped so the operator sees configuration state.
            skipped += 1
    h.audit(db, action="automation.renewal_check", business_id=business_id,
            resource="job", resource_id="renewal_reminder",
            meta={"created": created, "skipped": skipped})
    db.commit()
    return {"created": created, "skipped": skipped}
