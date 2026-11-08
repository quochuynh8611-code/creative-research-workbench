"""005_add_domain_to_research_sessions — Thêm cột domain nullable vào bảng research_sessions (Backend 1B)

Revision ID: 005
Revises: 004
Create Date: 2026-11-08

Mục tiêu:
  - Thêm cột domain (VARCHAR(256), nullable=True) vào bảng research_sessions
  - Không đặt giá trị mặc định ở tầng cơ sở dữ liệu (no DB default)
  - Không backfill dữ liệu cũ (dữ liệu cũ nhận giá trị NULL)
  - Hỗ trợ hạ cấp an toàn (downgrade an toàn chỉ drop cột domain)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "research_sessions",
        sa.Column("domain", sa.String(length=256), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("research_sessions", "domain")
