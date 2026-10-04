"""
models.py — SQLAlchemy ORM Models cho Creative Research Workbench

Nguồn chân lý: docs/DOMAIN_SCHEMA.md
Mọi thay đổi entity phải được cập nhật đồng bộ với DOMAIN_SCHEMA.md trước.

Relationships:
  ResearchSession 1─1 ProblemFrame
  ProblemFrame    1─1 Contradiction
  Document        1─1 Chunk
"""
from __future__ import annotations

import enum
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.sql import func


# ──────────────────────────────────────────────
# Base
# ──────────────────────────────────────────────

class Base(DeclarativeBase):
    """Shared declarative base — import này trong conftest.py."""
    pass


# ──────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────

class DocumentStatus(str, enum.Enum):
    canonical = "canonical"
    draft = "draft"
    deprecated = "deprecated"


class SessionStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    completed = "completed"
    archived = "archived"


class ContradictionType(str, enum.Enum):
    technical = "technical"
    physical = "physical"
    none = "none"
    unknown = "unknown"


class JobStatus(str, enum.Enum):
    pending = "pending"
    running = "running"
    completed = "completed"
    failed = "failed"


class JobType(str, enum.Enum):
    document_ingestion = "document_ingestion"
    reembed_knowledge_base = "reembed_knowledge_base"


# ──────────────────────────────────────────────
# Document — Golden Knowledge Base
# ──────────────────────────────────────────────

class Document(Base):
    """
    Đại diện cho 1 file markdown đã được ingest vào hệ thống.
    Frontmatter của file được map 1:1 vào các cột bên dưới.
    
    Constraint:
      - content_hash UNIQUE: chống duplicate ingest
    """
    __tablename__ = "documents"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    filepath: Mapped[str] = mapped_column(String(1024), nullable=False)
    title: Mapped[str] = mapped_column(String(512), nullable=False, default="")

    # --- Frontmatter fields (phải match YAML frontmatter trong /docs) ---
    topic: Mapped[str | None] = mapped_column(String(128), nullable=True)
    source_type: Mapped[str | None] = mapped_column(String(128), nullable=True)
    language: Mapped[str | None] = mapped_column(String(16), nullable=True, default="vi")
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String), nullable=True)
    phase: Mapped[str | None] = mapped_column(String(16), nullable=True)
    status: Mapped[DocumentStatus] = mapped_column(
        Enum(DocumentStatus), nullable=False, default=DocumentStatus.draft
    )
    golden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # --- Dedup ---
    content_hash: Mapped[str] = mapped_column(String(64), nullable=False)

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --- Relationships ---
    chunks: Mapped[list[Chunk]] = relationship(
        "Chunk", back_populates="document", cascade="all, delete-orphan"
    )

    __table_args__ = (
        UniqueConstraint("content_hash", name="uq_documents_content_hash"),
        Index("ix_documents_topic", "topic"),
        Index("ix_documents_golden", "golden"),
        Index("ix_documents_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<Document id={self.id} title='{self.title}' golden={self.golden}>"


# ──────────────────────────────────────────────
# Chunk — Unit cơ bản của Retrieval
# ──────────────────────────────────────────────

class Chunk(Base):
    """
    1 đoạn văn bản (512 tokens, overlap 50) của 1 Document.
    embedding: vector(1536) — sẽ được index IVFFlat cosine sau khi ingest đủ dữ liệu.
    """
    __tablename__ = "chunks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    document_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("documents.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    token_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # pgvector: 1536 dim = OpenAI text-embedding-3-small
    embedding: Mapped[list[float] | None] = mapped_column(
        Vector(1536), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # --- Relationships ---
    document: Mapped[Document] = relationship("Document", back_populates="chunks")

    __table_args__ = (
        Index("ix_chunks_document_id", "document_id"),
        Index("ix_chunks_chunk_index", "document_id", "chunk_index"),
        # IVFFlat cosine index — tạo AFTER ingest đủ dữ liệu (min ~1000 rows).
        # Không tạo trong metadata.create_all — sẽ tạo qua Alembic migration riêng.
    )

    def __repr__(self) -> str:
        return f"<Chunk id={self.id} doc={self.document_id} idx={self.chunk_index} tokens={self.token_count}>"


# ──────────────────────────────────────────────
# ResearchSession — Phà Nghên Cứu
# ──────────────────────────────────────────────

class ResearchSession(Base):
    """
    Phà nghiên cứu của người dùng.
    workflow_state: FSM state string, ví dụ: 'problem_framing', 'searching', 'synthesizing'.
    """
    __tablename__ = "research_sessions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus), nullable=False, default=SessionStatus.active
    )
    workflow_state: Mapped[str] = mapped_column(
        String(64), nullable=False, default="idle"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --- Relationships ---
    problem_frames: Mapped[list[ProblemFrame]] = relationship(
        "ProblemFrame", back_populates="session", cascade="all, delete-orphan"
    )
    research_notes: Mapped[list[ResearchNote]] = relationship(
        "ResearchNote", back_populates="session", cascade="all, delete-orphan"
    )
    candidate_solutions: Mapped[list[CandidateSolution]] = relationship(
        "CandidateSolution", back_populates="session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_sessions_status", "status"),
    )

    def __repr__(self) -> str:
        return f"<ResearchSession id={self.id} title='{self.title}' status={self.status}>"


# ──────────────────────────────────────────────
# ProblemFrame — TRIZ Problem Framing
# ──────────────────────────────────────────────

class ProblemFrame(Base):
    """
    Định khung bài toán theo TRIZ.
    improving_parameter / worsening_parameter: tên thông số TRIZ (ví dụ: 'speed', 'reliability').
    """
    __tablename__ = "problem_frames"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    raw_statement: Mapped[str] = mapped_column(Text, nullable=False)
    normalized_statement: Mapped[str | None] = mapped_column(Text, nullable=True)
    domain: Mapped[str | None] = mapped_column(String(256), nullable=True)
    contradiction_type: Mapped[ContradictionType] = mapped_column(
        Enum(ContradictionType), nullable=False, default=ContradictionType.unknown
    )
    improving_parameter: Mapped[str | None] = mapped_column(String(256), nullable=True)
    worsening_parameter: Mapped[str | None] = mapped_column(String(256), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # --- Relationships ---
    session: Mapped[ResearchSession] = relationship(
        "ResearchSession", back_populates="problem_frames"
    )
    contradictions: Mapped[list[Contradiction]] = relationship(
        "Contradiction", back_populates="problem_frame", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("ix_problem_frames_session_id", "session_id"),
    )

    def __repr__(self) -> str:
        return f"<ProblemFrame id={self.id} type={self.contradiction_type}>"


# ──────────────────────────────────────────────
# Contradiction — TRIZ Contradiction
# ──────────────────────────────────────────────

class Contradiction(Base):
    """
    Mâu thuẫn được trích xuất từ ProblemFrame.
    suggested_principles: danh sách số nguyên tắc TRIZ (1-40).
    """
    __tablename__ = "contradictions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    problem_frame_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("problem_frames.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[ContradictionType] = mapped_column(
        Enum(ContradictionType), nullable=False
    )
    statement: Mapped[str] = mapped_column(Text, nullable=False)
    suggested_principles: Mapped[list[int] | None] = mapped_column(
        ARRAY(Integer), nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # --- Relationships ---
    problem_frame: Mapped[ProblemFrame] = relationship(
        "ProblemFrame", back_populates="contradictions"
    )

    __table_args__ = (
        Index("ix_contradictions_problem_frame_id", "problem_frame_id"),
    )

    def __repr__(self) -> str:
        return f"<Contradiction id={self.id} type={self.type}>"


# ──────────────────────────────────────────────
# ResearchNote — Sổ tay ghi chép nghiên cứu (Phase 7.2)
# ──────────────────────────────────────────────

class ResearchNote(Base):
    """
    Ghi chú, giả thuyết, phát hiện hoặc quyết định trong phiên nghiên cứu.
    Ref: docs/PHASE_6_7_EXECUTION_SPEC.md (Phase 7.2)
    """
    __tablename__ = "research_notes"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    note_type: Mapped[str] = mapped_column(
        String(32), nullable=False, default="insight"
    )
    source_chunk_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("chunks.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --- Relationships ---
    session: Mapped[ResearchSession] = relationship(
        "ResearchSession", back_populates="research_notes"
    )
    source_chunk: Mapped[Chunk | None] = relationship("Chunk")

    __table_args__ = (
        Index("ix_research_notes_session_id", "session_id"),
        Index("ix_research_notes_note_type", "note_type"),
    )

    def __repr__(self) -> str:
        return f"<ResearchNote id={self.id} type={self.note_type} session={self.session_id}>"


# ──────────────────────────────────────────────
# CandidateSolution — Giải pháp ứng viên (Phase 7.4)
# ──────────────────────────────────────────────

class CandidateSolution(Base):
    """
    Giải pháp sáng tạo ứng viên được đề xuất trong phiên nghiên cứu.
    Ref: docs/PHASE_6_7_EXECUTION_SPEC.md (Phase 7.4)
    """
    __tablename__ = "candidate_solutions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("research_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    mechanism: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="candidate"
    )
    novelty_score: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=0.0
    )
    feasibility_score: Mapped[float | None] = mapped_column(
        Float, nullable=True, default=0.0
    )
    risk_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --- Relationships ---
    session: Mapped[ResearchSession] = relationship(
        "ResearchSession", back_populates="candidate_solutions"
    )

    __table_args__ = (
        Index("ix_candidate_solutions_session_id", "session_id"),
    )

    def __repr__(self) -> str:
        return f"<CandidateSolution id={self.id} title='{self.title[:30]}' status={self.status}>"


# ──────────────────────────────────────────────
# BackgroundJob — Tác vụ Nền Bất đồng bộ (Phase 12.2)
# ──────────────────────────────────────────────

class BackgroundJob(Base):
    """
    Đại diện cho 1 tác vụ xử lý nền bất đồng bộ (Phase 12.2).
    Ref: docs/ADR-004-async-background-processing.md & docs/PHASE_12_2_ASYNC_PROCESSING_SPEC.md
    """
    __tablename__ = "background_jobs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    job_type: Mapped[JobType] = mapped_column(
        Enum(JobType), nullable=False
    )
    status: Mapped[JobStatus] = mapped_column(
        Enum(JobStatus), nullable=False, default=JobStatus.pending
    )
    progress_percentage: Mapped[float] = mapped_column(
        Float, nullable=False, default=0.0
    )
    error_message: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    result_summary: Mapped[dict[str, Any] | None] = mapped_column(
        JSON, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    finished_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_background_jobs_status", "status"),
        Index("ix_background_jobs_created_at", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<BackgroundJob id={self.id} type={self.job_type} status={self.status}>"


# ──────────────────────────────────────────────
# Value Objects — dùng bởi Services (không map DB)
# ──────────────────────────────────────────────

@dataclass
class IngestResult:
    """
    Kết quả trả về bởi IngestionService.ingest().
    
    status values:
      'success'       — ingest thành công, tạo mới
      'already_exists' — file đã tồn tại (trùng content_hash), skip
      'error'          — lỗi trong quá trình ingest
    """
    status: str
    document_id: uuid.UUID | None = None
    chunks_created: int = 0
    embeddings_created: int = 0
    error_message: str | None = None

    @classmethod
    def already_exists(cls, document_id: uuid.UUID) -> "IngestResult":
        return cls(status="already_exists", document_id=document_id)

    @classmethod
    def error(cls, message: str) -> "IngestResult":
        return cls(status="error", error_message=message)


@dataclass
class SearchResult:
    """
    1 kết quả tìm kiếm từ RetrievalService.search().
    
    score: cosine similarity [0.0, 1.0] (hoặc RRF fused score)
    source_ref: đường dẫn file tương đối, ví dụ: 'docs/ADR-001-architecture.md'
    excerpt: đoạn text ngắn nhất có relevance, tối đa 500 ký tự
    metadata: các field từ Document (topic, source_type, golden, phase, ...)
    """
    chunk_id: uuid.UUID
    source_ref: str
    excerpt: str
    score: float
    metadata: dict[str, Any] = field(default_factory=dict)
    document_id: uuid.UUID | None = None
    chunk_index: int = 0
