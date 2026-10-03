"""
retrieval_service.py — Hybrid Search: Full-Text + Vector (RRF fusion)

Strategy:
  Hai search leg độc lập chạy song song ló văn trong cùng 1 transaction;
  kết quả được hòa trộn qua Reciprocal Rank Fusion (RRF) với k=60.

  Leg 1 — Full-Text Search (FTS):
    PostgreSQL tsvector + websearch_to_tsquery (việt/english config).
    Score: ts_rank_cd() — ưu tiên từ khóa chính xác.

  Leg 2 — Vector Search:
    pgvector cosine distance (<=>).
    Score: 1.0 - cosine_distance (∈ [0, 1]).
    Hiệu quả khi EmbeddingClient thực (MockClient → zero-vectors, không có tín hiệu).

  Fusion — RRF:
    score_rrf(d) = Σ 1 / (k + rank_i(d))  với k=60.
    Dedup theo chunk_id. Top-k sau sắp xếp giảm dần.

Filters:
  filters={"topic": ["architecture", "testing"], "phase": "1"}
  Được áp dụng qua JOIN Document trước cả hai leg.

Ref: docs/API_CONTRACTS.md (POST /search), docs/ADR-001-architecture.md
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import Engine, Float, Integer, Select, cast, func, select, text
from sqlalchemy.orm import Session

from app.domain.models import Chunk, Document, SearchResult
from app.services.embedding_client import (
    EmbeddingClient,
    MockEmbeddingClient,
    get_embedding_client,
)

logger = logging.getLogger(__name__)

# RRF constant (standard = 60)
_RRF_K: int = 60

# Cấu hình full-text search language
_FTS_CONFIG: str = "simple"  # 'simple' an toàn với tiếng Việt; 'english' cho en

# Số candidate tối đa lấy từ mỗi leg trước khi fuse (>= top_k * 4)
_CANDIDATE_MULTIPLIER: int = 4


class RetrievalService:
    """
    Hybrid search trên Knowledge Base.

    Args:
        engine:           SQLAlchemy Engine (PostgreSQL + pgvector).
        embedding_client: EmbeddingClient impl để encode query vector.
                          Default: MockEmbeddingClient (zero-vectors).

    Usage:
        retriever = RetrievalService(engine=engine)
        results = retriever.search("mâu thuẫn kỹ thuật", top_k=5)
        results = retriever.search(
            "test plan",
            top_k=5,
            filters={"topic": ["testing"]},
        )
    """

    def __init__(
        self,
        bind: Engine | Session,
        embedding_client: EmbeddingClient | None = None,
    ) -> None:
        if isinstance(bind, Session):
            self._session: Session | None = bind
            self._engine: Engine | None = None
        else:
            self._session = None
            self._engine = bind
        self.embedding_client = embedding_client or get_embedding_client()

    @property
    def engine(self) -> Engine | None:
        """Thuộc tính engine hỗ trợ backward compatibility."""
        return self._engine

    # ──────────────────────────────────────────
    # Public API
    # ──────────────────────────────────────────

    def search(
        self,
        query: str,
        top_k: int = 5,
        filters: dict[str, Any] | None = None,
    ) -> list[SearchResult]:
        """
        Hybrid search trả về danh sách SearchResult sắp xếp theo RRF score giảm dần.
        """
        results, _, _ = self.search_with_facets(
            query=query,
            top_k=top_k,
            filters=filters,
        )
        return results

    def search_with_facets(
        self,
        query: str,
        top_k: int = 5,
        offset: int = 0,
        filters: dict[str, Any] | None = None,
    ) -> tuple[list[SearchResult], int, dict[str, Any]]:
        """
        Hybrid search trả về:
        (list[SearchResult], total_hits, facet_counts) với phân trang offset/top_k.
        """
        empty_facets: dict[str, Any] = {
            "topic": {},
            "source_type": {},
            "phase": {},
            "golden": {},
        }
        if not query or not query.strip():
            return [], 0, empty_facets

        effective_offset = max(offset, 0)
        n_candidates = max((effective_offset + top_k) * _CANDIDATE_MULTIPLIER, 20)

        if self._session is not None:
            return self._execute_search_with_facets(
                session=self._session,
                query=query,
                top_k=top_k,
                offset=effective_offset,
                n_candidates=n_candidates,
                filters=filters,
            )

        with Session(self._engine) as session:
            return self._execute_search_with_facets(
                session=session,
                query=query,
                top_k=top_k,
                offset=effective_offset,
                n_candidates=n_candidates,
                filters=filters,
            )

    def _execute_search_with_facets(
        self,
        session: Session,
        query: str,
        top_k: int,
        offset: int,
        n_candidates: int,
        filters: dict[str, Any] | None,
    ) -> tuple[list[SearchResult], int, dict[str, Any]]:
        # Leg 1: Full-Text Search
        fts_rows = self._fts_search(
            session, query, limit=n_candidates, filters=filters
        )

        # Leg 2: Vector Search
        query_vector = self.embedding_client.embed([query])[0]
        vec_rows = self._vector_search(
            session, query_vector, limit=n_candidates, filters=filters
        )

        # RRF Fusion on all candidate matches
        all_fused_ids = self._rrf_fuse(
            fts_rows=fts_rows,
            vec_rows=vec_rows,
            top_k=None,
        )

        if not all_fused_ids:
            return [], 0, {
                "topic": {},
                "source_type": {},
                "phase": {},
                "golden": {},
            }

        total_hits = len(all_fused_ids)
        window_fused_ids = all_fused_ids[offset : offset + top_k]

        # Calculate facet counts on all candidate matches
        stmt = (
            select(Document.topic, Document.source_type, Document.phase, Document.golden)
            .join(Chunk, Chunk.document_id == Document.id)
            .where(Chunk.id.in_(all_fused_ids))
        )
        facet_rows = session.execute(stmt).all()

        topic_counts: dict[str, int] = {}
        source_type_counts: dict[str, int] = {}
        phase_counts: dict[str, int] = {}
        golden_counts: dict[str, int] = {}

        for row in facet_rows:
            if row[0]:
                topic_counts[str(row[0])] = topic_counts.get(str(row[0]), 0) + 1
            if row[1]:
                source_type_counts[str(row[1])] = source_type_counts.get(str(row[1]), 0) + 1
            if row[2] is not None:
                phase_counts[str(row[2])] = phase_counts.get(str(row[2]), 0) + 1
            if row[3] is not None:
                g_key = "true" if row[3] else "false"
                golden_counts[g_key] = golden_counts.get(g_key, 0) + 1

        facet_counts = {
            "topic": topic_counts,
            "source_type": source_type_counts,
            "phase": phase_counts,
            "golden": golden_counts,
        }

        # Hydrate SearchResult objects for current window
        results = self._hydrate(
            session=session,
            ranked_ids=window_fused_ids,
            query=query,
        )

        return results, total_hits, facet_counts

    def _execute_search(
        self,
        session: Session,
        query: str,
        top_k: int,
        n_candidates: int,
        filters: dict[str, Any] | None,
    ) -> list[SearchResult]:
        results, _, _ = self._execute_search_with_facets(
            session=session,
            query=query,
            top_k=top_k,
            n_candidates=n_candidates,
            filters=filters,
        )
        return results

    # ──────────────────────────────────────────
    # Leg 1: Full-Text Search
    # ──────────────────────────────────────────

    def _fts_search(
        self,
        session: Session,
        query: str,
        limit: int,
        filters: dict[str, Any] | None,
    ) -> list[tuple[uuid.UUID, float]]:
        """
        Full-text search qua tsvector được tạo on-the-fly.
        Trả về list of (chunk_id, ts_rank) sắp xếp giảm dần.
        """
        # to_tsvector(config, content) @@ websearch_to_tsquery(config, query)
        ts_query = func.websearch_to_tsquery(_FTS_CONFIG, query)
        ts_vector = func.to_tsvector(_FTS_CONFIG, Chunk.content)
        ts_rank = func.ts_rank_cd(ts_vector, ts_query)

        stmt: Select = (
            select(Chunk.id, ts_rank.label("rank"))
            .join(Document, Chunk.document_id == Document.id)
            .where(ts_vector.op("@@")(ts_query))
            .order_by(ts_rank.desc())
            .limit(limit)
        )
        stmt = self._apply_filters(stmt, filters)

        rows = session.execute(stmt).all()
        return [(row[0], float(row[1])) for row in rows]

    # ──────────────────────────────────────────
    # Leg 2: Vector Search
    # ──────────────────────────────────────────

    def _vector_search(
        self,
        session: Session,
        query_vector: list[float],
        limit: int,
        filters: dict[str, Any] | None,
    ) -> list[tuple[uuid.UUID, float]]:
        """
        Vector cosine search qua pgvector (<=> operator).
        Trả về list of (chunk_id, similarity_score) sắp xếp giảm dần.
        Skip nếu embedding là zero-vector (MockEmbeddingClient).
        """
        # Kiểm tra zero-vector: không có tín hiệu — skip để tránh nhiễu
        if all(v == 0.0 for v in query_vector):
            return []

        # Cosine distance: <=> trả về [0, 2] (0 = giống hệt, 2 = đối lập)
        # similarity = 1 - distance ∈ [-1, 1]; clip về [0, 1]
        distance_expr = Chunk.embedding.cosine_distance(query_vector)  # type: ignore[attr-defined]
        similarity = (1.0 - cast(distance_expr, Float)).label("similarity")

        stmt: Select = (
            select(Chunk.id, similarity)
            .join(Document, Chunk.document_id == Document.id)
            .where(Chunk.embedding.is_not(None))  # type: ignore[attr-defined]
            .order_by(distance_expr.asc())
            .limit(limit)
        )
        stmt = self._apply_filters(stmt, filters)

        rows = session.execute(stmt).all()
        # Clip score về [0.0, 1.0]
        return [(row[0], max(0.0, min(1.0, float(row[1])))) for row in rows]

    # ──────────────────────────────────────────
    # RRF Fusion
    # ──────────────────────────────────────────

    @staticmethod
    def _rrf_fuse(
        fts_rows: list[tuple[uuid.UUID, float]],
        vec_rows: list[tuple[uuid.UUID, float]],
        top_k: int | None = None,
        k: int = _RRF_K,
    ) -> list[uuid.UUID]:
        """
        Reciprocal Rank Fusion.

        score_rrf(d) = Σ 1 / (k + rank_i(d))  cho mỗi leg i có d

        Trả về list chunk_id sắp xếp theo RRF score giảm dần, đã dedup.
        """
        rrf_scores: dict[uuid.UUID, float] = {}

        for rank, (chunk_id, _score) in enumerate(fts_rows, start=1):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (k + rank)

        for rank, (chunk_id, _score) in enumerate(vec_rows, start=1):
            rrf_scores[chunk_id] = rrf_scores.get(chunk_id, 0.0) + 1.0 / (k + rank)

        ranked = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)
        if top_k is not None:
            return [chunk_id for chunk_id, _ in ranked[:top_k]]
        return [chunk_id for chunk_id, _ in ranked]

    # ──────────────────────────────────────────
    # Hydration
    # ──────────────────────────────────────────

    def _hydrate(
        self,
        session: Session,
        ranked_ids: list[uuid.UUID],
        query: str,
    ) -> list[SearchResult]:
        """
        JOIN Chunk + Document để lấy đủ thông tin populate SearchResult.
        Giữ nguyên thứ tự RRF của ranked_ids.
        """
        if not ranked_ids:
            return []

        stmt = (
            select(Chunk, Document)
            .join(Document, Chunk.document_id == Document.id)
            .where(Chunk.id.in_(ranked_ids))
        )
        rows = session.execute(stmt).all()

        # Index theo chunk_id để giữ thứ tự RRF
        chunk_map: dict[uuid.UUID, tuple[Chunk, Document]] = {
            chunk.id: (chunk, doc) for chunk, doc in rows
        }

        results: list[SearchResult] = []
        for rank, chunk_id in enumerate(ranked_ids, start=1):
            if chunk_id not in chunk_map:
                continue
            chunk, doc = chunk_map[chunk_id]

            # RRF score: 1 / (k + rank) như là normalized score dịp
            rrf_score = 1.0 / (_RRF_K + rank)

            excerpt = self._make_excerpt(chunk.content)

            results.append(
                SearchResult(
                    chunk_id=chunk.id,
                    source_ref=doc.filepath,
                    excerpt=excerpt,
                    score=round(rrf_score, 6),
                    document_id=doc.id,
                    chunk_index=chunk.chunk_index,
                    metadata={
                        "topic": doc.topic,
                        "source_type": doc.source_type,
                        "golden": doc.golden,
                        "phase": doc.phase,
                        "status": doc.status.value if doc.status else None,
                        "language": doc.language,
                    },
                )
            )
        return results

    # ──────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────

    @staticmethod
    def _apply_filters(
        stmt: Select,
        filters: dict[str, Any] | None,
    ) -> Select:
        """
        Áp dụng WHERE clauses từ filters dict lên stmt.
        Giả định stmt đã JOIN Document.
        """
        if not filters:
            return stmt

        topic_filter = filters.get("topic")
        if topic_filter:
            if isinstance(topic_filter, str):
                topic_filter = [topic_filter]
            stmt = stmt.where(Document.topic.in_(topic_filter))

        phase_filter = filters.get("phase")
        if phase_filter is not None:
            stmt = stmt.where(Document.phase == str(phase_filter))

        golden_filter = filters.get("golden")
        if golden_filter is not None:
            stmt = stmt.where(Document.golden == bool(golden_filter))

        source_type_filter = filters.get("source_type")
        if source_type_filter:
            if isinstance(source_type_filter, str):
                source_type_filter = [source_type_filter]
            stmt = stmt.where(Document.source_type.in_(source_type_filter))

        return stmt


    @staticmethod
    def _make_excerpt(content: str, max_chars: int = 500) -> str:
        """
        Cắt content xuống tối đa max_chars ký tự, kết thúc tại ranh giới từ.
        Thêm ellipsis nếu bị cắt.
        """
        content = content.strip()
        if len(content) <= max_chars:
            return content
        # Cắt tại ranh giới từ
        truncated = content[:max_chars]
        last_space = truncated.rfind(" ")
        if last_space > max_chars * 0.8:  # đủ dài để cắt tại từ
            truncated = truncated[:last_space]
        return truncated + "…"
