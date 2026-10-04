"""003_add_vector_cosine_index — Thêm IVFFlat cosine index cho bảng chunks

Revision ID: 003
Revises: 002
Create Date: 2026-10-04

Mục tiêu:
  - Tạo IVFFlat cosine index trên cột chunks.embedding (1536 dim)
  - Sử dụng toán tử vector_cosine_ops với lists = 10
  - Hỗ trợ downgrade không phá hủy dữ liệu (drop index only)
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Đảm bảo extension pgvector sẵn sàng
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Tạo IVFFlat cosine index trên chunks.embedding
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_chunks_embedding_cosine "
        "ON chunks USING ivfflat (embedding vector_cosine_ops) "
        "WITH (lists = 10)"
    )


def downgrade() -> None:
    # Gỡ bỏ index an toàn mà không làm biến đổi cấu trúc bảng hoặc mất mát dữ liệu
    op.execute("DROP INDEX IF EXISTS ix_chunks_embedding_cosine")
