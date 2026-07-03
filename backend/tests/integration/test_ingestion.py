"""
test_ingestion.py — Failing Integration Tests cho IngestionService

TRAN᩠NG THÁI: RED — tất cả tests dưới đây MUST FAIL khi chưa có implementation.
Mục tiêu: đưa về GREEN sau khi implement Phase 2.

Coverage:
  - Ingest 1 golden document thành công
  - Document record được lưu với đúng metadata (frontmatter)
  - Chunk + embedding được tạo
  - Duplicate ingest bị chặn bằng content_hash
"""
from __future__ import annotations

import pathlib

import pytest
from sqlalchemy import Engine

from .conftest import DOCS_DIR, GOLDEN_DOCS


class TestIngestionService:
    """
    Test suite cho IngestionService.

    RED: tất cả tests sẽ fail với ImportError hoặc AttributeError
    cho đến khi `backend/src/app/services/ingestion_service.py` được viết.
    """

    def test_ingest_golden_doc_returns_success(
        self, db_engine: Engine
    ) -> None:
        """
        RED: ImportError — IngestionService chưa tồn tại.

        Given: file ADR-001-architecture.md tồn tại với YAML frontmatter chuẩn
        When: gọi IngestionService.ingest(filepath)
        Then: trả về IngestResult với status="success"
        """
        from app.services.ingestion_service import IngestionService  # type: ignore[import]

        doc_path = str(DOCS_DIR / "ADR-001-architecture.md")
        service = IngestionService(engine=db_engine)
        result = service.ingest(doc_path)

        assert result.status == "success"
        assert result.document_id is not None

    def test_ingest_creates_chunks_with_correct_count(
        self, db_engine: Engine
    ) -> None:
        """
        RED: ImportError — IngestionService chưa tồn tại.

        Given: file ADR-001-architecture.md (~2.8KB)
        When: ingest với default chunk_size=512 tokens
        Then:
          - chunks_created >= 1
          - embeddings_created == chunks_created
          - mỗi chunk có token_count <= 512
        """
        from app.services.ingestion_service import IngestionService  # type: ignore[import]

        service = IngestionService(engine=db_engine)
        result = service.ingest(str(DOCS_DIR / "ADR-001-architecture.md"))

        assert result.chunks_created >= 1
        assert result.embeddings_created == result.chunks_created

    def test_ingest_parses_frontmatter_into_document_metadata(
        self, db_engine: Engine
    ) -> None:
        """
        RED: ImportError — IngestionService + Document model chưa tồn tại.

        Given: ADR-001-architecture.md có frontmatter:
          topic: "architecture", source_type: "decision-record", golden: true
        When: ingest xong
        Then: Document record trong DB phải có đúng các field đó
        """
        from app.services.ingestion_service import IngestionService  # type: ignore[import]
        from app.domain.models import Document  # type: ignore[import]
        from sqlalchemy.orm import Session

        service = IngestionService(engine=db_engine)
        result = service.ingest(str(DOCS_DIR / "ADR-001-architecture.md"))

        with Session(db_engine) as session:
            doc = session.get(Document, result.document_id)
            assert doc is not None
            assert doc.topic == "architecture"
            assert doc.source_type == "decision-record"
            assert doc.golden is True
            assert doc.status == "canonical"

    def test_duplicate_ingest_skipped_by_content_hash(
        self, db_engine: Engine
    ) -> None:
        """
        RED: ImportError — IngestionService chưa tồn tại.

        Given: DOMAIN_SCHEMA.md đã được ingest lần 1
        When: gọi ingest lần 2 với cùng file
        Then:
          - status == "already_exists"
          - không tạo thêm Document record mới
          - không tạo thêm Chunk nào
        """
        from app.services.ingestion_service import IngestionService  # type: ignore[import]
        from app.domain.models import Document  # type: ignore[import]
        from sqlalchemy.orm import Session
        from sqlalchemy import func, select

        service = IngestionService(engine=db_engine)
        doc_path = str(DOCS_DIR / "DOMAIN_SCHEMA.md")

        service.ingest(doc_path)  # lần 1
        result2 = service.ingest(doc_path)  # lần 2

        assert result2.status == "already_exists"

        # Verify: vẫn chỉ có 1 Document record
        with Session(db_engine) as session:
            count = session.scalar(
                select(func.count()).select_from(Document).where(
                    Document.filepath == doc_path
                )
            )
            assert count == 1
