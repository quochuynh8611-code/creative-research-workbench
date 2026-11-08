"""
test_p1_01_fsm_persistence.py — Test failing chứng minh lỗi P1-01 (Missing commit trong next-step)

Kịch bản:
- Given một session đã persist ở trạng thái structuring và có ProblemFrame hợp lệ.
- When POST /sessions/{id}/next-step kết thúc.
- Then GET /sessions/{id} bằng request độc lập trả retrieval.
- And một SQLAlchemy Session mới (isolated connection/identity map) đọc được retrieval.
- And request next-step tiếp theo tiến tới ideation.
- And đọc lại bằng session mới vẫn là ideation.
- Có test transition bị từ chối thì state không đổi.
- Có test GET recommendations không làm đổi workflow_state.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.domain.models import ContradictionType, ProblemFrame, ResearchSession, SessionStatus
from app.main import app


@pytest.fixture()
def isolated_db_override(sync_engine: Engine):
    """
    Override get_db để mỗi HTTP request nhận một Session độc lập thật sự từ sync_engine,
    mô phỏng chính xác hành vi production của Uvicorn / FastAPI.
    Không commit hộ endpoint.
    """
    def _get_isolated_db():
        session = Session(bind=sync_engine)
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _get_isolated_db
    yield
    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_next_step_persists_workflow_state_across_independent_sessions(
    sync_engine: Engine, tables: None, isolated_db_override: None
):
    """
    RED TEST cho P1-01:
    Chứng minh nếu endpoint không commit, một SQLAlchemy Session mới
    hoặc request GET độc lập sẽ không nhìn thấy workflow_state mới.
    """
    session_id = uuid.uuid4()

    # 1. Seed dữ liệu ban đầu bằng Session 1 và commit tường minh
    with Session(bind=sync_engine) as seed_db:
        session = ResearchSession(
            id=session_id,
            title="FSM Persistence Test Session",
            status=SessionStatus.active,
            workflow_state="structuring",
        )
        frame = ProblemFrame(
            session_id=session_id,
            raw_statement="Muốn tăng tốc độ nhưng sợ tốn chi phí",
            normalized_statement="speed vs cost",
            contradiction_type=ContradictionType.technical,
            improving_parameter="speed",
            worsening_parameter="cost",
        )
        seed_db.add(session)
        seed_db.add(frame)
        seed_db.commit()

    # 2. Gọi POST /sessions/{id}/next-step qua HTTP request
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_step1 = await client.post(f"/api/v1/sessions/{session_id}/next-step")
        assert res_step1.status_code == 200, res_step1.text
        data1 = res_step1.json().get("data", res_step1.json())
        assert data1["current_state"] == "retrieval"

        # 3. GET /sessions/{id} bằng HTTP request độc lập (mở DB session mới)
        res_get1 = await client.get(f"/api/v1/sessions/{session_id}")
        assert res_get1.status_code == 200
        get_data1 = res_get1.json().get("data", res_get1.json())
        assert get_data1["workflow_state"] == "retrieval", (
            f"GET request độc lập kỳ vọng workflow_state='retrieval' nhưng nhận '{get_data1['workflow_state']}'. "
            "Lỗi: next-step không commit vào database!"
        )

    # 4. Kiểm tra trực tiếp qua một SQLAlchemy Session hoàn toàn mới (khác identity map)
    with Session(bind=sync_engine) as verify_db:
        persisted = verify_db.query(ResearchSession).filter_by(id=session_id).first()
        assert persisted is not None
        assert persisted.workflow_state == "retrieval", (
            f"SQLAlchemy Session mới kỳ vọng workflow_state='retrieval' nhưng nhận '{persisted.workflow_state}'."
        )

    # 5. Thực hiện tiếp next-step để tiến từ retrieval -> ideation
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res_step2 = await client.post(f"/api/v1/sessions/{session_id}/next-step")
        assert res_step2.status_code == 200
        data2 = res_step2.json().get("data", res_step2.json())
        assert data2["current_state"] == "ideation"

    # 6. Đọc lại bằng SQLAlchemy Session mới thứ 3
    with Session(bind=sync_engine) as verify_db2:
        persisted2 = verify_db2.query(ResearchSession).filter_by(id=session_id).first()
        assert persisted2 is not None
        assert persisted2.workflow_state == "ideation", (
            f"SQLAlchemy Session mới kỳ vọng workflow_state='ideation' nhưng nhận '{persisted2.workflow_state}'."
        )


@pytest.mark.asyncio
async def test_rejected_transition_does_not_change_state(
    sync_engine: Engine, tables: None, isolated_db_override: None
):
    """
    Test transition bị từ chối (thiếu ProblemFrame để lên retrieval)
    thì state không bị thay đổi trong DB.
    """
    session_id = uuid.uuid4()

    with Session(bind=sync_engine) as seed_db:
        session = ResearchSession(
            id=session_id,
            title="Session Without Frame",
            status=SessionStatus.active,
            workflow_state="structuring",
        )
        seed_db.add(session)
        seed_db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # structuring -> retrieval yêu cầu có ít nhất 1 ProblemFrame
        res = await client.post(f"/api/v1/sessions/{session_id}/next-step")
        assert res.status_code == 422

    with Session(bind=sync_engine) as verify_db:
        persisted = verify_db.query(ResearchSession).filter_by(id=session_id).first()
        assert persisted is not None
        assert persisted.workflow_state == "structuring"


@pytest.mark.asyncio
async def test_get_recommendations_does_not_mutate_workflow_state(
    sync_engine: Engine, tables: None, isolated_db_override: None
):
    """
    Test GET /sessions/{id}/recommendations là read-only, tuyệt đối không làm đổi workflow_state.
    """
    session_id = uuid.uuid4()

    with Session(bind=sync_engine) as seed_db:
        session = ResearchSession(
            id=session_id,
            title="Session Read Only Recommendations",
            status=SessionStatus.active,
            workflow_state="structuring",
        )
        seed_db.add(session)
        seed_db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/v1/sessions/{session_id}/recommendations")
        assert res.status_code == 200

    with Session(bind=sync_engine) as verify_db:
        persisted = verify_db.query(ResearchSession).filter_by(id=session_id).first()
        assert persisted is not None
        assert persisted.workflow_state == "structuring"
