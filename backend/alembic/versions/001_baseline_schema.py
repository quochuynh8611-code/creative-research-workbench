"""001_baseline_schema — Snapshot 5 bảng cốt lõi hiện có của hệ thống

Revision ID: 001
Revises:
Create Date: 2026-09-30

Bảng bao gồm:
  1. documents
  2. chunks
  3. research_sessions
  4. problem_frames
  5. contradictions
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 0. Ensure vector extension
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # 1. documents
    op.create_table(
        "documents",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("filepath", sa.String(length=1024), nullable=False),
        sa.Column("title", sa.String(length=512), nullable=False, server_default=""),
        sa.Column("topic", sa.String(length=128), nullable=True),
        sa.Column("source_type", sa.String(length=128), nullable=True),
        sa.Column("language", sa.String(length=16), nullable=True, server_default="vi"),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column("phase", sa.String(length=16), nullable=True),
        sa.Column(
            "status",
            sa.Enum("canonical", "draft", "deprecated", name="documentstatus"),
            nullable=False,
            server_default="draft",
        ),
        sa.Column("golden", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("content_hash", name="uq_documents_content_hash"),
    )
    op.create_index("ix_documents_topic", "documents", ["topic"])
    op.create_index("ix_documents_golden", "documents", ["golden"])
    op.create_index("ix_documents_status", "documents", ["status"])

    # 2. chunks
    op.create_table(
        "chunks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("document_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("documents.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("token_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("embedding", Vector(1536), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_chunks_document_id", "chunks", ["document_id"])
    op.create_index("ix_chunks_chunk_index", "chunks", ["document_id", "chunk_index"])

    # 3. research_sessions
    op.create_table(
        "research_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("title", sa.String(length=512), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column(
            "status",
            sa.Enum("active", "paused", "completed", "archived", name="sessionstatus"),
            nullable=False,
            server_default="active",
        ),
        sa.Column("workflow_state", sa.String(length=64), nullable=False, server_default="idle"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_sessions_status", "research_sessions", ["status"])

    # 4. problem_frames
    op.create_table(
        "problem_frames",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("research_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("raw_statement", sa.Text(), nullable=False),
        sa.Column("normalized_statement", sa.Text(), nullable=True),
        sa.Column("domain", sa.String(length=256), nullable=True),
        sa.Column(
            "contradiction_type",
            sa.Enum("technical", "physical", "none", "unknown", name="contradictiontype"),
            nullable=False,
            server_default="unknown",
        ),
        sa.Column("improving_parameter", sa.String(length=256), nullable=True),
        sa.Column("worsening_parameter", sa.String(length=256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_problem_frames_session_id", "problem_frames", ["session_id"])

    # 5. contradictions
    op.create_table(
        "contradictions",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("problem_frame_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("problem_frames.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "type",
            sa.Enum("technical", "physical", "none", "unknown", name="contradictiontype", create_type=False),
            nullable=False,
        ),
        sa.Column("statement", sa.Text(), nullable=False),
        sa.Column("suggested_principles", postgresql.ARRAY(sa.Integer()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_contradictions_problem_frame_id", "contradictions", ["problem_frame_id"])


def downgrade() -> None:
    op.drop_table("contradictions")
    op.drop_table("problem_frames")
    op.drop_table("research_sessions")
    op.drop_table("chunks")
    op.drop_table("documents")

    # Drop custom ENUM types in PostgreSQL
    op.execute("DROP TYPE IF EXISTS contradictiontype CASCADE")
    op.execute("DROP TYPE IF EXISTS sessionstatus CASCADE")
    op.execute("DROP TYPE IF EXISTS documentstatus CASCADE")
