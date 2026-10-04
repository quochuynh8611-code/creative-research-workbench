"""
jobs.py — REST API endpoint tra cứu trạng thái và tiến độ tác vụ nền (Phase 12.2)

Cung cấp:
  - GET /api/v1/jobs/{job_id} : Lấy thông tin chi tiết và tiến độ xử lý của tác vụ nền
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.domain.models import BackgroundJob, JobStatus, JobType

router = APIRouter()


def _serialize_job(job: BackgroundJob) -> dict[str, Any]:
    return {
        "job_id": str(job.id),
        "job_type": job.job_type.value if isinstance(job.job_type, JobType) else str(job.job_type),
        "status": job.status.value if isinstance(job.status, JobStatus) else str(job.status),
        "progress_percentage": job.progress_percentage,
        "error_message": job.error_message,
        "result_summary": job.result_summary,
        "created_at": job.created_at.isoformat() if job.created_at else None,
        "started_at": job.started_at.isoformat() if job.started_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    }


@router.get("/{job_id}", response_model=None)
async def get_job(
    job_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """
    Tra cứu thông tin trạng thái và kết quả của một background job.
    """
    job = db.get(BackgroundJob, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job not found: {job_id}",
        )

    return {
        "data": _serialize_job(job)
    }
