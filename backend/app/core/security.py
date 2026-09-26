"""Password hashing + JWT session tokens."""

import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import get_settings

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except (ValueError, TypeError):
        return False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(user_id: str) -> str:
    s = get_settings()
    exp = _now() + timedelta(minutes=s.ACCESS_TOKEN_MINUTES)
    return jwt.encode(
        {"sub": user_id, "typ": "access", "exp": exp, "jti": uuid.uuid4().hex},
        s.SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_refresh_token(user_id: str) -> tuple[str, str]:
    """Returns (token, jti) so the jti can be allow-listed server-side."""
    s = get_settings()
    jti = uuid.uuid4().hex
    exp = _now() + timedelta(days=s.REFRESH_TOKEN_DAYS)
    token = jwt.encode(
        {"sub": user_id, "typ": "refresh", "exp": exp, "jti": jti},
        s.SECRET_KEY,
        algorithm=ALGORITHM,
    )
    return token, jti


def decode_token(token: str) -> dict:
    return jwt.decode(token, get_settings().SECRET_KEY, algorithms=[ALGORITHM])
