"""
test_search_api.py — Integration tests cho HTTP Search Endpoint

Specification:
  - Endpoint: POST /api/v1/search
  - Contract: docs/API_CONTRACTS.md
  - Scope: Phase 2 Step 4 — Search HTTP Boundary
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints.search import get_retrieval_service
from app.domain.models import Chunk, Document
from app.main import app
from app.services.retrieval_service import RetrievalService


@pytest.fixture()
def override_retrieval_service_dependency(db_session: Session):
    """
    Dependency override minh bạch cho endpoint search,
    truyền db_session của test vào RetrievalService và cleanup sau test.
    """
    service = RetrievalService(bind=db_session)
    app.dependency_overrides[get_retrieval_service] = lambda: service
    yield
    app.dependency_overrides.pop(get_retrieval_service, None)


@pytest.mark.asyncio
async def test_search_api_returns_valid_contract_shape(
    override_retrieval_service_dependency,
    sample_document: Document,
    sample_chunks: list[Chunk],
    mock_openai_embedding,
):
    """
    GIVEN: Ứng dụng FastAPI đang chạy và corpus có dữ liệu
    WHEN: Gọi POST /api/v1/search với body hợp lệ theo API contract
    THEN: Response trả về 200, có key 'results' và 'latency_ms'
          và mỗi item có đủ trường (chunk_id, source_ref, excerpt, score, metadata)
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/search",
            json={
                "query": "mâu thuẫn tốc độ và độ tin cậy",
                "top_k": 5,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "latency_ms" in data
    assert isinstance(data["latency_ms"], (int, float))
    assert isinstance(data["results"], list)
    assert len(data["results"]) >= 1

    item = data["results"][0]
    assert "chunk_id" in item
    assert "source_ref" in item
    assert "excerpt" in item
    assert "score" in item
    assert "metadata" in item


@pytest.mark.asyncio
async def test_search_api_empty_corpus_returns_empty_results(
    override_retrieval_service_dependency,
    mock_openai_embedding,
):
    """
    GIVEN: Corpus rỗng hoặc truy vấn không có kết quả
    WHEN: Gọi POST /api/v1/search
    THEN: Response trả về 200, results là list rỗng, không crash và có latency_ms
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/search",
            json={
                "query": "truy vấn không có trong corpus",
                "top_k": 5,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert isinstance(data["results"], list)
    assert data["results"] == []
    assert "latency_ms" in data
    assert isinstance(data["latency_ms"], (int, float))


@pytest.mark.asyncio
async def test_search_api_accepts_top_k_parameter(
    override_retrieval_service_dependency,
    sample_document: Document,
    sample_chunks: list[Chunk],
    mock_openai_embedding,
):
    """
    GIVEN: Request có tham số top_k = 2
    WHEN: Gọi POST /api/v1/search
    THEN: API chấp nhận tham số top_k, trả về tối đa 2 kết quả,
          và response shape không chứa key 'meta' placeholder cũ
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/search",
            json={
                "query": "triz",
                "top_k": 2,
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "latency_ms" in data
    assert "meta" not in data
    assert len(data["results"]) <= 2
