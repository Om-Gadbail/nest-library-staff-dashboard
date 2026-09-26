"""Leads + conversion."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import errors
from app.core.db import get_db
from app.core.deps import BizContext, require_perm
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h
from app.services import workflows as w

router = APIRouter(tags=["leads"])


def _out(lead: m.Lead) -> s.LeadOut:
    return s.LeadOut(
        lead_id=lead.id, business_id=lead.business_id, full_name=lead.full_name, phone=lead.phone,
        email=lead.email, stage=lead.stage, source=lead.source,
        interested_plan=lead.interested_plan, assigned_to=lead.assigned_to, notes=lead.notes,
        follow_up_at=lead.follow_up_at, converted_customer_id=lead.converted_customer_id,
        created_at=lead.created_at, updated_at=lead.updated_at)


@router.get("/leads", response_model=s.Page[s.LeadOut])
def list_leads(
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    q: str | None = None, stage: str | None = None,
    ctx: BizContext = Depends(require_perm("leads.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Lead).filter_by(business_id=ctx.business.id)
    if stage:
        query = query.filter_by(stage=stage)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter((m.Lead.full_name.ilike(like)) | (m.Lead.phone.ilike(like)))
    query = query.order_by(m.Lead.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_out(r) for r in rows], "total": total, "page": page, "page_size": page_size}


@router.post("/leads", response_model=s.LeadOut, status_code=201)
def create_lead(
    data: s.LeadIn,
    ctx: BizContext = Depends(require_perm("leads.manage")),
    db: Session = Depends(get_db),
):
    lead = m.Lead(business_id=ctx.business.id, full_name=data.full_name.strip(),
                  phone=data.phone.strip(), email=str(data.email) if data.email else None,
                  source=data.source, interested_plan=data.interested_plan,
                  assigned_to=data.assigned_to, notes=data.notes, follow_up_at=data.follow_up_at)
    db.add(lead)
    db.flush()
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="added lead",
                   detail=f"{lead.full_name} — {lead.source}", kind="lead")
    h.notify(db, ctx.business.id, title=f"New lead: {lead.full_name}",
             body=f"{lead.source} enquiry.", kind="lead", link=f"/leads/{lead.id}")
    db.commit()
    h.publish(ctx.business.id, {"type": "lead", "lead_id": lead.id})
    return _out(lead)


@router.get("/leads/{lead_id}", response_model=s.LeadOut)
def get_lead(
    lead_id: str,
    ctx: BizContext = Depends(require_perm("leads.view")),
    db: Session = Depends(get_db),
):
    lead = db.query(m.Lead).filter_by(id=lead_id, business_id=ctx.business.id).first()
    if not lead:
        raise errors.not_found("Lead not found")
    return _out(lead)


@router.patch("/leads/{lead_id}", response_model=s.LeadOut)
def update_lead(
    lead_id: str, data: s.LeadPatch,
    ctx: BizContext = Depends(require_perm("leads.manage")),
    db: Session = Depends(get_db),
):
    from datetime import datetime, timezone

    lead = db.query(m.Lead).filter_by(id=lead_id, business_id=ctx.business.id).first()
    if not lead:
        raise errors.not_found("Lead not found")
    for field in ("full_name", "phone", "source", "interested_plan", "assigned_to", "notes"):
        val = getattr(data, field)
        if val is not None:
            setattr(lead, field, val.strip() if isinstance(val, str) else val)
    if data.email is not None:
        lead.email = str(data.email) if data.email else None
    if data.follow_up_at is not None:
        lead.follow_up_at = data.follow_up_at
    if data.stage is not None:
        if data.stage not in ("new", "contacted", "interested", "follow-up", "converted", "lost"):
            raise errors.unprocessable(f"Unknown stage: {data.stage}")
        if lead.stage == "converted" and data.stage != "converted":
            raise errors.conflict("Converted leads cannot be moved back")
        lead.stage = data.stage
    lead.updated_at = datetime.now(timezone.utc)
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="updated lead",
                   detail=lead.full_name, kind="lead")
    db.commit()
    h.publish(ctx.business.id, {"type": "lead_updated", "lead_id": lead.id})
    return _out(lead)


@router.post("/leads/{lead_id}/notes")
def add_lead_note(
    lead_id: str, data: s.NoteIn,
    ctx: BizContext = Depends(require_perm("leads.manage")),
    db: Session = Depends(get_db),
):
    lead = db.query(m.Lead).filter_by(id=lead_id, business_id=ctx.business.id).first()
    if not lead:
        raise errors.not_found("Lead not found")
    lead.notes = f"{lead.notes}\n{data.note}" if lead.notes else data.note
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="added note",
                   detail=f"{lead.full_name} — {data.note[:120]}", kind="note")
    db.commit()
    return {"ok": True}


@router.post("/leads/{lead_id}/convert", status_code=201)
def convert_lead(
    lead_id: str, data: s.LeadConvertIn,
    ctx: BizContext = Depends(require_perm("leads.convert")),
    db: Session = Depends(get_db),
):
    return w.convert_lead(db, ctx.business.id, ctx.user.full_name, ctx.user.id, lead_id, data)
