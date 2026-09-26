"""Shared business helpers: audit log, notifications, activity, realtime events."""

import asyncio
import json
from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from app.models import models as m

_subscribers: dict[str, set["asyncio.Queue"]] = defaultdict(set)


def audit(
    db: Session,
    *,
    action: str,
    user_id: str | None = None,
    business_id: str | None = None,
    resource: str | None = None,
    resource_id: str | None = None,
    meta: dict | None = None,
) -> None:
    db.add(
        m.AuditLog(
            business_id=business_id,
            user_id=user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            meta=json.dumps(meta or {}),
        )
    )


def notify(
    db: Session,
    business_id: str,
    *,
    title: str,
    body: str = "",
    kind: str = "system",
    link: str | None = None,
    customer_id: str | None = None,
) -> m.Notification:
    row = m.Notification(
        business_id=business_id, title=title, body=body, kind=kind, link=link,
        customer_id=customer_id,
    )
    db.add(row)
    db.flush()
    publish(business_id, {"type": "notification", "id": row.id, "title": title, "kind": kind})
    return row


def log_activity(
    db: Session,
    business_id: str,
    *,
    actor: str,
    action: str,
    detail: str | None = None,
    kind: str = "system",
    customer_id: str | None = None,
) -> m.Activity:
    row = m.Activity(
        business_id=business_id, actor=actor, action=action, detail=detail,
        kind=kind, customer_id=customer_id,
    )
    db.add(row)
    db.flush()
    return row


def publish(business_id: str, event: dict) -> None:
    event = {"business_id": business_id, **event}
    for q in list(_subscribers.get(business_id, ())):
        try:
            q.put_nowait(event)
        except asyncio.QueueFull:
            pass


def subscribe(business_id: str) -> "asyncio.Queue":
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers[business_id].add(q)
    return q


def unsubscribe(business_id: str, q: "asyncio.Queue") -> None:
    _subscribers[business_id].discard(q)


def today_str() -> str:
    return datetime.now().strftime("%Y-%m-%d")
