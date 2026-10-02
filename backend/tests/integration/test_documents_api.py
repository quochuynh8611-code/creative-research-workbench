"""
test_documents_api.py — Integration tests cho Phase 8: Knowledge Base Management API

Specifications:
  - Feature: Documents Management REST API & Ingestion
  - Endpoints:
      - GET    /api/v1/documents
      - GET    /api/v1/documents/{id}
      - POST   /api/v1/documents/upload
      - DELETE /api/v1/documents/{id}
  - Ground truth:
      - docs/ADR/ADR-004-phase-8-knowledge-base-management.md
      - docs/PHASE_8_KNOWLEDGE_BASE_EXECUTION_SPEC.md
      - docs/PHASE_8_KNOWLEDGE_BASE_GHERKIN_MATRIX.md
"""
from __future__ import annotations

import io
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import Chunk, Document, DocumentStatus
from app.main import app


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db và db session."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.mark.asyncio
async def test_list_documents_endpoint_with_filters(db_session: Session):
    """
    Scenario 1.1: Liệt kê danh sách tài liệu có phân trang và bộ lọc (AC-1)
    GIVEN: DB có 1 document golden và 1 document thường
    WHEN: Gọi GET /api/v1/documents?topic=architecture
    THEN: Trả về status 200, danh sách lọc đúng và có meta pagination
    """
    doc_golden = Document(
        id=uuid.uuid4(),
        filename="ADR-001-architecture.md",
        filepath="docs/ADR-001-architecture.md",
        title="ADR-001 — Kiến trúc hệ thống",
        topic="architecture",
        source_type="decision-record",
        language="vi",
        tags=["adr", "triz"],
        phase="1",
        status=DocumentStatus.canonical,
        golden=True,
        content_hash="hash_doc_golden_01",
    )
    doc_normal = Document(
        id=uuid.uuid4(),
        filename="triz-cases.md",
        filepath="docs/triz-cases.md",
        title="TRIZ Case Studies",
        topic="triz",
        source_type="case-study",
        language="vi",
        tags=["case"],
        phase="2",
        status=DocumentStatus.draft,
        golden=False,
        content_hash="hash_doc_normal_02",
    )
    db_session.add_all([doc_golden, doc_normal])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/documents", params={"topic": "architecture"})

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert "meta" in body
    assert len(body["data"]) >= 1
    assert all(item["topic"] == "architecture" for item in body["data"])
    assert body["meta"]["total"] >= 1


@pytest.mark.asyncio
async def test_get_document_detail_endpoint(db_session: Session):
    """
    Scenario 1.2: Lấy chi tiết tài liệu và danh sách chunks (AC-2)
    GIVEN: 1 document kèm 2 chunks trong DB
    WHEN: Gọi GET /api/v1/documents/{id}
    THEN: Trả về 200, thông tin metadata và mảng chunks
    """
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        filename="doc-detail.md",
        filepath="docs/doc-detail.md",
        title="Tài liệu kiểm thử chi tiết",
        topic="testing",
        source_type="spec",
        language="vi",
        tags=["test"],
        phase="1",
        status=DocumentStatus.canonical,
        golden=False,
        content_hash="hash_detail_03",
    )
    chunk1 = Chunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        content="Đoạn 1 nội dung kiểm thử",
        chunk_index=0,
        token_count=10,
        embedding=[0.0] * 1536,
    )
    chunk2 = Chunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        content="Đoạn 2 nội dung kiểm thử",
        chunk_index=1,
        token_count=10,
        embedding=[0.0] * 1536,
    )
    db_session.add_all([doc, chunk1, chunk2])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/documents/{doc_id}")

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["id"] == str(doc_id)
    assert body["data"]["title"] == "Tài liệu kiểm thử chi tiết"
    assert len(body["data"]["chunks"]) == 2
    assert body["data"]["chunks"][0]["chunk_index"] == 0


@pytest.mark.asyncio
async def test_upload_document_endpoint_success(db_session: Session):
    """
    Scenario 1.3: Upload file Markdown mới hợp lệ (AC-3)
    GIVEN: File markdown có frontmatter
    WHEN: Gọi POST /api/v1/documents/upload dạng multipart
    THEN: Trả về 200 status='success', tạo document và chunks trong DB
    """
    content = b"""---
title: "Nghi\xc3\xaan c\xe1\xbb\xa9u Pin Lithium"
topic: "energy"
source_type: "paper"
language: "vi"
tags: ["battery", "lithium"]
phase: "1"
status: "draft"
golden: false
---

# Nghien cuu Pin Lithium
Noi dung nghien cuu tang mat do nang luong cua pin lithium polymer.
"""
    files = {"file": ("lithium_battery.md", io.BytesIO(content), "text/markdown")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/documents/upload", files=files)

    assert response.status_code == 200
    body = response.json()
    assert body["data"]["status"] == "success"
    assert "document_id" in body["data"]

    # Verify trong DB
    created_id = uuid.UUID(body["data"]["document_id"])
    saved_doc = db_session.get(Document, created_id)
    assert saved_doc is not None
    assert saved_doc.topic == "energy"


@pytest.mark.asyncio
async def test_upload_duplicate_document_returns_already_exists(db_session: Session):
    """
    Scenario 1.4: Upload file trùng lặp nội dung SHA-256 (AC-4)
    GIVEN: File markdown đã được upload 1 lần
    WHEN: Gọi POST /api/v1/documents/upload với cùng nội dung
    THEN: Trả về 200 OK với status='already_exists' và document_id cũ
    """
    content = b"""---
title: "Tai lieu chong duplicate"
topic: "testing"
---

Noi dung kiem tra duplicate sha256 hash.
"""
    files1 = {"file": ("dedup_test.md", io.BytesIO(content), "text/markdown")}
    files2 = {"file": ("dedup_test_copy.md", io.BytesIO(content), "text/markdown")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res1 = await client.post("/api/v1/documents/upload", files=files1)
        assert res1.status_code == 200
        doc_id = res1.json()["data"]["document_id"]

        res2 = await client.post("/api/v1/documents/upload", files=files2)

    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["data"]["status"] == "already_exists"
    assert body2["data"]["document_id"] == doc_id


@pytest.mark.asyncio
async def test_delete_normal_document_endpoint_success(db_session: Session):
    """
    Scenario 1.5: Xóa tài liệu thông thường thành công (AC-5)
    GIVEN: 1 document golden=False có 1 chunk
    WHEN: Gọi DELETE /api/v1/documents/{id}
    THEN: Trả về 200 status='deleted', document và chunk bị xóa khỏi DB
    """
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        filename="to-delete.md",
        filepath="docs/to-delete.md",
        title="Tài liệu cần xóa",
        golden=False,
        status=DocumentStatus.draft,
        content_hash="hash_to_delete_05",
    )
    chunk = Chunk(
        id=uuid.uuid4(),
        document_id=doc_id,
        content="Chunk can xoa",
        chunk_index=0,
        token_count=5,
        embedding=[0.0] * 1536,
    )
    db_session.add_all([doc, chunk])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete(f"/api/v1/documents/{doc_id}")

    assert response.status_code == 200
    assert response.json()["status"] == "deleted"

    # Verify trong DB
    assert db_session.get(Document, doc_id) is None
    assert db_session.query(Chunk).filter_by(document_id=doc_id).count() == 0


@pytest.mark.asyncio
async def test_delete_golden_document_guard_forbidden(db_session: Session):
    """
    Scenario 1.6: Chặn xóa tài liệu Golden Document (AC-6)
    GIVEN: 1 document golden=True
    WHEN: Gọi DELETE /api/v1/documents/{id}
    THEN: Trả về 403 Forbidden, tài liệu không bị xóa trong DB
    """
    doc_id = uuid.uuid4()
    doc = Document(
        id=doc_id,
        filename="golden-protected.md",
        filepath="docs/golden-protected.md",
        title="Golden Document Duoc Bao Ve",
        golden=True,
        status=DocumentStatus.canonical,
        content_hash="hash_golden_protected_06",
    )
    db_session.add(doc)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete(f"/api/v1/documents/{doc_id}")

    assert response.status_code == 403
    assert "Golden" in response.json()["detail"]

    # Verify tài liệu vẫn còn trong DB
    assert db_session.get(Document, doc_id) is not None


@pytest.mark.asyncio
async def test_upload_document_exceeds_max_size_returns_400(db_session: Session):
    """
    Scenario 1.7: Upload file vượt quá giới hạn tối đa 10MB
    GIVEN: File có kích thước > 10MB
    WHEN: Gọi POST /api/v1/documents/upload
    THEN: Trả về HTTP 400 Bad Request, detail có thông tin 10MB, không tạo document/chunk trong DB
    """
    # Tạo payload trong bộ nhớ > 10MB (10MB + 100 bytes)
    oversized_content = b"# Big Document\n" + b"x" * (10 * 1024 * 1024 + 100)
    files = {"file": ("oversized_file.md", io.BytesIO(oversized_content), "text/markdown")}

    count_docs_before = db_session.query(Document).count()
    count_chunks_before = db_session.query(Chunk).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/documents/upload", files=files)

    assert response.status_code == 400
    assert "10MB" in response.json()["detail"]

    # Assert database không tạo document hoặc chunk nào
    assert db_session.query(Document).count() == count_docs_before
    assert db_session.query(Chunk).count() == count_chunks_before
