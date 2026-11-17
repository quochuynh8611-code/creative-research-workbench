from __future__ import annotations

import hashlib
import json
import logging
import time
import uuid
from typing import Any, Generator, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.cache import get_cache
from app.core.config import settings
from app.services.cross_session_discovery_service import (
    CrossSessionDiscoveryService,
    SessionNotFoundError,
)
from app.services.retrieval_service import RetrievalService

logger = logging.getLogger(__name__)

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
    offset: int = 0
    limit: int | None = None
    filters: dict[str, Any] | None = None


class SearchResultItem(BaseModel):
    chunk_id: str
    source_ref: str
    excerpt: str
    score: float
    metadata: dict[str, Any] = Field(default_factory=dict)
    document_id: str | None = None
    chunk_index: int = 0


class FacetCounts(BaseModel):
    topic: dict[str, int] = Field(default_factory=dict)
    source_type: dict[str, int] = Field(default_factory=dict)
    phase: dict[str, int] = Field(default_factory=dict)
    golden: dict[str, int] = Field(default_factory=dict)


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    latency_ms: float
    total_hits: int = 0
    facet_counts: FacetCounts = Field(default_factory=FacetCounts)
    offset: int = 0
    limit: int = 5
    has_more: bool = False


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


def _build_search_cache_key(
    query: str, top_k: int, offset: int, filters: dict[str, Any] | None
) -> str:
    normalized_filters = json.dumps(filters or {}, sort_keys=True)
    raw = f"search:{query.strip().lower()}:{top_k}:{offset}:{normalized_filters}"
    return "search:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


# ──────────────────────────────────────────────
# Route Handlers
# ──────────────────────────────────────────────

@router.post("", response_model=SearchResponse)
async def semantic_search(
    body: SearchRequest,
    response: Response,
    service: RetrievalService = Depends(get_retrieval_service),
) -> SearchResponse:
    """Hybrid search trên Knowledge Base (Full-text + Vector + RRF) có phân trang và caching."""
    start_time = time.perf_counter()
    effective_limit = body.limit if body.limit is not None else body.top_k
    cache = get_cache()
    cache_key = _build_search_cache_key(body.query, effective_limit, body.offset, body.filters)

    # 1. Kiểm tra Cache Hit nếu enabled
    if settings.ENABLE_CACHE:
        try:
            cached_data = cache.safe_get(cache_key)
            if cached_data is not None:
                latency_ms = round((time.perf_counter() - start_time) * 1000, 2)
                response.headers["X-Cache"] = "HIT"
                return SearchResponse(
                    results=[SearchResultItem(**r) for r in cached_data["results"]],
                    latency_ms=latency_ms,
                    total_hits=cached_data["total_hits"],
                    facet_counts=FacetCounts(**cached_data["facet_counts"]),
                    offset=cached_data["offset"],
                    limit=cached_data["limit"],
                    has_more=cached_data["has_more"],
                )
        except Exception as exc:
            logger.warning(f"Search cache read failed gracefully: {exc}")

    # 2. Cache Miss: Thực thi truy vấn cơ sở dữ liệu gốc
    response.headers["X-Cache"] = "MISS"
    raw_results, total_hits, facet_counts = service.search_with_facets(
        query=body.query,
        top_k=effective_limit,
        offset=body.offset,
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

    has_more = (body.offset + len(results)) < total_hits

    # 3. Lưu vào Cache nếu enabled
    if settings.ENABLE_CACHE:
        try:
            cache.safe_set(
                cache_key,
                {
                    "results": [r.model_dump() for r in results],
                    "total_hits": total_hits,
                    "facet_counts": facet_counts,
                    "offset": body.offset,
                    "limit": effective_limit,
                    "has_more": has_more,
                },
                ttl=settings.CACHE_DEFAULT_TTL,
            )
        except Exception as exc:
            logger.warning(f"Search cache write failed gracefully: {exc}")

    return SearchResponse(
        results=results,
        latency_ms=latency_ms,
        total_hits=total_hits,
        facet_counts=FacetCounts(**facet_counts),
        offset=body.offset,
        limit=effective_limit,
        has_more=has_more,
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
