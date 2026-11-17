"""
test_caching_api.py — Integration tests cho Caching Layer trên Search và Analytics API

Specifications:
  - Feature: Search & Analytics In-Process Caching Integration
  - Endpoints:
      - POST /api/v1/search (X-Cache header, TTL 300s, invalidation on document mutation)
      - GET /api/v1/analytics/overview (X-Cache header, TTL 60s, refresh query param)
  - Ground Truth: docs/PHASE_12_3_CACHING_LAYER_SPEC.md & docs/ADR-010-caching-layer.md
  - Discipline: Test-First (TDD) — Fast In-Memory & CI Compatible
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient

from app.api.v1.endpoints.search import get_retrieval_service
from app.api.v1.endpoints.sessions import get_db
from app.core.cache import get_cache
from app.domain.models import SearchResult
from app.main import app


class MockRetrievalService:
    """Mock RetrievalService phục vụ integration testing độc lập và determinism."""

    def __init__(self, *args, **kwargs) -> None:
        self.call_count = 0

    def search_with_facets(self, query: str, top_k: int = 5, offset: int = 0, filters: dict | None = None):
        self.call_count += 1
        return (
            [
                SearchResult(
                    chunk_id=uuid.uuid4(),
                    source_ref="test_caching_doc.md",
                    excerpt=f"Nội dung tìm kiếm cho '{query}'",
                    score=0.95,
                    metadata={"topic": "caching"},
                    document_id=uuid.uuid4(),
                    chunk_index=0,
                )
            ],
            1,
            {"topic": {"caching": 1}, "source_type": {}, "phase": {}, "golden": {}},
        )


@pytest.fixture(autouse=True)
def clean_cache():
    """Dọn sạch cache trước và sau mỗi test."""
    cache = get_cache()
    cache.clear()
    yield
    cache.clear()


@pytest.fixture()
def mock_retrieval_service():
    """Dependency override cho get_retrieval_service."""
    mock_service = MockRetrievalService()
    app.dependency_overrides[get_retrieval_service] = lambda: mock_service
    yield mock_service
    app.dependency_overrides.pop(get_retrieval_service, None)


@pytest.fixture()
def mock_db_session():
    """Dependency override cho get_db trong integration tests."""
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_search_api_caching_hit_and_miss(mock_retrieval_service):
    """
    Scenario 1: POST /api/v1/search lần 1 là MISS, lần 2 là HIT với kết quả giống hệt nhau.
    """
    query_payload = {
        "query": "mâu thuẫn kỹ thuật",
        "top_k": 5,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Lần 1: Cache MISS
        res1 = await client.post("/api/v1/search", json=query_payload)
        assert res1.status_code == 200
        assert res1.headers.get("X-Cache") == "MISS"
        body1 = res1.json()

        # Lần 2: Cache HIT
        res2 = await client.post("/api/v1/search", json=query_payload)
        assert res2.status_code == 200
        assert res2.headers.get("X-Cache") == "HIT"
        body2 = res2.json()

        # Service chỉ được gọi đúng 1 lần
        assert mock_retrieval_service.call_count == 1

        # Dữ liệu trả về giống hệt nhau
        assert body1["results"] == body2["results"]
        assert body1["total_hits"] == body2["total_hits"]
        assert body1["facet_counts"] == body2["facet_counts"]


@pytest.mark.asyncio
async def test_document_mutation_invalidates_search_cache(mock_retrieval_service):
    """
    Scenario 2: Khi có thao tác document mutation, search cache bị vô hiệu hóa (lần gọi sau là MISS).
    """
    query_payload = {"query": "kiến trúc phần mềm", "top_k": 5}
    cache = get_cache()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Lần 1: MISS
        res1 = await client.post("/api/v1/search", json=query_payload)
        assert res1.status_code == 200
        assert res1.headers.get("X-Cache") == "MISS"

        # Lần 2: HIT
        res2 = await client.post("/api/v1/search", json=query_payload)
        assert res2.status_code == 200
        assert res2.headers.get("X-Cache") == "HIT"
        assert mock_retrieval_service.call_count == 1

        # Kích hoạt invalidation namespace "search" (như khi document upload/update/delete diễn ra)
        cache.invalidate_namespace("search")

        # Lần 3 sau invalidation: Search cache phải bị vô hiệu hóa -> Trả về MISS
        res3 = await client.post("/api/v1/search", json=query_payload)
        assert res3.status_code == 200
        assert res3.headers.get("X-Cache") == "MISS"
        assert mock_retrieval_service.call_count == 2


@pytest.mark.asyncio
async def test_analytics_overview_caching_hit_and_miss(mock_db_session):
    """
    Scenario 3: GET /api/v1/analytics/overview lần 1 là MISS, lần 2 là HIT (generated_at giữ nguyên).
    """
    dummy_overview = {
        "sessions": {"total": 10, "by_status": {"active": 10}, "by_workflow_state": {}, "by_domain": {}},
        "content": {"total_problem_frames": 5, "total_research_notes": 8, "notes_by_type": {}, "total_candidate_solutions": 3, "solutions_by_status": {}},
        "knowledge_base": {"total_documents": 20, "golden_documents": 4, "total_chunks": 100},
        "triz": {"total_contradictions": 2, "by_contradiction_type": {}},
    }

    with patch("app.services.analytics_service.AnalyticsService.get_overview", return_value=dummy_overview) as mock_get:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Lần 1: MISS
            res1 = await client.get("/api/v1/analytics/overview")
            assert res1.status_code == 200
            assert res1.headers.get("X-Cache") == "MISS"
            data1 = res1.json()

            # Lần 2: HIT
            res2 = await client.get("/api/v1/analytics/overview")
            assert res2.status_code == 200
            assert res2.headers.get("X-Cache") == "HIT"
            data2 = res2.json()

            # Service chỉ được gọi đúng 1 lần
            assert mock_get.call_count == 1

            # Dữ liệu và generated_at giữ nguyên từ cache
            assert data1["data"] == data2["data"]
            assert data1["generated_at"] == data2["generated_at"]


@pytest.mark.asyncio
async def test_analytics_refresh_query_param_bypasses_cache(mock_db_session):
    """
    Scenario 4: GET /api/v1/analytics/overview?refresh=true bỏ qua cache (MISS) và sinh dữ liệu mới.
    """
    dummy_overview = {
        "sessions": {"total": 1, "by_status": {}, "by_workflow_state": {}, "by_domain": {}},
        "content": {"total_problem_frames": 1, "total_research_notes": 1, "notes_by_type": {}, "total_candidate_solutions": 1, "solutions_by_status": {}},
        "knowledge_base": {"total_documents": 1, "golden_documents": 0, "total_chunks": 1},
        "triz": {"total_contradictions": 0, "by_contradiction_type": {}},
    }

    with patch("app.services.analytics_service.AnalyticsService.get_overview", return_value=dummy_overview) as mock_get:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Lần 1: nạp cache
            res1 = await client.get("/api/v1/analytics/overview")
            assert res1.headers.get("X-Cache") == "MISS"

            # Lần 2: hit cache
            res2 = await client.get("/api/v1/analytics/overview")
            assert res2.headers.get("X-Cache") == "HIT"
            assert mock_get.call_count == 1

            # Lần 3: refresh=true -> bypass cache
            res3 = await client.get("/api/v1/analytics/overview?refresh=true")
            assert res3.status_code == 200
            assert res3.headers.get("X-Cache") == "MISS"
            assert mock_get.call_count == 2


@pytest.mark.asyncio
async def test_caching_fail_safe_graceful_fallback(mock_retrieval_service, mock_db_session):
    """
    Scenario 5: Khi cache gặp ngoại lệ, API tự động fallback về direct query và vẫn trả về HTTP 200.
    """
    cache = get_cache()

    # Giả lập safe_get gặp exception bất ngờ
    with patch.object(cache, "safe_get", side_effect=RuntimeError("Memory fault in cache engine")):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Search vẫn hoạt động bình thường, trả về 200 (không 500)
            res = await client.post("/api/v1/search", json={"query": "test fallback", "top_k": 3})
            assert res.status_code == 200

            dummy_overview = {
                "sessions": {"total": 0, "by_status": {}, "by_workflow_state": {}, "by_domain": {}},
                "content": {"total_problem_frames": 0, "total_research_notes": 0, "notes_by_type": {}, "total_candidate_solutions": 0, "solutions_by_status": {}},
                "knowledge_base": {"total_documents": 0, "golden_documents": 0, "total_chunks": 0},
                "triz": {"total_contradictions": 0, "by_contradiction_type": {}},
            }
            with patch("app.services.analytics_service.AnalyticsService.get_overview", return_value=dummy_overview):
                res_a = await client.get("/api/v1/analytics/overview")
                assert res_a.status_code == 200


def test_production_cache_key_is_pure_and_test_agnostic():
    """
    Scenario: Production cache key trong analytics.py là 'analytics:overview:global' thuần túy,
    không chứa bất kỳ logic dependency_overrides hay id(db) nào.
    """
    import inspect
    from app.api.v1.endpoints import analytics
    source = inspect.getsource(analytics.get_analytics_overview)
    assert "dependency_overrides" not in source, "get_analytics_overview không được chứa logic test-aware"
    assert "id(db)" not in source, "get_analytics_overview không được chứa id(db) test-aware key"


def test_cache_isolation_fixture_prevents_cross_test_pollution():
    """
    Scenario: Test isolation via fixture prevents cross-test pollution.
    Mỗi test function đều bắt đầu với một cache instance hoàn toàn sạch.
    """
    cache = get_cache()
    assert cache.get("analytics:overview:global") is None
    cache.set("analytics:overview:global", {"polluted": True}, ttl=60)
    assert cache.get("analytics:overview:global") == {"polluted": True}
