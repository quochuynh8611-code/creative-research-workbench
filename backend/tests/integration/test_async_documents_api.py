"""
test_async_documents_api.py — Integration tests cho Async Document Upload API (Phase 12.2)

Specifications:
  - Feature: Dual-mode Document Ingestion (Sync & Async)
  - Endpoints:
      - POST /api/v1/documents/upload
      - POST /api/v1/documents/upload?async=true
  - Ground truth:
      - docs/ADR-004-async-background-processing.md
      - docs/PHASE_12_2_ASYNC_PROCESSING_SPEC.md
  - Discipline: Test-First (RED) — Integration API Contract Verification
"""
from __future__ import annotations

import io
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import Document
from app.main import app


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db trong integration tests."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.mark.asyncio
async def test_sync_document_upload_backward_compatibility(db_session: Session):
    """
    Scenario 1: Upload tài liệu ở chế độ đồng bộ mặc định (async=false)
    GIVEN: Một file markdown hợp lệ
    WHEN: Gửi POST /api/v1/documents/upload không có param async (hoặc async=false)
    THEN: API phản hồi HTTP 200 với kết quả nạp liệu đồng bộ tức thì
    """
    content = b"---\ntitle: Sync Test Doc\ntopic: test\n---\n\nDay la tai lieu test dong bo."
    files = {"file": ("sync_test.md", io.BytesIO(content), "text/markdown")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/documents/upload", files=files)

    assert response.status_code == 200
    body = response.json()
    assert "data" in body
    assert body["data"]["status"] in ["success", "already_exists"]
    assert "document_id" in body["data"]


@pytest.mark.asyncio
async def test_async_document_upload_returns_202_and_job_id(db_session: Session):
    """
    Scenario 2: Upload tài liệu ở chế độ bất đồng bộ (async=true)
    GIVEN: Một file markdown hợp lệ và query param async=true
    WHEN: Gửi POST /api/v1/documents/upload?async=true
    THEN: API phản hồi HTTP 202 Accepted, trả về job_id và status='pending'
    """
    content = b"---\ntitle: Async Test Doc\ntopic: async_test\n---\n\nNoi dung tai lieu bat dong bo."
    files = {"file": ("async_test.md", io.BytesIO(content), "text/markdown")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/documents/upload", params={"async": "true"}, files=files)

    assert response.status_code == 202, f"Expected 202 Accepted, got {response.status_code}: {response.text}"
    body = response.json()
    assert "data" in body
    data = body["data"]
    assert "job_id" in data
    assert uuid.UUID(data["job_id"])  # Phải là UUID hợp lệ
    assert data["job_type"] == "document_ingestion"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_async_document_upload_invalid_extension_returns_400():
    """
    Scenario 3: Upload file sai định dạng ở chế độ async fail-fast ngay lập tức
    GIVEN: Một file có đuôi không hợp lệ (.pdf hoặc .exe)
    WHEN: Gửi POST /api/v1/documents/upload?async=true
    THEN: API phản hồi HTTP 400 Bad Request ngay tại tầng validate, không tạo job
    """
    files = {"file": ("invalid_file.pdf", io.BytesIO(b"%PDF-1.4 binary data"), "application/pdf")}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/documents/upload", params={"async": "true"}, files=files)

    assert response.status_code == 400
    assert "Markdown" in response.json().get("detail", "")
