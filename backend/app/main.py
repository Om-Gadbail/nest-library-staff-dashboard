"""Nest Staff API — clean modular monolith: FastAPI -> services -> PostgreSQL."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.db import Base
from app.core.error_handler import api_exception_handler
from app.core.errors import ApiError

# import models so metadata is registered
from app.models import models  # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables if migrations have not run (dev convenience; prod uses Alembic).
    from app.core.db import engine

    Base.metadata.create_all(bind=engine)
    # Start the renewal scheduler (simple reliable in-process jobs).
    try:
        from apscheduler.schedulers.background import BackgroundScheduler

        from app.core.db import SessionLocal
        from app.models import models as m
        from app.services import scheduler as sched

        def _tick():
            db = SessionLocal()
            try:
                for (biz_id,) in db.query(m.Business.id).all():
                    try:
                        sched.run_renewal_check(db, biz_id)
                    except Exception:
                        db.rollback()
            finally:
                db.close()

        scheduler = BackgroundScheduler()
        scheduler.add_job(_tick, "interval", minutes=15, id="renewal-check")
        scheduler.start()
        app.state.scheduler = scheduler
    except Exception:
        app.state.scheduler = None
    yield
    try:
        if getattr(app.state, "scheduler", None):
            app.state.scheduler.shutdown(wait=False)
    except Exception:
        pass


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Nest Staff API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_exception_handler(ApiError, api_exception_handler)
    app.include_router(api_router)

    @app.get("/health", tags=["health"])
    def health():
        return {"ok": True}

    return app


app = create_app()
