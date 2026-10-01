"""
test_session_export_api.py — Integration tests cho Phase 9.1: Markdown Session Export

Specifications:
  - Feature: Session Export ra Markdown (Phase 9.1 Quick-Win)
  - Endpoint: GET /api/v1/sessions/{session_id}/export?format=md
  - Scope: Phase 9.1
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    ContradictionType,
    ProblemFrame,
    ResearchNote,
    ResearchSession,
    SessionStatus,
)
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
async def test_export_session_markdown_success(db_session: Session):
    """
    GIVEN: Một session có ProblemFrame và Research Notes
    WHEN: Gửi GET /api/v1/sessions/{session_id}/export?format=md
    THEN: Trả về HTTP 200 OK, Content-Type 'text/markdown; charset=utf-8',
          Content-Disposition 'attachment; filename="session_{id}.md"',
          và nội dung chứa Frontmatter cùng các Section chính.
    """
    session = ResearchSession(
        title="Tối ưu độ bền và trọng lượng cánh tay robot",
        description="Nghiên cứu vật liệu composite cho robot công nghiệp",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Cánh tay robot cần nhẹ để tăng tốc độ nhưng phải cứng để chịu tải",
        normalized_statement="Tăng độ cứng vững của cấu trúc trong khi duy trì hoặc giảm khối lượng tổng thể",
        contradiction_type=ContradictionType.technical,
        improving_parameter="Độ bền / Độ cứng",
        worsening_parameter="Trọng lượng vật thể",
        domain="technical",
    )
    db_session.add(frame)

    note = ResearchNote(
        session_id=session.id,
        content="Đề xuất dùng cấu trúc rỗng tổ ong kết hợp sợi carbon",
        note_type="hypothesis",
    )
    db_session.add(note)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=md")

    assert response.status_code == 200
    assert "text/markdown" in response.headers.get("content-type", "")
    assert f'filename="session_{session.id}.md"' in response.headers.get("content-disposition", "")

    body = response.text
    # Kiểm tra YAML Frontmatter
    assert body.startswith("---")
    assert f"title: \"{session.title}\"" in body or f"title: '{session.title}'" in body or session.title in body
    assert str(session.id) in body
    assert "status: active" in body

    # Kiểm tra các Sections
    assert "# 1. BÀI TOÁN & PHÂN TÍCH MÂU THUẪN TRIZ" in body
    assert "Cánh tay robot cần nhẹ để tăng tốc độ" in body
    assert "Độ bền / Độ cứng" in body
    assert "Trọng lượng vật thể" in body

    assert "# 2. NGUYÊN TẮC SÁNG TẠO ĐỀ XUẤT" in body

    assert "# 3. SỔ TAY GHI CHÉP NGHIÊN CỨU (RESEARCH NOTES)" in body
    assert "Đề xuất dùng cấu trúc rỗng tổ ong kết hợp sợi carbon" in body
    assert "Hypothesis" in body or "hypothesis" in body


@pytest.mark.asyncio
async def test_export_session_fallback_when_empty_frame_and_notes(db_session: Session):
    """
    GIVEN: Một session mới chưa có ProblemFrame và chưa có Notes
    WHEN: Gửi GET /api/v1/sessions/{session_id}/export?format=markdown
    THEN: Trả về HTTP 200 OK với fallback thông báo chưa có dữ liệu ở từng mục
    """
    session = ResearchSession(
        title="Session Trống Mới Tạo",
        status=SessionStatus.active,
        workflow_state="intake",
    )
    db_session.add(session)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=markdown")

    assert response.status_code == 200
    assert "text/markdown" in response.headers.get("content-type", "")
    body = response.text
    assert session.title in body
    assert "Chưa có dữ liệu" in body or "Chưa có phân tích" in body or "Chưa có ghi chú" in body


@pytest.mark.asyncio
async def test_export_session_not_found_404():
    """
    GIVEN: Session ID ngẫu nhiên không tồn tại trong DB
    WHEN: Gửi GET /api/v1/sessions/{random_id}/export?format=md
    THEN: Trả về HTTP 404 Not Found
    """
    random_id = uuid.uuid4()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{random_id}/export?format=md")

    assert response.status_code == 404
    assert f"ResearchSession with id '{random_id}' not found" in response.json()["detail"]


@pytest.mark.asyncio
async def test_export_session_invalid_format_400(db_session: Session):
    """
    GIVEN: Một session hợp lệ
    WHEN: Gửi GET /api/v1/sessions/{session_id}/export với format không hỗ trợ (vd: pdf)
    THEN: Trả về HTTP 400 Bad Request kèm chi tiết các format hợp lệ
    """
    session = ResearchSession(
        title="Session Test Format",
        status=SessionStatus.active,
        workflow_state="intake",
    )
    db_session.add(session)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=pdf")

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "Unsupported export format" in detail
    assert "md" in detail or "markdown" in detail


@pytest.mark.asyncio
async def test_export_session_zero_db_mutation(db_session: Session):
    """
    GIVEN: Một session và các dữ liệu liên quan
    WHEN: Gửi GET export nhiều lần
    THEN: Không có bất kỳ bản ghi nào bị thay đổi/thêm/bớt trong DB (read-only)
    """
    session = ResearchSession(
        title="Session Test Read-Only",
        status=SessionStatus.active,
        workflow_state="retrieval",
    )
    db_session.add(session)
    db_session.commit()

    count_sessions_before = db_session.query(ResearchSession).count()
    count_notes_before = db_session.query(ResearchNote).count()
    count_frames_before = db_session.query(ProblemFrame).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(3):
            res = await client.get(f"/api/v1/sessions/{session.id}/export?format=md")
            assert res.status_code == 200

    assert db_session.query(ResearchSession).count() == count_sessions_before
    assert db_session.query(ResearchNote).count() == count_notes_before
    assert db_session.query(ProblemFrame).count() == count_frames_before
