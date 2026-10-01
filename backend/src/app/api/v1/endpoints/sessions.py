from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Generator, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.domain.models import (
    ProblemFrame,
    ResearchNote,
    ResearchSession,
    SessionStatus,
)
from app.services.ai_analysis_service import AIAnalysisService
from app.services.method_recommender import MethodRecommender
from app.services.problem_structuring_service import ProblemStructuringService
from app.services.session_export_service import export_session_as_markdown
from app.services.workflow_engine import (
    InvalidTransitionError,
    WorkflowEngine,
    WorkflowState,
)

router = APIRouter()


# ──────────────────────────────────────────────
# Dependency Injection
# ──────────────────────────────────────────────

_engine = None


def get_engine():
    global _engine
    if _engine is None:
        db_url = settings.DATABASE_URL
        if "asyncpg" in db_url:
            db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
        _engine = create_engine(db_url, pool_pre_ping=True)
    return _engine


def get_db() -> Generator[Session, None, None]:
    """Dependency cung cấp SQLAlchemy Session cho database."""
    engine = get_engine()
    session = Session(bind=engine)
    try:
        yield session
    finally:
        session.close()


def get_problem_structuring_service() -> ProblemStructuringService:
    """Dependency cung cấp ProblemStructuringService theo cấu hình database mặc định."""
    return ProblemStructuringService(bind=get_engine())


def get_workflow_engine() -> WorkflowEngine:
    """Dependency cung cấp WorkflowEngine theo cấu hình database mặc định."""
    return WorkflowEngine(bind=get_engine())


def get_method_recommender() -> MethodRecommender:
    """Dependency cung cấp MethodRecommender theo cấu hình database mặc định."""
    return MethodRecommender(bind=get_engine())


def get_ai_analysis_service() -> AIAnalysisService:
    """Dependency cung cấp AIAnalysisService theo cấu hình LLM mặc định."""
    return AIAnalysisService(rule_service=ProblemStructuringService())



# ──────────────────────────────────────────────
# Schemas
# ──────────────────────────────────────────────

class SessionCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str | None = None
    domain: str = "research"
    tags: list[str] = []

    @field_validator("title")
    @classmethod
    def validate_title_not_whitespace(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("title must not be empty or whitespace only")
        return v.strip()


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

    @field_validator("raw_statement")
    @classmethod
    def validate_statement_not_whitespace(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("raw_statement must not be empty or whitespace only")
        return v.strip()


class AIProblemAnalysisRequest(BaseModel):
    raw_statement: str = Field(..., min_length=1)
    domain: str | None = None

    @field_validator("raw_statement")
    @classmethod
    def validate_statement_not_whitespace(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("raw_statement must not be empty or whitespace only")
        return v.strip()


VALID_NOTE_TYPES = {"insight", "hypothesis", "decision", "question", "action"}


class ResearchNoteCreate(BaseModel):
    content: str = Field(..., min_length=1)
    note_type: str = "insight"
    source_chunk_id: Optional[uuid.UUID] = None

    @field_validator("content")
    @classmethod
    def validate_content_not_whitespace(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("content must not be empty or whitespace only")
        return v.strip()

    @field_validator("note_type")
    @classmethod
    def validate_note_type(cls, v: str) -> str:
        clean = (v or "").strip().lower()
        if clean not in VALID_NOTE_TYPES:
            raise ValueError(
                f"Invalid note_type '{v}'. Must be one of: {sorted(list(VALID_NOTE_TYPES))}"
            )
        return clean


# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(
    body: SessionCreate,
    db: Session | None = Depends(get_db),
):
    """Tạo research session mới và persist vào database."""
    now_iso = datetime.now(timezone.utc).isoformat()

    if db is not None:
        session_record = ResearchSession(
            title=body.title,
            description=body.description,
            status=SessionStatus.active,
            workflow_state="idle",
        )
        db.add(session_record)
        db.flush()
        db.commit()
        db.refresh(session_record)

        created_iso = (
            session_record.created_at.isoformat()
            if session_record.created_at
            else now_iso
        )
        updated_iso = (
            session_record.updated_at.isoformat()
            if session_record.updated_at
            else created_iso
        )

        session_payload = {
            "id": str(session_record.id),
            "title": session_record.title,
            "description": session_record.description,
            "domain": body.domain,
            "status": (
                session_record.status.value
                if hasattr(session_record.status, "value")
                else str(session_record.status)
            ),
            "tags": body.tags,
            "workflow_state": session_record.workflow_state,
            "created_at": created_iso,
            "updated_at": updated_iso,
        }
    else:
        # Fallback khi không có DB connection (dùng cho smoke/health check)
        session_payload = {
            "id": f"ses_{uuid.uuid4().hex[:8]}",
            "title": body.title,
            "domain": body.domain,
            "status": "draft",
            "tags": body.tags,
            "current_problem_frame_id": None,
            "created_at": now_iso,
            "updated_at": now_iso,
        }

    return {
        **session_payload,
        "data": session_payload,
    }


@router.get("")
async def list_sessions(
    status: Optional[str] = None,
    domain: Optional[str] = None,
    q: Optional[str] = None,
    limit: int = 20,
    db: Session | None = Depends(get_db),
):
    """Liệt kê research sessions từ database."""
    if db is None:
        return {"data": [], "meta": {"total": 0}}

    query = db.query(ResearchSession)
    if status:
        query = query.filter(ResearchSession.status == status)
    else:
        # Phase 5.9 spec: Mặc định GET /api/v1/sessions phải ẩn archived
        query = query.filter(ResearchSession.status != SessionStatus.archived)

    if q:
        query = query.filter(ResearchSession.title.ilike(f"%{q.strip()}%"))

    total_count = query.count()
    records = query.order_by(ResearchSession.created_at.desc()).limit(limit).all()

    items = []
    for r in records:
        items.append({
            "id": str(r.id),
            "title": r.title,
            "description": r.description,
            "domain": domain or "research",
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "workflow_state": r.workflow_state,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })

    return {
        "data": items,
        "meta": {"total": total_count},
    }


@router.post("/{session_id}/archive", status_code=status.HTTP_200_OK)
async def archive_session(
    session_id: uuid.UUID,
    db: Session | None = Depends(get_db),
):
    """
    Lưu trữ an toàn (soft-delete) một ResearchSession.
    Ref: docs/PHASE_5.9_SESSION_LIFECYCLE_SPEC.md
    """
    if db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database session not available")

    record = db.query(ResearchSession).filter_by(id=session_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    current_status = (
        record.status.value
        if hasattr(record.status, "value")
        else str(record.status)
    )
    if current_status == SessionStatus.archived.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Session is already archived.",
        )

    record.status = SessionStatus.archived
    db.flush()
    db.commit()
    db.refresh(record)

    payload = {
        "id": str(record.id),
        "title": record.title,
        "description": record.description,
        "status": record.status.value if hasattr(record.status, "value") else str(record.status),
        "workflow_state": record.workflow_state,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }
    return {
        **payload,
        "data": payload,
    }


@router.post("/{session_id}/restore", status_code=status.HTTP_200_OK)
async def restore_session(
    session_id: uuid.UUID,
    db: Session | None = Depends(get_db),
):
    """
    Khôi phục ResearchSession đã lưu trữ về trạng thái 'active'.
    Ref: docs/PHASE_5.9_SESSION_LIFECYCLE_SPEC.md
    """
    if db is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Database session not available")

    record = db.query(ResearchSession).filter_by(id=session_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    current_status = (
        record.status.value
        if hasattr(record.status, "value")
        else str(record.status)
    )
    if current_status != SessionStatus.archived.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Session is not archived (current status: '{current_status}').",
        )

    # Khóa source of truth Phase 5.9: Always restore to active
    record.status = SessionStatus.active
    db.flush()
    db.commit()
    db.refresh(record)

    payload = {
        "id": str(record.id),
        "title": record.title,
        "description": record.description,
        "status": record.status.value if hasattr(record.status, "value") else str(record.status),
        "workflow_state": record.workflow_state,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
    }
    return {
        **payload,
        "data": payload,
    }



@router.get("/{session_id}")
async def get_session(
    session_id: uuid.UUID,
    db: Session | None = Depends(get_db),
):
    """Lấy chi tiết một session kèm ProblemFrame mới nhất từ database."""
    if db is None:
        raise HTTPException(status_code=404, detail="Session not found")

    record = db.query(ResearchSession).filter_by(id=session_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"ResearchSession with id '{session_id}' not found.")

    frame = (
        db.query(ProblemFrame)
        .filter_by(session_id=session_id)
        .order_by(ProblemFrame.created_at.desc())
        .first()
    )

    frame_payload = None
    if frame:
        frame_payload = {
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
            "domain": frame.domain or "research",
            "created_at": frame.created_at.isoformat() if frame.created_at else None,
        }

    session_payload = {
        "id": str(record.id),
        "title": record.title,
        "description": record.description,
        "domain": "research",
        "status": record.status.value if hasattr(record.status, "value") else str(record.status),
        "workflow_state": record.workflow_state,
        "created_at": record.created_at.isoformat() if record.created_at else None,
        "updated_at": record.updated_at.isoformat() if record.updated_at else None,
        "problem_frame": frame_payload,
        "current_problem_frame": frame_payload,
    }

    return {
        **session_payload,
        "data": session_payload,
    }


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


@router.post("/{session_id}/ai/analyze-problem", status_code=status.HTTP_200_OK)
async def analyze_problem_with_ai(
    session_id: uuid.UUID,
    body: AIProblemAnalysisRequest,
    db: Session | None = Depends(get_db),
    ai_service: AIAnalysisService = Depends(get_ai_analysis_service),
):
    """
    Phân tích bài toán bằng AI/LLM (Phase 6.2 — Ephemeral Suggestion Layer).

    AI Trust Contract Guarantee:
      - Pure suggestion: KHÔNG tự ý ghi đè ProblemFrame hoặc Contradiction trong database.
      - KHÔNG tự động chuyển FSM state.
      - Trả về provenance ("ai_hypothesis" hoặc "rule_based_fallback") kèm metadata.
    Ref: docs/PROFESSIONAL_UPGRADE_ROADMAP.md, docs/PHASE_6_7_EXECUTION_SPEC.md
    """
    # 1. Xác thực session có tồn tại trong database
    if db is not None:
        session_record = db.query(ResearchSession).filter_by(id=session_id).first()
        if not session_record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"ResearchSession with id '{session_id}' not found.",
            )

    # 2. Gọi AI Service thực hiện phân tích
    result = ai_service.analyze_problem(
        raw_statement=body.raw_statement,
        domain=body.domain,
    )

    return {
        "data": {
            "normalized_statement": result.normalized_statement,
            "domain": result.domain,
            "contradiction_type": result.contradiction_type,
            "improving_parameter": result.improving_parameter,
            "worsening_parameter": result.worsening_parameter,
            "suggested_keywords": result.suggested_keywords,
            "reasoning": result.reasoning,
        },
        "_meta": {
            "provenance": result.provenance,
            "provider": result.provider,
            "model": result.model,
            "prompt_version": result.prompt_version,
            "latency_ms": result.latency_ms,
            "fallback_reason": result.fallback_reason,
        },
    }


@router.post("/{session_id}/next-step", status_code=status.HTTP_200_OK)
async def next_step(
    session_id: uuid.UUID,
    db: Session | None = Depends(get_db),
    engine: WorkflowEngine = Depends(get_workflow_engine),
    recommender: MethodRecommender = Depends(get_method_recommender),
):
    """
    Chuyển sang bước nghiên cứu tiếp theo và gợi ý phương pháp giải quyết (FSM next-step).
    Ref: docs/ADR-001-architecture.md, docs/API_CONTRACTS.md, docs/IMPLEMENTATION_ROADMAP.md
    """
    if db is not None:
        engine = WorkflowEngine(bind=db)
        recommender = MethodRecommender(bind=db)

    # 1. Kiểm tra session có tồn tại không
    try:
        previous_state = engine.get_current_state(session_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    # 2. Xác định next state và thực hiện transition
    target_state = engine.get_next_state(session_id)
    if target_state:
        try:
            current_state = engine.transition(session_id, target_state=target_state)
        except InvalidTransitionError as e:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=str(e),
            )
    else:
        current_state = previous_state

    # 3. Gợi ý phương pháp / nguyên tắc TRIZ
    recommendations = recommender.recommend_methods(session_id)

    payload = {
        "session_id": str(session_id),
        "previous_state": previous_state,
        "current_state": current_state,
        "workflow_state": current_state,
        "next_step": current_state,
        "recommended_methods": recommendations,
        "principles": recommendations,
    }
    return {
        **payload,
        "data": payload,
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


# ──────────────────────────────────────────────
# Research Notes Endpoints (Phase 7.2)
# ──────────────────────────────────────────────

@router.get("/{session_id}/notes")
async def list_research_notes(
    session_id: uuid.UUID,
    db: Session | None = Depends(get_db),
):
    """Liệt kê tất cả research notes của một session (sắp xếp mới nhất trước)."""
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    session_record = db.query(ResearchSession).filter_by(id=session_id).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    notes = (
        db.query(ResearchNote)
        .filter_by(session_id=session_id)
        .order_by(ResearchNote.created_at.desc(), ResearchNote.id.desc())
        .all()
    )

    items = []
    for n in notes:
        items.append({
            "id": str(n.id),
            "session_id": str(n.session_id),
            "content": n.content,
            "note_type": n.note_type,
            "source_chunk_id": str(n.source_chunk_id) if n.source_chunk_id else None,
            "created_at": n.created_at.isoformat() if n.created_at else None,
            "updated_at": n.updated_at.isoformat() if n.updated_at else None,
        })

    return {
        "data": items,
        "meta": {"total": len(items)},
    }


@router.post("/{session_id}/notes", status_code=status.HTTP_201_CREATED)
async def create_research_note(
    session_id: uuid.UUID,
    body: ResearchNoteCreate,
    db: Session | None = Depends(get_db),
):
    """Tạo một research note mới gắn với session."""
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    session_record = db.query(ResearchSession).filter_by(id=session_id).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    note = ResearchNote(
        session_id=session_id,
        content=body.content,
        note_type=body.note_type,
        source_chunk_id=body.source_chunk_id,
    )
    db.add(note)
    db.flush()
    db.commit()
    db.refresh(note)

    payload = {
        "id": str(note.id),
        "session_id": str(note.session_id),
        "content": note.content,
        "note_type": note.note_type,
        "source_chunk_id": str(note.source_chunk_id) if note.source_chunk_id else None,
        "created_at": note.created_at.isoformat() if note.created_at else None,
        "updated_at": note.updated_at.isoformat() if note.updated_at else None,
    }

    return {
        **payload,
        "data": payload,
    }


@router.delete("/{session_id}/notes/{note_id}", status_code=status.HTTP_200_OK)
async def delete_research_note(
    session_id: uuid.UUID,
    note_id: uuid.UUID,
    db: Session | None = Depends(get_db),
):
    """Xóa một research note thuộc session."""
    if db is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    session_record = db.query(ResearchSession).filter_by(id=session_id).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    note = (
        db.query(ResearchNote)
        .filter_by(id=note_id, session_id=session_id)
        .first()
    )
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchNote with id '{note_id}' not found in session '{session_id}'.",
        )

    db.delete(note)
    db.flush()
    db.commit()

    return {
        "status": "deleted",
        "id": str(note_id),
        "session_id": str(session_id),
    }


# ──────────────────────────────────────────────
# Session Export Endpoint (Phase 9.1)
# ──────────────────────────────────────────────

@router.get("/{session_id}/export")
async def export_session(
    session_id: uuid.UUID,
    format: str = "md",
    db: Session | None = Depends(get_db),
):
    """
    Xuất báo cáo toàn bộ phiên nghiên cứu ra định dạng Markdown (GFM).
    - Hỗ trợ format: md, markdown (mặc định: md)
    - Trả về Content-Type: text/markdown; charset=utf-8
    - Header Content-Disposition đính kèm file session_{id}.md
    """
    clean_format = (format or "").strip().lower()
    if clean_format not in {"md", "markdown"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported export format '{format}'. Supported formats: md, markdown",
        )

    if db is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    session_record = db.query(ResearchSession).filter_by(id=session_id).first()
    if not session_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"ResearchSession with id '{session_id}' not found.",
        )

    markdown_text = export_session_as_markdown(session_record, db)
    filename = f"session_{session_id}.md"

    return Response(
        content=markdown_text,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
