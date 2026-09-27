"""In-process sliding-window rate limiter for anonymous public endpoints.

Single-process dev/small-deploy guard against abuse/rate spikes on the
website intake surface. Authenticated staff endpoints intentionally do not
use this (they are protected by login + RBAC instead).

Multi-worker note: each process keeps its own counters, so limits are
per-process. For multi-replica production, replace with a shared store
(e.g. Redis) behind the same `check()` signature.
"""

import threading
import time

from app.core import errors

_lock = threading.Lock()
_hits: dict[str, list[float]] = {}


def check(scope: str, limit: int, window_s: int) -> None:
    """Record one hit for `scope`; raise 429 when the budget is exhausted."""
    now = time.monotonic()
    cutoff = now - window_s
    with _lock:
        buf = _hits.get(scope)
        if buf is None:
            buf = []
            _hits[scope] = buf
        # prune expired hits in place
        kept = [t for t in buf if t > cutoff]
        if len(kept) != len(buf):
            buf[:] = kept
        if len(buf) >= limit:
            raise errors.rate_limited("Too many submissions. Please try again later.")
        buf.append(now)


def reset() -> None:
    """Clear all counters. Used by tests for determinism."""
    with _lock:
        _hits.clear()
