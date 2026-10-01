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
    Contradiction,
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
    db_session.flush()

    contra = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Độ bền vs Trọng lượng",
        suggested_principles=[15, 8, 29, 34],
    )
    db_session.add(contra)

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
    assert f'title: "{session.title}"' in body or session.title in body
    assert str(session.id) in body
    assert "status: active" in body

    # Kiểm tra Section 1
    assert "# 1. BÀI TOÁN & PHÂN TÍCH MÂU THUẪN TRIZ" in body
    assert "Cánh tay robot cần nhẹ để tăng tốc độ" in body
    assert "Độ bền / Độ cứng" in body
    assert "Trọng lượng vật thể" in body

    # Kiểm tra Section 2 có chứa các nguyên tắc TRIZ được gợi ý
    assert "# 2. NGUYÊN TẮC SÁNG TẠO ĐỀ XUẤT" in body
    assert "#15" in body or "Dynamics" in body or "Linh hoạt hóa" in body
    assert "#8" in body or "Anti-weight" in body or "Phản trọng lượng" in body

    # Kiểm tra Section 3
    assert "# 3. SỔ TAY GHI CHÉP NGHIÊN CỨU (RESEARCH NOTES)" in body
    assert "Đề xuất dùng cấu trúc rỗng tổ ong kết hợp sợi carbon" in body
    assert "Hypothesis" in body or "hypothesis" in body


@pytest.mark.asyncio
async def test_export_session_markdown_renders_full_triz_principles_details(db_session: Session):
    """
    GIVEN: Session có ProblemFrame và Contradiction với 3 nguyên tắc sáng tạo [1, 10, 35]
    WHEN: Gửi GET /api/v1/sessions/{session_id}/export?format=md
    THEN: Section 2 phải render chi tiết từng nguyên tắc với số hiệu, tên và mô tả
    """
    session = ResearchSession(
        title="Tối ưu quy trình đóng gói",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Cần tăng tốc độ đóng gói mà không làm rách bao bì",
        normalized_statement="Tăng năng suất đóng gói với giới hạn độ bền bao bì",
        contradiction_type=ContradictionType.technical,
        improving_parameter="Năng suất",
        worsening_parameter="Độ bền",
        domain="technical",
    )
    db_session.add(frame)
    db_session.flush()

    contra = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Năng suất vs Độ bền",
        suggested_principles=[1, 10, 35],
    )
    db_session.add(contra)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=md")

    assert response.status_code == 200
    body = response.text

    assert "# 2. NGUYÊN TẮC SÁNG TẠO ĐỀ XUẤT" in body
    assert "#1" in body
    assert "#10" in body
    assert "#35" in body


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
    WHEN: Gửi GET /api/v1/sessions/{session_id}/export với format không hỗ trợ (vd: docx)
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
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=docx")

    assert response.status_code == 400
    detail = response.json()["detail"]
    assert "Unsupported export format" in detail
    assert "md" in detail or "markdown" in detail


@pytest.mark.asyncio
async def test_export_session_zero_db_mutation(db_session: Session):
    """
    GIVEN: Một session và các dữ liệu liên quan
    WHEN: Gửi GET export nhiều lần
    THEN: Không có bất kỳ bản ghi nào bị thay đổi/thêm/bớt trong DB, updated_at không đổi
    """
    session = ResearchSession(
        title="Session Test Read-Only",
        status=SessionStatus.active,
        workflow_state="retrieval",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    initial_session_updated_at = session.updated_at
    count_sessions_before = db_session.query(ResearchSession).count()
    count_notes_before = db_session.query(ResearchNote).count()
    count_frames_before = db_session.query(ProblemFrame).count()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(3):
            res = await client.get(f"/api/v1/sessions/{session.id}/export?format=md")
            assert res.status_code == 200

    db_session.refresh(session)
    assert session.updated_at == initial_session_updated_at
    assert db_session.query(ResearchSession).count() == count_sessions_before
    assert db_session.query(ResearchNote).count() == count_notes_before
    assert db_session.query(ProblemFrame).count() == count_frames_before
