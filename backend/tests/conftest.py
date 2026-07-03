"""
conftest.py — Shared pytest fixtures cho toàn bộ test suite

Strategy:
  - Dùng testcontainers[postgres] để spin up PostgreSQL thật trong Docker.
  - Tạo schema qua Base.metadata.create_all — không dùng Alembic trong tests.
  - Mỗi test nhận 1 db_session riêng biệt, rollback sau khi test xong.
  - LLM/OpenAI được mock hoàn toàn, không có network call thật.

Scope:
  postgres_container : session — spin up 1 lần cho toàn bộ test run
  engine             : session — 1 engine chia sẻ
  tables             : session — create_all chạy 1 lần
  db_session         : function — 1 transaction mới + rollback mỗi test

Ref: FAILING_INTEGRATION_TEST_SPEC.md — Test Harness Assumptions
"""
from __future__ import annotations

import uuid
from collections.abc import AsyncGenerator, Generator
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session, sessionmaker
from testcontainers.postgres import PostgresContainer

from app.domain.models import (
    Base,
    Chunk,
    Contradiction,
    ContradictionType,
    Document,
    DocumentStatus,
    ProblemFrame,
    ResearchSession,
    SessionStatus,
)


# ──────────────────────────────────────────────
# PostgreSQL Container — session scope
# ──────────────────────────────────────────────

@pytest.fixture(scope="session")
def postgres_container():
    """
    Spin up PostgreSQL + pgvector extension.
    Image: ankane/pgvector — bao gồm sẵn pgvector.
    """
    with PostgresContainer(image="ankane/pgvector:latest") as pg:
        yield pg


@pytest.fixture(scope="session")
def sync_engine(postgres_container: PostgresContainer):
    """SQLAlchemy sync engine — dùng cho DDL và tests đồng bộ."""
    url = postgres_container.get_connection_url()
    # testcontainers trả về postgresql+psycopg2://, giữ nguyên
    engine = create_engine(url, echo=False, pool_pre_ping=True)

    # Bật pgvector extension trước khi create_all
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
        conn.commit()

    yield engine
    engine.dispose()


@pytest.fixture(scope="session")
def tables(sync_engine):
    """Tạo tất cả bảng một lần cho session. Drop sau khi xong."""
    Base.metadata.create_all(sync_engine)
    yield
    Base.metadata.drop_all(sync_engine)


@pytest.fixture()
def db_session(sync_engine, tables) -> Generator[Session, None, None]:
    """
    1 database session mới cho mỗi test.
    Dùng nested transaction (SAVEPOINT) để rollback sau test — không làm bẩn dữ liệu.
    """
    connection = sync_engine.connect()
    transaction = connection.begin()

    session_factory = sessionmaker(bind=connection)
    session = session_factory()

    # Nested transaction để rollback sau mỗi test
    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def restart_savepoint(session: Session, transaction: Any) -> None:
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    yield session

    session.close()
    transaction.rollback()
    connection.close()


# ──────────────────────────────────────────────
# Domain Fixtures — dữ liệu test chuẩn
# ──────────────────────────────────────────────

@pytest.fixture()
def sample_document(db_session: Session) -> Document:
    """
    1 Document canonical với đầy đủ metadata.
    Dùng làm source cho các Chunk retrieval tests.
    """
    doc = Document(
        filename="triz-contradictions.md",
        filepath="docs/triz-contradictions.md",
        title="TRIZ Contradictions — Reference Guide",
        topic="contradictions",
        source_type="internal_markdown",
        language="vi",
        tags=["triz", "contradiction", "40-principles"],
        golden=True,
        status=DocumentStatus.canonical,
        content_hash="deadbeef" + uuid.uuid4().hex[:56],
    )
    db_session.add(doc)
    db_session.flush()
    return doc


@pytest.fixture()
def sample_chunks(db_session: Session, sample_document: Document) -> list[Chunk]:
    """
    3 Chunk với embeddings giả lập.
    - chunk[0]: cosine similarity cao với query "speed vs reliability"
    - chunk[1]: relevance thấp hơn
    - chunk[2]: không liên quan
    Embedding là vector 1536 chiều với giá trị xác định (không random).
    """
    BASE = 1536
    embeddings = [
        [0.9 if i < 100 else 0.01 for i in range(BASE)],   # high-relevance
        [0.5 if i < 100 else 0.01 for i in range(BASE)],   # mid-relevance
        [0.01 for _ in range(BASE)],                        # low-relevance
    ]
    contents = [
        "Mâu thuẫn kỹ thuật TRIZ: cải thiện tốc độ làm giảm độ tin cậy. "
        "Nguyên tắc 10 (Tác động sơ bộ) và 35 (Chuyển đổi thông số) được khuyến nghị.",
        "Phân loại mâu thuẫn: kỹ thuật và vật lý. Mâu thuẫn vật lý xuất hiện khi "
        "cùng một tham số cần có hai trạng thái đối nghịch.",
        "Lịch sử phát triển TRIZ do Genrich Altshuller khởi xướng năm 1946 "
        "dựa trên phân tích hàng chục nghìn bằng sáng chế.",
    ]
    chunks = [
        Chunk(
            document_id=sample_document.id,
            content=contents[i],
            chunk_index=i,
            token_count=len(contents[i].split()),
            embedding=embeddings[i],
        )
        for i in range(3)
    ]
    db_session.add_all(chunks)
    db_session.flush()
    return chunks


@pytest.fixture()
def sample_session(db_session: Session) -> ResearchSession:
    """1 ResearchSession active để gắn với ProblemFrame."""
    session = ResearchSession(
        title="Nghiên cứu mâu thuẫn tốc độ - độ tin cậy",
        status=SessionStatus.active,
        workflow_state="problem_framing",
    )
    db_session.add(session)
    db_session.flush()
    return session


@pytest.fixture()
def sample_problem_frame(db_session: Session, sample_session: ResearchSession) -> ProblemFrame:
    """1 ProblemFrame với mâu thuẫn kỹ thuật rõ ràng."""
    frame = ProblemFrame(
        session_id=sample_session.id,
        raw_statement="Tăng tốc độ xử lý nhưng không giảm độ tin cậy của hệ thống.",
        normalized_statement="Cải thiện tốc độ (speed) mâu thuẫn với độ tin cậy (reliability).",
        domain="technical",
        contradiction_type=ContradictionType.technical,
        improving_parameter="speed",
        worsening_parameter="reliability",
    )
    db_session.add(frame)
    db_session.flush()
    return frame


@pytest.fixture()
def sample_contradiction(
    db_session: Session, sample_problem_frame: ProblemFrame
) -> Contradiction:
    """1 Contradiction gắn với ProblemFrame."""
    contradiction = Contradiction(
        problem_frame_id=sample_problem_frame.id,
        type=ContradictionType.technical,
        statement="Tăng tốc độ làm giảm độ tin cậy.",
        suggested_principles=[10, 35, 1, 28],
    )
    db_session.add(contradiction)
    db_session.flush()
    return contradiction


# ──────────────────────────────────────────────
# Mock Fixtures — LLM / OpenAI
# ──────────────────────────────────────────────

@pytest.fixture()
def mock_openai_embedding():
    """
    Mock openai.AsyncClient.embeddings.create để không gọi API thật.
    Trả về vector 1536 chiều với giá trị 0.5 — đủ để test pipeline.
    """
    fake_vector = [0.5] * 1536

    mock_response = MagicMock()
    mock_response.data = [MagicMock(embedding=fake_vector)]

    mock_client = AsyncMock()
    mock_client.embeddings.create = AsyncMock(return_value=mock_response)

    with patch("openai.AsyncOpenAI", return_value=mock_client):
        yield mock_client
