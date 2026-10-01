"""
test_candidate_solutions_api.py — Integration tests cho Phase 7.4: Candidate Solutions Persistence

Specifications:
  - Feature: Candidate Solutions CRUD & Persistence
  - Endpoints (Session-Scoped):
      - GET    /api/v1/sessions/{session_id}/solutions
      - POST   /api/v1/sessions/{session_id}/solutions
      - PATCH  /api/v1/sessions/{session_id}/solutions/{solution_id}
      - DELETE /api/v1/sessions/{session_id}/solutions/{solution_id}
  - Scope: Phase 7.4
"""
from __future__ import annotations

import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain.models import ResearchSession, SessionStatus
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
async def test_create_candidate_solution_success(db_session: Session):
    """
    GIVEN: Một ResearchSession active
    WHEN: Gửi POST /api/v1/sessions/{session_id}/solutions với title và mechanism hợp lệ
    THEN: Trả về HTTP 201 Created kèm UUID thật, status 'candidate', và lưu bền vững vào DB
    """
    session = ResearchSession(
        title="Session Pin Thể Rắn",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    payload = {
        "title": "Màng ngăn polymer nano composite",
        "mechanism": "Ứng dụng vật liệu composite tự phục hồi ngăn dendrite hình thành.",
        "novelty_score": 0.85,
        "feasibility_score": 0.75,
        "risk_notes": "Chi phí chế tạo ban đầu có thể cao.",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/solutions", json=payload)

    assert response.status_code == 201, response.text
    data = response.json()
    sol_data = data.get("data", data)
    assert sol_data["title"] == payload["title"]
    assert sol_data["mechanism"] == payload["mechanism"]
    assert sol_data["status"] == "candidate"
    assert sol_data["novelty_score"] == 0.85
    assert sol_data["feasibility_score"] == 0.75
    assert sol_data["risk_notes"] == payload["risk_notes"]
    assert sol_data["session_id"] == str(session.id)
    assert "id" in sol_data
    assert not sol_data["id"].startswith("sol_")
    assert "created_at" in sol_data

    # Kiểm tra trực tiếp trong DB
    sol_id = uuid.UUID(sol_data["id"])
    row = db_session.execute(
        text(
            "SELECT title, mechanism, status, novelty_score, feasibility_score, session_id "
            "FROM candidate_solutions WHERE id = :id"
        ),
        {"id": sol_id},
    ).fetchone()
    assert row is not None
    assert row[0] == payload["title"]
    assert row[1] == payload["mechanism"]
    assert row[2] == "candidate"
    assert row[3] == 0.85
    assert row[4] == 0.75
    assert row[5] == session.id


@pytest.mark.asyncio
async def test_list_candidate_solutions_by_session(db_session: Session):
    """
    GIVEN: Session có 2 candidate solutions
    WHEN: Gọi GET /api/v1/sessions/{session_id}/solutions
    THEN: Trả về HTTP 200 kèm danh sách 2 solutions sắp xếp theo created_at desc
    """
    session = ResearchSession(title="Session Solution List", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    # Tạo 2 solutions
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Giải pháp 1", "mechanism": "Cơ chế 1"},
        )
        await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Giải pháp 2", "mechanism": "Cơ chế 2"},
        )

        response = await client.get(f"/api/v1/sessions/{session.id}/solutions")

    assert response.status_code == 200, response.text
    data = response.json()
    solutions = data.get("data", [])
    assert len(solutions) == 2
    titles = [s["title"] for s in solutions]
    assert "Giải pháp 1" in titles
    assert "Giải pháp 2" in titles
    assert data.get("meta", {}).get("total") == 2


@pytest.mark.asyncio
async def test_update_candidate_solution_status_and_scores(db_session: Session):
    """
    GIVEN: Session có 1 candidate solution
    WHEN: Gửi PATCH /api/v1/sessions/{session_id}/solutions/{solution_id} cập nhật status='accepted'
    THEN: Trả về HTTP 200 và cập nhật dữ liệu trong DB
    """
    session = ResearchSession(title="Session Solution Patch", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        create_res = await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Giải pháp ban đầu", "mechanism": "Cơ chế sơ thảo"},
        )
        sol_id = create_res.json().get("data", create_res.json())["id"]

        patch_payload = {
            "status": "accepted",
            "novelty_score": 0.95,
            "feasibility_score": 0.88,
            "risk_notes": "Đã kiểm chứng tính khả thi ở lab.",
        }
        patch_res = await client.patch(
            f"/api/v1/sessions/{session.id}/solutions/{sol_id}",
            json=patch_payload,
        )
        assert patch_res.status_code == 200, patch_res.text
        updated = patch_res.json().get("data", patch_res.json())
        assert updated["status"] == "accepted"
        assert updated["novelty_score"] == 0.95
        assert updated["feasibility_score"] == 0.88
        assert updated["risk_notes"] == "Đã kiểm chứng tính khả thi ở lab."

    # Kiểm tra trực tiếp DB
    row = db_session.execute(
        text("SELECT status, novelty_score, feasibility_score FROM candidate_solutions WHERE id = :id"),
        {"id": uuid.UUID(sol_id)},
    ).fetchone()
    assert row[0] == "accepted"
    assert row[1] == 0.95
    assert row[2] == 0.88


@pytest.mark.asyncio
async def test_delete_candidate_solution_success(db_session: Session):
    """
    GIVEN: Session có 1 solution
    WHEN: Gửi DELETE /api/v1/sessions/{session_id}/solutions/{solution_id}
    THEN: Trả về HTTP 200 và xóa bản ghi khỏi DB
    """
    session = ResearchSession(title="Session Solution Delete", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        post_res = await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Giải pháp thử nghiệm", "mechanism": "Cơ chế thử nghiệm"},
        )
        sol_id = post_res.json().get("data", post_res.json())["id"]

        del_res = await client.delete(f"/api/v1/sessions/{session.id}/solutions/{sol_id}")
        assert del_res.status_code == 200, del_res.text

        # Kiểm tra lại qua GET
        list_res = await client.get(f"/api/v1/sessions/{session.id}/solutions")
        assert len(list_res.json().get("data", [])) == 0


@pytest.mark.asyncio
async def test_session_boundary_guard_idor_prevention(db_session: Session):
    """
    GIVEN: Session A có Solution S1, Session B active
    WHEN: Gửi PATCH hoặc DELETE trên /api/v1/sessions/{session_B_id}/solutions/{S1_id}
    THEN: Trả về HTTP 404 Not Found và S1 không bị thay đổi hay xóa
    """
    session_a = ResearchSession(title="Session A", status=SessionStatus.active)
    session_b = ResearchSession(title="Session B", status=SessionStatus.active)
    db_session.add_all([session_a, session_b])
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Tạo solution thuộc Session A
        post_res = await client.post(
            f"/api/v1/sessions/{session_a.id}/solutions",
            json={"title": "Solution thuộc A", "mechanism": "Mechanism A"},
        )
        sol_a_id = post_res.json().get("data", post_res.json())["id"]

        # Session B cố gắng PATCH solution của Session A
        patch_res = await client.patch(
            f"/api/v1/sessions/{session_b.id}/solutions/{sol_a_id}",
            json={"status": "rejected"},
        )
        assert patch_res.status_code == 404

        # Session B cố gắng DELETE solution của Session A
        del_res = await client.delete(f"/api/v1/sessions/{session_b.id}/solutions/{sol_a_id}")
        assert del_res.status_code == 404

    # Xác minh solution A vẫn còn nguyên
    row = db_session.execute(
        text("SELECT status FROM candidate_solutions WHERE id = :id"),
        {"id": uuid.UUID(sol_a_id)},
    ).fetchone()
    assert row is not None
    assert row[0] == "candidate"


@pytest.mark.asyncio
async def test_create_solution_rejects_blank_fields(db_session: Session):
    """
    GIVEN: Session active
    WHEN: Gửi POST với title hoặc mechanism rỗng hoặc whitespace
    THEN: Trả về HTTP 422 Unprocessable Entity
    """
    session = ResearchSession(title="Session Blank Validation", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Blank title
        res1 = await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "   ", "mechanism": "Hợp lệ"},
        )
        assert res1.status_code == 422

        # Blank mechanism
        res2 = await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Tiêu đề hợp lệ", "mechanism": "    "},
        )
        assert res2.status_code == 422


@pytest.mark.asyncio
async def test_update_solution_rejects_invalid_status_and_scores(db_session: Session):
    """
    GIVEN: Session active có 1 solution
    WHEN: Gửi PATCH với status không hợp lệ hoặc scores ngoài khoảng [0.0, 1.0]
    THEN: Trả về HTTP 422 Unprocessable Entity
    """
    session = ResearchSession(title="Session Score Validation", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        post_res = await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Solution Test", "mechanism": "Mechanism Test"},
        )
        sol_id = post_res.json().get("data", post_res.json())["id"]

        # Invalid status
        res_status = await client.patch(
            f"/api/v1/sessions/{session.id}/solutions/{sol_id}",
            json={"status": "invalid_status_value"},
        )
        assert res_status.status_code == 422

        # Invalid novelty_score (> 1.0)
        res_score = await client.patch(
            f"/api/v1/sessions/{session.id}/solutions/{sol_id}",
            json={"novelty_score": 1.5},
        )
        assert res_score.status_code == 422


@pytest.mark.asyncio
async def test_solutions_endpoints_return_404_when_session_not_found():
    """
    GIVEN: session_id không tồn tại
    WHEN: Gọi GET/POST/PATCH/DELETE solutions
    THEN: Trả về HTTP 404 Not Found
    """
    non_existent_session_id = uuid.uuid4()
    non_existent_sol_id = uuid.uuid4()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        get_res = await client.get(f"/api/v1/sessions/{non_existent_session_id}/solutions")
        assert get_res.status_code == 404

        post_res = await client.post(
            f"/api/v1/sessions/{non_existent_session_id}/solutions",
            json={"title": "Tiêu đề", "mechanism": "Cơ chế"},
        )
        assert post_res.status_code == 404

        patch_res = await client.patch(
            f"/api/v1/sessions/{non_existent_session_id}/solutions/{non_existent_sol_id}",
            json={"status": "accepted"},
        )
        assert patch_res.status_code == 404

        del_res = await client.delete(
            f"/api/v1/sessions/{non_existent_session_id}/solutions/{non_existent_sol_id}"
        )
        assert del_res.status_code == 404


@pytest.mark.asyncio
async def test_session_cascade_deletes_candidate_solutions(db_session: Session):
    """
    GIVEN: Session có 2 candidate solutions
    WHEN: Session bị xóa khỏi DB
    THEN: Các candidate_solutions liên kết bị xóa tự động (CASCADE)
    """
    session = ResearchSession(title="Session Cascade Sol Test", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Sol 1", "mechanism": "Mec 1"},
        )
        await client.post(
            f"/api/v1/sessions/{session.id}/solutions",
            json={"title": "Sol 2", "mechanism": "Mec 2"},
        )

    # Đếm số solutions của session
    count_before = db_session.execute(
        text("SELECT COUNT(*) FROM candidate_solutions WHERE session_id = :id"),
        {"id": session.id},
    ).scalar()
    assert count_before == 2

    # Xóa session
    db_session.delete(session)
    db_session.flush()

    count_after = db_session.execute(
        text("SELECT COUNT(*) FROM candidate_solutions WHERE session_id = :id"),
        {"id": session.id},
    ).scalar()
    assert count_after == 0
