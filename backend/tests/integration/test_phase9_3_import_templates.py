"""
Integration tests for Phase 9.3: Session Import & Domain Templates.
"""

from __future__ import annotations

import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session

from app.main import app
from app.domain.models import (
    ResearchSession,
    SessionStatus,
    ProblemFrame,
    ResearchNote,
    CandidateSolution,
)


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


@pytest.mark.asyncio
async def test_import_session_json_snapshot_success(db_session: Session):
    """
    Scenario 1.1: Import session từ JSON export snapshot thành công
    GIVEN: Một snapshot JSON có session, problem_frame, 2 research_notes và 1 candidate_solution
    WHEN: Gọi POST /api/v1/sessions/import
    THEN: Trả về HTTP 201 Created với ID phiên mới, ProblemFrame, Notes và Solutions được tạo đầy đủ.
    """
    snapshot_payload = {
        "session": {
            "title": "Tối ưu hóa độ bền động cơ điện",
            "description": "Nghiên cứu vật liệu tản nhiệt thế hệ mới",
            "status": "active",
            "workflow_state": "ideation",
            "tags": ["motor", "ev", "triz"],
        },
        "problem_frame": {
            "raw_statement": "Động cơ cần tăng công suất nhưng không được tăng nhiệt độ",
            "normalized_statement": "Tăng công suất trong khi giữ nhiệt độ an toàn",
            "contradiction_type": "technical",
            "improving_parameter": "power",
            "worsening_parameter": "temperature",
            "domain": "technical",
        },
        "research_notes": [
            {
                "content": "Phát hiện màng gốm tản nhiệt dẫn nhiệt gấp 3 lần",
                "note_type": "insight",
            },
            {
                "content": "Cần kiểm tra tương thích với dầu làm mát",
                "note_type": "question",
            },
        ],
        "candidate_solutions": [
            {
                "title": "Rotor lõi rỗng có cánh tản nhiệt tích hợp",
                "mechanism": "Lưu thông khí đối lưu tự nhiên khi quay",
                "status": "candidate",
                "novelty_score": 0.85,
                "feasibility_score": 0.8,
                "risk_notes": "Cần cân bằng động ở vòng tua cao",
            },
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=snapshot_payload)

    assert response.status_code == 201
    res_data = response.json()
    assert "data" in res_data
    new_session_id = res_data["data"]["id"]
    assert new_session_id is not None
    assert res_data["data"]["title"] == "Tối ưu hóa độ bền động cơ điện"
    assert res_data["imported_elements"]["problem_frame"] is True
    assert res_data["imported_elements"]["notes_count"] == 2
    assert res_data["imported_elements"]["solutions_count"] == 1

    # Kiểm tra DB records
    sess_uuid = uuid.UUID(new_session_id)
    imported_sess = db_session.query(ResearchSession).filter_by(id=sess_uuid).first()
    assert imported_sess is not None
    assert imported_sess.title == "Tối ưu hóa độ bền động cơ điện"

    imported_frame = db_session.query(ProblemFrame).filter_by(session_id=sess_uuid).first()
    assert imported_frame is not None
    assert imported_frame.improving_parameter == "power"
    assert imported_frame.worsening_parameter == "temperature"

    imported_notes = db_session.query(ResearchNote).filter_by(session_id=sess_uuid).all()
    assert len(imported_notes) == 2

    imported_solutions = db_session.query(CandidateSolution).filter_by(session_id=sess_uuid).all()
    assert len(imported_solutions) == 1
    assert imported_solutions[0].title == "Rotor lõi rỗng có cánh tản nhiệt tích hợp"


@pytest.mark.asyncio
async def test_import_session_missing_title_returns_400(db_session: Session):
    """
    Scenario 1.2: Import snapshot thiếu tiêu đề trả về 400 Bad Request
    """
    invalid_snapshot = {
        "session": {
            "title": "   ",
            "description": "Không có tiêu đề",
        }
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=invalid_snapshot)

    assert response.status_code == 400
    assert "missing required session title" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_import_session_malformed_returns_400(db_session: Session):
    """
    Scenario 1.3: Import payload không hợp lệ trả về 400 Bad Request
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json={"random_field": 123})

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_domain_templates():
    """
    Scenario 2.1: Lấy danh sách Domain Templates
    WHEN: Gọi GET /api/v1/sessions/templates
    THEN: Trả về HTTP 200 kèm danh sách ít nhất 3 templates
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions/templates")

    assert response.status_code == 200
    data = response.json().get("data", [])
    assert len(data) >= 3
    template_ids = [t["id"] for t in data]
    assert "engineering_composite_arm" in template_ids
    assert "business_delivery_speed_cost" in template_ids
    assert "software_latency_security" in template_ids


@pytest.mark.asyncio
async def test_create_session_from_template_success(db_session: Session):
    """
    Scenario 2.2: Tạo session mới từ Domain Template thành công
    WHEN: Gọi POST /api/v1/sessions/from-template với template_id hợp lệ
    THEN: Tạo ResearchSession mới kèm ProblemFrame cấu hình sẵn theo template
    """
    body = {
        "template_id": "engineering_composite_arm",
        "custom_title": "Nghiên cứu Cánh tay Robot Thế hệ Mới",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/from-template", json=body)

    assert response.status_code == 201
    data = response.json()["data"]
    assert data["title"] == "Nghiên cứu Cánh tay Robot Thế hệ Mới"
    assert data["domain"] == "technical"
    assert data["workflow_state"] == "structuring"

    sess_uuid = uuid.UUID(data["id"])
    frame = db_session.query(ProblemFrame).filter_by(session_id=sess_uuid).first()
    assert frame is not None
    assert frame.improving_parameter == "strength"
    assert frame.worsening_parameter == "weight_moving"


@pytest.mark.asyncio
async def test_create_session_from_non_existent_template_returns_404():
    """
    Scenario 2.3: Tạo session từ template_id không tồn tại trả về 404
    """
    body = {
        "template_id": "invalid_template_id_12345",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/from-template", json=body)

    assert response.status_code == 404
