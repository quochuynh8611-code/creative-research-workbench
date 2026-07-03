from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class SearchRequest(BaseModel):
    query: str
    session_id: Optional[str] = None
    limit: int = 10


@router.post("")
async def semantic_search(body: SearchRequest):
    """Semantic retrieval trên kho tài liệu TRIZ."""
    # TODO: implement pgvector hybrid search
    return {
        "results": [],
        "meta": {
            "query": body.query,
            "total": 0,
            "note": "Retrieval engine not yet implemented — Phase 2",
        },
    }
