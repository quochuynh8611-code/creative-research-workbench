from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.retrieval_service import RetrievalService

router = APIRouter()


# ──────────────────────────────────────────────
# Dependency Injection
# ──────────────────────────────────────────────

def get_retrieval_service() -> RetrievalService:
    """Dependency cung cấp RetrievalService theo cấu hình database mặc định."""
    db_url = settings.DATABASE_URL
    if "asyncpg" in db_url:
        db_url = db_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")
    engine = create_engine(db_url)
    return RetrievalService(bind=engine)


# ──────────────────────────────────────────────
# Schemas (API_CONTRACTS.md)
# ──────────────────────────────────────────────

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5
    filters: dict[str, Any] | None = None


class SearchResultItem(BaseModel):
    chunk_id: str
    source_ref: str
    excerpt: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)
    document_id: str | None = None
    chunk_index: int = 0


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    latency_ms: float


# ──────────────────────────────────────────────
# Route Handler
# ──────────────────────────────────────────────

@router.post("", response_model=SearchResponse)
async def semantic_search(
    body: SearchRequest,
    service: RetrievalService = Depends(get_retrieval_service),
) -> SearchResponse:
    """Hybrid search trên Knowledge Base (Full-text + Vector + RRF)."""
    start_time = time.perf_counter()
    raw_results = service.search(
        query=body.query,
        top_k=body.top_k,
        filters=body.filters,
    )
    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    results = [
        SearchResultItem(
            chunk_id=str(r.chunk_id),
            source_ref=r.source_ref,
            excerpt=r.excerpt,
            score=r.score,
            metadata=r.metadata,
            document_id=str(r.document_id) if r.document_id else None,
            chunk_index=r.chunk_index,
        )
        for r in raw_results
    ]

    return SearchResponse(
        results=results,
        latency_ms=latency_ms,
    )
