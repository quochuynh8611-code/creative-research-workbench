"""006_add_source_context_to_research_notes — Thêm cột source_context nullable vào bảng research_notes (Batch C7c-1)

Revision ID: 006
Revises: 005
Create Date: 2026-11-13

Mục tiêu:
  - Thêm cột source_context (JSONB, nullable=True) vào bảng research_notes
  - Không đặt giá trị mặc định ở tầng cơ sở dữ liệu (no DB default)
  - Không backfill dữ liệu cũ (dữ liệu cũ nhận giá trị NULL)
  - Hỗ trợ hạ cấp an toàn (downgrade an toàn chỉ drop cột source_context)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "006"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "research_notes",
        sa.Column("source_context", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("research_notes", "source_context")
