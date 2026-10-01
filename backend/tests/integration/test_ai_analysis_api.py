"""
test_ai_analysis_api.py — Integration tests cho endpoint POST /api/v1/sessions/{id}/ai/analyze-problem (Phase 6.2)
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import ProblemFrame, ResearchSession, SessionStatus
from app.main import app


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


@pytest.mark.asyncio
async def test_ai_analyze_problem_success(db_session: Session):
    # 1. Tạo session
    session_id = uuid.uuid4()
    session_record = ResearchSession(
        id=session_id,
        title="Test Session AI",
        description="Session for testing AI structuring",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session_record)
    db_session.commit()

    # 2. Gửi request phân tích AI
    payload = {
        "raw_statement": "Tăng tốc độ xử lý của động cơ làm tăng nhiệt độ quá mức",
        "domain": "mechanical",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/sessions/{session_id}/ai/analyze-problem", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert "data" in data
    assert "_meta" in data

    res_data = data["data"]
    assert res_data["contradiction_type"] == "technical"
    assert res_data["improving_parameter"] == "speed"
    assert res_data["worsening_parameter"] == "temperature"
    assert len(res_data["suggested_keywords"]) > 0

    meta = data["_meta"]
    assert meta["provenance"] in {"ai_hypothesis", "rule_based_fallback"}
    assert "provider" in meta
    assert "prompt_version" in meta
    assert "latency_ms" in meta


@pytest.mark.asyncio
async def test_ai_analyze_problem_zero_auto_overwrite_guarantee(db_session: Session):
    """
    AI Trust Contract Test:
    Gọi endpoint AI phân tích tuyệt đối KHÔNG được ghi đè hoặc tạo mới ProblemFrame trong DB.
    """
    session_id = uuid.uuid4()
    session_record = ResearchSession(
        id=session_id,
        title="Canonical Session",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session_record)
    db_session.commit()

    # Đếm số lượng ProblemFrame trước khi gọi AI
    frames_before = db_session.query(ProblemFrame).filter_by(session_id=session_id).count()
    assert frames_before == 0

    # Gọi AI endpoint
    payload = {
        "raw_statement": "Tăng áp suất làm giảm độ bền của ống dẫn",
        "domain": "fluid",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/sessions/{session_id}/ai/analyze-problem", json=payload)
    assert response.status_code == 200

    # Kiểm tra lại DB: Số ProblemFrame vẫn phải bằng 0!
    db_session.expire_all()
    frames_after = db_session.query(ProblemFrame).filter_by(session_id=session_id).count()
    assert frames_after == 0

    # Kiểm tra FSM state không bị tự động thay đổi
    db_session.refresh(session_record)
    assert session_record.workflow_state == "idle"


@pytest.mark.asyncio
async def test_ai_analyze_problem_session_not_found(db_session: Session):
    random_id = uuid.uuid4()
    payload = {
        "raw_statement": "Tăng tốc độ làm nóng máy",
        "domain": "mechanical",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/sessions/{random_id}/ai/analyze-problem", json=payload)
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_ai_analyze_problem_blank_statement_rejected(db_session: Session):
    session_id = uuid.uuid4()
    session_record = ResearchSession(
        id=session_id,
        title="Session Blank Test",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session_record)
    db_session.commit()

    payload = {
        "raw_statement": "    ",
        "domain": "mechanical",
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(f"/api/v1/sessions/{session_id}/ai/analyze-problem", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ai_analyze_problem_graceful_fallback_when_llm_fails(db_session: Session):
    session_id = uuid.uuid4()
    session_record = ResearchSession(
        id=session_id,
        title="Session Fallback Test",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session_record)
    db_session.commit()

    payload = {
        "raw_statement": "Tăng tốc độ làm giảm độ bền của kết cấu",
        "domain": "mechanical",
    }

    # Giả lập LLMClient bị ném lỗi mạng
    with patch("app.services.ai_analysis_service.get_llm_client") as mock_get_client:
        mock_client = MagicMock()
        mock_client.provider_name = "mock_provider"
        mock_client.model_name = "mock_model"
        mock_client.analyze.side_effect = RuntimeError("503 Service Unavailable")
        mock_get_client.return_value = mock_client

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
            response = await ac.post(f"/api/v1/sessions/{session_id}/ai/analyze-problem", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["_meta"]["provenance"] == "rule_based_fallback"
        assert "503 Service Unavailable" in (data["_meta"]["fallback_reason"] or "")
        assert data["data"]["improving_parameter"] == "speed"
        assert data["data"]["worsening_parameter"] == "strength"
