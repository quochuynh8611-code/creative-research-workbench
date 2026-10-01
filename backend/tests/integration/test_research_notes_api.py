"""
test_research_notes_api.py — Integration tests cho Phase 7.2: Research Notes & Persistence

Specifications:
  - Feature: Research Notes CRUD & Persistence
  - Endpoints:
      - GET /api/v1/sessions/{session_id}/notes
      - POST /api/v1/sessions/{session_id}/notes
      - DELETE /api/v1/sessions/{session_id}/notes/{note_id}
  - Scope: Phase 7.2
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
async def test_create_research_note_success(db_session: Session):
    """
    GIVEN: Một ResearchSession active
    WHEN: Gửi POST /api/v1/sessions/{session_id}/notes với content và note_type hợp lệ
    THEN: Trả về HTTP 201 Created kèm note payload và lưu bền vững vào DB
    """
    session = ResearchSession(
        title="Session Nghiên cứu Pin",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    payload = {
        "content": "Giả thuyết: Sử dụng lớp màng polymer có thể ngăn dendrite lithium.",
        "note_type": "hypothesis",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/notes", json=payload)

    assert response.status_code == 201
    data = response.json()
    note_data = data.get("data", data)
    assert note_data["content"] == payload["content"]
    assert note_data["note_type"] == "hypothesis"
    assert note_data["session_id"] == str(session.id)
    assert "id" in note_data
    assert "created_at" in note_data

    # Kiểm tra trực tiếp trong DB
    note_id = uuid.UUID(note_data["id"])
    row = db_session.execute(
        text("SELECT content, note_type, session_id FROM research_notes WHERE id = :id"),
        {"id": note_id},
    ).fetchone()
    assert row is not None
    assert row[0] == payload["content"]
    assert row[1] == "hypothesis"
    assert row[2] == session.id


@pytest.mark.asyncio
async def test_list_research_notes_by_session(db_session: Session):
    """
    GIVEN: Session có 2 notes
    WHEN: Gọi GET /api/v1/sessions/{session_id}/notes
    THEN: Trả về HTTP 200 kèm danh sách 2 notes sắp xếp theo created_at desc
    """
    session = ResearchSession(title="Session Note List", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    # Tạo 2 notes
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note 1: Phát hiện sơ bộ", "note_type": "insight"},
        )
        await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note 2: Câu hỏi nghiên cứu", "note_type": "question"},
        )

        response = await client.get(f"/api/v1/sessions/{session.id}/notes")

    assert response.status_code == 200
    data = response.json()
    notes = data.get("data", [])
    assert len(notes) == 2
    contents = [n["content"] for n in notes]
    assert "Note 1: Phát hiện sơ bộ" in contents
    assert "Note 2: Câu hỏi nghiên cứu" in contents
    assert data.get("meta", {}).get("total") == 2


@pytest.mark.asyncio
async def test_delete_research_note_success(db_session: Session):
    """
    GIVEN: Session có 1 note
    WHEN: Gửi DELETE /api/v1/sessions/{session_id}/notes/{note_id}
    THEN: Trả về HTTP 200 và xóa note khỏi DB
    """
    session = ResearchSession(title="Session Note Delete", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        post_res = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Ghi chú tạm cần xóa", "note_type": "insight"},
        )
        note_id = post_res.json().get("data", post_res.json())["id"]

        del_res = await client.delete(f"/api/v1/sessions/{session.id}/notes/{note_id}")
        assert del_res.status_code == 200

        # Kiểm tra lại qua GET
        list_res = await client.get(f"/api/v1/sessions/{session.id}/notes")
        assert len(list_res.json().get("data", [])) == 0


@pytest.mark.asyncio
async def test_create_note_rejects_invalid_note_type(db_session: Session):
    """
    GIVEN: Session active
    WHEN: Gửi POST /api/v1/sessions/{session_id}/notes với note_type không thuộc enum hợp lệ
    THEN: Trả về HTTP 422 Unprocessable Entity
    """
    session = ResearchSession(title="Session Invalid Type", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Nội dung hợp lệ", "note_type": "invalid_random_type"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_note_rejects_blank_content(db_session: Session):
    """
    GIVEN: Session active
    WHEN: Gửi POST với content rỗng hoặc whitespace
    THEN: Trả về HTTP 422 Unprocessable Entity
    """
    session = ResearchSession(title="Session Blank Content", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "    ", "note_type": "insight"},
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_notes_endpoints_return_404_when_session_not_found():
    """
    GIVEN: session_id không tồn tại
    WHEN: Gọi GET/POST/DELETE notes
    THEN: Trả về HTTP 404 Not Found
    """
    non_existent_session_id = uuid.uuid4()
    non_existent_note_id = uuid.uuid4()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        get_res = await client.get(f"/api/v1/sessions/{non_existent_session_id}/notes")
        assert get_res.status_code == 404

        post_res = await client.post(
            f"/api/v1/sessions/{non_existent_session_id}/notes",
            json={"content": "Nội dung", "note_type": "insight"},
        )
        assert post_res.status_code == 404

        del_res = await client.delete(
            f"/api/v1/sessions/{non_existent_session_id}/notes/{non_existent_note_id}"
        )
        assert del_res.status_code == 404


@pytest.mark.asyncio
async def test_delete_note_returns_404_for_non_existent_note(db_session: Session):
    """
    GIVEN: Session tồn tại nhưng note_id không tồn tại (hoặc thuộc session khác)
    WHEN: Gọi DELETE /api/v1/sessions/{session_id}/notes/{random_note_id}
    THEN: Trả về HTTP 404 Not Found
    """
    session = ResearchSession(title="Session Delete 404", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    random_note_id = uuid.uuid4()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.delete(f"/api/v1/sessions/{session.id}/notes/{random_note_id}")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_session_cascade_deletes_research_notes(db_session: Session):
    """
    GIVEN: Session có 2 notes
    WHEN: Session bị xóa khỏi DB
    THEN: Các research_notes liên kết bị xóa tự động (CASCADE)
    """
    session = ResearchSession(title="Session Cascade Test", status=SessionStatus.active)
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note Cascade 1", "note_type": "insight"},
        )
        await client.post(
            f"/api/v1/sessions/{session.id}/notes",
            json={"content": "Note Cascade 2", "note_type": "decision"},
        )

    # Đếm số notes của session
    count_before = db_session.execute(
        text("SELECT COUNT(*) FROM research_notes WHERE session_id = :id"),
        {"id": session.id},
    ).scalar()
    assert count_before == 2

    # Xóa session
    db_session.delete(session)
    db_session.flush()

    count_after = db_session.execute(
        text("SELECT COUNT(*) FROM research_notes WHERE session_id = :id"),
        {"id": session.id},
    ).scalar()
    assert count_after == 0
