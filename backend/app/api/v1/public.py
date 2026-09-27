"""Anonymous public website intake (thin compatibility adapters).

The Nest website speaks a fixed contract (see website `docs/LEAD_API.md`):

    POST /api/leads/contact | visit | membership | seat-inquiry
    -> 200 { "referenceId": "<id>" }

These routes are intentionally thin: they validate, resolve the tenant
SERVER-SIDE, then delegate into the SAME canonical pipeline as staff-created
leads — same `Lead` rows, same activity audit, same staff notification, same
realtime publish. There is no second lead pipeline and no Nest-only logic.

Tenant safety:
- The browser's `businessId`/`tenantId` fields are IGNORED. The Nest intake
  endpoints always resolve to `PUBLIC_NEST_BUSINESS_ID` (default
  `nest-library-001`). A client sending `businessId="prime"` still lands in
  the Nest tenant — cross-tenant submission is impossible through this path.
- The config endpoint resolves an explicit server-side slug map and 404s on
  unknown slugs. It returns public-safe business facts only (never secrets).
"""

import json
import secrets
from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import errors
from app.core.config import get_settings
from app.core.db import get_db
from app.core.rate_limit import check as rate_check
from app.models import models as m
from app.schemas import public as ps
from app.services import helpers as h

leads_router = APIRouter(prefix="/api/leads", tags=["public-leads"])
config_router = APIRouter(prefix="/api/v1/public", tags=["public"])

SOURCE_LABEL = {
    "contact": ("Website-Contact", "Contact"),
    "visit": ("Website-Visit", "Visit booking"),
    "membership": ("Website-Membership", "Membership inquiry"),
    "seat-inquiry": ("Website-Seat", "Seat inquiry"),
}


def _settings():
    return get_settings()


def _client_ip(request: Request) -> str:
    if request.client is not None and request.client.host:
        return request.client.host
    return "unknown"


def _is_honeypot_caught(company: str | None) -> bool:
    return bool(company and company.strip())


def _opaque_reference() -> str:
    # Honeypot replies must be indistinguishable from real ones to bots.
    return secrets.token_hex(6)


def _valid_idempotency_key(value: str | None) -> str | None:
    if value is None:
        return None
    key = value.strip()
    if 1 <= len(key) <= 128:
        return key
    return None


def _slug_map() -> dict[str, str]:
    s = _settings()
    return {
        "nest": s.PUBLIC_NEST_BUSINESS_ID,
        "nest-library": s.PUBLIC_NEST_BUSINESS_ID,
        "prime": s.PUBLIC_PRIME_BUSINESS_ID,
        "prime-fitness": s.PUBLIC_PRIME_BUSINESS_ID,
    }


def _resolve_business(db: Session, business_id: str) -> m.Business:
    biz = db.get(m.Business, business_id)
    if not biz:
        raise errors.unavailable(
            "Website intake is not configured for this business yet.")
    return biz


def _get_idem_response(db: Session, business_id: str, key: str) -> dict | None:
    row = (
        db.query(m.IdempotencyKey)
        .filter_by(business_id=business_id, key=key)
        .first()
    )
    if not row:
        return None
    if not row.response_json:
        # Winner is still processing: ask the caller to retry, never fork a
        # second lead for the same key.
        raise errors.conflict("Duplicate request is still processing. Please retry.")
    return json.loads(row.response_json)


def _guard(request: Request, body: bytes, *, scope: str) -> None:
    s = _settings()
    if len(body) > s.PUBLIC_MAX_BODY_BYTES:
        raise errors.ApiError("payload_too_large", "Request body too large.", 413)
    rate_check(scope, s.PUBLIC_RATE_LIMIT, s.PUBLIC_RATE_WINDOW_S)


def _create_lead(
    db: Session,
    biz: m.Business,
    *,
    endpoint: str,
    form: str,
    full_name: str,
    phone: str,
    notes: str | None,
    interested_plan: str | None,
    follow_up_at: datetime | None,
    idem_key: str | None,
) -> dict:
    if idem_key:
        # Insert-first: the unique (business_id, key) race decides the winner.
        # Losers roll back before creating anything and replay the winner.
        probe = m.IdempotencyKey(
            business_id=biz.id, key=idem_key, endpoint=endpoint, response_json="")
        db.add(probe)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            stored = _get_idem_response(db, biz.id, idem_key)
            assert stored is not None  # winner row must exist after conflict
            return stored
    source, label = SOURCE_LABEL[form]
    lead = m.Lead(
        business_id=biz.id,
        full_name=full_name.strip(),
        phone=phone.strip(),
        source=source,
        # interested_plan is a short queryable tag; the full enquiry detail
        # always lives in notes as well.
        interested_plan=(interested_plan[:32] if interested_plan else None),
        notes=notes,
        follow_up_at=follow_up_at,
    )
    db.add(lead)
    db.flush()
    h.log_activity(
        db, biz.id, actor="Website", action="new website lead",
        detail=f"{lead.full_name} — {label}", kind="lead")
    h.notify(
        db, biz.id, title=f"New website lead: {lead.full_name}",
        body=f"{label} enquiry.", kind="lead", link=f"/leads/{lead.id}")
    if idem_key:
        row = (
            db.query(m.IdempotencyKey)
            .filter_by(business_id=biz.id, key=idem_key)
            .first()
        )
        if row is not None:
            row.response_json = json.dumps({"referenceId": lead.id})
    db.commit()
    return {"referenceId": lead.id}


def _visit_follow_up(biz: m.Business, date: str, time_: str) -> datetime:
    try:
        naive = datetime.strptime(f"{date.strip()} {time_.strip()}", "%Y-%m-%d %H:%M")
    except ValueError:
        raise errors.unprocessable("Invalid preferredDate/preferredTime.")
    try:
        tz = ZoneInfo(biz.timezone or "Asia/Kolkata")
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")
    return naive.replace(tzinfo=tz)


def _lines(*pairs: tuple[str, str | None]) -> str | None:
    out = [f"{label}: {value.strip()}" for label, value in pairs if value and value.strip()]
    return "\n".join(out) if out else None


# ---------- intake endpoints (exact website contract) ----------


@leads_router.post("/contact", response_model=ps.PublicReferenceOut)
async def submit_contact(
    request: Request,
    data: ps.PublicContactIn,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None),
):
    body = await request.body()
    _guard(request, body, scope=f"public:leads:contact:{_client_ip(request)}")
    if _is_honeypot_caught(data.company):
        return {"referenceId": _opaque_reference()}
    key = _valid_idempotency_key(idempotency_key)
    biz = _resolve_business(db, _settings().PUBLIC_NEST_BUSINESS_ID)
    if key:
        stored = _get_idem_response(db, biz.id, key)
        if stored:
            return stored
    return _create_lead(
        db, biz, endpoint="contact", form="contact",
        full_name=data.name, phone=data.phone,
        notes=data.message.strip(), interested_plan=None, follow_up_at=None,
        idem_key=key,
    )


@leads_router.post("/visit", response_model=ps.PublicReferenceOut)
async def submit_visit(
    request: Request,
    data: ps.PublicVisitIn,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None),
):
    body = await request.body()
    _guard(request, body, scope=f"public:leads:visit:{_client_ip(request)}")
    if _is_honeypot_caught(data.company):
        return {"referenceId": _opaque_reference()}
    key = _valid_idempotency_key(idempotency_key)
    biz = _resolve_business(db, _settings().PUBLIC_NEST_BUSINESS_ID)
    if key:
        stored = _get_idem_response(db, biz.id, key)
        if stored:
            return stored
    follow_up_at = _visit_follow_up(biz, data.preferredDate, data.preferredTime)
    notes = _lines(
        ("Preferred visit", f"{data.preferredDate.strip()} {data.preferredTime.strip()}"),
        ("Preparation", data.purpose),
        ("Message", data.message),
    )
    return _create_lead(
        db, biz, endpoint="visit", form="visit",
        full_name=data.name, phone=data.phone,
        notes=notes, interested_plan=None, follow_up_at=follow_up_at,
        idem_key=key,
    )


@leads_router.post("/membership", response_model=ps.PublicReferenceOut)
async def submit_membership(
    request: Request,
    data: ps.PublicMembershipIn,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None),
):
    body = await request.body()
    _guard(request, body, scope=f"public:leads:membership:{_client_ip(request)}")
    if _is_honeypot_caught(data.company):
        return {"referenceId": _opaque_reference()}
    key = _valid_idempotency_key(idempotency_key)
    biz = _resolve_business(db, _settings().PUBLIC_NEST_BUSINESS_ID)
    if key:
        stored = _get_idem_response(db, biz.id, key)
        if stored:
            return stored
    notes = _lines(
        ("Plan", data.plan),
        ("Seat type", data.seatType),
        ("Duration", data.duration),
        ("Message", data.message),
    )
    return _create_lead(
        db, biz, endpoint="membership", form="membership",
        full_name=data.name, phone=data.phone,
        notes=notes, interested_plan=data.plan.strip(), follow_up_at=None,
        idem_key=key,
    )


@leads_router.post("/seat-inquiry", response_model=ps.PublicReferenceOut)
async def submit_seat_inquiry(
    request: Request,
    data: ps.PublicSeatInquiryIn,
    db: Session = Depends(get_db),
    idempotency_key: str | None = Header(default=None),
):
    body = await request.body()
    _guard(request, body, scope=f"public:leads:seat-inquiry:{_client_ip(request)}")
    if _is_honeypot_caught(data.company):
        return {"referenceId": _opaque_reference()}
    key = _valid_idempotency_key(idempotency_key)
    biz = _resolve_business(db, _settings().PUBLIC_NEST_BUSINESS_ID)
    if key:
        stored = _get_idem_response(db, biz.id, key)
        if stored:
            return stored
    notes = _lines(
        ("Occupation", data.occupation),
        ("Exam goal", data.examGoal),
        ("Duration", data.duration),
        ("Seat preference", data.seatPreference),
        ("Timing", data.timing),
        ("Source", data.source),
        ("Message", data.message),
    )
    return _create_lead(
        db, biz, endpoint="seat-inquiry", form="seat-inquiry",
        full_name=data.name, phone=data.phone,
        notes=notes, interested_plan=None, follow_up_at=None,
        idem_key=key,
    )


# ---------- public business config ----------


@config_router.get("/{slug}/config", response_model=ps.PublicBusinessConfigOut)
def get_public_config(slug: str, request: Request, db: Session = Depends(get_db)):
    slug = slug.strip().lower()
    _guard(request, b"", scope=f"public:config:{slug}:{_client_ip(request)}")
    business_id = _slug_map().get(slug)
    if not business_id:
        raise errors.not_found("Business not found")
    biz = _resolve_business(db, business_id)
    settings_row = db.get(m.BusinessSettings, biz.id)
    return {
        "slug": slug,
        "businessId": biz.id,
        "name": biz.name,
        "phone": (settings_row.phone if settings_row else None) or biz.phone,
        "email": (settings_row.email if settings_row else None) or biz.email,
        "address": (settings_row.address if settings_row else None) or biz.address,
        "openingHours": settings_row.opening_hours if settings_row else None,
        "timezone": biz.timezone,
        "currency": biz.currency,
        "leadIntake": {
            "contact": "/api/leads/contact",
            "visit": "/api/leads/visit",
            "membership": "/api/leads/membership",
            "seatInquiry": "/api/leads/seat-inquiry",
        },
    }
