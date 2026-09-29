from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.models import ProblemFrame, ResearchSession
from app.services.problem_structuring_service import ProblemStructuringService

router = APIRouter()


# ──────────────────────────────────────────────
# Dependency Injection
# ──────────────────────────────────────────────

def get_problem_structuring_service() -> ProblemStructuringService:
    """Dependency cung cấp ProblemStructuringService theo cấu hình database mặc định."""
    db_url = settings.DATABASE_URL
    if "asyncpg" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    engine = create_engine(db_url)
    return ProblemStructuringService(bind=engine)


# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: str
    domain: str = "research"
    tags: list[str] = []


class SessionResponse(BaseModel):
    id: str
    title: str
    domain: str
    status: str
    tags: list[str]
    created_at: str
    updated_at: str


class ProblemFrameCreate(BaseModel):
    raw_problem_statement: str


class ProblemFrameCreateRequest(BaseModel):
    raw_statement: str = Field(..., min_length=1)
    domain: str | None = None


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate):
    """Tạo research session mới."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "data": {
            "id": f"ses_{uuid.uuid4().hex[:8]}",
            "title": body.title,
            "domain": body.domain,
            "status": "draft",
            "tags": body.tags,
            "current_problem_frame_id": None,
            "created_at": now,
            "updated_at": now,
        }
    }


@router.get("")
async def list_sessions(
    status: Optional[str] = None,
    domain: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 20,
):
    """Liệt kê research sessions."""
    # TODO: implement database query
    return {"data": [], "meta": {"total": 0}}


@router.get("/{session_id}")
async def get_session(session_id: str):
    """Lấy chi tiết một session."""
    # TODO: implement database query
    raise HTTPException(status_code=404, detail="Session not found")


@router.post("/{session_id}/problem-frame", status_code=status.HTTP_201_CREATED)
async def create_problem_frame_canonical(
    session_id: uuid.UUID,
    body: ProblemFrameCreateRequest,
    service: ProblemStructuringService = Depends(get_problem_structuring_service),
):
    """
    Tạo/cập nhật ProblemFrame chuẩn hóa theo TRIZ cho ResearchSession (canonical spec).
    Ref: docs/API_CONTRACTS.md, docs/DOMAIN_SCHEMA.md
    """
    # 1. Kiểm tra ResearchSession có tồn tại trong database
    session_exists = False
    if service._session is not None:
        session_exists = (
            service._session.query(ResearchSession).filter_by(id=session_id).first()
            is not None
        )
    elif service._engine is not None:
        with Session(service._engine) as db_sess:
            session_exists = (
                db_sess.query(ResearchSession).filter_by(id=session_id).first()
                is not None
            )

    if not session_exists:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    # 2. Gọi service xử lý structuring
    try:
        frame = service.structure_problem(
            session_id=session_id,
            raw_statement=body.raw_statement,
            domain=body.domain,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )

    return {
        "id": str(frame.id),
        "session_id": str(frame.session_id),
        "raw_statement": frame.raw_statement,
        "normalized_statement": frame.normalized_statement,
        "contradiction_type": (
            frame.contradiction_type.value
            if hasattr(frame.contradiction_type, "value")
            else str(frame.contradiction_type)
        ),
        "improving_parameter": frame.improving_parameter,
        "worsening_parameter": frame.worsening_parameter,
        "domain": frame.domain,
        "created_at": frame.created_at.isoformat() if frame.created_at else None,
    }


@router.post("/{session_id}/problem-frames")
async def create_problem_frame(session_id: str, body: ProblemFrameCreate):
    """Tạo ProblemFrame từ raw problem statement (legacy plural route)."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "data": {
            "id": f"pf_{uuid.uuid4().hex[:8]}",
            "research_session_id": session_id,
            "version": 1,
            "raw_problem_statement": body.raw_problem_statement,
            "normalized_problem_statement": None,
            "review_status": "pending",
            "created_at": now,
        }
    }


@router.post("/{session_id}/advance")
async def advance_stage(session_id: str, body: dict):
    """Chuyển workflow sang stage tiếp theo."""
    to_stage = body.get("to_stage")
    valid_stages = ["intake", "structuring", "retrieval", "ideation", "evaluation", "synthesis"]
    if to_stage not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {valid_stages}")
    return {"data": {"session_id": session_id, "current_stage": to_stage}}
