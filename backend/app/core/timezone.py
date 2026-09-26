"""Business-timezone helpers. All timestamps stored as UTC; ranges computed in business tz."""

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import get_settings


def business_tz(name: str | None = None) -> ZoneInfo:
    tz = name or get_settings().BUSINESS_TIMEZONE_DEFAULT
    try:
        return ZoneInfo(tz)
    except Exception:
        return ZoneInfo("Asia/Kolkata")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def ensure_aware(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


RANGE_ALIASES = {
    "today", "yesterday", "this-week", "last-week", "this-month", "last-month",
    "this-quarter", "last-quarter", "last-7", "last-30", "last-90", "custom",
}


def resolve_range(
    preset: str, tz: ZoneInfo, custom_from: str | None = None, custom_to: str | None = None
) -> tuple[datetime, datetime]:
    now_local = datetime.now(tz)
    midnight = now_local.replace(hour=0, minute=0, second=0, microsecond=0)
    if preset == "today":
        start, end = midnight, midnight + timedelta(days=1)
    elif preset == "yesterday":
        start, end = midnight - timedelta(days=1), midnight
    elif preset == "this-week":
        start = midnight - timedelta(days=midnight.weekday())
        end = midnight + timedelta(days=1)
    elif preset == "last-week":
        start = midnight - timedelta(days=midnight.weekday() + 7)
        end = start + timedelta(days=7)
    elif preset == "this-month":
        start = midnight.replace(day=1)
        end = midnight + timedelta(days=1)
    elif preset == "last-month":
        first = midnight.replace(day=1)
        end = first
        start = (first - timedelta(days=1)).replace(day=1)
    elif preset == "this-quarter":
        q = (midnight.month - 1) // 3 * 3 + 1
        start = midnight.replace(month=q, day=1)
        end = midnight + timedelta(days=1)
    elif preset == "last-quarter":
        q = (midnight.month - 1) // 3 * 3 + 1
        cur_q_start = midnight.replace(month=q, day=1)
        end = cur_q_start
        prev_end = cur_q_start - timedelta(days=1)
        pq = (prev_end.month - 1) // 3 * 3 + 1
        start = prev_end.replace(month=pq, day=1)
    elif preset == "last-7":
        start, end = midnight - timedelta(days=6), midnight + timedelta(days=1)
    elif preset == "last-90":
        start, end = midnight - timedelta(days=89), midnight + timedelta(days=1)
    elif preset == "custom" and custom_from and custom_to:
        s = datetime.fromisoformat(custom_from)
        e = datetime.fromisoformat(custom_to)
        if s.tzinfo is None:
            s = s.replace(tzinfo=tz)
        if e.tzinfo is None:
            e = e.replace(tzinfo=tz)
        start, end = s, e + timedelta(days=1) if e.hour == 0 and e.minute == 0 else (s, e)
    else:  # last-30 default
        start, end = midnight - timedelta(days=29), midnight + timedelta(days=1)
    return start.astimezone(timezone.utc), end.astimezone(timezone.utc)
