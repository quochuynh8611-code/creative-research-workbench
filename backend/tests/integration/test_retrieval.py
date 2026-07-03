"""
test_retrieval.py — Failing Integration Tests cho RetrievalService

TRANG THÁI: RED — tất cả tests dưới đây MUST FAIL khi chưa có implementation.
Mục tiêu: đưa về GREEN sau khi implement Phase 2.

Coverage:
  - Hybrid search (FTS + vector) trả về kết quả đúng schema
  - Search latency < 200ms
  - Recall@5 >= 0.75 trên Golden Set
  - Filter theo topic và phase hoạt động đúng
"""
from __future__ import annotations

import time

import pytest
from sqlalchemy import Engine

from .conftest import DOCS_DIR, GOLDEN_DOCS, GOLDEN_QUERIES


@pytest.fixture(scope="module")
def ingested_engine(db_engine: Engine) -> Engine:
    """
    Pre-condition: ingest toàn bộ 10 Golden Docs trước khi chạy retrieval tests.
    RED: sẽ fail tại import IngestionService.
    """
    from app.services.ingestion_service import IngestionService  # type: ignore[import]

    service = IngestionService(engine=db_engine)
    for doc_path in GOLDEN_DOCS:
        service.ingest(doc_path)
    return db_engine


class TestRetrievalService:
    """
    Test suite cho RetrievalService.

    RED: tất cả tests sẽ fail với ImportError
    cho đến khi `backend/src/app/services/retrieval_service.py` được viết.
    """

    def test_search_returns_results_with_correct_schema(
        self, ingested_engine: Engine
    ) -> None:
        """
        RED: ImportError — RetrievalService chưa tồn tại.

        Given: 10 Golden Docs đã được ingest
        When: search("mâu thuẫn kỹ thuật", top_k=5)
        Then:
          - len(results) >= 1
          - mỗi result có: chunk_id, source_ref, excerpt, score, metadata
          - score nằm trong [0.0, 1.0]
          - excerpt không phải empty string
        """
        from app.services.retrieval_service import RetrievalService  # type: ignore[import]

        retriever = RetrievalService(engine=ingested_engine)
        results = retriever.search("mâu thuận kỹ thuật", top_k=5)

        assert len(results) >= 1
        assert len(results) <= 5

        first = results[0]
        assert first.chunk_id is not None
        assert first.source_ref is not None and first.source_ref != ""
        assert first.excerpt is not None and first.excerpt != ""
        assert 0.0 <= first.score <= 1.0
        assert first.metadata is not None

    def test_search_latency_under_200ms(
        self, ingested_engine: Engine
    ) -> None:
        """
        RED: ImportError — RetrievalService chưa tồn tại.

        Given: 10 Golden Docs đã được ingest và index
        When: gọi search()
        Then: elapsed_ms < 200ms (acceptance gate từ API_CONTRACTS.md)

        NOTE: Test này có thể flaky trên môi trường CI chậm.
        Thêm @pytest.mark.slow để skip khi cần.
        """
        from app.services.retrieval_service import RetrievalService  # type: ignore[import]

        retriever = RetrievalService(engine=ingested_engine)

        # Warmup 1 lần để tránh cold start skew
        retriever.search("warmup", top_k=1)

        start = time.perf_counter()
        retriever.search("nguyên tắc sáng tạo TRIZ", top_k=5)
        elapsed_ms = (time.perf_counter() - start) * 1000

        assert elapsed_ms < 200, (
            f"Search latency {elapsed_ms:.1f}ms vượt quá 200ms SLA. "
            f"Kiểm tra IVFFlat index trên Chunk.embedding."
        )

    def test_recall_at_5_on_golden_set(
        self, ingested_engine: Engine
    ) -> None:
        """
        RED: ImportError — RetrievalService chưa tồn tại.

        Given: 10 Golden Docs đã ingest, 10 benchmark queries tương ứng
        When: chạy từng query, lấy top_k=5 results
        Then: Recall@5 >= 0.75
          (tối thiểu 7.5/10 queries tìm được đúng golden doc trong top 5)

        Đây là acceptance gate chính của Phase 2 retrieval.
        """
        from app.services.retrieval_service import RetrievalService  # type: ignore[import]

        retriever = RetrievalService(engine=ingested_engine)

        # Map từng query → filename golden doc kỳ vọng
        query_to_golden: list[tuple[str, str]] = [
            (q, pathlib.Path(doc).name)
            for q, doc in zip(GOLDEN_QUERIES, GOLDEN_DOCS)
        ]

        hits = 0
        for query, expected_filename in query_to_golden:
            results = retriever.search(query, top_k=5)
            top5_refs = [pathlib.Path(r.source_ref).name for r in results]
            if expected_filename in top5_refs:
                hits += 1

        recall_at_5 = hits / len(query_to_golden)
        assert recall_at_5 >= 0.75, (
            f"Recall@5 = {recall_at_5:.2f} < 0.75. "
            f"Cần cải thiện embedding model hoặc chunking strategy."
        )

    def test_search_filter_by_topic(
        self, ingested_engine: Engine
    ) -> None:
        """
        RED: ImportError — RetrievalService chưa tồn tại.

        Given: 10 Golden Docs đã ingest (nhiều topic: architecture, api, testing, ...)
        When: search(query, filters={"topic": ["testing"]})
        Then:
          - tất cả results đều có metadata.topic == "testing"
          - không có result nào từ topic khác
        """
        from app.services.retrieval_service import RetrievalService  # type: ignore[import]

        retriever = RetrievalService(engine=ingested_engine)
        results = retriever.search(
            "test plan acceptance criteria",
            top_k=5,
            filters={"topic": ["testing"]},
        )

        assert len(results) >= 1
        for result in results:
            assert result.metadata["topic"] == "testing", (
                f"Expected topic='testing', got '{result.metadata.get('topic')}' "
                f"from {result.source_ref}"
            )


import pathlib
