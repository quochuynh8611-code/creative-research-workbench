"""
test_problem_structuring.py — Integration tests cho Phase 3: Problem Structuring & Contradiction Extraction

Specifications:
  - Feature: Problem Structuring (docs/GHERKIN_SCENARIOS.md)
  - Endpoint: POST /api/v1/sessions/{session_id}/problem-frame (docs/API_CONTRACTS.md)
  - Domain Schema: docs/DOMAIN_SCHEMA.md
  - Scope: Phase 3 Step 2/4 — Integration Tests
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_problem_structuring_service
from app.services.problem_structuring_service import ProblemStructuringService
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

@pytest.fixture()
def override_problem_structuring_service(db_session: Session):
    """
    Dependency override minh bạch cho endpoint sessions problem-frame,
    truyền db_session của test vào ProblemStructuringService và cleanup sau test.
    """
    service = ProblemStructuringService(bind=db_session)
    app.dependency_overrides[get_problem_structuring_service] = lambda: service
    yield
    app.dependency_overrides.pop(get_problem_structuring_service, None)


# ──────────────────────────────────────────────
# A. Service-level Persistence Tests
# ──────────────────────────────────────────────

def test_structure_problem_creates_problem_frame_for_existing_session(
    db_session: Session,
    sample_session: ResearchSession,
):
    """
    GIVEN: ResearchSession tồn tại trong database
    WHEN: Gọi ProblemStructuringService.structure_problem(...)
    THEN: ProblemFrame record được tạo trong DB, linked đúng session_id,
          normalized_statement không rỗng và domain được lưu chính xác.
    """
    service = ProblemStructuringService(bind=db_session)
    frame = service.structure_problem(
        session_id=sample_session.id,
        raw_statement="Bánh răng cần cứng để chịu lực va đập nhưng cần dẻo mềm để triệt tiêu rung chấn.",
        domain="mechanical",
    )

    assert frame is not None
    assert frame.id is not None
    assert frame.session_id == sample_session.id
    assert frame.raw_statement == "Bánh răng cần cứng để chịu lực va đập nhưng cần dẻo mềm để triệt tiêu rung chấn."
    assert frame.domain == "mechanical"
    assert frame.normalized_statement is not None
    assert len(frame.normalized_statement.strip()) > 0

    # Kiểm tra persistence trong database
    saved_frame = db_session.query(ProblemFrame).filter_by(id=frame.id).first()
    assert saved_frame is not None
    assert saved_frame.session_id == sample_session.id
    assert saved_frame.normalized_statement == frame.normalized_statement


def test_structure_problem_extracts_technical_contradiction(
    db_session: Session,
    sample_session: ResearchSession,
):
    """
    GIVEN: Raw problem statement chứa mâu thuẫn kỹ thuật rõ ràng (speed vs reliability)
    WHEN: Gọi ProblemStructuringService.structure_problem(...)
    THEN: improving_parameter và worsening_parameter được trích xuất,
          contradiction_type = technical,
          và ít nhất 1 Contradiction record được tạo và gắn với ProblemFrame.
    """
    service = ProblemStructuringService(bind=db_session)
    frame = service.structure_problem(
        session_id=sample_session.id,
        raw_statement="Tăng tốc độ xử lý dữ liệu của mạng nhưng làm giảm độ tin cậy truyền tin.",
        domain="computer_science",
    )

    assert frame.contradiction_type == ContradictionType.technical
    assert frame.improving_parameter is not None
    assert frame.worsening_parameter is not None

    # Kiểm tra Contradiction record được lưu kèm
    contradictions = db_session.query(Contradiction).filter_by(problem_frame_id=frame.id).all()
    assert len(contradictions) >= 1
    c = contradictions[0]
    assert c.type == ContradictionType.technical
    assert c.statement is not None and len(c.statement.strip()) > 0
    assert c.suggested_principles is not None
    assert len(c.suggested_principles) > 0


def test_structure_problem_rejects_empty_statement(
    db_session: Session,
    sample_session: ResearchSession,
):
    """
    GIVEN: ResearchSession hợp lệ
    WHEN: Gọi structure_problem với raw_statement rỗng hoặc chỉ có khoảng trắng
    THEN: Raise ValueError (hoặc validation error)
    AND: Không có bất kỳ ProblemFrame nào được ghi vào DB.
    """
    service = ProblemStructuringService(bind=db_session)
    initial_count = db_session.query(ProblemFrame).filter_by(session_id=sample_session.id).count()

    with pytest.raises(ValueError):
        service.structure_problem(
            session_id=sample_session.id,
            raw_statement="   ",
            domain="general",
        )

    final_count = db_session.query(ProblemFrame).filter_by(session_id=sample_session.id).count()
    assert final_count == initial_count


# ──────────────────────────────────────────────
# B. HTTP Boundary Tests (POST /api/v1/sessions/{id}/problem-frame)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_problem_frame_returns_404_for_missing_session(
    override_problem_structuring_service,
    db_session: Session,
):
    """
    GIVEN: session_id không tồn tại trong database
    WHEN: Gọi POST /api/v1/sessions/{missing_session_id}/problem-frame
    THEN: HTTP Status 404 Not Found.
    """
    missing_session_id = uuid.uuid4()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{missing_session_id}/problem-frame",
            json={
                "raw_statement": "Hệ thống cần tăng tốc độ nhưng không được tiêu tốn quá nhiều năng lượng.",
                "domain": "electronics",
            },
        )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_problem_frame_returns_422_for_empty_statement(
    override_problem_structuring_service,
    db_session: Session,
    sample_session: ResearchSession,
):
    """
    GIVEN: Session tồn tại trong DB
    WHEN: Gọi POST /api/v1/sessions/{session_id}/problem-frame với raw_statement rỗng
    THEN: HTTP Status 422 Unprocessable Entity
    AND: Database không tạo thêm ProblemFrame record mới.
    """
    initial_count = db_session.query(ProblemFrame).filter_by(session_id=sample_session.id).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{sample_session.id}/problem-frame",
            json={
                "raw_statement": "",
                "domain": "mechanical",
            },
        )

    assert response.status_code == 422
    final_count = db_session.query(ProblemFrame).filter_by(session_id=sample_session.id).count()
    assert final_count == initial_count


@pytest.mark.asyncio
async def test_create_problem_frame_persists_structured_output(
    override_problem_structuring_service,
    db_session: Session,
    sample_session: ResearchSession,
):
    """
    GIVEN: Session tồn tại trong DB
    WHEN: Gọi canonical POST /api/v1/sessions/{session_id}/problem-frame với input hợp lệ
    THEN: Response trả về 200 hoặc 201 với cấu trúc {id, normalized_statement, contradiction_type, ...}
    AND: Database lưu ProblemFrame với normalized_statement không rỗng và contradiction_type hợp lệ.
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{sample_session.id}/problem-frame",
            json={
                "raw_statement": "Bánh răng cần cứng để chịu lực nhưng mềm để giảm rung",
                "domain": "mechanical",
            },
        )

    assert response.status_code in (200, 201)
    data = response.json()
    assert "id" in data or "data" in data

    # Kiểm tra DB persistence
    frames = db_session.query(ProblemFrame).filter_by(session_id=sample_session.id).all()
    assert len(frames) >= 1
    latest_frame = frames[-1]
    assert latest_frame.normalized_statement is not None
    assert len(latest_frame.normalized_statement.strip()) > 0
    assert latest_frame.contradiction_type in (
        ContradictionType.technical,
        ContradictionType.physical,
        ContradictionType.none,
    )
