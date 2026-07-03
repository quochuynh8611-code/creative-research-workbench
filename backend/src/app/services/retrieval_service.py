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
from app.services.ingestion_service import EmbeddingClient, MockEmbeddingClient

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
        engine: Engine,
        embedding_client: EmbeddingClient | None = None,
    ) -> None:
        self.engine = engine
        self.embedding_client = embedding_client or MockEmbeddingClient()

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

        Args:
            query:   Câu truy vấn người dùng (plain text).
            top_k:   Số kết quả tối đa trả về.
            filters: Bộ lọc tùy chọn:
                     - "topic": list[str]   — chỉ lấy chunk từ docs có topic trong list
                     - "phase": str         — chỉ lấy chunk từ docs có phase == str

        Returns:
            List[SearchResult] với len <= top_k.
            Rỗng nếu không có kết quả.
        """
        if not query or not query.strip():
            return []

        n_candidates = max(top_k * _CANDIDATE_MULTIPLIER, 20)

        with Session(self.engine) as session:
            # Leg 1: Full-Text Search
            fts_rows = self._fts_search(
                session, query, limit=n_candidates, filters=filters
            )

            # Leg 2: Vector Search
            query_vector = self.embedding_client.embed([query])[0]
            vec_rows = self._vector_search(
                session, query_vector, limit=n_candidates, filters=filters
            )

            # RRF Fusion
            fused_ids = self._rrf_fuse(
                fts_rows=fts_rows,
                vec_rows=vec_rows,
                top_k=top_k,
            )

            if not fused_ids:
                return []

            # Hydrate SearchResult objects
            return self._hydrate(
                session=session,
                ranked_ids=fused_ids,
                query=query,
            )

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
        vec_literal = str(query_vector)
        distance_expr = Chunk.embedding.op("<=>")(  # type: ignore[attr-defined]
            func.cast(vec_literal, Chunk.embedding.type)  # type: ignore[attr-defined]
        )
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
        top_k: int,
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
        return [chunk_id for chunk_id, _ in ranked[:top_k]]

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
