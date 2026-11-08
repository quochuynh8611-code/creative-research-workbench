"""
Integration test for GET /api/v1/sessions/{session_id}/recommendations
Verifies that recommendations can be retrieved directly by session ID without advancing the workflow state.
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


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.mark.asyncio
async def test_get_session_recommendations_success(db_session: Session):
    session = ResearchSession(
        title="Recommendations direct retrieval test",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Cần tăng tốc độ nhưng sợ quá nhiệt",
        normalized_statement="Tăng tốc độ mà không tăng nhiệt độ",
        contradiction_type=ContradictionType.technical,
        improving_parameter="speed",
        worsening_parameter="temperature",
    )
    db_session.add(frame)
    db_session.flush()

    contra = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Tăng tốc độ làm tăng nhiệt độ",
        suggested_principles=[10, 19, 28, 35],
    )
    db_session.add(contra)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/recommendations")

    assert response.status_code == 200
    res_data = response.json()
    assert "data" in res_data
    methods = res_data["data"]
    assert len(methods) == 4
    principle_ids = [m["principle_id"] for m in methods]
    assert principle_ids == [10, 19, 28, 35]


@pytest.mark.asyncio
async def test_get_session_recommendations_not_found(db_session: Session):
    random_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{random_id}/recommendations")

    assert response.status_code == 404
