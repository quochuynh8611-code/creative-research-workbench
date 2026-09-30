"""
test_session_lifecycle.py — Integration tests cho Phase 5.9: Session Lifecycle & Safe Deletion (Archive & Restore)

Specifications:
  - Feature: Session Safe Deletion (Archive) & Restoration
  - Endpoints:
      - POST /api/v1/sessions/{session_id}/archive
      - POST /api/v1/sessions/{session_id}/restore
      - GET  /api/v1/sessions (Default: excludes archived sessions)
      - GET  /api/v1/sessions?status=archived
  - Schema: ResearchSession.status (active -> archived -> active)
  - Scope: Phase 5.9 — Integration Tests
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

try:
    from app.api.v1.endpoints.sessions import get_db
except ImportError:
    get_db = None  # type: ignore[assignment]


# ──────────────────────────────────────────────
# Fixtures
# ──────────────────────────────────────────────

@pytest.fixture(autouse=True)
def override_session_db(db_session: Session):
    """Inject db_session fixture vào get_db dependency."""
    if get_db is not None:
        app.dependency_overrides[get_db] = lambda: db_session
    yield
    if get_db is not None:
        app.dependency_overrides.pop(get_db, None)


# ──────────────────────────────────────────────
# 1. Archive Tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_archive_active_session_succeeds(db_session: Session):
    """
    GIVEN: Một ResearchSession đang ở trạng thái 'active'
    WHEN: Gọi POST /api/v1/sessions/{session_id}/archive
    THEN: Trả về HTTP 200 OK
          AND status của session đổi thành 'archived'
          AND bản ghi trong database được cập nhật thành 'archived'
          AND dữ liệu ProblemFrame liên kết không bị xóa.
    """
    session = ResearchSession(
        title="Session cần lưu trữ an toàn",
        description="Nghiên cứu ma sát động cơ",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    # Thêm ProblemFrame liên kết để xác nhận không bị CASCADE delete
    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Mâu thuẫn kỹ thuật tốc độ và độ bền",
        contradiction_type=ContradictionType.technical,
    )
    db_session.add(frame)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/archive")

    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    assert payload["id"] == str(session.id)
    assert payload["status"] == "archived"

    # Kiểm tra database record
    db_session.refresh(session)
    assert session.status == SessionStatus.archived

    # Kiểm tra ProblemFrame vẫn nguyên vẹn
    saved_frame = db_session.query(ProblemFrame).filter_by(session_id=session.id).first()
    assert saved_frame is not None
    assert saved_frame.raw_statement == "Mâu thuẫn kỹ thuật tốc độ và độ bền"


@pytest.mark.asyncio
async def test_archive_nonexistent_session_returns_404(db_session: Session):
    """
    GIVEN: Một session_id ngẫu nhiên không tồn tại
    WHEN: Gọi POST /api/v1/sessions/{random_uuid}/archive
    THEN: Trả về HTTP 404 Not Found
    """
    random_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{random_id}/archive")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_archive_already_archived_session_returns_400(db_session: Session):
    """
    GIVEN: Một session đã ở trạng thái 'archived'
    WHEN: Gọi POST /api/v1/sessions/{session_id}/archive
    THEN: Trả về HTTP 400 Bad Request
    """
    session = ResearchSession(
        title="Session đã lưu trữ từ trước",
        status=SessionStatus.archived,
    )
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/archive")

    assert response.status_code == 400


# ──────────────────────────────────────────────
# 2. Restore Tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_restore_archived_session_succeeds_and_sets_active(db_session: Session):
    """
    GIVEN: Một ResearchSession đang ở trạng thái 'archived'
    WHEN: Gọi POST /api/v1/sessions/{session_id}/restore
    THEN: Trả về HTTP 200 OK
          AND status của session luôn đổi thành 'active' (theo spec Phase 5.9)
          AND bản ghi trong database được cập nhật thành 'active'.
    """
    session = ResearchSession(
        title="Session cần khôi phục",
        description="Nghiên cứu phục hồi",
        status=SessionStatus.archived,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/restore")

    assert response.status_code == 200
    data = response.json()
    payload = data.get("data", data)
    assert payload["id"] == str(session.id)
    assert payload["status"] == "active"

    db_session.refresh(session)
    assert session.status == SessionStatus.active


@pytest.mark.asyncio
async def test_restore_nonexistent_session_returns_404(db_session: Session):
    """
    GIVEN: Một session_id ngẫu nhiên không tồn tại
    WHEN: Gọi POST /api/v1/sessions/{random_uuid}/restore
    THEN: Trả về HTTP 404 Not Found
    """
    random_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{random_id}/restore")

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_restore_active_session_returns_400(db_session: Session):
    """
    GIVEN: Một session đang ở trạng thái 'active' (không phải archived)
    WHEN: Gọi POST /api/v1/sessions/{session_id}/restore
    THEN: Trả về HTTP 400 Bad Request
    """
    session = ResearchSession(
        title="Session đang active",
        status=SessionStatus.active,
    )
    db_session.add(session)
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post(f"/api/v1/sessions/{session.id}/restore")

    assert response.status_code == 400


# ──────────────────────────────────────────────
# 3. List Sessions Filtering Tests
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_default_list_sessions_excludes_archived_sessions(db_session: Session):
    """
    GIVEN: Trong DB có 1 session 'active' và 1 session 'archived'
    WHEN: Gọi GET /api/v1/sessions (mặc định không có query param status)
    THEN: Chỉ trả về session 'active', session 'archived' bị ẩn.
    """
    active_s = ResearchSession(
        title="Session Đang Hoạt Động",
        status=SessionStatus.active,
    )
    archived_s = ResearchSession(
        title="Session Đã Lưu Trữ",
        status=SessionStatus.archived,
    )
    db_session.add_all([active_s, archived_s])
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions")

    assert response.status_code == 200
    items = response.json().get("data", [])
    item_ids = [s["id"] for s in items]

    assert str(active_s.id) in item_ids
    assert str(archived_s.id) not in item_ids


@pytest.mark.asyncio
async def test_list_sessions_with_status_archived_returns_archived_only(db_session: Session):
    """
    GIVEN: Trong DB có 1 session 'active' và 1 session 'archived'
    WHEN: Gọi GET /api/v1/sessions?status=archived
    THEN: Chỉ trả về session 'archived'.
    """
    active_s = ResearchSession(
        title="Session Đang Hoạt Động 2",
        status=SessionStatus.active,
    )
    archived_s = ResearchSession(
        title="Session Đã Lưu Trữ 2",
        status=SessionStatus.archived,
    )
    db_session.add_all([active_s, archived_s])
    db_session.flush()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/api/v1/sessions?status=archived")

    assert response.status_code == 200
    items = response.json().get("data", [])
    item_ids = [s["id"] for s in items]

    assert str(archived_s.id) in item_ids
    assert str(active_s.id) not in item_ids
