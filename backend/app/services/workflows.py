"""Transactional business workflows: admission, renewal, payments, lead conversion."""

from datetime import datetime, timezone

from dateutil.relativedelta import relativedelta
from sqlalchemy.orm import Session

from app.core import errors
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h

PLAN_MONTHS = {"monthly": 1, "quarterly": 3, "half-yearly": 6, "yearly": 12, "day-pass": 0}
VALID_PLANS = set(PLAN_MONTHS)
VALID_METHODS = {"upi", "cash", "card", "netbanking", "bank-transfer", "other"}


def _ensure_aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _expiry(start: datetime, plan: str) -> datetime:
    months = PLAN_MONTHS[plan]
    if months == 0:
        return _ensure_aware(start) + relativedelta(days=1)
    return _ensure_aware(start) + relativedelta(months=months)


def _payment_status(amount: float, paid: float) -> str:
    if paid <= 0:
        return "pending"
    return "paid" if paid >= amount else "partial"


def _validate_money(plan: str, amount: float, paid: float, method: str) -> None:
    if plan not in VALID_PLANS:
        raise errors.unprocessable(f"Unknown plan: {plan}")
    if method not in VALID_METHODS:
        raise errors.unprocessable(f"Unknown payment method: {method}")
    if amount < 0 or paid < 0:
        raise errors.unprocessable("Amounts must be non-negative")
    if paid > amount:
        raise errors.unprocessable("Paid amount cannot exceed total amount")


def _receipt(db: Session, business_id: str) -> str:
    n = db.query(m.Payment).filter_by(business_id=business_id).count() + 1
    return f"NL-{datetime.now(timezone.utc).year}-{n:05d}"


def _customer_status(db: Session, business_id: str, customer_id: str, now) -> tuple[str, str | None, datetime | None]:
    ms = (
        db.query(m.Membership)
        .filter_by(business_id=business_id, customer_id=customer_id)
        .order_by(m.Membership.expires_at.desc())
        .first()
    )
    if not ms:
        return "active", None, None
    # SQLite returns naive datetimes; normalize before comparing.
    days = (_ensure_aware(ms.expires_at) - _ensure_aware(now)).days
    status = "expired" if days < 0 else ("expiring" if days <= 7 else "active")
    return status, ms.plan, ms.expires_at


def customer_out(db: Session, c: m.Customer) -> s.CustomerOut:
    now = datetime.now(timezone.utc)
    status, plan, expires = _customer_status(db, c.business_id, c.id, now)
    return s.CustomerOut(
        customer_id=c.id, business_id=c.business_id, full_name=c.full_name,
        phone=c.phone, email=c.email, notes=c.notes, joined_at=c.joined_at,
        status=status, plan=plan, expires_at=expires,
    )


def create_admission(
    db: Session, business_id: str, actor: str, user_id: str, data: s.AdmissionIn,
) -> s.AdmissionOut:
    _validate_money(data.plan, data.amount, data.paid, data.method)
    try:
        with db.begin_nested():
            customer = m.Customer(
                business_id=business_id, full_name=data.full_name.strip(),
                phone=data.phone.strip(), email=str(data.email) if data.email else None,
                notes=data.notes, joined_at=_ensure_aware(data.start_at),
            )
            db.add(customer)
            db.flush()
            expires = _expiry(data.start_at, data.plan)
            membership = m.Membership(
                business_id=business_id, customer_id=customer.id, plan=data.plan,
                status="active", start_at=_ensure_aware(data.start_at), expires_at=expires,
                amount=data.amount, paid=data.paid,
            )
            db.add(membership)
            db.flush()
            status = _payment_status(data.amount, data.paid)
            payment = m.Payment(
                business_id=business_id, customer_id=customer.id, membership_id=membership.id,
                plan=data.plan, kind="admission", amount=data.amount, paid=data.paid,
                method=data.method, status=status,
                received_at=datetime.now(timezone.utc), receipt_no="",
            )
            db.add(payment)
            db.flush()
            payment.receipt_no = _receipt(db, business_id)
            renewal = m.Renewal(
                business_id=business_id, customer_id=customer.id, membership_id=membership.id,
                plan=data.plan, due_at=expires, amount=data.amount, status="upcoming",
            )
            db.add(renewal)
            db.flush()
            h.log_activity(db, business_id, actor=actor, action="created admission",
                           detail=f"{customer.full_name} — {data.plan}", kind="admission",
                           customer_id=customer.id)
            h.notify(db, business_id, title=f"New admission: {customer.full_name}",
                     body=f"{data.plan} · ₹{data.paid:,.0f} received via {data.method}.",
                     kind="admission", link=f"/customers/{customer.id}", customer_id=customer.id)
            h.audit(db, action="admission.create", user_id=user_id, business_id=business_id,
                    resource="customer", resource_id=customer.id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    h.publish(business_id, {"type": "admission", "customer_id": customer.id})
    balance = data.amount - data.paid
    return s.AdmissionOut(
        customer=customer_out(db, customer),
        membership=s.MembershipOut(
            membership_id=membership.id, business_id=business_id, customer_id=customer.id,
            customer_name=customer.full_name, plan=membership.plan, status="active",
            start_at=membership.start_at, expires_at=membership.expires_at,
            amount=membership.amount, paid=membership.paid, balance=balance,
            payment_state=status if status != "pending" else "pending"),
        payment=s.PaymentOut(
            payment_id=payment.id, business_id=business_id, customer_id=customer.id,
            customer_name=customer.full_name, membership_id=membership.id, plan=data.plan,
            kind="admission", amount=data.amount, paid=data.paid, balance=balance,
            method=data.method, status=status, received_at=payment.received_at,
            receipt_no=payment.receipt_no),
        renewal=s.RenewalOut(
            renewal_id=renewal.id, business_id=business_id, customer_id=customer.id,
            customer_name=customer.full_name, plan=data.plan, due_at=renewal.due_at,
            amount=data.amount, status="upcoming", contact_status="pending"),
    )


def renew_membership(
    db: Session, business_id: str, actor: str, user_id: str, customer_id: str, data: s.RenewIn,
):
    customer = db.query(m.Customer).filter_by(id=customer_id, business_id=business_id).first()
    if not customer:
        raise errors.not_found("Customer not found")
    _validate_money(data.plan, data.amount, data.paid, data.method)
    try:
        with db.begin_nested():
            expires = _expiry(data.start_at, data.plan)
            membership = m.Membership(
                business_id=business_id, customer_id=customer.id, plan=data.plan,
                status="active", start_at=_ensure_aware(data.start_at), expires_at=expires,
                amount=data.amount, paid=data.paid,
            )
            db.add(membership)
            db.flush()
            status = _payment_status(data.amount, data.paid)
            payment = m.Payment(
                business_id=business_id, customer_id=customer.id, membership_id=membership.id,
                plan=data.plan, kind="renewal", amount=data.amount, paid=data.paid,
                method=data.method, status=status,
                received_at=datetime.now(timezone.utc), receipt_no="",
            )
            db.add(payment)
            db.flush()
            payment.receipt_no = _receipt(db, business_id)
            renewal = (
                db.query(m.Renewal)
                .filter_by(business_id=business_id, customer_id=customer.id)
                .order_by(m.Renewal.due_at.desc()).first()
            )
            if renewal:
                renewal.membership_id = membership.id
                renewal.plan = data.plan
                renewal.due_at = expires
                renewal.amount = data.amount
                renewal.status = "upcoming"
                renewal.contact_status = "renewed"
            h.log_activity(db, business_id, actor=actor, action="renewed membership",
                           detail=f"{customer.full_name} — {data.plan}", kind="renewal",
                           customer_id=customer.id)
            h.notify(db, business_id, title=f"Renewal: {customer.full_name}",
                     body=f"{data.plan} renewed · ₹{data.paid:,.0f} via {data.method}.",
                     kind="renewal", link=f"/customers/{customer.id}", customer_id=customer.id)
            h.audit(db, action="membership.renew", user_id=user_id, business_id=business_id,
                    resource="membership", resource_id=membership.id)
        db.commit()
    except Exception:
        db.rollback()
        raise
    h.publish(business_id, {"type": "renewal", "customer_id": customer.id})
    return membership, payment


def record_payment(
    db: Session, business_id: str, actor: str, user_id: str, data: s.PaymentIn,
) -> m.Payment:
    customer = db.query(m.Customer).filter_by(id=data.customer_id, business_id=business_id).first()
    if not customer:
        raise errors.not_found("Customer not found")
    if data.method not in VALID_METHODS:
        raise errors.unprocessable(f"Unknown payment method: {data.method}")
    if data.amount < 0 or data.paid < 0:
        raise errors.unprocessable("Amounts must be non-negative")
    if data.paid > data.amount:
        raise errors.unprocessable("Paid amount cannot exceed total amount")
    membership = None
    if data.membership_id:
        membership = db.query(m.Membership).filter_by(
            id=data.membership_id, business_id=business_id).first()
        if not membership:
            raise errors.not_found("Membership not found")
    try:
        with db.begin_nested():
            payment = m.Payment(
                business_id=business_id, customer_id=customer.id,
                membership_id=membership.id if membership else None,
                plan=membership.plan if membership else None, kind=data.kind,
                amount=data.amount, paid=data.paid, method=data.method,
                status=_payment_status(data.amount, data.paid),
                received_at=datetime.now(timezone.utc), receipt_no="",
            )
            db.add(payment)
            db.flush()
            payment.receipt_no = _receipt(db, business_id)
            if membership:
                membership.paid = (membership.paid or 0) + data.paid
            h.log_activity(db, business_id, actor=actor, action="recorded payment",
                           detail=f"₹{data.paid:,.0f} from {customer.full_name}", kind="payment",
                           customer_id=customer.id)
            h.notify(db, business_id, title=f"Payment received — ₹{data.paid:,.0f}",
                     body=f"{customer.full_name} · {data.method}.", kind="payment",
                     link=f"/customers/{customer.id}", customer_id=customer.id)
            h.audit(db, action="payment.create", user_id=user_id, business_id=business_id,
                    resource="payment", resource_id=payment.id,
                    meta={"paid": data.paid, "method": data.method})
        db.commit()
    except Exception:
        db.rollback()
        raise
    h.publish(business_id, {"type": "payment", "customer_id": customer.id})
    return payment


def _norm_phone(phone: str) -> str:
    return "".join(ch for ch in phone if ch.isdigit())[-10:]


def find_duplicate_customer(db: Session, business_id: str, phone: str, email: str | None):
    digits = _norm_phone(phone)
    for c in db.query(m.Customer).filter_by(business_id=business_id).all():
        if _norm_phone(c.phone or "") == digits and digits:
            return c
        if email and c.email and c.email.lower() == email.lower():
            return c
    return None


def convert_lead(
    db: Session, business_id: str, actor: str, user_id: str, lead_id: str, data: s.LeadConvertIn,
):
    lead = db.query(m.Lead).filter_by(id=lead_id, business_id=business_id).first()
    if not lead:
        raise errors.not_found("Lead not found")
    if lead.stage == "converted" and lead.converted_customer_id:
        raise errors.conflict("Lead is already converted")
    dup = None
    if data.link_customer_id:
        dup = db.query(m.Customer).filter_by(
            id=data.link_customer_id, business_id=business_id).first()
        if not dup:
            raise errors.not_found("Linked customer not found")
    elif not data.allow_link:
        dup = find_duplicate_customer(db, business_id, lead.phone, lead.email)
        if dup:
            raise errors.conflict(
                "A customer with this phone/email already exists.",
                details={"customer_id": dup.id, "full_name": dup.full_name},
            )
    admission = s.AdmissionIn(
        full_name=lead.full_name, phone=lead.phone,
        email=lead.email,  # type: ignore[arg-type]
        notes=f"Converted from lead ({lead.source}). {lead.notes or ''}".strip(),
        plan=data.plan, start_at=data.start_at, amount=data.amount,
        paid=data.paid, method=data.method,
    )
    # If linking to an existing customer, create membership/payment/renewal only.
    if dup is not None and (data.allow_link or data.link_customer_id):
        customer = dup
        _validate_money(data.plan, data.amount, data.paid, data.method)
        try:
            with db.begin_nested():
                expires = _expiry(data.start_at, data.plan)
                membership = m.Membership(
                    business_id=business_id, customer_id=customer.id, plan=data.plan,
                    status="active", start_at=_ensure_aware(data.start_at), expires_at=expires,
                    amount=data.amount, paid=data.paid)
                db.add(membership)
                db.flush()
                status = _payment_status(data.amount, data.paid)
                payment = m.Payment(
                    business_id=business_id, customer_id=customer.id,
                    membership_id=membership.id, plan=data.plan, kind="admission",
                    amount=data.amount, paid=data.paid, method=data.method, status=status,
                    received_at=datetime.now(timezone.utc), receipt_no="")
                db.add(payment)
                db.flush()
                payment.receipt_no = _receipt(db, business_id)
                renewal = m.Renewal(
                    business_id=business_id, customer_id=customer.id,
                    membership_id=membership.id, plan=data.plan, due_at=expires,
                    amount=data.amount, status="upcoming")
                db.add(renewal)
                lead.stage = "converted"
                lead.converted_customer_id = customer.id
                h.log_activity(db, business_id, actor=actor, action="converted lead",
                               detail=f"{lead.full_name} → existing customer", kind="conversion",
                               customer_id=customer.id)
                h.audit(db, action="lead.convert", user_id=user_id, business_id=business_id,
                        resource="lead", resource_id=lead.id)
            db.commit()
        except Exception:
            db.rollback()
            raise
        h.publish(business_id, {"type": "lead_converted", "lead_id": lead.id})
        return {"linked": True, "customer_id": customer.id}
    out = create_admission(db, business_id, actor, user_id, admission)
    lead2 = db.query(m.Lead).filter_by(id=lead_id, business_id=business_id).first()
    assert lead2 is not None
    lead2.stage = "converted"
    lead2.converted_customer_id = out.customer.customer_id
    db.commit()
    h.log_activity(db, business_id, actor=actor, action="converted lead",
                   detail=f"{lead2.full_name} → {out.customer.customer_id}", kind="conversion",
                   customer_id=out.customer.customer_id)
    db.commit()
    return out


def booking_conflicts(
    db: Session, business_id: str, staff: str | None, starts_at: datetime, ends_at: datetime,
    ignore_id: str | None = None,
):
    if not staff:
        return []
    q = db.query(m.Booking).filter(
        m.Booking.business_id == business_id,
        m.Booking.staff == staff,
        m.Booking.status != "cancelled",
        m.Booking.starts_at < _ensure_aware(ends_at),
        m.Booking.ends_at > _ensure_aware(starts_at),
    )
    if ignore_id:
        q = q.filter(m.Booking.id != ignore_id)
    return q.all()
