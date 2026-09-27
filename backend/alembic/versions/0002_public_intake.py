"""Public website intake: idempotency_keys table for exactly-once submissions.

Revision ID: 0002_public_intake
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_public_intake"
down_revision = "0001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Same converge-safe pattern as 0001: metadata is the source of truth.
    from app.core.db import Base
    from app.models import models  # noqa: F401

    bind = op.get_bind()
    Base.metadata.create_all(bind=bind, checkfirst=True)


def downgrade() -> None:
    op.drop_table("idempotency_keys")
