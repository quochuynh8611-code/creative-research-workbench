"""
test_session_query_api.py — Integration tests cho Phase 4.5: Session Query & Detail Read APIs

Specifications:
  - Feature: Session Querying, Filtering, and Detail Retrieval
  - Endpoints:
      - GET /api/v1/sessions
      - GET /api/v1/sessions/{session_id}
  - Contracts: docs/API_CONTRACTS.md, docs/DOMAIN_SCHEMA.md, docs/UI_MODULE_BREAKDOWN.md
  - Scope: Phase 4.5 — RED Integration Tests
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    ContradictionType,
    ProblemFrame,
    ResearchSession,
    SessionStatus,
)
from app.main import app


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


# ──────────────────────────────────────────────
# List Sessions Tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_sessions_returns_persisted_sessions(db_session: Session):
    """
    GIVEN: Có 2 ResearchSession trong DB
    WHEN: Gọi GET /api/v1/sessions
    THEN: Trả về HTTP 200 và mảng 'data' chứa đầy đủ các session đã persist
    """
    session_1 = ResearchSession(
        title="Session 1: Giảm ma sát ổ bi",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    session_2 = ResearchSession(
        title="Session 2: Tối ưu truyền động",
        status=SessionStatus.completed,
        workflow_state="synthesis",
    )
    db_session.add_all([session_1, session_2])
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions")

    assert response.status_code == 200
    data = response.json()
    sessions_list = data.get("data", [])
    assert len(sessions_list) >= 2

    session_ids = [str(s.get("id")) for s in sessions_list]
    assert str(session_1.id) in session_ids
    assert str(session_2.id) in session_ids


@pytest.mark.asyncio
async def test_list_sessions_supports_limit(db_session: Session):
    """
    GIVEN: Có 3 session trong DB
    WHEN: Gọi GET /api/v1/sessions?limit=2
    THEN: Chỉ trả về tối đa 2 item trong data
    """
    s1 = ResearchSession(title="Session Limit 1", status=SessionStatus.active)
    s2 = ResearchSession(title="Session Limit 2", status=SessionStatus.active)
    s3 = ResearchSession(title="Session Limit 3", status=SessionStatus.active)
    db_session.add_all([s1, s2, s3])
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions?limit=2")

    assert response.status_code == 200
    data = response.json()
    sessions_list = data.get("data", [])
    assert len(sessions_list) == 2


@pytest.mark.asyncio
async def test_list_sessions_filters_by_status(db_session: Session):
    """
    GIVEN: Có session với status 'active' và 'archived'
    WHEN: Gọi GET /api/v1/sessions?status=active
    THEN: Chỉ trả về sessions có status 'active'
    """
    active_session = ResearchSession(title="Active Session", status=SessionStatus.active)
    archived_session = ResearchSession(title="Archived Session", status=SessionStatus.archived)
    db_session.add_all([active_session, archived_session])
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions?status=active")

    assert response.status_code == 200
    data = response.json()
    sessions_list = data.get("data", [])

    assert any(s["id"] == str(active_session.id) for s in sessions_list)
    assert not any(s["id"] == str(archived_session.id) for s in sessions_list)


@pytest.mark.asyncio
async def test_list_sessions_filters_by_query(db_session: Session):
    """
    GIVEN: Các session với title khác nhau
    WHEN: Gọi GET /api/v1/sessions?q=rung
    THEN: Chỉ trả về session có title chứa từ khóa 'rung'
    """
    match_session = ResearchSession(title="Giảm rung cánh quạt", status=SessionStatus.active)
    other_session = ResearchSession(title="Tăng áp lực khí nén", status=SessionStatus.active)
    db_session.add_all([match_session, other_session])
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions?q=rung")

    assert response.status_code == 200
    data = response.json()
    sessions_list = data.get("data", [])

    assert any(s["id"] == str(match_session.id) for s in sessions_list)
    assert not any(s["id"] == str(other_session.id) for s in sessions_list)


# ──────────────────────────────────────────────
# Get Session Detail Tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_session_returns_session_detail(db_session: Session):
    """
    GIVEN: 1 ResearchSession đã persist trong DB
    WHEN: Gọi GET /api/v1/sessions/{id}
    THEN: Trả về HTTP 200 với đầy đủ thông tin chi tiết (id, title, status, workflow_state)
    """
    session = ResearchSession(
        title="Detail Test Session",
        description="Mô tả chi tiết bài toán",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}")

    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    assert payload["id"] == str(session.id)
    assert payload["title"] == "Detail Test Session"
    assert payload["status"] in (SessionStatus.active.value, "active")
    assert payload["workflow_state"] == "structuring"


@pytest.mark.asyncio
async def test_get_session_returns_404_for_missing_id(db_session: Session):
    """
    GIVEN: Một session_id không tồn tại trong DB
    WHEN: Gọi GET /api/v1/sessions/{random_uuid}
    THEN: Trả về HTTP 404 Not Found
    """
    non_existent_id = uuid.uuid4()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{non_existent_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_session_includes_latest_problem_frame_if_exists(db_session: Session):
    """
    GIVEN: Session có ProblemFrame liên kết
    WHEN: Gọi GET /api/v1/sessions/{id}
    THEN: Response chứa trường problem_frame (hoặc current_problem_frame) với thông tin mâu thuẫn
    """
    session = ResearchSession(
        title="Session with ProblemFrame",
        status=SessionStatus.active,
        workflow_state="retrieval",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng tốc độ nhưng làm giảm độ tin cậy",
        normalized_statement="speed vs reliability",
        contradiction_type=ContradictionType.technical,
        improving_parameter="speed",
        worsening_parameter="reliability",
    )
    db_session.add(frame)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}")

    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    assert "problem_frame" in payload or "problem_frames" in payload or "current_problem_frame" in payload
    pf = payload.get("problem_frame") or payload.get("current_problem_frame")
    if pf:
        assert pf["raw_statement"] == "Tăng tốc độ nhưng làm giảm độ tin cậy"
        assert pf["contradiction_type"] in ("technical", ContradictionType.technical.value)
