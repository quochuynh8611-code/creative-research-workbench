"""
test_ingestion.py — Integration Tests cho IngestionService

Quy chuẩn:
  - TDD / Gherkin BDD style
  - Sử dụng testcontainers (PostgreSQL + pgvector) thông qua db_session fixture
  - Coverage:
      1. Ingest markdown có frontmatter tạo Document record với đúng metadata
      2. Ingest tạo các Chunks có embeddings
      3. Duplicate ingest bị chặn bằng content_hash (IngestResult.status == 'already_exists')
"""
from __future__ import annotations

import pathlib
import pytest
from sqlalchemy.orm import Session

from app.domain.models import Chunk, Document
from app.services.ingestion_service import IngestionService


@pytest.fixture
def sample_md_file(tmp_path: pathlib.Path) -> pathlib.Path:
    """Fixture tạo 1 file markdown mẫu có đầy đủ YAML frontmatter hợp lệ."""
    content = """---
title: "Kiến trúc hệ thống"
topic: "architecture"
source_type: "decision-record"
language: "vi"
tags:
  - architecture
  - triz
phase: "2"
status: "canonical"
golden: true
---

# Kiến trúc hệ thống
Đây là tài liệu kiến trúc hệ thống phục vụ cho việc nghiên cứu và tìm kiếm theo TRIZ.
Mục tiêu là hỗ trợ quy trình phân tích mâu thuẫn kỹ thuật và giải quyết vấn đề sáng tạo.
"""
    file_path = tmp_path / "sample_doc.md"
    file_path.write_text(content, encoding="utf-8")
    return file_path


def test_ingest_golden_doc_creates_document_record(
    db_session: Session, sample_md_file: pathlib.Path
) -> None:
    """GIVEN: 1 markdown file hợp lệ với frontmatter
       WHEN: IngestionService.ingest(filepath) được gọi
       THEN: Document record được tạo trong DB với đúng metadata"""
    engine = db_session.get_bind()
    service = IngestionService(engine=engine)
    result = service.ingest(str(sample_md_file))

    assert result.status == "success"
    assert result.document_id is not None

    doc = db_session.get(Document, result.document_id)
    assert doc is not None
    assert doc.title == "Kiến trúc hệ thống"
    assert doc.topic == "architecture"
    assert doc.source_type == "decision-record"
    assert doc.language == "vi"
    assert "architecture" in doc.tags
    assert doc.golden is True
    assert doc.status == "canonical"
    assert doc.content_hash is not None


def test_ingest_creates_chunks_with_embeddings(
    db_session: Session, sample_md_file: pathlib.Path
) -> None:
    """GIVEN: 1 markdown file hợp lệ
       WHEN: ingest() hoàn thành
       THEN: >= 1 Chunk record có embedding vector != None"""
    engine = db_session.get_bind()
    service = IngestionService(engine=engine)
    result = service.ingest(str(sample_md_file))

    assert result.status == "success"
    assert result.chunks_created >= 1
    assert result.embeddings_created >= 1

    chunks = db_session.query(Chunk).filter(Chunk.document_id == result.document_id).all()
    assert len(chunks) >= 1
    for chunk in chunks:
        assert chunk.content is not None
        assert chunk.token_count > 0
        assert chunk.embedding is not None


def test_duplicate_ingest_skipped_by_content_hash(
    db_session: Session, sample_md_file: pathlib.Path
) -> None:
    """GIVEN: 1 file đã được ingest
       WHEN: ingest() được gọi lại với cùng file
       THEN: IngestResult.status == 'already_exists', không tạo thêm record"""
    engine = db_session.get_bind()
    service = IngestionService(engine=engine)

    # Ingest lần 1
    result1 = service.ingest(str(sample_md_file))
    assert result1.status == "success"

    # Ingest lần 2 (cùng file)
    result2 = service.ingest(str(sample_md_file))
    assert result2.status == "already_exists"
    assert result2.document_id == result1.document_id

    # Đảm bảo không tạo thêm document record mới
    doc_count = db_session.query(Document).filter(Document.filepath == str(sample_md_file)).count()
    assert doc_count == 1

    # Đảm bảo số chunks không bị nhân đôi
    chunk_count = db_session.query(Chunk).filter(Chunk.document_id == result1.document_id).count()
    assert chunk_count == result1.chunks_created
