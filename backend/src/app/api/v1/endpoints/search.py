from __future__ import annotations

import time
import uuid
from typing import Any, Generator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.cross_session_discovery_service import (
    CrossSessionDiscoveryService,
    SessionNotFoundError,
)
from app.services.retrieval_service import RetrievalService

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
    """Dependency cung cấp SQLAlchemy Session cho search router."""
    engine = get_engine()
    session = Session(bind=engine)
    try:
        yield session
    finally:
        session.close()


def get_retrieval_service() -> RetrievalService:
    """Dependency cung cấp RetrievalService theo cấu hình database mặc định."""
    return RetrievalService(bind=get_engine())


def get_cross_session_discovery_service(
    db: Session = Depends(get_db),
) -> CrossSessionDiscoveryService:
    """Dependency cung cấp CrossSessionDiscoveryService cho router."""
    return CrossSessionDiscoveryService(bind=db)


# ──────────────────────────────────────────────
# Schemas (API_CONTRACTS.md & PHASE_10_2_SPEC)
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


class MatchedSessionResponseItem(BaseModel):
    session_id: str
    title: str
    domain: Optional[str] = None
    status: str
    similarity_score: float
    match_reasons: list[str] = Field(default_factory=list)
    shared_parameters: dict[str, Any] = Field(default_factory=dict)
    created_at: Optional[str] = None


class CrossSessionSearchResponse(BaseModel):
    source_session_id: str
    has_problem_frame: bool
    reason: Optional[str] = None
    matched_sessions: list[MatchedSessionResponseItem]
    total_candidates_analyzed: int
    latency_ms: float


# ──────────────────────────────────────────────
# Route Handlers
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


@router.get("/cross-session", response_model=CrossSessionSearchResponse)
async def discover_cross_sessions(
    session_id: uuid.UUID = Query(..., description="ID của phiên nghiên cứu nguồn"),
    top_k: int = Query(default=5, ge=1, le=50, description="Số lượng session tương tự tối đa"),
    min_score: float = Query(default=0.1, ge=0.0, le=1.0, description="Ngưỡng điểm tương đồng tối thiểu"),
    service: CrossSessionDiscoveryService = Depends(get_cross_session_discovery_service),
) -> CrossSessionSearchResponse:
    """
    Tìm kiếm các phiên nghiên cứu có cấu trúc bài toán TRIZ tương đồng (Phase 10.2).
    """
    start_time = time.perf_counter()
    try:
        result = service.discover_related_sessions(
            session_id=session_id,
            top_k=top_k,
            min_score=min_score,
        )
    except SessionNotFoundError as err:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(err),
        ) from err

    latency_ms = round((time.perf_counter() - start_time) * 1000, 2)

    return CrossSessionSearchResponse(
        source_session_id=result.source_session_id,
        has_problem_frame=result.has_problem_frame,
        reason=result.reason,
        matched_sessions=[
            MatchedSessionResponseItem(
                session_id=item.session_id,
                title=item.title,
                domain=item.domain,
                status=item.status,
                similarity_score=item.similarity_score,
                match_reasons=item.match_reasons,
                shared_parameters=item.shared_parameters,
                created_at=item.created_at,
            )
            for item in result.matched_sessions
        ],
        total_candidates_analyzed=result.total_candidates_analyzed,
        latency_ms=latency_ms,
    )
