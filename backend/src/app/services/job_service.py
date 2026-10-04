"""
job_service.py — Dịch vụ điều phối và quản lý vòng đời tác vụ nền (Phase 12.2)

Nguồn chân lý:
  - docs/ADR-004-async-background-processing.md
  - docs/PHASE_12_2_ASYNC_PROCESSING_SPEC.md
"""
from __future__ import annotations

import logging
import uuid
from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.domain.models import BackgroundJob, JobStatus, JobType

logger = logging.getLogger(__name__)


class JobService:
    """
    Dịch vụ quản lý chu kỳ tác vụ nền: pending -> running -> completed | failed.
    Đảm bảo cách ly Session hoàn toàn với HTTP request.
    """

    def __init__(
        self,
        engine: Engine | None = None,
        session_factory: sessionmaker[Session] | Callable[[], Session] | None = None,
    ) -> None:
        if session_factory is not None:
            self._session_factory = session_factory
        elif engine is not None:
            self._session_factory = sessionmaker(bind=engine, expire_on_commit=False)
        else:
            from app.api.v1.endpoints.sessions import get_engine
            self._session_factory = sessionmaker(bind=get_engine(), expire_on_commit=False)

    def _get_session(self) -> Session:
        return self._session_factory()

    def create_job(self, job_type: JobType) -> BackgroundJob:
        """Khởi tạo một job mới ở trạng thái pending."""
        session = self._get_session()
        try:
            job = BackgroundJob(
                id=uuid.uuid4(),
                job_type=job_type,
                status=JobStatus.pending,
                progress_percentage=0.0,
                error_message=None,
                result_summary=None,
                created_at=datetime.now(timezone.utc),
                started_at=None,
                finished_at=None,
            )
            session.add(job)
            session.commit()
            session.refresh(job)
            return job
        finally:
            session.close()

    def get_job(self, job_id: uuid.UUID) -> BackgroundJob | None:
        """Tra cứu thông tin job theo ID."""
        session = self._get_session()
        try:
            return session.get(BackgroundJob, job_id)
        finally:
            session.close()

    def run_job(
        self,
        job_id: uuid.UUID,
        worker_func: Callable[[Session], dict[str, Any] | None],
    ) -> None:
        """
        Thực thi tác vụ nền với session riêng biệt.
        Chuyển trạng thái: pending -> running -> completed | failed.
        Ghi nhận log và đảm bảo dọn dẹp session trong finally block.
        """
        session = self._get_session()
        try:
            job = session.get(BackgroundJob, job_id)
            if not job:
                logger.error("Job %s not found when starting background execution.", job_id)
                return

            # Cập nhật running
            job.status = JobStatus.running
            job.started_at = datetime.now(timezone.utc)
            session.commit()

            # Thực thi worker function
            result = worker_func(session)

            # Cập nhật completed
            job.status = JobStatus.completed
            job.progress_percentage = 100.0
            job.finished_at = datetime.now(timezone.utc)
            job.result_summary = result
            job.error_message = None
            session.commit()
            logger.info("Job %s completed successfully.", job_id)

        except Exception as exc:
            logger.exception("Error executing background job %s: %s", job_id, exc)
            try:
                session.rollback()
                job = session.get(BackgroundJob, job_id)
                if job:
                    job.status = JobStatus.failed
                    job.finished_at = datetime.now(timezone.utc)
                    job.error_message = str(exc)
                    session.commit()
            except Exception as update_exc:
                logger.critical("Failed to record error for job %s: %s", job_id, update_exc)
        finally:
            session.close()
