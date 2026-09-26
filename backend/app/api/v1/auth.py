"""Authentication: login / logout / me / refresh with HttpOnly cookies + rate limiting."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core import errors
from app.core.config import get_settings
from app.core.db import get_db
from app.core.deps import (
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    CurrentUser,
    get_current_user,
    login_allowed,
    login_hit,
    login_reset,
)
from app.core.permissions import PERMISSIONS, can
from app.core.security import (
    create_access_token,
    create_refresh_token,
    verify_password,
)
from app.models import models as m
from app.schemas import schemas as s
from app.services import helpers as h

router = APIRouter(tags=["auth"])

ROLE_PERM_CACHE: dict[str, list[str]] = {
    role: sorted(a for a, roles in PERMISSIONS.items() if role in roles)
    for role in ("owner", "admin", "staff")
}


def _set_cookies(resp: Response, access: str, refresh: str) -> None:
    cfg = get_settings()
    secure = cfg.COOKIE_SECURE
    samesite = cfg.COOKIE_SAMESITE
    resp.set_cookie(ACCESS_COOKIE, access, httponly=True, secure=secure, samesite=samesite,
                    path="/", max_age=cfg.ACCESS_TOKEN_MINUTES * 60)
    resp.set_cookie(REFRESH_COOKIE, refresh, httponly=True, secure=secure, samesite=samesite,
                    path="/api/v1/auth", max_age=cfg.REFRESH_TOKEN_DAYS * 86400)


def _clear_cookies(resp: Response) -> None:
    resp.delete_cookie(ACCESS_COOKIE, path="/")
    resp.delete_cookie(REFRESH_COOKIE, path="/api/v1/auth")


def _me_payload(current: CurrentUser, db: Session) -> s.MeOut:
    businesses: list[s.BizOut] = []
    perms: set[str] = set()
    for ms in current.memberships:
        biz = db.get(m.Business, ms.business_id)
        if not biz:
            continue
        businesses.append(s.BizOut(business_id=biz.id, name=biz.name, role=ms.role,
                                   timezone=biz.timezone))
        perms.update(ROLE_PERM_CACHE.get(ms.role, []))
    return s.MeOut(user_id=current.user.id, full_name=current.user.full_name,
                   email=current.user.email, businesses=businesses,
                   permissions=sorted(perms))


@router.post("/login")
def login(data: s.LoginIn, request: Request, resp: Response, db: Session = Depends(get_db)):
    key = f"{request.client.host if request.client else 'unknown'}|{data.email.lower()}"
    if not login_allowed(key):
        raise errors.rate_limited()
    user = db.query(m.User).filter(m.User.email == data.email.lower().strip()).first()
    if not user or not verify_password(data.password, user.password_hash):
        login_hit(key)
        raise errors.unauthorized("Invalid email or password")
    if not user.is_active:
        raise errors.forbidden("Account is disabled")
    login_reset(key)
    access = create_access_token(user.id)
    refresh, jti = create_refresh_token(user.id)
    db.add(m.RefreshToken(
        jti=jti, user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(
            days=get_settings().REFRESH_TOKEN_DAYS)))
    h.audit(db, action="auth.login", user_id=user.id)
    db.commit()
    _set_cookies(resp, access, refresh)
    memberships = db.query(m.Membership2Business).filter_by(
        user_id=user.id, status="active").all()
    return {"access_token": access, "token_type": "bearer",
            "user": _me_payload(CurrentUser(user=user, memberships=memberships), db)}


@router.post("/logout")
def logout(resp: Response, refresh: str | None = None,
           current: CurrentUser = Depends(get_current_user),
           db: Session = Depends(get_db),
           request: Request = None):  # type: ignore[assignment]
    from fastapi import Cookie as _Cookie  # local import to keep signature simple
    _clear_cookies(resp)
    h.audit(db, action="auth.logout", user_id=current.user.id)
    db.commit()
    return {"ok": True}


@router.post("/refresh")
def refresh(request: Request, resp: Response, db: Session = Depends(get_db)):
    import jwt as _jwt

    token = request.cookies.get(REFRESH_COOKIE)
    if not token:
        raise errors.unauthorized("No refresh session")
    try:
        from app.core.security import decode_token

        payload = decode_token(token)
    except _jwt.ExpiredSignatureError:
        raise errors.ApiError("session_expired", "Session expired. Please log in again.", 401)
    except _jwt.InvalidTokenError:
        raise errors.unauthorized("Invalid session")
    if payload.get("typ") != "refresh":
        raise errors.unauthorized("Invalid session")
    row = db.get(m.RefreshToken, payload.get("jti"))
    if not row or row.revoked or row.expires_at.replace(tzinfo=timezone.utc) < datetime.now(
        timezone.utc
    ):
        raise errors.unauthorized("Session expired")
    user = db.get(m.User, payload.get("sub"))
    if not user or not user.is_active:
        raise errors.unauthorized("Account is disabled")
    # rotate
    row.revoked = True
    access = create_access_token(user.id)
    new_refresh, jti = create_refresh_token(user.id)
    db.add(m.RefreshToken(
        jti=jti, user_id=user.id,
        expires_at=datetime.now(timezone.utc) + timedelta(
            days=get_settings().REFRESH_TOKEN_DAYS)))
    db.commit()
    _set_cookies(resp, access, new_refresh)
    return {"access_token": access, "token_type": "bearer"}


@router.get("/me", response_model=s.MeOut)
def me(current: CurrentUser = Depends(get_current_user), db: Session = Depends(get_db)):
    return _me_payload(current, db)
