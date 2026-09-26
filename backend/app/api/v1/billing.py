"""Memberships, renewals, payments."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import errors
from app.core.db import get_db
from app.core.deps import BizContext, require_perm
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h
from app.services import workflows as w

router = APIRouter(tags=["billing"])


@router.get("/memberships", response_model=s.Page[s.MembershipOut])
def list_memberships(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    q: str | None = None, status: str | None = None,
    ctx: BizContext = Depends(require_perm("memberships.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Membership).filter_by(business_id=ctx.business.id)
    if status:
        query = query.filter_by(status=status)
    query = query.order_by(m.Membership.expires_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items: list[s.MembershipOut] = []
    for x in rows:
        c = db.get(m.Customer, x.customer_id)
        name = c.full_name if c else ""
        if q and q.strip().lower() not in name.lower():
            continue
        items.append(s.MembershipOut(
            membership_id=x.id, business_id=x.business_id, customer_id=x.customer_id,
            customer_name=name, plan=x.plan, status=x.status, start_at=x.start_at,
            expires_at=x.expires_at, amount=x.amount or 0, paid=x.paid or 0,
            balance=(x.amount or 0) - (x.paid or 0),
            payment_state=("paid" if (x.amount or 0) - (x.paid or 0) <= 0
                           else ("partial" if (x.paid or 0) > 0 else "pending"))))
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/renewals", response_model=s.Page[s.RenewalOut])
def list_renewals(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    q: str | None = None, status: str | None = None,
    ctx: BizContext = Depends(require_perm("memberships.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Renewal).filter_by(business_id=ctx.business.id)
    if status:
        query = query.filter_by(status=status)
    query = query.order_by(m.Renewal.due_at.asc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    now = datetime.now(timezone.utc)
    items: list[s.RenewalOut] = []
    for r in rows:
        c = db.get(m.Customer, r.customer_id)
        name = c.full_name if c else ""
        if q and q.strip().lower() not in name.lower():
            continue
        items.append(s.RenewalOut(
            renewal_id=r.id, business_id=r.business_id, customer_id=r.customer_id,
            customer_name=name, plan=r.plan, due_at=r.due_at, amount=r.amount or 0,
            status=r.status, contact_status=r.contact_status,
            days_remaining=(r.due_at - now).days))
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/renewals/{renewal_id}/contacted")
def mark_contacted(
    renewal_id: str,
    ctx: BizContext = Depends(require_perm("renewals.manage")),
    db: Session = Depends(get_db),
):
    r = db.query(m.Renewal).filter_by(id=renewal_id, business_id=ctx.business.id).first()
    if not r:
        raise errors.not_found("Renewal not found")
    r.contact_status = "contacted"
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="marked contacted",
                   detail="renewal follow-up", kind="contact", customer_id=r.customer_id)
    db.commit()
    return {"ok": True}


@router.get("/payments", response_model=s.Page[s.PaymentOut])
def list_payments(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    q: str | None = None, status: str | None = None, method: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
    ctx: BizContext = Depends(require_perm("payments.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Payment).filter_by(business_id=ctx.business.id)
    if status:
        query = query.filter_by(status=status)
    if method:
        query = query.filter_by(method=method)
    if date_from:
        query = query.filter(m.Payment.received_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(m.Payment.received_at <= datetime.fromisoformat(date_to))
    query = query.order_by(m.Payment.received_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items: list[s.PaymentOut] = []
    for p in rows:
        c = db.get(m.Customer, p.customer_id)
        name = c.full_name if c else ""
        if q and q.strip().lower() not in (name + (p.receipt_no or "")).lower():
            continue
        items.append(s.PaymentOut(
            payment_id=p.id, business_id=p.business_id, customer_id=p.customer_id,
            customer_name=name, membership_id=p.membership_id, plan=p.plan, kind=p.kind,
            amount=p.amount or 0, paid=p.paid or 0,
            balance=(p.amount or 0) - (p.paid or 0), method=p.method, status=p.status,
            received_at=p.received_at, receipt_no=p.receipt_no or ""))
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/payments", response_model=s.PaymentOut, status_code=201)
def create_payment(
    data: s.PaymentIn,
    ctx: BizContext = Depends(require_perm("payments.manage")),
    db: Session = Depends(get_db),
):
    p = w.record_payment(db, ctx.business.id, ctx.user.full_name, ctx.user.id, data)
    c = db.get(m.Customer, p.customer_id)
    return s.PaymentOut(
        payment_id=p.id, business_id=p.business_id, customer_id=p.customer_id,
        customer_name=c.full_name if c else "", membership_id=p.membership_id, plan=p.plan,
        kind=p.kind, amount=p.amount or 0, paid=p.paid or 0,
        balance=(p.amount or 0) - (p.paid or 0), method=p.method, status=p.status,
        received_at=p.received_at, receipt_no=p.receipt_no or "")


@router.post("/payments/{payment_id}/refund")
def refund_payment(
    payment_id: str,
    ctx: BizContext = Depends(require_perm("payments.refund")),
    db: Session = Depends(get_db),
):
    p = db.query(m.Payment).filter_by(id=payment_id, business_id=ctx.business.id).first()
    if not p:
        raise errors.not_found("Payment not found")
    if p.status == "refunded":
        raise errors.conflict("Payment already refunded")
    p.status = "refunded"
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="refunded payment",
                   detail=f"₹{p.paid:,.0f} · {p.receipt_no}", kind="payment",
                   customer_id=p.customer_id)
    h.audit(db, action="payment.refund", user_id=ctx.user.id, business_id=ctx.business.id,
            resource="payment", resource_id=p.id)
    db.commit()
    h.publish(ctx.business.id, {"type": "payment_refunded", "payment_id": p.id})
    return {"ok": True}
