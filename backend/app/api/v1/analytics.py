"""Analytics derived from real DB records. No magic numbers, no demo series."""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.deps import BizContext, require_perm
from app.core.timezone import business_tz, resolve_range
from app.models import models as m
from app.schemas import schemas as s


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)

router = APIRouter(tags=["analytics"])


def _range(ctx: BizContext, preset: str, date_from: str | None, date_to: str | None):
    tz = business_tz(ctx.business.timezone)
    start, end = resolve_range(preset, tz, date_from, date_to)
    # previous equivalent-length period
    length = end - start
    prev_end = start
    prev_start = start - length
    return start, end, prev_start, prev_end, tz


def _payments_in(db: Session, biz: str, start: datetime, end: datetime):
    return (
        db.query(m.Payment)
        .filter(m.Payment.business_id == biz,
                m.Payment.received_at >= start, m.Payment.received_at < end)
        .all()
    )


def _summarize(payments: list[m.Payment]) -> dict:
    live = [p for p in payments if p.status != "refunded"]
    received = sum(p.paid or 0 for p in live)
    due = sum(max(0, (p.amount or 0) - (p.paid or 0)) for p in live)
    expected = sum(p.amount or 0 for p in live)
    refunds = sum(p.paid or 0 for p in payments if p.status == "refunded")
    txns = len(live)
    return {"received": received, "due": due, "outstanding": due, "expected": expected,
            "refunds": refunds, "net": received - refunds, "transactions": txns,
            "average": received / txns if txns else 0}


@router.get("/analytics/overview", response_model=s.AnalyticsOverviewOut)
def overview(
    ctx: BizContext = Depends(require_perm("analytics.view")),
    db: Session = Depends(get_db),
):
    biz = ctx.business.id
    tz = business_tz(ctx.business.timezone)
    now = datetime.now(timezone.utc)
    customers = db.query(m.Customer).filter_by(business_id=biz).all()
    memberships = db.query(m.Membership).filter_by(business_id=biz).all()
    leads = db.query(m.Lead).filter_by(business_id=biz).all()
    active = expiring = expired = 0
    latest: dict[str, m.Membership] = {}
    for x in memberships:
        if x.customer_id not in latest or x.expires_at > latest[x.customer_id].expires_at:
            latest[x.customer_id] = x
    for x in latest.values():
        days = (_aware(x.expires_at) - now).days
        if days < 0:
            expired += 1
        elif days <= 7:
            expiring += 1
        else:
            active += 1
    m_active = sum(1 for x in memberships if x.status == "active")
    m_expired = sum(1 for x in memberships if x.status == "expired")
    m_expiring = expiring
    by_customer: dict[str, int] = defaultdict(int)
    for x in memberships:
        by_customer[x.customer_id] += 1
    renewed = sum(1 for n in by_customer.values() if n > 1)
    renewal_rate = (renewed / len(by_customer) * 100) if by_customer else 0
    leads_new = sum(1 for l in leads if l.stage == "new")
    leads_conv = sum(1 for l in leads if l.stage == "converted")
    conv_rate = (leads_conv / len(leads) * 100) if leads else 0
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    bookings_today = db.query(m.Booking).filter(
        m.Booking.business_id == biz, m.Booking.starts_at >= today_start,
        m.Booking.starts_at < today_start + timedelta(days=1),
        m.Booking.status != "cancelled").count()
    tasks_overdue = db.query(m.Task).filter(
        m.Task.business_id == biz, m.Task.due_at < now,
        ~m.Task.status.in_(["done", "completed", "archived"])).count()
    renewals_due = db.query(m.Renewal).filter(
        m.Renewal.business_id == biz,
        m.Renewal.due_at >= now, m.Renewal.due_at < now + timedelta(days=7)).count()
    t_start, t_end, _, _, _ = _range(ctx, "today", None, None)
    m_start, m_end, _, _, _ = _range(ctx, "this-month", None, None)
    rev_today = _summarize(_payments_in(db, biz, t_start, t_end))["received"]
    rev_month = _summarize(_payments_in(db, biz, m_start, m_end))["received"]
    return {
        "customers_total": len(customers), "customers_active": active,
        "customers_expiring": expiring, "customers_expired": expired,
        "memberships_active": m_active, "memberships_expiring": m_expiring,
        "memberships_expired": m_expired, "renewal_rate": round(renewal_rate, 1),
        "leads_total": len(leads), "leads_new": leads_new, "leads_converted": leads_conv,
        "lead_conversion_rate": round(conv_rate, 1), "bookings_today": bookings_today,
        "tasks_overdue": tasks_overdue, "renewals_due_7d": renewals_due,
        "revenue_today": rev_today, "revenue_month": rev_month,
    }


@router.get("/analytics/revenue")
def revenue(
    preset: str = Query("last-30"), date_from: str | None = None, date_to: str | None = None,
    group: str = Query("auto"),
    ctx: BizContext = Depends(require_perm("analytics.view")),
    db: Session = Depends(get_db),
):
    from app.core.timezone import RANGE_ALIASES

    if preset not in RANGE_ALIASES:
        preset = "last-30"
    start, end, p_start, p_end, tz = _range(ctx, preset, date_from, date_to)
    cur = _payments_in(db, ctx.business.id, start, end)
    prev = _payments_in(db, ctx.business.id, p_start, p_end)
    summary = _summarize(cur)
    prev_received = _summarize(prev)["received"]
    days = max(1, (end - start).days)
    gran = group if group in ("day", "week", "month") else (
        "day" if days <= 31 else ("week" if days <= 120 else "month"))
    buckets: list[tuple[str, str, datetime, datetime]] = []
    cursor = start
    fmt_day = "%d %b"
    if gran == "day":
        while cursor < end:
            nxt = cursor + timedelta(days=1)
            local = cursor.astimezone(tz)
            buckets.append((local.strftime("%Y-%m-%d"), local.strftime(fmt_day), cursor, nxt))
            cursor = nxt
    elif gran == "week":
        # align to Monday (business week)
        while cursor < end:
            nxt = cursor + timedelta(days=7)
            local = cursor.astimezone(tz)
            buckets.append((local.strftime("%Y-%m-%d"), "w/c " + local.strftime(fmt_day),
                            cursor, nxt))
            cursor = nxt
    else:
        local = start.astimezone(tz).replace(day=1)
        while local.astimezone(timezone.utc) < end:
            key = local.strftime("%Y-%m")
            label = local.strftime("%b %Y")
            b_start = local.astimezone(timezone.utc)
            # next month
            nm = local.month % 12 + 1
            ny = local.year + (1 if nm == 1 else 0)
            b_end = local.replace(year=ny, month=nm, day=1).astimezone(timezone.utc)
            buckets.append((key, label, b_start, b_end))
            local = local.replace(year=ny, month=nm, day=1)
    trend = []
    for key, label, b0, b1 in buckets:
        # SQLite returns naive datetimes; normalize before comparing.
        rev = sum(p.paid or 0 for p in cur
                  if p.status != "refunded" and b0 <= _aware(p.received_at) < b1)
        # previous-period overlay by index not needed; aggregate same-length offset
        offset = (end - start)
        pb0, pb1 = b0 - offset, b1 - offset
        prv = sum(p.paid or 0 for p in prev
                  if p.status != "refunded" and pb0 <= _aware(p.received_at) < pb1)
        trend.append({"key": key, "label": label, "revenue": rev, "previous": prv})
    by_method: dict[str, float] = defaultdict(float)
    by_plan: dict[str, float] = defaultdict(float)
    by_status: dict[str, float] = defaultdict(float)
    for p in cur:
        if p.status != "refunded":
            by_method[p.method] += p.paid or 0
            if p.plan:
                by_plan[p.method and p.plan] += p.paid or 0
        by_status[p.status] += p.paid or 0
    change = ((summary["received"] - prev_received) / abs(prev_received) * 100
              if prev_received else None)
    return {
        "summary": {**summary, "previous_received": prev_received,
                    "change_percent": change,
                    "has_data": len(cur) > 0 or prev_received > 0},
        "trend": trend,
        "by_method": [{"name": k, "total": v} for k, v in sorted(
            by_method.items(), key=lambda x: -x[1])],
        "by_plan": [{"name": k, "total": v} for k, v in sorted(
            by_plan.items(), key=lambda x: -x[1])],
        "by_status": [{"name": k, "total": v} for k, v in sorted(
            by_status.items(), key=lambda x: -x[1])],
        "range": {"start": start.isoformat(), "end": end.isoformat(), "preset": preset},
    }


@router.get("/analytics/transactions", response_model=s.Page[s.PaymentOut])
def transactions(
    preset: str = Query("last-30"), date_from: str | None = None,
    date_to: str | None = None, q: str | None = None,
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    ctx: BizContext = Depends(require_perm("analytics.view")),
    db: Session = Depends(get_db),
):
    start, end, _, _, _ = _range(ctx, preset, date_from, date_to)
    query = db.query(m.Payment).filter(
        m.Payment.business_id == ctx.business.id,
        m.Payment.received_at >= start, m.Payment.received_at < end)
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
