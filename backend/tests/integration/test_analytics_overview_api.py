"""
test_analytics_overview_api.py — Integration tests cho Phase 11.1: Session Analytics & Research Intelligence Overview

Specifications:
  - Feature: Analytics Overview REST API (Pure Read-Only, Zero DB Mutation)
  - Endpoint: GET /api/v1/analytics/overview
  - Scope: Phase 11.1A Backend RED Phase
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    CandidateSolution,
    Chunk,
    Contradiction,
    ContradictionType,
    Document,
    DocumentStatus,
    ProblemFrame,
    ResearchNote,
    ResearchSession,
    SessionStatus,
)
from app.main import app


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db và db session."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


def _seed_sample_analytics_dataset(db_session: Session) -> dict[str, list]:
    """Helper tạo bộ dữ liệu mẫu đa dạng cho analytics testing."""
    # Session 1: active, structuring, domain: technical
    s1 = ResearchSession(
        title="Tối ưu động cơ điện",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    # Session 2: paused, ideation, domain: business
    s2 = ResearchSession(
        title="Mô hình kinh doanh SaaS B2B",
        status=SessionStatus.paused,
        workflow_state="ideation",
    )
    # Session 3: archived, idle, NO problem frame (unassigned domain)
    s3 = ResearchSession(
        title="Phiên nghiên cứu tạm dừng",
        status=SessionStatus.archived,
        workflow_state="idle",
    )
    db_session.add_all([s1, s2, s3])
    db_session.flush()

    # Problem frames
    pf1 = ProblemFrame(
        session_id=s1.id,
        raw_statement="Tăng công suất động cơ mà không làm tăng nhiệt độ",
        normalized_statement="Tăng công suất với nhiệt độ an toàn",
        domain="technical",
        contradiction_type=ContradictionType.technical,
    )
    pf2 = ProblemFrame(
        session_id=s2.id,
        raw_statement="Tăng doanh thu nhưng không tăng chi phí bán hàng",
        normalized_statement="Tối ưu tỷ lệ chuyển đổi sales",
        domain="business",
        contradiction_type=ContradictionType.physical,
    )
    db_session.add_all([pf1, pf2])
    db_session.flush()

    # Contradiction
    c1 = Contradiction(
        problem_frame_id=pf1.id,
        type=ContradictionType.technical,
        statement="Công suất vs Nhiệt độ",
        suggested_principles=[1, 10, 35],
    )
    db_session.add(c1)

    # Research Notes
    n1 = ResearchNote(session_id=s1.id, content="Ghi chú về rotor", note_type="insight")
    n2 = ResearchNote(session_id=s1.id, content="Giả thuyết về cuộn dây", note_type="hypothesis")
    n3 = ResearchNote(session_id=s2.id, content="Quyết định giá SaaS", note_type="decision")
    db_session.add_all([n1, n2, n3])

    # Candidate Solutions
    sol1 = CandidateSolution(
        session_id=s1.id,
        title="Lõi rotor rỗng",
        mechanism="Lõi hợp kim giảm quán tính",
        status="candidate",
        novelty_score=0.8,
        feasibility_score=0.7,
    )
    sol2 = CandidateSolution(
        session_id=s2.id,
        title="Freemium model",
        mechanism="Cho dùng thử 14 ngày",
        status="accepted",
        novelty_score=0.9,
        feasibility_score=0.85,
    )
    db_session.add_all([sol1, sol2])

    # Documents & Chunks
    doc1 = Document(
        filename="triz_dynamics.md",
        filepath="docs/triz_dynamics.md",
        title="Nguyên tắc Linh hoạt hóa",
        topic="triz",
        status=DocumentStatus.canonical,
        golden=True,
        content_hash="hash_doc_1_triz",
    )
    doc2 = Document(
        filename="business_models.md",
        filepath="docs/business_models.md",
        title="Các mô hình kinh doanh",
        topic="business",
        status=DocumentStatus.draft,
        golden=False,
        content_hash="hash_doc_2_business",
    )
    db_session.add_all([doc1, doc2])
    db_session.flush()

    chunk1 = Chunk(document_id=doc1.id, content="Đoạn 1 tài liệu TRIZ", chunk_index=0, token_count=100)
    chunk2 = Chunk(document_id=doc1.id, content="Đoạn 2 tài liệu TRIZ", chunk_index=1, token_count=120)
    chunk3 = Chunk(document_id=doc2.id, content="Đoạn 1 tài liệu Business", chunk_index=0, token_count=80)
    db_session.add_all([chunk1, chunk2, chunk3])

    db_session.commit()
    return {
        "sessions": [s1, s2, s3],
        "problem_frames": [pf1, pf2],
        "notes": [n1, n2, n3],
        "solutions": [sol1, sol2],
        "documents": [doc1, doc2],
    }


@pytest.mark.asyncio
async def test_analytics_overview_returns_200_with_expected_top_level_shape(db_session: Session):
    """
    Test 1: Endpoint GET /api/v1/analytics/overview trả về HTTP 200 với đầy đủ 4 nhóm dữ liệu
    GIVEN: Cơ sở dữ liệu có chứa dữ liệu nghiên cứu mẫu
    WHEN: Client gửi request GET /api/v1/analytics/overview
    THEN: Trả về HTTP 200 OK với cấu trúc { data: { sessions, content, knowledge_base, triz }, generated_at }
    """
    _seed_sample_analytics_dataset(db_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/analytics/overview")

    assert response.status_code == 200
    res_json = response.json()
    assert "data" in res_json
    assert "generated_at" in res_json

    data = res_json["data"]
    assert "sessions" in data
    assert "content" in data
    assert "knowledge_base" in data
    assert "triz" in data


@pytest.mark.asyncio
async def test_analytics_overview_aggregates_dynamic_maps_correctly(db_session: Session):
    """
    Test 2: Tổng hợp dữ liệu dynamic maps chính xác từ database
    GIVEN: Dữ liệu mẫu gồm 3 sessions (1 active, 1 paused, 1 archived; 1 session không có problem frame)
    WHEN: Gọi GET /api/v1/analytics/overview
    THEN: Các chỉ số đếm và dynamic breakdown maps khớp chính xác với DB
    """
    _seed_sample_analytics_dataset(db_session)

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/analytics/overview")

    assert response.status_code == 200
    data = response.json()["data"]

    # 1. Sessions group
    sessions = data["sessions"]
    assert sessions["total"] == 3
    assert sessions["by_status"] == {
        "active": 1,
        "paused": 1,
        "archived": 1,
    }
    assert sessions["by_workflow_state"] == {
        "structuring": 1,
        "ideation": 1,
        "idle": 1,
    }
    assert sessions["by_domain"] == {
        "technical": 1,
        "business": 1,
        "unassigned": 1,
    }

    # 2. Content group
    content = data["content"]
    assert content["total_problem_frames"] == 2
    assert content["total_research_notes"] == 3
    assert content["notes_by_type"] == {
        "insight": 1,
        "hypothesis": 1,
        "decision": 1,
    }
    assert content["total_candidate_solutions"] == 2
    assert content["solutions_by_status"] == {
        "candidate": 1,
        "accepted": 1,
    }

    # 3. Knowledge Base group
    kb = data["knowledge_base"]
    assert kb["total_documents"] == 2
    assert kb["golden_documents"] == 1
    assert kb["total_chunks"] == 3

    # 4. TRIZ group
    triz = data["triz"]
    assert triz["total_contradictions"] == 1
    assert triz["by_contradiction_type"] == {
        "technical": 1,
        "physical": 1,
    }


@pytest.mark.asyncio
async def test_analytics_overview_returns_zero_counts_for_empty_database(db_session: Session):
    """
    Test 3: Database trống trả về các bộ đếm bằng 0 và các map rỗng {} an toàn
    GIVEN: Cơ sở dữ liệu hoàn toàn trống (0 bản ghi)
    WHEN: Gọi GET /api/v1/analytics/overview
    THEN: Trả về HTTP 200 OK, tất cả total = 0 và các breakdown map là {}
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/analytics/overview")

    assert response.status_code == 200
    data = response.json()["data"]

    assert data["sessions"]["total"] == 0
    assert data["sessions"]["by_status"] == {}
    assert data["sessions"]["by_workflow_state"] == {}
    assert data["sessions"]["by_domain"] == {}

    assert data["content"]["total_problem_frames"] == 0
    assert data["content"]["total_research_notes"] == 0
    assert data["content"]["notes_by_type"] == {}
    assert data["content"]["total_candidate_solutions"] == 0
    assert data["content"]["solutions_by_status"] == {}

    assert data["knowledge_base"]["total_documents"] == 0
    assert data["knowledge_base"]["golden_documents"] == 0
    assert data["knowledge_base"]["total_chunks"] == 0

    assert data["triz"]["total_contradictions"] == 0
    assert data["triz"]["by_contradiction_type"] == {}


@pytest.mark.asyncio
async def test_analytics_overview_is_read_only_and_does_not_mutate_data(db_session: Session):
    """
    Test 4: Endpoint là pure read-only, không làm thay đổi hay tăng số lượng bản ghi DB
    GIVEN: Dữ liệu mẫu đã có trong DB
    WHEN: Gọi GET /api/v1/analytics/overview liên tiếp 3 lần
    THEN: Không có bản ghi nào bị thêm/bớt/sửa, updated_at của session không thay đổi
    """
    seeded = _seed_sample_analytics_dataset(db_session)
    session_sample = seeded["sessions"][0]
    db_session.refresh(session_sample)
    initial_updated_at = session_sample.updated_at

    count_sessions_before = db_session.query(ResearchSession).count()
    count_notes_before = db_session.query(ResearchNote).count()
    count_solutions_before = db_session.query(CandidateSolution).count()
    count_docs_before = db_session.query(Document).count()
    count_chunks_before = db_session.query(Chunk).count()
    count_frames_before = db_session.query(ProblemFrame).count()
    count_contras_before = db_session.query(Contradiction).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(3):
            res = await client.get("/api/v1/analytics/overview")
            assert res.status_code == 200

    db_session.refresh(session_sample)
    assert session_sample.updated_at == initial_updated_at
    assert db_session.query(ResearchSession).count() == count_sessions_before
    assert db_session.query(ResearchNote).count() == count_notes_before
    assert db_session.query(CandidateSolution).count() == count_solutions_before
    assert db_session.query(Document).count() == count_docs_before
    assert db_session.query(Chunk).count() == count_chunks_before
    assert db_session.query(ProblemFrame).count() == count_frames_before
    assert db_session.query(Contradiction).count() == count_contras_before
