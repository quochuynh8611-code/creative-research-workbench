"""
test_next_step_api.py — Integration tests cho Phase 4: Next-step Workflow API

Specifications:
  - Feature: Next Step Workflow Guidance & State Transition API
  - Endpoint: POST /api/v1/sessions/{session_id}/next-step
  - Architecture: ADR-001 (Workflow Engine + Reasoning)
  - Scope: Phase 4 — RED Integration Tests
"""
from __future__ import annotations

import uuid
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
# API Test Cases
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_next_step_returns_200_for_valid_session(db_session: Session):
    """
    GIVEN: Một ResearchSession hợp lệ ở trạng thái 'idle'
    WHEN: Gọi POST /api/v1/sessions/{session_id}/next-step
    THEN: Trả về HTTP 200 OK và thông tin bước tiếp theo
    """
    session = ResearchSession(
        title="Next step valid session test",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/next-step")

    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    assert "current_state" in payload or "workflow_state" in payload or "next_step" in payload


@pytest.mark.asyncio
async def test_next_step_returns_404_for_missing_session(db_session: Session):
    """
    GIVEN: Một session_id không tồn tại trong DB
    WHEN: Gọi POST /api/v1/sessions/{random_uuid}/next-step
    THEN: Trả về HTTP 404 Not Found
    """
    non_existent_id = uuid.uuid4()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{non_existent_id}/next-step")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_next_step_updates_workflow_state_in_db(db_session: Session):
    """
    GIVEN: Session ở trạng thái 'idle'
    WHEN: Gọi POST /api/v1/sessions/{session_id}/next-step để chuyển bước
    THEN: workflow_state trong database được cập nhật (ví dụ từ idle -> structuring)
    """
    session = ResearchSession(
        title="Next step DB update test",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/next-step")

    assert response.status_code == 200
    db_session.refresh(session)
    assert session.workflow_state != "idle"


@pytest.mark.asyncio
async def test_next_step_returns_recommended_methods(db_session: Session):
    """
    GIVEN: Session ở trạng thái structuring và đã có Technical Contradiction
    WHEN: Gọi POST /api/v1/sessions/{session_id}/next-step
    THEN: Response chứa danh sách phương pháp/nguyên tắc sáng tạo gợi ý (recommended_methods / principles)
    """
    session = ResearchSession(
        title="Next step recommendations test",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng độ bền nhưng làm tăng khối lượng",
        normalized_statement="strength vs weight",
        contradiction_type=ContradictionType.technical,
        improving_parameter="strength",
        worsening_parameter="weight",
    )
    db_session.add(frame)
    db_session.flush()

    contradiction = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Tăng độ bền làm tăng khối lượng",
        suggested_principles=[1, 8, 40, 15],
    )
    db_session.add(contradiction)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/next-step")

    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    assert "recommended_methods" in payload or "principles" in payload or "suggestions" in payload
