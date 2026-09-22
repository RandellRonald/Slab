"""initial postgresql schema

Revision ID: 20260922_0001
Revises:
Create Date: 2026-09-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "20260922_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "slab_records",
        sa.Column("internal_id", sa.String(length=36), primary_key=True),
        sa.Column("record_id", sa.String(length=36), nullable=False),
        sa.Column("table_name", sa.String(length=80), nullable=False),
        sa.Column("data", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default=sa.text("'{}'::jsonb")),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("table_name", "record_id", name="uq_slab_record"),
    )
    op.create_index("ix_slab_records_record_id", "slab_records", ["record_id"])
    op.create_index("ix_slab_records_table_name", "slab_records", ["table_name"])


def downgrade() -> None:
    op.drop_index("ix_slab_records_table_name", table_name="slab_records")
    op.drop_index("ix_slab_records_record_id", table_name="slab_records")
    op.drop_table("slab_records")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
