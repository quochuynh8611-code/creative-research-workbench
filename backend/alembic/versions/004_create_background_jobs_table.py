"""004_create_background_jobs_table — Tạo bảng background_jobs cho xử lý tác vụ nền bất đồng bộ (Phase 12.2)

Revision ID: 004
Revises: 003
Create Date: 2026-10-04

Mục tiêu:
  - Tạo bảng background_jobs lưu trữ trạng thái, tiến độ và metadata của các tác vụ nền
  - Sử dụng VARCHAR(50) cho job_type và VARCHAR(20) cho status theo đúng DOMAIN_SCHEMA / PHASE_12_2_SPEC
  - Hỗ trợ downgrade an toàn
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tạo bảng background_jobs
    op.create_table(
        "background_jobs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "job_type",
            sa.String(length=50),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default="pending",
        ),
        sa.Column(
            "progress_percentage",
            sa.Float(),
            nullable=False,
            server_default="0.0",
        ),
        sa.Column(
            "error_message",
            sa.Text(),
            nullable=True,
        ),
        sa.Column(
            "result_summary",
            postgresql.JSON(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "started_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "finished_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
    )
    op.create_index("ix_background_jobs_status", "background_jobs", ["status"])
    op.create_index("ix_background_jobs_created_at", "background_jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_background_jobs_created_at", table_name="background_jobs")
    op.drop_index("ix_background_jobs_status", table_name="background_jobs")
    op.drop_table("background_jobs")
