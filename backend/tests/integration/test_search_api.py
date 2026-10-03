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


@pytest.mark.asyncio
async def test_search_api_returns_total_hits_and_facet_counts(
    override_retrieval_service_dependency,
    db_session: Session,
    sample_document: Document,
    sample_chunks: list[Chunk],
    mock_openai_embedding,
):
    """
    Phase 10.3 Increment 14: Search response bao gồm total_hits và facet_counts.
    """
    # Create an additional document with different metadata
    doc2 = Document(
        filename="research_paper_1.md",
        filepath="docs/research_paper_1.md",
        title="Research Paper on TRIZ Contradictions",
        topic="function",
        source_type="research_paper",
        phase="2",
        golden=False,
        content_hash="hash_rp_123",
    )
    db_session.add(doc2)
    db_session.flush()

    chunk2 = Chunk(
        document_id=doc2.id,
        content="Nghiên cứu về mâu thuẫn kỹ thuật và các quy luật phát triển hệ thống",
        chunk_index=0,
        embedding=[0.0] * 1536,
    )
    db_session.add(chunk2)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/search",
            json={
                "query": "mâu thuẫn",
                "top_k": 10,
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert "total_hits" in data
    assert "facet_counts" in data
    assert data["total_hits"] >= 2

    facets = data["facet_counts"]
    assert "topic" in facets
    assert "source_type" in facets
    assert "phase" in facets
    assert "golden" in facets
    assert "research_paper" in facets["source_type"]
    assert facets["golden"].get("true", 0) >= 1
    assert facets["golden"].get("false", 0) >= 1


@pytest.mark.asyncio
async def test_search_api_total_hits_exceeds_top_k(
    override_retrieval_service_dependency,
    db_session: Session,
    sample_document: Document,
    sample_chunks: list[Chunk],
    mock_openai_embedding,
):
    """
    Phase 10.3 Increment 14: Khi top_k nhỏ hơn tổng candidate match,
    total_hits vẫn phản ánh đúng tổng số candidates trước khi slice.
    """
    # Create 3 more documents matching "mâu thuẫn"
    for i in range(3):
        d = Document(
            filename=f"extra_doc_{i}.md",
            filepath=f"docs/extra_{i}.md",
            title=f"Extra Doc {i}",
            topic="contradiction",
            source_type="case_study",
            golden=False,
            content_hash=f"hash_extra_{i}",
        )
        db_session.add(d)
        db_session.flush()
        c = Chunk(
            document_id=d.id,
            content=f"Giải quyết mâu thuẫn kỹ thuật trường hợp số {i}",
            chunk_index=0,
            embedding=[0.0] * 1536,
        )
        db_session.add(c)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post(
            "/api/v1/search",
            json={
                "query": "mâu thuẫn",
                "top_k": 2,
            },
        )

    assert resp.status_code == 200
    data = resp.json()
    assert len(data["results"]) == 2
    assert data["total_hits"] >= 4


@pytest.mark.asyncio
async def test_search_api_pagination_offset_and_has_more(
    override_retrieval_service_dependency,
    db_session: Session,
    sample_document: Document,
    sample_chunks: list[Chunk],
    mock_openai_embedding,
):
    """
    Phase 10.3 Increment 15: Search API hỗ trợ offset, limit/top_k, và trường has_more.
    """
    # Create 4 documents matching "nguyên tắc"
    for i in range(4):
        d = Document(
            filename=f"doc_page_{i}.md",
            filepath=f"docs/doc_page_{i}.md",
            title=f"Doc Page {i}",
            topic="contradiction",
            source_type="case_study",
            golden=False,
            content_hash=f"hash_page_{i}",
        )
        db_session.add(d)
        db_session.flush()
        c = Chunk(
            document_id=d.id,
            content=f"Áp dụng nguyên tắc giải quyết bài toán số {i}",
            chunk_index=0,
            embedding=[0.0] * 1536,
        )
        db_session.add(c)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Page 1: offset=0, limit=2 -> has_more should be True
        resp1 = await client.post(
            "/api/v1/search",
            json={
                "query": "nguyên tắc",
                "offset": 0,
                "top_k": 2,
            },
        )
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert "offset" in data1
        assert "limit" in data1
        assert "has_more" in data1
        assert data1["offset"] == 0
        assert data1["limit"] == 2
        assert len(data1["results"]) == 2
        assert data1["total_hits"] >= 4
        assert data1["has_more"] is True

        page1_ids = [item["chunk_id"] for item in data1["results"]]

        # Page 2: offset=2, limit=2 -> disjoint from page 1
        resp2 = await client.post(
            "/api/v1/search",
            json={
                "query": "nguyên tắc",
                "offset": 2,
                "top_k": 2,
            },
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["offset"] == 2
        assert data2["limit"] == 2
        assert len(data2["results"]) >= 1
        page2_ids = [item["chunk_id"] for item in data2["results"]]
        assert not set(page1_ids).intersection(set(page2_ids))
        assert data2["total_hits"] == data1["total_hits"]
        assert data2["facet_counts"] == data1["facet_counts"]
