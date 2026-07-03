from uuid import UUID
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

router = APIRouter()


# --- Schemas ---

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


# --- Routes ---

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_session(body: SessionCreate):
    """Tạo research session mới."""
    now = datetime.utcnow().isoformat() + "Z"
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


@router.post("/{session_id}/problem-frames")
async def create_problem_frame(session_id: str, body: ProblemFrameCreate):
    """Tạo ProblemFrame từ raw problem statement."""
    now = datetime.utcnow().isoformat() + "Z"
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
