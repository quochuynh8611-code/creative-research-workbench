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


@pytest.mark.asyncio
async def test_search_api_filters_by_golden(
    override_retrieval_service_dependency,
    db_session: Session,
    sample_document: Document,
    sample_chunks: list[Chunk],
    mock_openai_embedding,
):
    """
    Scenario 1: Search lọc theo golden: true / false.
    """
    # Create non-golden document with chunk
    doc_non_golden = Document(
        filename="non_golden_doc.md",
        filepath="docs/non_golden_doc.md",
        title="Non Golden TRIZ Doc",
        topic="triz",
        source_type="draft_notes",
        golden=False,
        content_hash="hash_non_golden_123",
    )
    db_session.add(doc_non_golden)
    db_session.flush()

    chunk_non_golden = Chunk(
        document_id=doc_non_golden.id,
        content="Nội dung thử nghiệm về mâu thuẫn kỹ thuật trong tài liệu draft",
        chunk_index=0,
        embedding=[0.0] * 1536,
    )
    db_session.add(chunk_non_golden)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Filter golden = true: only sample_document (golden=True) should be returned
        resp_golden = await client.post(
            "/api/v1/search",
            json={
                "query": "mâu thuẫn",
                "top_k": 10,
                "filters": {"golden": True},
            },
        )
        assert resp_golden.status_code == 200
        results_golden = resp_golden.json()["results"]
        assert len(results_golden) >= 1
        for item in results_golden:
            assert item["metadata"]["golden"] is True

        # 2. Filter golden = false: only doc_non_golden should be returned
        resp_draft = await client.post(
            "/api/v1/search",
            json={
                "query": "mâu thuẫn",
                "top_k": 10,
                "filters": {"golden": False},
            },
        )
        assert resp_draft.status_code == 200
        results_draft = resp_draft.json()["results"]
        assert len(results_draft) >= 1
        for item in results_draft:
            assert item["metadata"]["golden"] is False


@pytest.mark.asyncio
async def test_search_api_filters_by_source_type(
    override_retrieval_service_dependency,
    db_session: Session,
    sample_document: Document,
    sample_chunks: list[Chunk],
    mock_openai_embedding,
):
    """
    Scenario 2: Search lọc theo source_type.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Match sample_document source_type (sample_document in conftest has source_type="golden_kb" or similar)
        src_type = sample_document.source_type or "core_framework"
        resp = await client.post(
            "/api/v1/search",
            json={
                "query": "mâu thuẫn",
                "top_k": 10,
                "filters": {"source_type": src_type},
            },
        )
        assert resp.status_code == 200
        results = resp.json()["results"]
        assert len(results) >= 1
        for item in results:
            assert item["metadata"]["source_type"] == src_type

        # Filter with non-matching source_type
        resp_empty = await client.post(
            "/api/v1/search",
            json={
                "query": "mâu thuẫn",
                "top_k": 10,
                "filters": {"source_type": "non_existent_source_type_xyz"},
            },
        )
        assert resp_empty.status_code == 200
        assert len(resp_empty.json()["results"]) == 0
