"""Auth / RBAC / tenant dependencies. Never trust client-supplied business context."""

import time
from dataclasses import dataclass

import jwt
from fastapi import Cookie, Depends, Header, Request
from sqlalchemy.orm import Session

from app.core import errors
from app.core.db import get_db
from app.core.permissions import can
from app.core.security import decode_token
from app.models import models as m

ACCESS_COOKIE = "nest_at"
REFRESH_COOKIE = "nest_rt"

# login brute-force protection: (ip|email) -> [timestamps]
_attempts: dict[str, list[float]] = {}


def login_allowed(key: str, limit: int = 5, window_s: int = 300) -> bool:
    now = time.time()
    hits = [t for t in _attempts.get(key, []) if now - t < window_s]
    _attempts[key] = hits
    return len(hits) < limit


def login_hit(key: str) -> None:
    _attempts.setdefault(key, []).append(time.time())


def login_reset(key: str) -> None:
    _attempts.pop(key, None)


@dataclass
class CurrentUser:
    user: m.User
    memberships: list[m.Membership2Business]


def _token_from(request: Request, cookie_token: str | None, auth_header: str | None) -> str | None:
    if cookie_token:
        return cookie_token
    if auth_header and auth_header.lower().startswith("bearer "):
        return auth_header[7:]
    return None


def get_current_user(
    request: Request,
    db: Session = Depends(get_db),
    nest_at: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> CurrentUser:
    token = _token_from(request, nest_at, authorization)
    if not token:
        raise errors.unauthorized("Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise errors.ApiError("session_expired", "Session expired. Please log in again.", 401)
    except jwt.InvalidTokenError:
        raise errors.unauthorized("Invalid session")
    if payload.get("typ") != "access":
        raise errors.unauthorized("Invalid session")
    user = db.get(m.User, payload.get("sub"))
    if not user or not user.is_active:
        raise errors.unauthorized("Account is disabled")
    memberships = (
        db.query(m.Membership2Business)
        .filter_by(user_id=user.id, status="active")
        .all()
    )
    return CurrentUser(user=user, memberships=memberships)


@dataclass
class BizContext:
    business: m.Business
    role: str
    user: m.User


def get_biz_context(
    business_id: str | None = None,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
    x_business_id: str | None = Header(default=None),
) -> BizContext:
    """Business context is derived server-side from the user's memberships.

    The client may suggest a business_id (query/header), but it is only a
    selector among businesses the user belongs to — never a grant.
    """
    requested = business_id or x_business_id
    allowed = {ms.business_id: ms.role for ms in current.memberships}
    if not allowed:
        raise errors.forbidden("No business access")
    chosen = requested if requested in allowed else None
    if chosen is None:
        # default to first membership; if an explicit unknown id was requested, deny
        if requested is not None:
            raise errors.forbidden("No access to this business")
        chosen = next(iter(allowed))
    business = db.get(m.Business, chosen)
    if not business:
        raise errors.not_found("Business not found")
    return BizContext(business=business, role=allowed[chosen], user=current.user)


def require_perm(action: str):
    def dep(ctx: BizContext = Depends(get_biz_context)) -> BizContext:
        if not can(ctx.role, action):
            raise errors.forbidden(f"Requires permission: {action}")
        return ctx

    return dep
