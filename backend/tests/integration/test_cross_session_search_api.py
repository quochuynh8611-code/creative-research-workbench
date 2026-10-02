"""
test_cross_session_search_api.py — Integration tests cho Phase 10.2: Cross-Session Knowledge Discovery.

Specifications:
  - Feature: Cross-Session Knowledge Discovery
  - Endpoint: GET /api/v1/search/cross-session
  - Spec: docs/PHASE_10_2_CROSS_SESSION_DISCOVERY_SPEC.md
  - Matrix: docs/PHASE_10_2_CROSS_SESSION_DISCOVERY_GHERKIN_MATRIX.md
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone, timedelta
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    Contradiction,
    ContradictionType,
    ProblemFrame,
    ResearchSession,
    SessionStatus,
)
from app.main import app


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db và engine."""
    from app.api.v1.endpoints.search import get_db
    app.dependency_overrides[get_db] = lambda: db_session
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_cross_session_search_success_with_matching_parameters(db_session: Session):
    """
    Scenario 1: Tìm kiếm thành công các session có TRIZ parameters và principles tương đồng.
    GIVEN: Session A (nguồn) và Session B (đích) có cùng parameters và domain
    WHEN: Gọi GET /api/v1/search/cross-session?session_id={Session_A_ID}&top_k=5&min_score=0.1
    THEN: Trả về HTTP 200, has_problem_frame=True, matched_sessions chứa Session B với điểm cao, Session A không nằm trong kết quả.
    """
    now = datetime.now(timezone.utc)

    # Session A (Source)
    session_a = ResearchSession(
        title="Tối ưu hóa tản nhiệt pin xe điện",
        status=SessionStatus.active,
        workflow_state="structuring",
        created_at=now,
    )
    db_session.add(session_a)
    db_session.flush()

    pf_a = ProblemFrame(
        session_id=session_a.id,
        raw_statement="Cần tăng tốc độ sạc nhưng pin bị quá nhiệt",
        domain="energy",
        contradiction_type=ContradictionType.technical,
        improving_parameter="Speed",
        worsening_parameter="Temperature",
    )
    db_session.add(pf_a)
    db_session.flush()

    contra_a = Contradiction(
        problem_frame_id=pf_a.id,
        type=ContradictionType.technical,
        statement="Tốc độ sạc vs Nhiệt độ",
        suggested_principles=[1, 35],
    )
    db_session.add(contra_a)

    # Session B (Target - High Match)
    session_b = ResearchSession(
        title="Kiểm soát nhiệt độ động cơ siêu tốc",
        status=SessionStatus.active,
        workflow_state="ideation",
        created_at=now + timedelta(minutes=5),
    )
    db_session.add(session_b)
    db_session.flush()

    pf_b = ProblemFrame(
        session_id=session_b.id,
        raw_statement="Tăng tốc độ quay động cơ nhưng làm tăng nhiệt độ ma sát",
        domain="energy",
        contradiction_type=ContradictionType.technical,
        improving_parameter="Speed",
        worsening_parameter="Temperature",
    )
    db_session.add(pf_b)
    db_session.flush()

    contra_b = Contradiction(
        problem_frame_id=pf_b.id,
        type=ContradictionType.technical,
        statement="Tốc độ vs Nhiệt độ",
        suggested_principles=[1, 35, 19],
    )
    db_session.add(contra_b)

    # Session C (Target - Low/No Match)
    session_c = ResearchSession(
        title="Thiết kế vỏ robot siêu nhẹ",
        status=SessionStatus.active,
        workflow_state="structuring",
        created_at=now + timedelta(minutes=10),
    )
    db_session.add(session_c)
    db_session.flush()

    pf_c = ProblemFrame(
        session_id=session_c.id,
        raw_statement="Giảm khối lượng nhưng giữ độ bền",
        domain="mechanics",
        contradiction_type=ContradictionType.physical,
        improving_parameter="Weight",
        worsening_parameter="Strength",
    )
    db_session.add(pf_c)
    db_session.flush()

    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/search/cross-session?session_id={session_a.id}&top_k=5&min_score=0.1")

    assert response.status_code == 200
    data = response.json()
    assert data["source_session_id"] == str(session_a.id)
    assert data["has_problem_frame"] is True
    assert data["reason"] is None
    assert isinstance(data["matched_sessions"], list)
    assert len(data["matched_sessions"]) >= 1

    matched_ids = [m["session_id"] for m in data["matched_sessions"]]
    assert str(session_b.id) in matched_ids
    assert str(session_a.id) not in matched_ids  # No self-match

    top_match = data["matched_sessions"][0]
    assert top_match["session_id"] == str(session_b.id)
    assert top_match["similarity_score"] >= 0.8
    assert len(top_match["match_reasons"]) >= 3
    assert top_match["shared_parameters"]["improving_parameter"] == "Speed"
    assert top_match["shared_parameters"]["worsening_parameter"] == "Temperature"
    assert 1 in top_match["shared_parameters"]["shared_principles"]


@pytest.mark.asyncio
async def test_cross_session_search_excludes_self(db_session: Session):
    """
    Scenario 2: Source session không được tự match chính nó.
    """
    session = ResearchSession(
        title="Nghiên cứu vật liệu composite",
        status=SessionStatus.active,
    )
    db_session.add(session)
    db_session.flush()

    pf = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng độ bền vật liệu",
        improving_parameter="Strength",
    )
    db_session.add(pf)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/search/cross-session?session_id={session.id}")

    assert response.status_code == 200
    data = response.json()
    matched_ids = [m["session_id"] for m in data["matched_sessions"]]
    assert str(session.id) not in matched_ids


@pytest.mark.asyncio
async def test_cross_session_search_excludes_archived(db_session: Session):
    """
    Scenario 3: Loại trừ các session có trạng thái archived khỏi kết quả tìm kiếm.
    """
    now = datetime.now(timezone.utc)

    session_active = ResearchSession(
        title="Active Session",
        status=SessionStatus.active,
        created_at=now,
    )
    db_session.add(session_active)
    db_session.flush()

    pf_active = ProblemFrame(
        session_id=session_active.id,
        raw_statement="Tăng độ chính xác",
        improving_parameter="Accuracy",
    )
    db_session.add(pf_active)

    session_archived = ResearchSession(
        title="Archived Old Session",
        status=SessionStatus.archived,
        created_at=now + timedelta(minutes=1),
    )
    db_session.add(session_archived)
    db_session.flush()

    pf_archived = ProblemFrame(
        session_id=session_archived.id,
        raw_statement="Tăng độ chính xác",
        improving_parameter="Accuracy",
    )
    db_session.add(pf_archived)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/search/cross-session?session_id={session_active.id}")

    assert response.status_code == 200
    data = response.json()
    matched_ids = [m["session_id"] for m in data["matched_sessions"]]
    assert str(session_archived.id) not in matched_ids


@pytest.mark.asyncio
async def test_cross_session_search_no_problem_frame_returns_deterministic_empty(db_session: Session):
    """
    Scenario 4: Session nguồn chưa có problem_frame trả về 200 OK rỗng kèm reason='no_problem_frame'.
    """
    session = ResearchSession(
        title="Session mới chưa qua intake",
        status=SessionStatus.active,
    )
    db_session.add(session)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/search/cross-session?session_id={session.id}")

    assert response.status_code == 200
    data = response.json()
    assert data["source_session_id"] == str(session.id)
    assert data["has_problem_frame"] is False
    assert data["reason"] == "no_problem_frame"
    assert data["matched_sessions"] == []
    assert data["total_candidates_analyzed"] == 0
    assert "latency_ms" in data


@pytest.mark.asyncio
async def test_cross_session_search_session_not_found_404():
    """
    Scenario 5: Session không tồn tại trả về lỗi HTTP 404.
    """
    random_uuid = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/search/cross-session?session_id={random_uuid}")

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()


@pytest.mark.asyncio
async def test_cross_session_search_top_k_and_min_score_contract(db_session: Session):
    """
    Scenario 6: Kiểm tra query parameters top_k và min_score.
    """
    now = datetime.now(timezone.utc)
    source = ResearchSession(title="Source Session", status=SessionStatus.active, created_at=now)
    db_session.add(source)
    db_session.flush()

    pf_src = ProblemFrame(
        session_id=source.id,
        raw_statement="Source statement",
        domain="engineering",
        improving_parameter="Speed",
        worsening_parameter="Weight",
        contradiction_type=ContradictionType.technical,
    )
    db_session.add(pf_src)

    # Add 5 candidate sessions
    for i in range(5):
        cand = ResearchSession(title=f"Cand {i}", status=SessionStatus.active, created_at=now + timedelta(minutes=i + 1))
        db_session.add(cand)
        db_session.flush()
        pf = ProblemFrame(
            session_id=cand.id,
            raw_statement=f"Cand {i} statement",
            domain="engineering",
            improving_parameter="Speed",
            worsening_parameter="Weight",
            contradiction_type=ContradictionType.technical,
        )
        db_session.add(pf)

    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Limit top_k to 2
        resp = await client.get(f"/api/v1/search/cross-session?session_id={source.id}&top_k=2&min_score=0.2")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["matched_sessions"]) == 2

        # High min_score filters out candidates if threshold is high (e.g. 0.95)
        resp_strict = await client.get(f"/api/v1/search/cross-session?session_id={source.id}&top_k=5&min_score=0.99")
        assert resp_strict.status_code == 200
        data_strict = resp_strict.json()
        # All candidates have same score ~0.85 (no principles overlap yet), so min_score 0.99 yields 0
        assert len(data_strict["matched_sessions"]) == 0


@pytest.mark.asyncio
async def test_cross_session_search_stable_ordering(db_session: Session):
    """
    Scenario 7: Thứ tự sắp xếp ổn định (Score DESC, Created_at DESC, ID ASC).
    """
    now = datetime.now(timezone.utc)
    source = ResearchSession(title="Source Session", status=SessionStatus.active, created_at=now)
    db_session.add(source)
    db_session.flush()

    pf_src = ProblemFrame(
        session_id=source.id,
        raw_statement="Source statement",
        improving_parameter="Speed",
    )
    db_session.add(pf_src)

    # Cand Older
    cand_older = ResearchSession(title="Older Cand", status=SessionStatus.active, created_at=now + timedelta(minutes=1))
    db_session.add(cand_older)
    db_session.flush()
    pf_older = ProblemFrame(session_id=cand_older.id, raw_statement="Older", improving_parameter="Speed")
    db_session.add(pf_older)

    # Cand Newer
    cand_newer = ResearchSession(title="Newer Cand", status=SessionStatus.active, created_at=now + timedelta(minutes=5))
    db_session.add(cand_newer)
    db_session.flush()
    pf_newer = ProblemFrame(session_id=cand_newer.id, raw_statement="Newer", improving_parameter="Speed")
    db_session.add(pf_newer)

    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get(f"/api/v1/search/cross-session?session_id={source.id}")

    assert resp.status_code == 200
    data = resp.json()
    matches = data["matched_sessions"]
    assert len(matches) == 2
    # Cand newer must come first
    assert matches[0]["session_id"] == str(cand_newer.id)
    assert matches[1]["session_id"] == str(cand_older.id)
