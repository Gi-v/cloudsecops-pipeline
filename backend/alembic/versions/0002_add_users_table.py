"""add users table

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-19

Adds the `users` table backing JWT-based human login (app/core/security.py),
which coexists with the pre-existing X-API-Key service-account gate rather
than replacing it. Hand-written to mirror app/db/models.py, matching the
convention set by 0001_initial_schema.py.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

user_role_enum = postgresql.ENUM("viewer", "admin", name="userrole")


def upgrade() -> None:
    bind = op.get_bind()
    user_role_enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("username", sa.String(64), nullable=False, unique=True),
        sa.Column("email", sa.String(256), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(256), nullable=False),
        sa.Column("role", user_role_enum, nullable=False, server_default="viewer"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.true()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_users_username", "users", ["username"])


def downgrade() -> None:
    op.drop_table("users")

    bind = op.get_bind()
    user_role_enum.drop(bind, checkfirst=True)
