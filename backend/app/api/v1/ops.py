"""Tasks, notifications, activities."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core import errors
from app.core.db import get_db
from app.core.deps import BizContext, require_perm
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h

router = APIRouter(tags=["ops"])


def _task_out(t: m.Task) -> s.TaskOut:
    return s.TaskOut(
        task_id=t.id, business_id=t.business_id, title=t.title, assigned_to=t.assigned_to,
        customer_id=t.customer_id, lead_id=t.lead_id, priority=t.priority, status=t.status,
        due_at=t.due_at, notes=t.notes, created_at=t.created_at, completed_at=t.completed_at)


@router.get("/tasks", response_model=s.Page[s.TaskOut])
def list_tasks(
    page: int = Query(1, ge=1), page_size: int = Query(50, ge=1, le=100),
    q: str | None = None, status: str | None = None, mine: str | None = None,
    ctx: BizContext = Depends(require_perm("tasks.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Task).filter_by(business_id=ctx.business.id)
    if status:
        query = query.filter_by(status=status)
    if mine:
        query = query.filter(m.Task.assigned_to == ctx.user.full_name)
    query = query.order_by(m.Task.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    items = [_task_out(t) for t in rows]
    if q:
        ql = q.strip().lower()
        items = [t for t in items if ql in t.title.lower()]
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.post("/tasks", response_model=s.TaskOut, status_code=201)
def create_task(
    data: s.TaskIn,
    ctx: BizContext = Depends(require_perm("tasks.manage")),
    db: Session = Depends(get_db),
):
    t = m.Task(business_id=ctx.business.id, title=data.title.strip(),
               assigned_to=data.assigned_to, customer_id=data.customer_id, lead_id=data.lead_id,
               priority=data.priority, status="open", due_at=data.due_at, notes=data.notes)
    db.add(t)
    db.flush()
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="created task",
                   detail=t.title, kind="task")
    db.commit()
    h.publish(ctx.business.id, {"type": "task", "task_id": t.id})
    return _task_out(t)


@router.patch("/tasks/{task_id}", response_model=s.TaskOut)
def update_task(
    task_id: str, data: s.TaskPatch,
    ctx: BizContext = Depends(require_perm("tasks.manage")),
    db: Session = Depends(get_db),
):
    t = db.query(m.Task).filter_by(id=task_id, business_id=ctx.business.id).first()
    if not t:
        raise errors.not_found("Task not found")
    for field in ("title", "assigned_to", "customer_id", "lead_id", "priority", "due_at", "notes"):
        val = getattr(data, field)
        if val is not None:
            setattr(t, field, val)
    if data.status:
        if data.status not in ("todo", "open", "in-progress", "waiting", "done",
                               "completed", "archived"):
            raise errors.unprocessable(f"Unknown status: {data.status}")
        t.status = data.status
        if data.status in ("done", "completed"):
            t.completed_at = datetime.now(timezone.utc)
    h.log_activity(db, ctx.business.id, actor=ctx.user.full_name, action="updated task",
                   detail=t.title, kind="task")
    db.commit()
    h.publish(ctx.business.id, {"type": "task_updated", "task_id": t.id})
    return _task_out(t)


# ---------- notifications ----------


@router.get("/notifications", response_model=s.Page[s.NotificationOut])
def list_notifications(
    page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
    unread: bool = False,
    ctx: BizContext = Depends(require_perm("notifications.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Notification).filter_by(business_id=ctx.business.id, dismissed=False)
    if unread:
        query = query.filter_by(read=False)
    query = query.order_by(m.Notification.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [s.NotificationOut(
        notification_id=n.id, business_id=n.business_id, title=n.title, body=n.body or "",
        kind=n.kind, link=n.link, customer_id=n.customer_id, read=n.read,
        created_at=n.created_at) for n in rows],
        "total": total, "page": page, "page_size": page_size}


@router.get("/notifications/unread-count")
def unread_count(
    ctx: BizContext = Depends(require_perm("notifications.view")),
    db: Session = Depends(get_db),
):
    n = db.query(m.Notification).filter_by(
        business_id=ctx.business.id, read=False, dismissed=False).count()
    return {"unread": n}


@router.patch("/notifications/{nid}/read")
def mark_read(
    nid: str,
    ctx: BizContext = Depends(require_perm("notifications.manage")),
    db: Session = Depends(get_db),
):
    n = db.query(m.Notification).filter_by(id=nid, business_id=ctx.business.id).first()
    if not n:
        raise errors.not_found("Notification not found")
    n.read = True
    db.commit()
    return {"ok": True}


@router.post("/notifications/read-all")
def mark_all_read(
    ctx: BizContext = Depends(require_perm("notifications.manage")),
    db: Session = Depends(get_db),
):
    db.query(m.Notification).filter_by(business_id=ctx.business.id, read=False).update({"read": True})
    db.commit()
    return {"ok": True}


@router.delete("/notifications/{nid}")
def dismiss(
    nid: str,
    ctx: BizContext = Depends(require_perm("notifications.manage")),
    db: Session = Depends(get_db),
):
    n = db.query(m.Notification).filter_by(id=nid, business_id=ctx.business.id).first()
    if not n:
        raise errors.not_found("Notification not found")
    n.dismissed = True
    db.commit()
    return {"ok": True}


# ---------- activities ----------


@router.get("/activities", response_model=s.Page[s.ActivityOut])
def list_activities(
    page: int = Query(1, ge=1), page_size: int = Query(30, ge=1, le=100),
    customer_id: str | None = None,
    ctx: BizContext = Depends(require_perm("dashboard.view")),
    db: Session = Depends(get_db),
):
    query = db.query(m.Activity).filter_by(business_id=ctx.business.id)
    if customer_id:
        # verify the customer belongs to this business (IDOR guard)
        c = db.query(m.Customer).filter_by(id=customer_id, business_id=ctx.business.id).first()
        if not c:
            raise errors.not_found("Customer not found")
        query = query.filter_by(customer_id=customer_id)
    query = query.order_by(m.Activity.created_at.desc())
    total = query.count()
    rows = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [s.ActivityOut(
        activity_id=a.id, business_id=a.business_id, actor=a.actor, action=a.action,
        detail=a.detail, kind=a.kind, customer_id=a.customer_id,
        created_at=a.created_at) for a in rows],
        "total": total, "page": page, "page_size": page_size}
