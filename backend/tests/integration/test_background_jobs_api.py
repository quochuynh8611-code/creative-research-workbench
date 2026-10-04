"""
test_background_jobs_api.py — Integration tests cho Background Job Tracking API (Phase 12.2)

Specifications:
  - Feature: Background Jobs Status & Progress Tracking REST API
  - Endpoints:
      - GET /api/v1/jobs/{job_id}
  - Ground truth:
      - docs/ADR-004-async-background-processing.md
      - docs/PHASE_12_2_ASYNC_PROCESSING_SPEC.md
  - Discipline: Test-First (RED) — Job Status & Polling Verification
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.main import app

# Import domain models dự kiến
try:
    from app.domain.models import BackgroundJob, JobStatus, JobType
except ImportError:
    BackgroundJob = None
    JobStatus = None
    JobType = None


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
async def test_get_running_job_status(db_session: Session):
    """
    Scenario 1: Tra cứu trạng thái job đang chạy (running / in-progress)
    GIVEN: Một BackgroundJob có trạng thái 'running' và tiến độ 45.0% trong DB
    WHEN: Gửi GET /api/v1/jobs/{job_id}
    THEN: API phản hồi HTTP 200 với đầy đủ metadata tiến độ
    """
    if BackgroundJob is None:
        # Nếu model chưa được tạo, kiểm tra gọi endpoint vẫn trả về 404/không tìm thấy route
        job_id = uuid.uuid4()
    else:
        job = BackgroundJob(
            id=uuid.uuid4(),
            job_type=JobType.document_ingestion,
            status=JobStatus.running,
            progress_percentage=45.0,
            error_message=None,
            result_summary=None,
            created_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc),
            finished_at=None,
        )
        db_session.add(job)
        db_session.commit()
        job_id = job.id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/jobs/{job_id}")

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    body = response.json()
    assert "data" in body
    data = body["data"]
    assert data["job_id"] == str(job_id)
    assert data["status"] == "running"
    assert data["progress_percentage"] == 45.0
    assert data["started_at"] is not None
    assert data["finished_at"] is None


@pytest.mark.asyncio
async def test_get_completed_job_status(db_session: Session):
    """
    Scenario 2: Tra cứu trạng thái job đã hoàn thành thành công
    GIVEN: Một BackgroundJob có trạng thái 'completed' kèm result_summary
    WHEN: Gửi GET /api/v1/jobs/{job_id}
    THEN: API phản hồi HTTP 200 với status='completed' và payload kết quả
    """
    if BackgroundJob is None:
        job_id = uuid.uuid4()
    else:
        doc_id = uuid.uuid4()
        job = BackgroundJob(
            id=uuid.uuid4(),
            job_type=JobType.document_ingestion,
            status=JobStatus.completed,
            progress_percentage=100.0,
            error_message=None,
            result_summary={"document_id": str(doc_id), "chunks_created": 8, "embeddings_created": 8},
            created_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db_session.add(job)
        db_session.commit()
        job_id = job.id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/jobs/{job_id}")

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    body = response.json()
    assert "data" in body
    data = body["data"]
    assert data["job_id"] == str(job_id)
    assert data["status"] == "completed"
    assert data["progress_percentage"] == 100.0
    assert data["result_summary"] is not None
    assert data["result_summary"]["chunks_created"] == 8


@pytest.mark.asyncio
async def test_get_failed_job_status(db_session: Session):
    """
    Scenario 3: Tra cứu trạng thái job thất bại
    GIVEN: Một BackgroundJob có trạng thái 'failed' và error_message
    WHEN: Gửi GET /api/v1/jobs/{job_id}
    THEN: API phản hồi HTTP 200 với status='failed' và thông báo lỗi rõ ràng
    """
    if BackgroundJob is None:
        job_id = uuid.uuid4()
    else:
        job = BackgroundJob(
            id=uuid.uuid4(),
            job_type=JobType.document_ingestion,
            status=JobStatus.failed,
            progress_percentage=0.0,
            error_message="OpenAI rate limit error",
            result_summary=None,
            created_at=datetime.now(timezone.utc),
            started_at=datetime.now(timezone.utc),
            finished_at=datetime.now(timezone.utc),
        )
        db_session.add(job)
        db_session.commit()
        job_id = job.id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/jobs/{job_id}")

    assert response.status_code == 200, f"Expected 200 OK, got {response.status_code}: {response.text}"
    body = response.json()
    assert "data" in body
    data = body["data"]
    assert data["job_id"] == str(job_id)
    assert data["status"] == "failed"
    assert "rate limit" in data["error_message"]


@pytest.mark.asyncio
async def test_get_non_existent_job_returns_404():
    """
    Scenario 4: Tra cứu job ID không tồn tại
    GIVEN: Một UUID ngẫu nhiên không có trong database
    WHEN: Gửi GET /api/v1/jobs/{non_existent_id}
    THEN: API phản hồi HTTP 404 NOT FOUND kèm thông báo lỗi
    """
    random_id = uuid.uuid4()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/jobs/{random_id}")

    assert response.status_code == 404
    assert str(random_id) in response.json().get("detail", "")
