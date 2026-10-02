"""
test_phase9a_export_synthesis.py — Integration tests cho Phase 9A: Export & AI Research Report Generator

Specifications:
  - Feature 1: Export Session (Markdown with Candidate Solutions & JSON snapshot)
  - Feature 2: AI Research Report Generator (Synthesis preview, AI trust contract, fallback)
  - Ground truth:
      - docs/ADR/ADR-005-phase-9a-export-and-synthesis.md
      - docs/PHASE_9A_EXPORT_AND_SYNTHESIS_EXECUTION_SPEC.md
      - docs/PHASE_9A_EXPORT_AND_SYNTHESIS_GHERKIN_MATRIX.md
"""
from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    CandidateSolution,
    Contradiction,
    ContradictionType,
    ProblemFrame,
    ResearchNote,
    ResearchSession,
    SessionStatus,
)
from app.main import app
from app.services.llm_client import LLMAnalysisOutput


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


# ──────────────────────────────────────────────
# 1. Session Export Tests (Markdown & JSON)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_export_session_markdown_includes_candidate_solutions(db_session: Session):
    """
    Scenario 1.1: Export session as Markdown includes Candidate Solutions
    GIVEN: Session có ProblemFrame, Research Notes và 2 Candidate Solutions
    WHEN: Gọi GET /api/v1/sessions/{id}/export?format=markdown
    THEN: Trả về HTTP 200, Content-Type 'text/markdown; charset=utf-8',
          chứa mục '4. GIẢI PHÁP ĐỀ XUẤT (CANDIDATE SOLUTIONS)'
          và các chi tiết giải pháp (title, mechanism, score, status).
    """
    session = ResearchSession(
        title="Nghiên cứu Pin thể rắn cho xe điện",
        description="Nâng cao mật độ năng lượng và độ an toàn",
        status=SessionStatus.active,
        workflow_state="evaluation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng mật độ năng lượng nhưng phải giữ an toàn chống cháy nổ",
        normalized_statement="Cải thiện mật độ năng lượng với ràng buộc an toàn nhiệt độ",
        contradiction_type=ContradictionType.technical,
        improving_parameter="energy_stationary",
        worsening_parameter="temperature",
        domain="energy",
    )
    db_session.add(frame)
    db_session.flush()

    sol1 = CandidateSolution(
        session_id=session.id,
        title="Chất điện phân gốm Sulfide",
        mechanism="Sử dụng màng gốm dẫn ion Li+ với độ ổn định nhiệt cao.",
        status="accepted",
        novelty_score=0.9,
        feasibility_score=0.85,
        risk_notes="Độ ẩm không khí có thể sinh khí H2S",
    )
    sol2 = CandidateSolution(
        session_id=session.id,
        title="Lớp phủ Nano Polymer tự phục hồi",
        mechanism="Màng polymer bảo vệ điện cực khi co giãn thể tích.",
        status="candidate",
        novelty_score=0.75,
        feasibility_score=0.6,
        risk_notes="Quy trình sản xuất phức tạp",
    )
    db_session.add_all([sol1, sol2])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=markdown")

    assert response.status_code == 200
    assert "text/markdown" in response.headers.get("content-type", "")
    body = response.text

    # Section 4 must be present
    assert "# 4. GIẢI PHÁP ĐỀ XUẤT (CANDIDATE SOLUTIONS)" in body
    assert "Chất điện phân gốm Sulfide" in body
    assert "Sử dụng màng gốm dẫn ion Li+" in body
    assert "[ACCEPTED]" in body or "accepted" in body.lower()
    assert "0.9" in body
    assert "Lớp phủ Nano Polymer tự phục hồi" in body


@pytest.mark.asyncio
async def test_export_session_json_format_success(db_session: Session):
    """
    Scenario 1.2: Export session as JSON data snapshot
    GIVEN: Session có đầy đủ thực thể
    WHEN: Gọi GET /api/v1/sessions/{id}/export?format=json
    THEN: Trả về HTTP 200, Content-Type 'application/json; charset=utf-8',
          payload chứa session, problem_frame, recommended_methods, research_notes, candidate_solutions.
    """
    session = ResearchSession(
        title="Tối ưu động cơ điện",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng công suất động cơ mà không làm tăng khối lượng",
        normalized_statement="Tăng công suất với khối lượng không đổi",
        contradiction_type=ContradictionType.technical,
        improving_parameter="power",
        worsening_parameter="weight_moving",
    )
    db_session.add(frame)
    db_session.flush()

    note = ResearchNote(
        session_id=session.id,
        content="Ghi chú về nam châm vĩnh cửu Neodymium",
        note_type="insight",
    )
    sol = CandidateSolution(
        session_id=session.id,
        title="Rotor cấu trúc rỗng",
        mechanism="Giảm quán tính quay bằng lõi hợp kim rỗng.",
        status="candidate",
        novelty_score=0.8,
        feasibility_score=0.7,
    )
    db_session.add_all([note, sol])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=json")

    assert response.status_code == 200
    assert "application/json" in response.headers.get("content-type", "")
    data = response.json()

    assert "session" in data
    assert data["session"]["id"] == str(session.id)
    assert data["session"]["title"] == "Tối ưu động cơ điện"
    assert "problem_frame" in data
    assert data["problem_frame"]["improving_parameter"] == "power"
    assert "recommended_methods" in data
    assert isinstance(data["recommended_methods"], list)
    assert "research_notes" in data
    assert len(data["research_notes"]) >= 1
    assert "candidate_solutions" in data
    assert len(data["candidate_solutions"]) >= 1
    assert data["candidate_solutions"][0]["title"] == "Rotor cấu trúc rỗng"


@pytest.mark.asyncio
async def test_export_session_not_found_and_invalid_format(db_session: Session):
    """
    Scenario 1.3 & 1.4: Error handling cho Export API
    - Session không tồn tại => 404
    - Format không hỗ trợ => 400
    """
    random_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_404 = await client.get(f"/api/v1/sessions/{random_id}/export?format=json")
        assert res_404.status_code == 404

        session = ResearchSession(title="Valid Session", status=SessionStatus.active)
        db_session.add(session)
        db_session.commit()

        res_400 = await client.get(f"/api/v1/sessions/{session.id}/export?format=pdf_binary")
        assert res_400.status_code == 400
        assert "Unsupported" in res_400.json()["detail"]


# ──────────────────────────────────────────────
# 2. AI Research Report Generator Tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_ai_generate_research_report_success(db_session: Session):
    """
    Scenario 2.1: Sinh Báo Cáo Nghiên Cứu AI thành công
    GIVEN: Session có ProblemFrame và Candidate Solutions
    WHEN: Gọi POST /api/v1/sessions/{id}/ai/generate-report
    THEN: Trả về HTTP 200 với đầy đủ các section báo cáo tổng hợp,
          provenance == 'ai_synthesis', không tạo mới record trong DB.
    """
    session = ResearchSession(
        title="Nghiên cứu Cánh tay Robot",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng tốc độ mà không giảm độ bền",
        normalized_statement="Tối ưu tốc độ với giới hạn độ bền",
        contradiction_type=ContradictionType.technical,
        improving_parameter="speed",
        worsening_parameter="strength",
    )
    db_session.add(frame)
    db_session.commit()

    count_sessions_before = db_session.query(ResearchSession).count()
    count_notes_before = db_session.query(ResearchNote).count()
    workflow_state_before = session.workflow_state

    # Mock LLM generation result
    mock_report_content = {
        "report_title": "Báo cáo Nghiên cứu: Cánh tay Robot",
        "executive_summary": "Tóm tắt: Phương án tối ưu kết cấu giải quyết mâu thuẫn tốc độ vs độ bền.",
        "problem_background": "Phân tích bài toán kỹ thuật theo TRIZ...",
        "evidence_synthesis": "Tổng hợp tri thức từ các tài liệu liên quan...",
        "solution_assessment": "Đánh giá khả thi các giải pháp ứng viên...",
        "action_plan": ["1. Thử nghiệm vật liệu", "2. Thiết kế mô hình CAD"],
        "markdown_content": "# BÁO CÁO NGHIÊN CỨU CHIẾN LƯỢC\n\nNội dung chi tiết...",
    }

    with patch("app.services.ai_report_service.get_llm_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.provider_name = "mock"
        mock_client.model_name = "mock-synthesis"
        mock_client.generate_report.return_value = mock_report_content
        mock_factory.return_value = mock_client

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(f"/api/v1/sessions/{session.id}/ai/generate-report")

    assert response.status_code == 200
    res_data = response.json()["data"]

    assert res_data["session_id"] == str(session.id)
    assert res_data["report_title"] == "Báo cáo Nghiên cứu: Cánh tay Robot"
    assert "executive_summary" in res_data
    assert "markdown_content" in res_data
    assert res_data["provenance"] == "ai_synthesis"
    assert "latency_ms" in res_data

    # Verify zero DB mutations and no FSM state changes
    db_session.refresh(session)
    assert session.workflow_state == workflow_state_before
    assert db_session.query(ResearchSession).count() == count_sessions_before
    assert db_session.query(ResearchNote).count() == count_notes_before


@pytest.mark.asyncio
async def test_ai_generate_research_report_fallback_when_llm_fails(db_session: Session):
    """
    Scenario 2.2: Tự động fallback sang Template-Based synthesis khi LLM gặp lỗi
    GIVEN: Session hợp lệ
    WHEN: Gọi POST /api/v1/sessions/{id}/ai/generate-report và LLM ném ngoại lệ Timeout/Network
    THEN: Trả về HTTP 200, provenance == 'rule_based_fallback', fallback_reason chứa lỗi,
          cấu trúc báo cáo vẫn hoàn chỉnh và không làm crash ứng dụng.
    """
    session = ResearchSession(
        title="Session Test Fallback",
        status=SessionStatus.active,
        workflow_state="synthesis",
    )
    db_session.add(session)
    db_session.commit()

    with patch("app.services.ai_report_service.get_llm_client") as mock_factory:
        mock_client = MagicMock()
        mock_client.provider_name = "openai"
        mock_client.model_name = "gpt-4o-mini"
        mock_client.generate_report.side_effect = TimeoutError("OpenAI API request timed out (15.0s)")
        mock_factory.return_value = mock_client

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.post(f"/api/v1/sessions/{session.id}/ai/generate-report")

    assert response.status_code == 200
    res_data = response.json()["data"]

    assert res_data["provenance"] == "rule_based_fallback"
    assert res_data["fallback_reason"] is not None
    assert "timed out" in res_data["fallback_reason"]
    assert "executive_summary" in res_data
    assert "markdown_content" in res_data
    assert res_data["markdown_content"].startswith("#")


@pytest.mark.asyncio
async def test_ai_generate_research_report_missing_session_returns_404(db_session: Session):
    """
    Scenario 2.3: Gọi generate report trên session không tồn tại
    THEN: Trả về HTTP 404 Not Found
    """
    missing_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{missing_id}/ai/generate-report")

    assert response.status_code == 404
