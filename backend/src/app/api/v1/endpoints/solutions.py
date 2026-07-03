from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

router = APIRouter()


class SolutionCreate(BaseModel):
    session_id: str
    title: str
    mechanism: str
    inspired_by: list[str] = []


@router.post("")
async def create_solution(body: SolutionCreate):
    """Tạo candidate solution mới."""
    now = datetime.utcnow().isoformat() + "Z"
    return {
        "data": {
            "id": f"sol_{uuid.uuid4().hex[:8]}",
            "session_id": body.session_id,
            "title": body.title,
            "mechanism": body.mechanism,
            "status": "draft",
            "created_at": now,
        }
    }
