"""
test_caching_api.py — Integration tests cho Caching Layer trên Search và Analytics API

Specifications:
  - Feature: Search & Analytics In-Process Caching Integration
  - Endpoints:
      - POST /api/v1/search (X-Cache header, TTL 300s, invalidation on document mutation)
      - GET /api/v1/analytics/overview (X-Cache header, TTL 60s, refresh query param)
  - Ground Truth: docs/PHASE_12_3_CACHING_LAYER_SPEC.md & docs/ADR-010-caching-layer.md
  - Discipline: Test-First (RED Phase)
"""
from __future__ import annotations

import io
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.core.cache import get_cache
from app.domain.models import Document
from app.main import app
from app.services.retrieval_service import RetrievalService
from app.api.v1.endpoints.search import get_retrieval_service


@pytest.fixture(autouse=True)
def clean_cache():
    """Dọn sạch cache trước và sau mỗi test."""
    cache = get_cache()
    cache.clear()
    yield
    cache.clear()


@pytest.fixture()
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db và db session."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.fixture()
def override_retrieval_service(db_session: Session):
    """Dependency override cho retrieval service."""
    service = RetrievalService(bind=db_session)
    app.dependency_overrides[get_retrieval_service] = lambda: service
    yield
    app.dependency_overrides.pop(get_retrieval_service, None)


@pytest.mark.asyncio
async def test_search_api_caching_hit_and_miss(
    override_retrieval_service,
    override_db_dependency,
    db_session: Session,
):
    """
    Scenario 1: POST /api/v1/search lần 1 là MISS, lần 2 là HIT với kết quả giống hệt nhau.
    """
    # Seed một document
    doc = Document(
        id=uuid.uuid4(),
        filename="test_cache_doc.md",
        filepath="docs/test_cache_doc.md",
        title="Tài liệu Caching TRIZ",
        content_hash="hash_cache_test_1",
        status="canonical",
        golden=True,
    )
    db_session.add(doc)
    db_session.commit()

    query_payload = {
        "query": "tài liệu caching triz",
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

        # Dữ liệu trả về giống hệt nhau
        assert body1["results"] == body2["results"]
        assert body1["total_hits"] == body2["total_hits"]
        assert body1["facet_counts"] == body2["facet_counts"]


@pytest.mark.asyncio
async def test_document_mutation_invalidates_search_cache(
    override_retrieval_service,
    override_db_dependency,
    db_session: Session,
):
    """
    Scenario 2: Khi có thao tác document mutation, search cache bị vô hiệu hóa (lần gọi sau là MISS).
    """
    query_payload = {"query": "test invalidation keyword", "top_k": 5}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Lần 1: MISS
        res1 = await client.post("/api/v1/search", json=query_payload)
        assert res1.status_code == 200
        assert res1.headers.get("X-Cache") == "MISS"

        # Lần 2: HIT
        res2 = await client.post("/api/v1/search", json=query_payload)
        assert res2.status_code == 200
        assert res2.headers.get("X-Cache") == "HIT"

        # Tạo mutation tài liệu mới
        content = b"---\ntitle: Doc Invalidate\ntopic: test\n---\n\nNoi dung test invalidation."
        files = {"file": ("doc_invalidate.md", io.BytesIO(content), "text/markdown")}
        upload_res = await client.post("/api/v1/documents/upload", files=files)
        assert upload_res.status_code in [200, 202]

        # Lần 3 sau mutation: Search cache phải bị vô hiệu hóa -> Trả về MISS
        res3 = await client.post("/api/v1/search", json=query_payload)
        assert res3.status_code == 200
        assert res3.headers.get("X-Cache") == "MISS"


@pytest.mark.asyncio
async def test_analytics_overview_caching_hit_and_miss(override_db_dependency):
    """
    Scenario 3: GET /api/v1/analytics/overview lần 1 là MISS, lần 2 là HIT (generated_at giữ nguyên).
    """
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

        # Dữ liệu và generated_at giữ nguyên từ cache
        assert data1["data"] == data2["data"]
        assert data1["generated_at"] == data2["generated_at"]


@pytest.mark.asyncio
async def test_analytics_refresh_query_param_bypasses_cache(override_db_dependency):
    """
    Scenario 4: GET /api/v1/analytics/overview?refresh=true bỏ qua cache (MISS) và sinh dữ liệu mới.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Lần 1: nạp cache
        res1 = await client.get("/api/v1/analytics/overview")
        assert res1.headers.get("X-Cache") == "MISS"

        # Lần 2: hit cache
        res2 = await client.get("/api/v1/analytics/overview")
        assert res2.headers.get("X-Cache") == "HIT"

        # Lần 3: refresh=true -> bypass cache
        res3 = await client.get("/api/v1/analytics/overview?refresh=true")
        assert res3.status_code == 200
        assert res3.headers.get("X-Cache") == "MISS"


@pytest.mark.asyncio
async def test_caching_fail_safe_graceful_fallback(
    override_retrieval_service,
    override_db_dependency,
):
    """
    Scenario 5: Khi cache gặp ngoại lệ, API tự động fallback về direct query và vẫn trả về HTTP 200.
    """
    cache = get_cache()

    # Giả lập cache.get() gặp exception
    def broken_get(*args, **kwargs):
        raise RuntimeError("Cache backend memory fault")

    cache.get = broken_get

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Search vẫn hoạt động bình thường, không 500
        res = await client.post("/api/v1/search", json={"query": "test fallback", "top_k": 3})
        assert res.status_code == 200

        # Analytics vẫn hoạt động bình thường, không 500
        res_a = await client.get("/api/v1/analytics/overview")
        assert res_a.status_code == 200
