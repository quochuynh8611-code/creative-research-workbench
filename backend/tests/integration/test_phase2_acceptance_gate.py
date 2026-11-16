"""
test_phase2_acceptance_gate.py — Batch C19: Phase 2 Acceptance Gate Verification

Gherkin Scenarios:
  1. Migration creates required tables (alembic upgrade head -> documents, chunks, embedding column & indexes)
  2. Ingest 10 golden documents + idempotent re-ingest
  3. Handle malformed frontmatter -> raise validation error, no Document created
  4. Preserve chunk ordering -> contiguous chunk_index sequence matching document order
"""
from __future__ import annotations

import pathlib

import pytest
from alembic import command
from sqlalchemy import Engine, inspect
from sqlalchemy.orm import Session

from app.domain.models import Base, Chunk, Document
from app.services.ingestion_service import FrontmatterValidationError, IngestionService
from tests.integration.test_alembic_migrations import _clean_database, get_alembic_config


@pytest.fixture
def restore_schema_after_migration(sync_engine: Engine):
    """Đảm bảo schema ORM được khôi phục sạch sau test migration."""
    yield
    _clean_database(sync_engine)
    Base.metadata.create_all(sync_engine)


def test_migration_creates_required_tables_and_indexes(
    sync_engine: Engine,
    restore_schema_after_migration,
) -> None:
    """Scenario: Migration creates required tables."""
    _clean_database(sync_engine)
    cfg = get_alembic_config(sync_engine)

    command.upgrade(cfg, "head")

    inspector = inspect(sync_engine)
    table_names = set(inspector.get_table_names())
    assert "documents" in table_names
    assert "chunks" in table_names

    doc_cols = {col["name"] for col in inspector.get_columns("documents")}
    assert {"id", "filename", "filepath", "title", "topic", "source_type", "phase", "golden", "content_hash", "created_at", "updated_at"}.issubset(doc_cols)

    chunk_cols = {col["name"] for col in inspector.get_columns("chunks")}
    assert {"id", "document_id", "content", "chunk_index", "token_count", "embedding", "created_at"}.issubset(chunk_cols)

    doc_uniques = {uc["name"] for uc in inspector.get_unique_constraints("documents")}
    assert "uq_documents_content_hash" in doc_uniques

    chunk_fks = inspector.get_foreign_keys("chunks")
    assert any(fk["referred_table"] == "documents" and fk["constrained_columns"] == ["document_id"] for fk in chunk_fks)

    doc_indexes = {idx["name"] for idx in inspector.get_indexes("documents")}
    assert {"ix_documents_topic", "ix_documents_golden", "ix_documents_status"}.issubset(doc_indexes)

    chunk_indexes = {idx["name"] for idx in inspector.get_indexes("chunks")}
    assert {"ix_chunks_document_id", "ix_chunks_chunk_index", "ix_chunks_embedding_cosine"}.issubset(chunk_indexes)


def test_ingest_10_golden_documents_and_idempotent_reingest(
    db_session: Session,
    tmp_path: pathlib.Path,
) -> None:
    """Scenario: Ingest 10 golden documents + idempotent re-ingest."""
    engine = db_session.get_bind()
    service = IngestionService(engine=engine)

    golden_specs = [
        ("ADR-001-architecture.md", "architecture", "decision-record"),
        ("API_CONTRACTS.md", "api", "contract"),
        ("DOMAIN_SCHEMA.md", "domain-model", "schema"),
        ("PRODUCT_SPEC.md", "product", "spec"),
        ("IMPLEMENTATION_ROADMAP.md", "roadmap", "plan"),
        ("UI_MODULE_BREAKDOWN.md", "frontend", "design"),
        ("TEST_PLAN.md", "testing", "plan"),
        ("GHERKIN_SCENARIOS.md", "testing", "bdd"),
        ("FAILING_INTEGRATION_TEST_SPEC.md", "testing", "spec"),
        ("Definition_of_Done.md", "process", "definition"),
    ]

    files: list[pathlib.Path] = []
    for idx, (filename, topic, source_type) in enumerate(golden_specs, start=1):
        p = tmp_path / filename
        p.write_text(
            f"""---
title: "Golden Document {idx}: {filename}"
topic: "{topic}"
source_type: "{source_type}"
language: "vi"
phase: "2"
status: "canonical"
golden: true
---

# Golden Document {idx}

Nội dung chuẩn hóa số {idx} cho chủ đề {topic} phục vụ benchmark retrieval.
""",
            encoding="utf-8",
        )
        files.append(p)

    doc_ids = []
    for p in files:
        res = service.ingest(str(p))
        assert res.status == "success"
        assert res.document_id is not None
        assert res.chunks_created >= 1
        doc_ids.append(res.document_id)

    assert db_session.query(Document).filter(Document.golden.is_(True)).count() == 10
    initial_chunk_count = db_session.query(Chunk).count()
    assert initial_chunk_count >= 10

    # Re-ingest must be idempotent
    for p, expected_id in zip(files, doc_ids, strict=True):
        re_res = service.ingest(str(p))
        assert re_res.status == "already_exists"
        assert re_res.document_id == expected_id

    assert db_session.query(Document).count() == 10
    assert db_session.query(Chunk).count() == initial_chunk_count


def test_malformed_frontmatter_raises_validation_error_and_creates_no_document(
    db_session: Session,
    tmp_path: pathlib.Path,
) -> None:
    """Scenario: Handle malformed frontmatter."""
    bad_file = tmp_path / "malformed.md"
    bad_file.write_text(
        """---
title: [unclosed bracket
topic: : : invalid
---

# Nội dung bị lỗi frontmatter
""",
        encoding="utf-8",
    )

    engine = db_session.get_bind()
    service = IngestionService(engine=engine)

    with pytest.raises(FrontmatterValidationError):
        service.ingest(str(bad_file))

    assert db_session.query(Document).count() == 0
    assert db_session.query(Chunk).count() == 0


def test_preserve_chunk_ordering_across_multiple_sections(
    db_session: Session,
    tmp_path: pathlib.Path,
) -> None:
    """Scenario: Preserve chunk ordering."""
    multi_section = tmp_path / "multi_section.md"
    section_1 = "SECTION_ALPHA " + ("mâu thuẫn kỹ thuật " * 25)
    section_2 = "SECTION_BETA " + ("nguyên tắc sáng tạo " * 25)
    section_3 = "SECTION_GAMMA " + ("ma trận phân tách " * 25)

    multi_section.write_text(
        f"""---
title: "Multi-Section Document"
topic: "contradiction"
source_type: "spec"
golden: true
---

# Phần 1
{section_1}

# Phần 2
{section_2}

# Phần 3
{section_3}
""",
        encoding="utf-8",
    )

    engine = db_session.get_bind()
    service = IngestionService(engine=engine, chunk_size=40, overlap=0)
    res = service.ingest(str(multi_section))

    assert res.status == "success"
    assert res.chunks_created >= 3

    chunks = (
        db_session.query(Chunk)
        .filter(Chunk.document_id == res.document_id)
        .order_by(Chunk.chunk_index.asc())
        .all()
    )
    assert [c.chunk_index for c in chunks] == list(range(len(chunks)))

    joined_positions = [
        next(i for i, c in enumerate(chunks) if marker in c.content)
        for marker in ("SECTION_ALPHA", "SECTION_BETA", "SECTION_GAMMA")
    ]
    assert joined_positions == sorted(joined_positions)
