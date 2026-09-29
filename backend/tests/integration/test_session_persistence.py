"""
test_session_persistence.py — Integration tests cho Phase 3.5: ResearchSession Persistence Remediation

Specifications:
  - Feature: Session Management & Persistence
  - Endpoints:
      - POST /api/v1/sessions (docs/API_CONTRACTS.md)
      - POST /api/v1/sessions/{session_id}/problem-frame (docs/API_CONTRACTS.md)
  - Domain Schema: docs/DOMAIN_SCHEMA.md
  - Scope: Phase 3.5 — RED Integration Tests
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
from app.services.problem_structuring_service import ProblemStructuringService

# Import dependencies từ endpoints nếu đã khai báo
try:
    from app.api.v1.endpoints.sessions import (
        get_db,
        get_problem_structuring_service,
    )
except ImportError:
    get_db = None  # type: ignore[assignment]
    get_problem_structuring_service = None  # type: ignore[assignment]


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture(autouse=True)
def override_session_dependencies(db_session: Session):
    """
    Explicit dependency overrides cho toàn bộ test trong module:
    - Inject db_session vào get_db (nếu có).
    - Inject ProblemStructuringService(bind=db_session) vào get_problem_structuring_service.
    """
    if get_problem_structuring_service is not None:
        service = ProblemStructuringService(bind=db_session)
        app.dependency_overrides[get_problem_structuring_service] = lambda: service
    if get_db is not None:
        app.dependency_overrides[get_db] = lambda: db_session

    yield

    if get_problem_structuring_service is not None:
        app.dependency_overrides.pop(get_problem_structuring_service, None)
    if get_db is not None:
        app.dependency_overrides.pop(get_db, None)


# ──────────────────────────────────────────────
# Test Cases
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_session_persists_research_session(
    db_session: Session,
):
    """
    GIVEN: Body tạo session với title và description hợp lệ
    WHEN: Gọi POST /api/v1/sessions
    THEN: Response trả về 201 Created
          AND id trả về là UUID hợp lệ (không phải mock string dạng ses_xxxx)
          AND ResearchSession record thực sự được lưu trong database.
    """
    payload = {
        "title": "Nghiên cứu giảm rung cho hệ thống truyền động",
        "description": "Ứng dụng TRIZ và thạch học giảm dao động",
        "domain": "mechanical",
        "tags": ["triz", "mechanical"],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions", json=payload)

    assert response.status_code == 201
    data = response.json()

    # Hỗ trợ cả direct dict và wrapper {"data": {...}}
    session_data = data.get("data", data)
    raw_id = session_data.get("id")
    assert raw_id is not None, "Response must contain 'id'"

    # ID phải parse được thành UUID chuẩn
    try:
        session_uuid = uuid.UUID(str(raw_id))
    except ValueError:
        pytest.fail(f"RED: session id '{raw_id}' is not a valid UUID (currently mock string).")

    # Kiểm tra persistence trong Database
    saved_session = db_session.query(ResearchSession).filter_by(id=session_uuid).first()
    assert saved_session is not None, f"RED: ResearchSession with id {session_uuid} was not persisted in database."
    assert saved_session.title == "Nghiên cứu giảm rung cho hệ thống truyền động"
    assert saved_session.status in (SessionStatus.active, "active")


@pytest.mark.asyncio
async def test_create_session_initializes_workflow_state(
    db_session: Session,
):
    """
    GIVEN: Body tạo session hợp lệ
    WHEN: Gọi POST /api/v1/sessions
    THEN: Response trả về 201
          AND Database record có workflow_state canonical (idle hoặc intake/problem_framing)
          AND không dùng mock string id dạng ses_xxxxxxxx.
    """
    payload = {
        "title": "Session workflow state initialization test",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions", json=payload)

    assert response.status_code == 201
    data = response.json()
    session_data = data.get("data", data)
    raw_id = session_data.get("id")

    try:
        session_uuid = uuid.UUID(str(raw_id))
    except ValueError:
        pytest.fail(f"RED: session id '{raw_id}' is a mock string, expected valid UUID.")

    saved_session = db_session.query(ResearchSession).filter_by(id=session_uuid).first()
    assert saved_session is not None
    assert saved_session.workflow_state in ("idle", "intake", "problem_framing")


@pytest.mark.asyncio
async def test_create_session_rejects_empty_title(
    db_session: Session,
):
    """
    GIVEN: Body tạo session với title rỗng hoặc chỉ có khoảng trắng
    WHEN: Gọi POST /api/v1/sessions
    THEN: Response trả về 422 Unprocessable Entity
          AND Database không tạo thêm bất kỳ ResearchSession nào với title rỗng.
    """
    initial_count = db_session.query(ResearchSession).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            "/api/v1/sessions",
            json={"title": "   ", "domain": "research"},
        )

    assert response.status_code == 422
    final_count = db_session.query(ResearchSession).count()
    assert final_count == initial_count


@pytest.mark.asyncio
async def test_problem_frame_can_use_persisted_session(
    db_session: Session,
):
    """
    GIVEN: Session được tạo mới và persist thật qua POST /api/v1/sessions
    WHEN: Gọi canonical POST /api/v1/sessions/{new_session_id}/problem-frame
    THEN: Endpoint trả về 201
          AND ProblemFrame được tạo và liên kết chính xác với session_id vừa tạo
          AND Foreign key constraint trong DB được bảo toàn hoàn hảo.
    """
    # 1. Tạo session thật qua API
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        session_resp = await client.post(
            "/api/v1/sessions",
            json={"title": "End-to-End Session & Framing Test"},
        )
        assert session_resp.status_code == 201
        session_data = session_resp.json().get("data", session_resp.json())
        raw_id = session_data.get("id")

        try:
            session_uuid = uuid.UUID(str(raw_id))
        except ValueError:
            pytest.fail(f"RED: cannot proceed with framing test, session_id '{raw_id}' is not UUID.")

        # 2. Tạo ProblemFrame gắn với session_uuid này
        frame_resp = await client.post(
            f"/api/v1/sessions/{session_uuid}/problem-frame",
            json={
                "raw_statement": "Tăng tốc độ truyền tải nhưng làm suy giảm độ tin cậy",
                "domain": "telecommunications",
            },
        )
        assert frame_resp.status_code in (200, 201)

    # 3. Kiểm tra liên kết trong DB
    frame = db_session.query(ProblemFrame).filter_by(session_id=session_uuid).first()
    assert frame is not None, "ProblemFrame must be persisted and linked to the created session."
    assert frame.session_id == session_uuid
    assert frame.contradiction_type == ContradictionType.technical
