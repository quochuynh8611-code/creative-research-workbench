"""test_c39_batch_export_api.py — Integration tests cho C39 Lô 1: Multi-Session Batch Export & Streaming API.

Specifications:
  - Feature: Multi-Session Batch Export & Archive (C39-FEAT-02)
  - Endpoint: POST /api/v1/sessions/batch-export
  - Scope: C39 Lô 1 (Backend Service & API)
  - In-Memory ZIP Streaming, Zero DB Migration, Zero New Dependencies, Safety Ceiling <= 100 sessions.
"""
from __future__ import annotations

import io
import json
import uuid
import zipfile
from datetime import datetime, timezone, timedelta
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    CandidateSolution,
    ContradictionType,
    ProblemFrame,
    ResearchNote,
    ResearchSession,
    SessionStatus,
    Tag,
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


def _create_test_session(
    db: Session,
    title: str,
    domain: str = "business",
    status: SessionStatus = SessionStatus.active,
    tags: list[str] | None = None,
    created_at: datetime | None = None,
) -> ResearchSession:
    """Helper tạo research session đầy đủ dữ liệu cho test."""
    sess = ResearchSession(
        title=title,
        description=f"Mô tả cho {title}",
        domain=domain,
        status=status,
        workflow_state="ideation",
    )
    if created_at:
        sess.created_at = created_at
    db.add(sess)
    db.flush()

    # Thêm ProblemFrame
    frame = ProblemFrame(
        session_id=sess.id,
        raw_statement=f"Bài toán cho {title}",
        normalized_statement=f"Chuẩn hóa cho {title}",
        contradiction_type=ContradictionType.technical,
        improving_parameter="Năng suất",
        worsening_parameter="Chi phí",
        domain=domain,
    )
    db.add(frame)
    db.flush()

    # Thêm CandidateSolution
    sol = CandidateSolution(
        session_id=sess.id,
        title=f"Giải pháp cho {title}",
        mechanism="Sử dụng nguyên tắc phân tách thời gian",
        status="candidate",
        novelty_score=8.5,
        feasibility_score=9.0,
    )
    db.add(sol)
    db.flush()

    # Thêm ResearchNote và Tags nếu có
    note = ResearchNote(
        session_id=sess.id,
        content=f"Ghi chú nghiên cứu cho {title}",
        note_type="insight",
    )
    db.add(note)
    db.flush()

    if tags:
        for tag_str in tags:
            clean_tag = tag_str.strip().lower()
            tag_obj = db.query(Tag).filter_by(canonical_slug=clean_tag).first()
            if not tag_obj:
                tag_obj = Tag(canonical_slug=clean_tag, display_label=clean_tag)
                db.add(tag_obj)
                db.flush()
            note.tags.append(tag_obj)
        db.flush()

    return sess


@pytest.mark.asyncio
async def test_batch_export_explicit_session_ids_zip_both_formats(db_session: Session):
    """
    GIVEN: 2 sessions hợp lệ trong DB
    WHEN: Gửi POST /api/v1/sessions/batch-export với session_ids cụ thể và format='both'
    THEN:
      1. HTTP 200 OK, Content-Type 'application/zip'
      2. Content-Disposition đính kèm filename 'creative-research-archive-{timestamp}.zip'
      3. Tệp ZIP chứa 'manifest.json' với total_sessions = 2
      4. Tệp ZIP chứa đúng 2 file .md trong 'markdown/' và 2 file .json trong 'json/'
      5. Trạng thái của cả 2 session vẫn giữ nguyên 'active'
    """
    s1 = _create_test_session(db_session, "Nghiên cứu Pin Thể Rắn", domain="mechanical", tags=["pin", "dien-cuc"])
    s2 = _create_test_session(db_session, "Mô hình Chuỗi Cung Ứng ST25", domain="business", tags=["gao", "logistics"])

    payload = {
        "session_ids": [str(s1.id), str(s2.id)],
        "format": "both",
        "archive_after_export": False,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/zip"
    assert "creative-research-archive-" in response.headers["content-disposition"]
    assert response.headers["content-disposition"].endswith('.zip"')

    # Đọc và giải nén ZIP hoàn toàn trong RAM
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        namelist = zf.namelist()
        assert "manifest.json" in namelist

        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest["archive_version"] == "1.0"
        assert manifest["total_sessions"] == 2
        assert manifest["requested_format"] == "both"
        assert len(manifest["sessions_index"]) == 2

        md_files = [f for f in namelist if f.startswith("markdown/") and f.endswith(".md")]
        json_files = [f for f in namelist if f.startswith("json/") and f.endswith(".json")]
        assert len(md_files) == 2
        assert len(json_files) == 2

        # Kiểm tra nội dung markdown của 1 session
        md_content = zf.read(md_files[0]).decode("utf-8")
        assert "MÃ PHIÊN NGHIÊN CỨU" in md_content.upper() or "session_id:" in md_content

        # Kiểm tra nội dung json snapshot của 1 session
        snapshot = json.loads(zf.read(json_files[0]).decode("utf-8"))
        assert "session" in snapshot
        assert "problem_frame" in snapshot
        assert "research_notes" in snapshot

    # Xác nhận sessions không bị thay đổi trạng thái
    db_session.refresh(s1)
    db_session.refresh(s2)
    assert s1.status == SessionStatus.active
    assert s2.status == SessionStatus.active


@pytest.mark.asyncio
async def test_batch_export_format_markdown_only(db_session: Session):
    """
    GIVEN: 1 session
    WHEN: Gửi POST /api/v1/sessions/batch-export với format='markdown'
    THEN: Tệp ZIP chỉ chứa 'manifest.json' và thư mục 'markdown/', không chứa 'json/'
    """
    s = _create_test_session(db_session, "Thiết kế Cánh Buồm Khí Động", domain="mechanical")

    payload = {
        "session_ids": [str(s.id)],
        "format": "markdown",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 200
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        namelist = zf.namelist()
        assert "manifest.json" in namelist
        assert any(f.startswith("markdown/") for f in namelist)
        assert not any(f.startswith("json/") for f in namelist)


@pytest.mark.asyncio
async def test_batch_export_format_json_only(db_session: Session):
    """
    GIVEN: 1 session
    WHEN: Gửi POST /api/v1/sessions/batch-export với format='json'
    THEN: Tệp ZIP chỉ chứa 'manifest.json' và thư mục 'json/', không chứa 'markdown/'
    """
    s = _create_test_session(db_session, "Phân Tích Dữ Liệu Dinh Dưỡng", domain="healthcare")

    payload = {
        "session_ids": [str(s.id)],
        "format": "json",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 200
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        namelist = zf.namelist()
        assert "manifest.json" in namelist
        assert any(f.startswith("json/") for f in namelist)
        assert not any(f.startswith("markdown/") for f in namelist)


@pytest.mark.asyncio
async def test_batch_export_filter_by_tag(db_session: Session):
    """
    GIVEN: 3 sessions với các tag khác nhau (2 session chứa tag 'pin-lithium')
    WHEN: Gửi POST /api/v1/sessions/batch-export với filters={'tag': 'pin-lithium'}
    THEN: Chỉ xuất đúng 2 session có ghi chú chứa tag 'pin-lithium'
    """
    s1 = _create_test_session(db_session, "Pin Thể Rắn 1", tags=["pin-lithium", "anode"])
    s2 = _create_test_session(db_session, "Tản nhiệt Động cơ", tags=["cooling", "thermal"])
    s3 = _create_test_session(db_session, "Pin Thể Rắn 2", tags=["pin-lithium", "cathode"])

    payload = {
        "filters": {
            "tag": "pin-lithium",
        },
        "format": "both",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 200
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest["total_sessions"] == 2
        exported_ids = [item["id"] for item in manifest["sessions_index"]]
        assert str(s1.id) in exported_ids
        assert str(s3.id) in exported_ids
        assert str(s2.id) not in exported_ids


@pytest.mark.asyncio
async def test_batch_export_filter_by_status_and_domain(db_session: Session):
    """
    GIVEN: Sessions có trạng thái và domain khác nhau
    WHEN: Gửi POST /api/v1/sessions/batch-export với filter status='archived' và domain='business'
    THEN: Chỉ xuất session khớp cả status và domain
    """
    s_target = _create_test_session(db_session, "Target Session", domain="business", status=SessionStatus.archived)
    _create_test_session(db_session, "Active Business", domain="business", status=SessionStatus.active)
    _create_test_session(db_session, "Archived Mechanical", domain="mechanical", status=SessionStatus.archived)

    payload = {
        "filters": {
            "status": "archived",
            "domain": "business",
        },
        "format": "json",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 200
    zip_buffer = io.BytesIO(response.content)
    with zipfile.ZipFile(zip_buffer, "r") as zf:
        manifest = json.loads(zf.read("manifest.json").decode("utf-8"))
        assert manifest["total_sessions"] == 1
        assert manifest["sessions_index"][0]["id"] == str(s_target.id)


@pytest.mark.asyncio
async def test_batch_export_archive_after_export_flag(db_session: Session):
    """
    GIVEN: 2 active sessions
    WHEN: Gửi POST /api/v1/sessions/batch-export với archive_after_export=True
    THEN:
      1. Tệp ZIP được trả về thành công
      2. Cả 2 sessions được cập nhật status='archived' trong DB
      3. Dữ liệu ghi chú và giải pháp không bị mất
    """
    s1 = _create_test_session(db_session, "Session Archive Test 1", status=SessionStatus.active)
    s2 = _create_test_session(db_session, "Session Archive Test 2", status=SessionStatus.active)

    payload = {
        "session_ids": [str(s1.id), str(s2.id)],
        "archive_after_export": True,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 200

    # Kiểm tra trạng thái đã chuyển thành archived
    db_session.refresh(s1)
    db_session.refresh(s2)
    assert s1.status == SessionStatus.archived
    assert s2.status == SessionStatus.archived
    assert len(s1.research_notes) >= 1
    assert len(s1.candidate_solutions) >= 1


@pytest.mark.asyncio
async def test_batch_export_exceed_safety_limit_returns_422(db_session: Session):
    """
    GIVEN: Tạo giả lập danh sách session_ids > 100 phần tử
    WHEN: Gửi POST /api/v1/sessions/batch-export với 101 session_ids
    THEN: Trả về HTTP 422 Unprocessable Entity kèm header X-Error-Code: EXCEED_BATCH_LIMIT
    """
    too_many_ids = [str(uuid.uuid4()) for _ in range(101)]

    payload = {
        "session_ids": too_many_ids,
        "format": "both",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 422
    assert response.headers.get("x-error-code") == "EXCEED_BATCH_LIMIT"
    assert "100" in response.json()["detail"]


@pytest.mark.asyncio
async def test_batch_export_zero_matching_returns_404(db_session: Session):
    """
    GIVEN: Bộ lọc không khớp bất kỳ session nào
    WHEN: Gửi POST /api/v1/sessions/batch-export
    THEN: Trả về HTTP 404 Not Found
    """
    payload = {
        "filters": {
            "domain": "nonexistent_domain_xyz",
        },
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 404
    assert "Không tìm thấy" in response.json()["detail"]


@pytest.mark.asyncio
async def test_batch_export_empty_request_returns_400():
    """
    GIVEN: Request rỗng không có cả session_ids lẫn filters
    WHEN: Gửi POST /api/v1/sessions/batch-export
    THEN: Trả về HTTP 400 Bad Request
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json={})

    assert response.status_code == 400
    assert "session_ids" in response.json()["detail"] or "filters" in response.json()["detail"]


@pytest.mark.asyncio
async def test_batch_export_invalid_format_returns_400(db_session: Session):
    """
    GIVEN: Định dạng không hợp lệ như 'pdf' hay 'xml'
    WHEN: Gửi POST /api/v1/sessions/batch-export
    THEN: Trả về HTTP 400 Bad Request
    """
    s = _create_test_session(db_session, "Test Session")
    payload = {
        "session_ids": [str(s.id)],
        "format": "pdf",
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/batch-export", json=payload)

    assert response.status_code == 400
    assert "Unsupported" in response.json()["detail"] or "format" in response.json()["detail"]
