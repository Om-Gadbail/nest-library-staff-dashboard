"""Staff management (owner-enforced), business settings, WhatsApp, search, realtime, jobs."""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core import errors
from app.core.db import get_db
from app.core.deps import BizContext, CurrentUser, get_current_user, require_perm
from app.core.permissions import can
from app.core.security import hash_password
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h
from app.services import scheduler as sched
from app.services import whatsapp as wa

router = APIRouter(tags=["admin"])


# ---------- staff ----------


@router.get("/staff", response_model=s.Page[s.StaffOut])
def list_staff(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
    ctx: BizContext = Depends(require_perm("staff.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Membership2Business).filter_by(business_id=ctx.business.id)
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items: list[s.StaffOut] = []
    for ms in rows:
        u = db.get(m.User, ms.user_id)
        if not u:
            continue
        items.append(s.StaffOut(staff_id=ms.id, business_id=ms.business_id,
                                full_name=u.full_name, email=u.email, role=ms.role,
                                status=ms.status, last_active=None))
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/staff/invite", status_code=201)
def invite_staff(
    data: s.StaffInviteIn,
    ctx: BizContext = Depends(require_perm("staff.invite")),
    db: Session = Depends(get_db),
):
    from app.core.config import get_settings

    if data.role == "owner" and ctx.role != "owner":
        raise errors.forbidden("Only owners can invite owners")
    if data.role not in ("owner", "admin", "staff"):
        raise errors.unprocessable(f"Unknown role: {data.role}")
    existing = db.query(m.User).filter_by(email=str(data.email).lower().strip()).first()
    if existing:
        dup = db.query(m.Membership2Business).filter_by(
            user_id=existing.id, business_id=ctx.business.id).first()
        if dup:
            raise errors.conflict("This user is already a member of this business")
        dup = m.Membership2Business(user_id=existing.id, business_id=ctx.business.id,
                                    role=data.role, status="invited")
        db.add(dup)
        db.commit()
        return {"ok": True, "user_id": existing.id}
    # Create placeholder user; real password set on first login via admin reset in this build.
    user = m.User(full_name=data.full_name.strip(),
                  email=str(data.email).lower().strip(),
                  password_hash=hash_password(get_settings().SEED_DEMO_PASSWORD))
    db.add(user)
    db.flush()
    db.add(m.Membership2Business(user_id=user.id, business_id=ctx.business.id,
                                 role=data.role, status="invited"))
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="invited staff",
                   detail=f"{data.full_name} — {data.role}", kind="system")
    h.audit(db, action="staff.invite", user_id=ctx.user.id, business_id=ctx.business.id,
            resource="user", resource_id=user.id, meta={"role": data.role})
    db.commit()
    return {"ok": True, "user_id": user.id}


@router.patch("/staff/{staff_id}/role")
def update_role(
    staff_id: str, data: s.StaffRoleIn,
    ctx: BizContext = Depends(require_perm("staff.role")),
    db: Session = Depends(get_db),
):
    if data.role not in ("owner", "admin", "staff"):
        raise errors.unprocessable(f"Unknown role: {data.role}")
    ms = db.query(m.Membership2Business).filter_by(
        id=staff_id, business_id=ctx.business.id).first()
    if not ms:
        raise errors.not_found("Staff member not found")
    if ms.user_id == ctx.user.id:
        raise errors.forbidden("You cannot change your own role")
    ms.role = data.role
    h.audit(db, action="staff.role", user_id=ctx.user.id, business_id=ctx.business.id,
            resource="staff", resource_id=ms.id, meta={"role": data.role})
    db.commit()
    return {"ok": True}


@router.patch("/staff/{staff_id}/status")
def update_status(
    staff_id: str, data: s.StaffStatusIn,
    ctx: BizContext = Depends(require_perm("staff.status")),
    db: Session = Depends(get_db),
):
    if data.status not in ("active", "invited", "inactive"):
        raise errors.unprocessable(f"Unknown status: {data.status}")
    ms = db.query(m.Membership2Business).filter_by(
        id=staff_id, business_id=ctx.business.id).first()
    if not ms:
        raise errors.not_found("Staff member not found")
    if ms.user_id == ctx.user.id and data.status != "active":
        raise errors.forbidden("You cannot deactivate yourself")
    # never remove the last owner
    if ms.role == "owner" and data.status != "active":
        owners = db.query(m.Membership2Business).filter_by(
            business_id=ctx.business.id, role="owner", status="active").count()
        if owners <= 1:
            raise errors.conflict("Cannot deactivate the last owner")
    ms.status = data.status
    h.audit(db, action="staff.status", user_id=ctx.user.id, business_id=ctx.business.id,
            resource="staff", resource_id=ms.id, meta={"status": data.status})
    db.commit()
    return {"ok": True}


# ---------- settings ----------


def _settings_out(db: Session, ctx: BizContext) -> s.SettingsOut:
    row = db.get(m.BusinessSettings, ctx.business.id)
    plans = db.query(m.MembershipPlan).filter_by(business_id=ctx.business.id).all()
    return s.SettingsOut(
        business_id=ctx.business.id, name=row.name if row else ctx.business.name,
        phone=row.phone if row else ctx.business.phone,
        email=row.email if row else ctx.business.email,
        address=row.address if row else ctx.business.address,
        opening_hours=row.opening_hours if row else None,
        timezone=ctx.business.timezone, currency=ctx.business.currency,
        renewal_reminders=row.renewal_reminders if row else True,
        payment_reminders=row.payment_reminders if row else True,
        lead_followups=row.lead_followups if row else True,
        booking_reminders=row.booking_reminders if row else True,
        whatsapp_connected=row.whatsapp_connected if row else False,
        reminder_timing=row.reminder_timing if row else "1 day before",
        plans=[{"id": p.id, "name": p.name, "months": p.months, "price": p.price,
                "active": p.active} for p in plans])


@router.get("/settings", response_model=s.SettingsOut)
def get_settings(
    ctx: BizContext = Depends(require_perm("settings.view")),
    db: Session = Depends(get_db),
):
    return _settings_out(db, ctx)


@router.patch("/settings", response_model=s.SettingsOut)
def update_settings(
    data: s.SettingsPatch,
    ctx: BizContext = Depends(require_perm("settings.limited")),
    db: Session = Depends(get_db),
):
    owner_only_fields = {"name", "phone", "email", "address", "opening_hours", "timezone",
                         "plans"}
    touched_owner = owner_only_fields.intersection(
        {k for k, v in data.model_dump(exclude_unset=True).items() if v is not None})
    if touched_owner and not can(ctx.role, "settings.manage"):
        raise errors.forbidden("Only owners can change business identity settings")
    biz = db.get(m.Business, ctx.business.id)
    assert biz is not None
    if data.name is not None:
        biz.name = data.name.strip()
    if data.timezone is not None:
        from zoneinfo import ZoneInfo

        try:
            ZoneInfo(data.timezone)
        except Exception:
            raise errors.unprocessable(f"Unknown timezone: {data.timezone}")
        biz.timezone = data.timezone
    row = db.get(m.BusinessSettings, ctx.business.id)
    if not row:
        row = m.BusinessSettings(business_id=ctx.business.id, name=biz.name)
        db.add(row)
    for field in ("phone", "email", "address", "opening_hours", "renewal_reminders",
                  "payment_reminders", "lead_followups", "booking_reminders",
                  "reminder_timing"):
        val = getattr(data, field)
        if val is not None:
            setattr(row, field, str(val) if field == "email" else val)
    if data.name is not None:
        row.name = data.name.strip()
    if data.plans is not None:
        for p in data.plans:
            if "id" in p and p["id"]:
                existing = db.get(m.MembershipPlan, p["id"])
                if not existing or existing.business_id != ctx.business.id:
                    raise errors.not_found("Plan not found")
                for k in ("name", "months", "price", "active"):
                    if k in p:
                        setattr(existing, k, p[k])
            else:
                db.add(m.MembershipPlan(business_id=ctx.business.id, name=p.get("name", "Plan"),
                                        months=int(p.get("months", 1)),
                                        price=float(p.get("price", 0)),
                                        active=bool(p.get("active", True))))
    h.audit(db, action="settings.update", user_id=ctx.user.id, business_id=ctx.business.id,
            resource="settings", resource_id=ctx.business.id)
    db.commit()
    h.publish(ctx.business.id, {"type": "settings"})
    return _settings_out(db, ctx)


# ---------- whatsapp ----------


@router.get("/whatsapp/settings", response_model=s.WhatsAppSettingsOut)
def wa_get(
    ctx: BizContext = Depends(require_perm("whatsapp.view")),
    db: Session = Depends(get_db),
):
    from app.core.config import get_settings as _gs

    cfg = db.get(m.WhatsAppSettings, ctx.business.id)
    gs = _gs()
    provider = cfg.provider if cfg else gs.WHATSAPP_PROVIDER
    enabled = cfg.enabled if cfg else gs.WHATSAPP_ENABLED
    phone_set = bool((cfg.phone_number_id if cfg else "") or gs.WHATSAPP_PHONE_NUMBER_ID)
    token_set = bool((cfg.access_token_enc if cfg else "") or gs.WHATSAPP_ACCESS_TOKEN)
    return s.WhatsAppSettingsOut(provider=provider, enabled=enabled,
                                 configured=enabled and phone_set and token_set,
                                 phone_number_id_set=phone_set, has_token=token_set,
                                 reminder_days=cfg.reminder_days if cfg else "7,3,1,0",
                                 templates=cfg.templates if cfg else "renewal_reminder")


@router.patch("/whatsapp/settings", response_model=s.WhatsAppSettingsOut)
def wa_update(
    data: s.WhatsAppSettingsPatch,
    ctx: BizContext = Depends(require_perm("whatsapp.manage")),
    db: Session = Depends(get_db),
):
    cfg = db.get(m.WhatsAppSettings, ctx.business.id)
    if not cfg:
        cfg = m.WhatsAppSettings(business_id=ctx.business.id)
        db.add(cfg)
    if data.provider is not None:
        if data.provider not in ("log", "meta"):
            raise errors.unprocessable(f"Unknown provider: {data.provider}")
        cfg.provider = data.provider
    if data.phone_number_id is not None:
        cfg.phone_number_id = data.phone_number_id
    if data.access_token is not None:
        # Stored server-side only; never returned by the API.
        cfg.access_token_enc = data.access_token
    if data.enabled is not None:
        cfg.enabled = data.enabled
    if data.reminder_days is not None:
        cfg.reminder_days = data.reminder_days
    if data.templates is not None:
        cfg.templates = data.templates
    row = db.get(m.BusinessSettings, ctx.business.id)
    if row:
        row.whatsapp_connected = bool(cfg.enabled and cfg.phone_number_id
                                      and cfg.access_token_enc)
    h.audit(db, action="whatsapp.settings", user_id=ctx.user.id,
            business_id=ctx.business.id, resource="whatsapp")
    db.commit()
    return wa_get(ctx, db)


@router.post("/whatsapp/send", response_model=s.WhatsAppMessageOut, status_code=201)
def wa_send(
    data: s.WhatsAppSendIn,
    ctx: BizContext = Depends(require_perm("whatsapp.send")),
    db: Session = Depends(get_db),
):
    msg = wa.queue_and_send(db, ctx.business.id, recipient=data.recipient,
                            template=data.template, body=data.body, kind="manual",
                            customer_id=data.customer_id, renewal_id=data.renewal_id)
    h.publish(ctx.business.id, {"type": "whatsapp", "message_id": msg.id})
    return s.WhatsAppMessageOut(
        message_id=msg.id, business_id=msg.business_id, recipient=msg.recipient,
        template=msg.template, body=msg.body, status=msg.status,
        provider_message_id=msg.provider_message_id, error=msg.error,
        created_at=msg.created_at)


@router.get("/whatsapp/messages", response_model=s.Page[s.WhatsAppMessageOut])
def wa_list(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    ctx: BizContext = Depends(require_perm("whatsapp.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.WhatsAppMessage).filter_by(
        business_id=ctx.business.id).order_by(m.WhatsAppMessage.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [s.WhatsAppMessageOut(
        message_id=x.id, business_id=x.business_id, recipient=x.recipient,
        template=x.template, body=x.body, status=x.status,
        provider_message_id=x.provider_message_id, error=x.error,
        created_at=x.created_at) for x in rows],
        "total": total, "page": page, "page_size": page_size}


# ---------- global search (server-side, scoped, paginated) ----------


@router.get("/search")
def search(
    q: str = Query(..., min_length=2, max_length=100),
    limit: int = Query(8, ge=1, le=20),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.core.deps import get_biz_context as _gbc  # noqa

    allowed = [ms for ms in current.memberships]
    if not allowed:
        raise errors.forbidden("No business access")
    biz_id = allowed[0].business_id
    like = f"%{q.strip()}%"
    customers = db.query(m.Customer).filter(
        m.Customer.business_id == biz_id,
        (m.Customer.full_name.ilike(like)) | (m.Customer.phone.ilike(like))).limit(limit).all()
    leads = db.query(m.Lead).filter(
        m.Lead.business_id == biz_id,
        (m.Lead.full_name.ilike(like)) | (m.Lead.phone.ilike(like))).limit(limit).all()
    bookings = db.query(m.Booking).filter(
        m.Booking.business_id == biz_id, m.Booking.title.ilike(like)).limit(limit).all()
    tasks = db.query(m.Task).filter(
        m.Task.business_id == biz_id, m.Task.title.ilike(like)).limit(limit).all()
    return {
        "customers": [{"id": c.id, "name": c.full_name, "phone": c.phone} for c in customers],
        "leads": [{"id": l.id, "name": l.full_name, "stage": l.stage} for l in leads],
        "bookings": [{"id": b.id, "title": b.title,
                      "starts_at": b.starts_at.isoformat()} for b in bookings],
        "tasks": [{"id": t.id, "title": t.title, "status": t.status} for t in tasks],
    }


# ---------- realtime (SSE with graceful fallback) ----------


@router.get("/realtime/events")
async def realtime_events(
    current: CurrentUser = Depends(get_current_user),
):
    biz_id = current.memberships[0].business_id if current.memberships else ""
    if not biz_id:
        raise errors.forbidden("No business access")
    queue = h.subscribe(biz_id)

    async def gen():
        try:
            yield 'event: ready\ndata: {"ok": true}\n\n'
            while True:
                import asyncio as _aio

                try:
                    event = await _aio.wait_for(queue.get(), timeout=25)
                    yield f"event: update\ndata: {json.dumps(event)}\n\n"
                except _aio.TimeoutError:
                    yield ": heartbeat\n\n"
        finally:
            h.unsubscribe(biz_id, queue)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# ---------- jobs ----------


@router.post("/jobs/renewal-check")
def run_renewal_check(
    ctx: BizContext = Depends(require_perm("jobs.run")),
    db: Session = Depends(get_db),
):
    return sched.run_renewal_check(db, ctx.business.id)


@router.get("/audit-logs")
def audit_logs(
    page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
    ctx: BizContext = Depends(require_perm("settings.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.AuditLog).filter_by(
        business_id=ctx.business.id).order_by(m.AuditLog.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [{"id": a.id, "action": a.action, "resource": a.resource,
                       "resource_id": a.resource_id, "meta": a.meta,
                       "created_at": a.created_at.isoformat() if a.created_at else None}
                      for a in rows],
            "total": total, "page": page, "page_size": page_size}
