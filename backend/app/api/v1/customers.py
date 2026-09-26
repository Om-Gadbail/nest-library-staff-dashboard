"""Customers, admissions, notes, timelines."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import errors
from app.core.db import get_db
from app.core.deps import BizContext, get_biz_context, require_perm
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h
from app.services import workflows as w

router = APIRouter(tags=["customers"])


def _paginate(q, page: int, page_size: int):
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()
    return items, total


@router.get("/customers", response_model=s.Page[s.CustomerOut])
def list_customers(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    q: str | None = None, status: str | None = None,
    ctx: BizContext = Depends(require_perm("customers.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Customer).filter_by(business_id=ctx.business.id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            (m.Customer.full_name.ilike(like)) | (m.Customer.phone.ilike(like))
            | (m.Customer.email.ilike(like))
        )
    query = query.order_by(m.Customer.created_at.desc())
    rows, total = _paginate(query, page, page_size)
    items = [w.customer_out(db, c) for c in rows]
    if status:
        items = [i for i in items if i.status == status]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/customers", response_model=s.CustomerOut, status_code=201)
def create_customer(
    data: s.CustomerIn,
    ctx: BizContext = Depends(require_perm("customers.manage")),
    db: Session = Depends(get_db),
):
    dup = w.find_duplicate_customer(db, ctx.business.id, data.phone,
                                    str(data.email) if data.email else None)
    if dup:
        raise errors.conflict("A customer with this phone/email already exists.",
                              details={"customer_id": dup.id})
    c = m.Customer(business_id=ctx.business.id, full_name=data.full_name.strip(),
                   phone=data.phone.strip(),
                   email=str(data.email) if data.email else None, notes=data.notes)
    db.add(c)
    db.flush()
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="created customer",
                   detail=c.full_name, kind="contact", customer_id=c.id)
    db.commit()
    h.publish(ctx.business.id, {"type": "customer", "customer_id": c.id})
    return w.customer_out(db, c)


@router.get("/customers/{customer_id}", response_model=s.CustomerDetailOut)
def get_customer(
    customer_id: str,
    ctx: BizContext = Depends(require_perm("customers.view")),
    db: Session = Depends(get_db),
):
    c = db.query(m.Customer).filter_by(id=customer_id, business_id=ctx.business.id).first()
    if not c:
        raise errors.not_found("Customer not found")
    memberships = (
        db.query(m.Membership).filter_by(business_id=ctx.business.id, customer_id=c.id)
        .order_by(m.Membership.start_at.desc()).all()
    )
    payments = (
        db.query(m.Payment).filter_by(business_id=ctx.business.id, customer_id=c.id)
        .order_by(m.Payment.received_at.desc()).all()
    )
    renewals = (
        db.query(m.Renewal).filter_by(business_id=ctx.business.id, customer_id=c.id)
        .order_by(m.Renewal.due_at.desc()).all()
    )
    activities = (
        db.query(m.Activity).filter_by(business_id=ctx.business.id, customer_id=c.id)
        .order_by(m.Activity.created_at.desc()).limit(100).all()
    )
    now = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)

    def _aware(dt):
        return dt if dt.tzinfo else dt.replace(tzinfo=__import__("datetime").timezone.utc)
    balance = lambda p: (p.amount or 0) - (p.paid or 0)  # noqa: E731
    return {
        "customer": w.customer_out(db, c),
        "memberships": [
            s.MembershipOut(membership_id=x.id, business_id=x.business_id, customer_id=x.customer_id,
                            customer_name=c.full_name, plan=x.plan, status=x.status,
                            start_at=x.start_at, expires_at=x.expires_at, amount=x.amount or 0,
                            paid=x.paid or 0, balance=(x.amount or 0) - (x.paid or 0),
                            payment_state=("paid" if (x.amount or 0) - (x.paid or 0) <= 0
                                           else ("partial" if (x.paid or 0) > 0 else "pending")))
            for x in memberships
        ],
        "payments": [
            s.PaymentOut(payment_id=p.id, business_id=p.business_id, customer_id=p.customer_id,
                         customer_name=c.full_name, membership_id=p.membership_id, plan=p.plan,
                         kind=p.kind, amount=p.amount or 0, paid=p.paid or 0, balance=balance(p),
                         method=p.method, status=p.status, received_at=p.received_at,
                         receipt_no=p.receipt_no or "")
            for p in payments
        ],
        "renewals": [
            s.RenewalOut(renewal_id=r.id, business_id=r.business_id, customer_id=r.customer_id,
                         customer_name=c.full_name, plan=r.plan, due_at=r.due_at, amount=r.amount or 0,
                         status=r.status, contact_status=r.contact_status,
                         days_remaining=(_aware(r.due_at) - now).days)
            for r in renewals
        ],
        "activities": [
            s.ActivityOut(activity_id=a.id, business_id=a.business_id, actor=a.actor,
                          action=a.action, detail=a.detail, kind=a.kind, customer_id=a.customer_id,
                          created_at=a.created_at)
            for a in activities
        ],
    }


@router.patch("/customers/{customer_id}", response_model=s.CustomerOut)
def update_customer(
    customer_id: str, data: s.CustomerIn,
    ctx: BizContext = Depends(require_perm("customers.manage")),
    db: Session = Depends(get_db),
):
    c = db.query(m.Customer).filter_by(id=customer_id, business_id=ctx.business.id).first()
    if not c:
        raise errors.not_found("Customer not found")
    c.full_name = data.full_name.strip()
    c.phone = data.phone.strip()
    c.email = str(data.email) if data.email else None
    c.notes = data.notes
    h.audit(db, action="customer.update", user_id=ctx.user.id, business_id=ctx.business.id,
            resource="customer", resource_id=c.id)
    db.commit()
    return w.customer_out(db, c)


@router.post("/customers/{customer_id}/notes")
def add_note(
    customer_id: str, data: s.NoteIn,
    ctx: BizContext = Depends(require_perm("customers.manage")),
    db: Session = Depends(get_db),
):
    c = db.query(m.Customer).filter_by(id=customer_id, business_id=ctx.business.id).first()
    if not c:
        raise errors.not_found("Customer not found")
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="added note",
                   detail=f"{c.full_name} — {data.note[:120]}", kind="note", customer_id=c.id)
    db.commit()
    h.publish(ctx.business.id, {"type": "note", "customer_id": c.id})
    return {"ok": True}


@router.post("/admissions", response_model=s.AdmissionOut, status_code=201)
def create_admission(
    data: s.AdmissionIn,
    ctx: BizContext = Depends(require_perm("admissions.create")),
    db: Session = Depends(get_db),
):
    return w.create_admission(db, ctx.business.id, ctx.user.full_name, ctx.user.id, data)


@router.post("/customers/{customer_id}/renew")
def renew(
    customer_id: str, data: s.RenewIn,
    ctx: BizContext = Depends(require_perm("renewals.manage")),
    db: Session = Depends(get_db),
):
    membership, payment = w.renew_membership(db, ctx.business.id, ctx.user.full_name,
                                             ctx.user.id, customer_id, data)
    return {"membership_id": membership.id, "payment_id": payment.id}
