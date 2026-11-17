"""
test_ai_coach_api.py — Unit tests for AI Coach suggestions API endpoint (Batch C31).

Tests:
1. POST /api/v1/sessions/{session_id}/coach/suggestions returns HTTP 200 with structured data.
2. POST with non-existent session_id returns HTTP 404.
3. Zero secret leakage in response body or headers.
4. Suggestions count <= 5.
5. Grounding integrity on API level.
"""
from __future__ import annotations

import json
import uuid
from unittest.mock import MagicMock
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.domain.models import ProblemFrame, ResearchSession
from app.main import app
from app.services.ai_coach_service import AICoachService
from app.api.v1.endpoints.sessions import get_ai_coach_service, get_db


@pytest.fixture
def client(db_session):
    app.dependency_overrides[get_db] = lambda: db_session
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)



def test_post_coach_suggestions_success(client, db_session):
    # Setup test session with problem frame
    session = ResearchSession(
        title="Delivery Speed Session",
        domain="logistics",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Muốn giao hàng trong 2 giờ nhưng chi phí đội xe quá lớn",
        normalized_statement="Giao hàng nhanh 2h nhưng chi phí cao",
        contradiction_type="technical",
        improving_parameter="speed",
        worsening_parameter="cost",
    )
    db_session.add(frame)
    db_session.commit()

    response = client.post(f"/api/v1/sessions/{session.id}/coach/suggestions")
    assert response.status_code == status.HTTP_200_OK

    data = response.json().get("data", {})
    assert data.get("session_id") == str(session.id)
    assert "summary" in data
    assert "provenance" in data
    assert data["provenance"] in ("ai_coach", "rule_based_fallback", "mock_coach")
    assert "suggestions" in data
    suggestions = data["suggestions"]
    assert isinstance(suggestions, list)
    assert len(suggestions) <= 5
    for s in suggestions:
        assert "id" in s
        assert "category" in s
        assert "title" in s
        assert "description" in s
        assert "source_grounding" in s
        grounding = s["source_grounding"]
        assert grounding["source_type"] in ("contradiction", "principle", "evidence", "note")
        assert len(grounding["source_reference"].strip()) > 0


def test_post_coach_suggestions_session_not_found(client):
    random_id = uuid.uuid4()
    response = client.post(f"/api/v1/sessions/{random_id}/coach/suggestions")
    assert response.status_code == status.HTTP_404_NOT_FOUND
    assert f"ResearchSession with id '{random_id}' not found" in response.json()["detail"]


def test_post_coach_suggestions_zero_secret_leak(client, db_session):
    session = ResearchSession(
        title="Secret Leak Test Session",
        domain="security",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Test statement",
        contradiction_type="technical",
        improving_parameter="speed",
        worsening_parameter="cost",
    )
    db_session.add(frame)
    db_session.commit()

    response = client.post(f"/api/v1/sessions/{session.id}/coach/suggestions")
    assert response.status_code == status.HTTP_200_OK

    body_text = response.text.lower()
    # Ensure no common secret tokens or prefixes are leaked
    forbidden_tokens = ["sk-proj", "bearer", "password", "supersecret", "openai_api_key"]
    for token in forbidden_tokens:
        assert token not in body_text, f"Potential secret leak detected in response: {token}"


def test_post_coach_suggestions_empty_problem_frame_handled_gracefully(client, db_session):
    session = ResearchSession(
        title="Empty Problem Frame Session",
        domain="general",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    # Calling coach when no problem frame exists
    response = client.post(f"/api/v1/sessions/{session.id}/coach/suggestions")
    assert response.status_code == status.HTTP_200_OK
    data = response.json().get("data", {})
    assert len(data.get("suggestions", [])) <= 5
