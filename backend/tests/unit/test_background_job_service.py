"""
test_background_job_service.py — Unit tests cho JobService & Background Task Runner

Specifications:
  - Feature: Background Job Service & Lifecycle Management
  - Ground truth:
      - docs/ADR-004-async-background-processing.md
      - docs/PHASE_12_2_ASYNC_PROCESSING_SPEC.md
  - Discipline: Test-First (RED) — Domain & Service Unit Verification
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

# Các imports dự kiến từ production code chưa được implement
try:
    from app.domain.models import BackgroundJob, Base, JobStatus, JobType
    from app.services.job_service import JobService
except ImportError:
    # Cho phép test runner nạp file ngay cả khi symbols chưa được định nghĩa
    BackgroundJob = None
    Base = None
    JobStatus = None
    JobType = None
    JobService = None


@pytest.fixture()
def sqlite_session_factory():
    """In-memory SQLite engine và session factory độc lập cho unit tests."""
    if Base is None or BackgroundJob is None:
        pytest.fail("BackgroundJob model is not implemented yet (RED phase)")
    engine = create_engine("sqlite:///:memory:", echo=False)
    BackgroundJob.__table__.create(engine)
    factory = sessionmaker(bind=engine)
    yield factory
    BackgroundJob.__table__.drop(engine)
    engine.dispose()


def test_create_background_job_pending(sqlite_session_factory):
    """
    Scenario 1: Khởi tạo Background Job mới ở trạng thái pending
    GIVEN: JobService được cấu hình với session factory
    WHEN: Gọi JobService.create_job(job_type=JobType.document_ingestion)
    THEN: Job được tạo với ID hợp lệ, status='pending', progress_percentage=0.0
    """
    if JobService is None or JobType is None:
        pytest.fail("JobService or JobType not implemented")

    service = JobService(session_factory=sqlite_session_factory)
    job = service.create_job(job_type=JobType.document_ingestion)

    assert job is not None
    assert isinstance(job.id, uuid.UUID)
    assert job.job_type == JobType.document_ingestion
    assert job.status == JobStatus.pending
    assert job.progress_percentage == 0.0
    assert job.error_message is None
    assert job.result_summary is None
    assert job.created_at is not None
    assert job.started_at is None
    assert job.finished_at is None

    # Kiểm tra persistence
    fetched = service.get_job(job.id)
    assert fetched is not None
    assert fetched.id == job.id


def test_get_job_not_found(sqlite_session_factory):
    """
    Scenario 2: Truy vấn Job ID không tồn tại
    GIVEN: Một UUID ngẫu nhiên không có trong database
    WHEN: Gọi JobService.get_job(random_id)
    THEN: Trả về None
    """
    if JobService is None:
        pytest.fail("JobService not implemented")

    service = JobService(session_factory=sqlite_session_factory)
    result = service.get_job(uuid.uuid4())
    assert result is None


def test_run_job_success_lifecycle(sqlite_session_factory):
    """
    Scenario 3: Chu kỳ thực thi thành công của một tác vụ nền
    GIVEN: Một job đang ở trạng thái pending và worker function thành công
    WHEN: JobService.run_job(job_id, worker_func) được thực thi
    THEN: Trạng thái chuyển running -> completed, progress=100.0, finished_at được ghi nhận
    """
    if JobService is None or JobType is None or JobStatus is None:
        pytest.fail("JobService or Job enums not implemented")

    service = JobService(session_factory=sqlite_session_factory)
    job = service.create_job(job_type=JobType.document_ingestion)

    expected_summary = {"document_id": str(uuid.uuid4()), "chunks_created": 5}

    def dummy_worker(session: Session) -> dict:
        return expected_summary

    service.run_job(job.id, worker_func=dummy_worker)

    updated = service.get_job(job.id)
    assert updated is not None
    assert updated.status == JobStatus.completed
    assert updated.progress_percentage == 100.0
    assert updated.started_at is not None
    assert updated.finished_at is not None
    assert updated.result_summary == expected_summary
    assert updated.error_message is None


def test_run_job_failure_lifecycle_and_exception_handling(sqlite_session_factory):
    """
    Scenario 4: Chu kỳ thực thi khi worker function gặp ngoại lệ
    GIVEN: Một job pending và worker function ném ra Exception
    WHEN: JobService.run_job(job_id, worker_func) bắt được lỗi
    THEN: Trạng thái chuyển running -> failed, error_message được ghi nhận, không crash tiến trình
    """
    if JobService is None or JobType is None or JobStatus is None:
        pytest.fail("JobService or Job enums not implemented")

    service = JobService(session_factory=sqlite_session_factory)
    job = service.create_job(job_type=JobType.document_ingestion)

    def failing_worker(session: Session):
        raise RuntimeError("OpenAI API rate limit exceeded")

    # Hàm run_job không được ném exception ra ngoài mà phải bắt và cập nhật job record
    service.run_job(job.id, worker_func=failing_worker)

    updated = service.get_job(job.id)
    assert updated is not None
    assert updated.status == JobStatus.failed
    assert updated.started_at is not None
    assert updated.finished_at is not None
    assert "OpenAI API rate limit exceeded" in (updated.error_message or "")
    assert updated.result_summary is None


def test_session_isolation_and_guaranteed_cleanup():
    """
    Scenario 5: Đảm bảo cách ly Session và luôn đóng kết nối trong finally block
    GIVEN: JobService thực thi với một session factory
    WHEN: Worker hoàn thành hoặc thất bại
    THEN: Session độc lập được tạo và gọi session.close() trong mọi trường hợp
    """
    if JobService is None or JobType is None:
        pytest.fail("JobService not implemented")

    mock_session = MagicMock()
    mock_factory = MagicMock(return_value=mock_session)

    service = JobService(session_factory=mock_factory)
    job_id = uuid.uuid4()

    # Giả lập query tìm job
    fake_job = MagicMock()
    fake_job.id = job_id
    mock_session.get.return_value = fake_job

    def worker(session: Session):
        raise ValueError("Simulated failure inside worker")

    service.run_job(job_id, worker_func=worker)

    # Đảm bảo session.close() luôn được gọi ít nhất một lần
    assert mock_session.close.called
