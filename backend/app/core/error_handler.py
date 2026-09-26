"""Consistent API error contract."""

from fastapi import Request
from fastapi.responses import JSONResponse


def error(code: str, message: str, status: int, details: object = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": {"code": code, "message": message, "details": details}},
    )


async def api_exception_handler(request: Request, exc: Exception):
    from app.core.errors import ApiError

    if isinstance(exc, ApiError):
        return error(exc.code, exc.message, exc.status, exc.details)
    raise exc
