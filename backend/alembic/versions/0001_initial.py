"""Initial schema: full Nest Staff API tables with tenant indexes.

Revision ID: 0001_initial
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Single source of truth is app.models metadata (keeps migration + models
    # in sync across SQLite and PostgreSQL). checkfirst makes fresh and
    # existing databases converge safely.
    from app.core.db import Base
    from app.models import models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    for table in (
        "audit_logs", "automation_runs", "whatsapp_messages", "whatsapp_settings",
        "membership_plans", "business_settings", "activities", "notifications", "tasks",
        "bookings", "leads", "payments", "renewals", "memberships", "customers",
        "refresh_tokens", "user_businesses", "users", "businesses",
    ):
        op.drop_table(table)
