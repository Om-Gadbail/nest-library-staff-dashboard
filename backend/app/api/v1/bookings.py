"""Bookings with server-side conflict detection."""

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import errors
from app.core.db import get_db
from app.core.deps import BizContext, require_perm
from app.core.permissions import can
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h
from app.services import workflows as w

router = APIRouter(tags=["bookings"])


def _out(b: m.Booking) -> s.BookingOut:
    return s.BookingOut(
        booking_id=b.id, business_id=b.business_id, title=b.title, service=b.service,
        customer_id=b.customer_id, customer_name=b.customer_name,
        customer_phone=b.customer_phone, staff=b.staff, starts_at=b.starts_at,
        ends_at=b.ends_at, status=b.status, notes=b.notes)


@router.get("/bookings", response_model=s.Page[s.BookingOut])
def list_bookings(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    q: str | None = None, status: str | None = None,
    date_from: str | None = None, date_to: str | None = None,
    ctx: BizContext = Depends(require_perm("bookings.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Booking).filter_by(business_id=ctx.business.id)
    if status:
        query = query.filter_by(status=status)
    if date_from:
        query = query.filter(m.Booking.starts_at >= datetime.fromisoformat(date_from))
    if date_to:
        query = query.filter(m.Booking.starts_at <= datetime.fromisoformat(date_to))
    query = query.order_by(m.Booking.starts_at.asc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [_out(b) for b in rows]
    if q:
        ql = q.strip().lower()
        items = [b for b in items if ql in (b.title + b.customer_name).lower()]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/bookings", response_model=s.BookingOut, status_code=201)
def create_booking(
    data: s.BookingIn,
    ctx: BizContext = Depends(require_perm("bookings.manage")),
    db: Session = Depends(get_db),
):
    if data.ends_at <= data.starts_at:
        raise errors.unprocessable("End time must be after start time")
    conflicts = w.booking_conflicts(db, ctx.business.id, data.staff, data.starts_at, data.ends_at)
    if conflicts and not (data.allow_overlap and can(ctx.role, "bookings.override")):
        raise errors.conflict(
            f"Staff member is already booked during this time ({conflicts[0].title}).",
            details={"conflicts": [{"booking_id": c.id, "title": c.title,
                                    "starts_at": c.starts_at.isoformat(),
                                    "ends_at": c.ends_at.isoformat()} for c in conflicts]})
    customer_name = data.customer_name
    if data.customer_id:
        c = db.query(m.Customer).filter_by(id=data.customer_id,
                                           business_id=ctx.business.id).first()
        if not c:
            raise errors.not_found("Customer not found")
        customer_name = customer_name or c.full_name
    b = m.Booking(business_id=ctx.business.id, title=data.title.strip(), service=data.service,
                  customer_id=data.customer_id, customer_name=customer_name,
                  customer_phone=data.customer_phone, staff=data.staff,
                  starts_at=data.starts_at, ends_at=data.ends_at, status="scheduled",
                  notes=data.notes)
    db.add(b)
    db.flush()
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="created booking",
                   detail=f"{b.title} — {b.customer_name}", kind="booking")
    h.notify(db, ctx.business.id, title=f"Booking: {b.title}",
             body=f"{b.customer_name} · {b.starts_at:%Y-%m-%d %H:%M}.", kind="booking",
             link="/bookings")
    db.commit()
    h.publish(ctx.business.id, {"type": "booking", "booking_id": b.id})
    return _out(b)


@router.patch("/bookings/{booking_id}", response_model=s.BookingOut)
def update_booking(
    booking_id: str, data: s.BookingPatch,
    ctx: BizContext = Depends(require_perm("bookings.manage")),
    db: Session = Depends(get_db),
):
    b = db.query(m.Booking).filter_by(id=booking_id, business_id=ctx.business.id).first()
    if not b:
        raise errors.not_found("Booking not found")
    starts = data.starts_at or b.starts_at
    ends = data.ends_at or b.ends_at
    if ends <= starts:
        raise errors.unprocessable("End time must be after start time")
    staff = data.staff if data.staff is not None else b.staff
    conflicts = w.booking_conflicts(db, ctx.business.id, staff, starts, ends, ignore_id=b.id)
    if conflicts and not (data.allow_overlap and can(ctx.role, "bookings.override")):
        raise errors.conflict(
            f"Staff member is already booked during this time ({conflicts[0].title}).")
    for field in ("title", "service", "customer_id", "customer_name", "customer_phone",
                  "staff", "notes"):
        val = getattr(data, field)
        if val is not None:
            setattr(b, field, val)
    b.starts_at, b.ends_at = starts, ends
    if data.status:
        if data.status not in ("scheduled", "confirmed", "pending", "cancelled",
                               "completed", "no-show"):
            raise errors.unprocessable(f"Unknown status: {data.status}")
        b.status = data.status
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="updated booking",
                   detail=f"{b.title} — {b.customer_name}", kind="booking")
    h.audit(db, action="booking.update", user_id=ctx.user.id, business_id=ctx.business.id,
            resource="booking", resource_id=b.id)
    db.commit()
    h.publish(ctx.business.id, {"type": "booking_updated", "booking_id": b.id})
    return _out(b)
