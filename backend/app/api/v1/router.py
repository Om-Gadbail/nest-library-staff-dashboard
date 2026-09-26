from fastapi import APIRouter

from app.api.v1 import admin, analytics, auth, billing, bookings, customers, leads, ops

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(auth.router, prefix="/auth")
api_router.include_router(customers.router)
api_router.include_router(leads.router)
api_router.include_router(billing.router)
api_router.include_router(bookings.router)
api_router.include_router(ops.router)
api_router.include_router(analytics.router)
api_router.include_router(admin.router)


@api_router.get("/health", tags=["health"])
def health():
    return {"ok": True}
