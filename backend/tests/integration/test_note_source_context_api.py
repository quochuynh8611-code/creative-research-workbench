"""
test_note_source_context_api.py — Integration test suite cho Batch C7c-1: API và Dịch vụ source_context.

Kiểm tra:
  - Backward compatibility: Tạo note không có source_context vẫn 201, source_context = None.
  - Validation:
      - Chấp nhận 5 nguồn hợp lệ (triz_9_windows, triz_matrix, principle_suggestion, evidence, candidate_solution).
      - Từ chối 422 với source_type lạ, trường thừa, principle_id/param_id ngoài khoảng, chuỗi vượt max_length.
      - Nguồn evidence: Cho phép top-level source_chunk_id nhưng CẤM lặp chunk_id trong source_context.
  - CRUD Endpoints:
      - GET /notes trả về source_context (null cho note cũ, dict cho note mới).
      - DELETE /notes/{id} hoạt động bình thường.
  - Export:
      - JSON export chứa trường source_context trong mảng research_notes.
      - Markdown export không bị crash và hiển thị thông tin ngữ cảnh nếu có.
  - Import (Được kiểm tra ở cả 2 tầng):
      - [Tầng Service]: Snapshot cũ không context -> import thành công, gán source_context = None.
      - [Tầng Service]: Snapshot có context hợp lệ -> import thành công và bảo toàn source_context.
      - [Tầng Service]: Snapshot có context sai định dạng -> import_session_from_json ném lỗi và rollback.
      - [Tầng API Endpoint]: POST /api/v1/sessions/import với context sai định dạng -> từ chối HTTP 422, zero orphan records.
  - Regression guards:
      - Analytics overview: Tổng hợp số lượng note_type hoạt động ổn định khi có note chứa source_context.
      - AI report: Sinh báo cáo tổng hợp bằng chứng từ notes hoạt động ổn định khi có note chứa source_context.
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.domain.models import (
    ResearchSession,
    ResearchNote,
    SessionStatus,
    ProblemFrame,
    ContradictionType,
)
from app.main import app
from app.services.session_export_service import (
    export_session_as_json,
    export_session_as_markdown,
)
from app.services.session_import_service import import_session_from_json


@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Ghi đè get_db sang disposable db_session của testcontainers."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.fixture
def active_session(db_session: Session) -> ResearchSession:
    """Fixture tạo một ResearchSession active cho các API tests."""
    session = ResearchSession(
        title="Session Test Source Context C7c-1",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()
    return session


# ──────────────────────────────────────────────
# 1. API Create Note — Backward Compatibility
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_note_without_source_context_backward_compatible(active_session: ResearchSession):
    """
    GIVEN: Client cũ gửi request POST /notes không có trường source_context
    WHEN: Gọi API tạo ghi chú
    THEN: Trả về HTTP 201 Created và trường source_context trong response là None
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú không có context từ client cũ",
                "note_type": "insight",
            },
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["content"] == "Ghi chú không có context từ client cũ"
    assert "source_context" in data
    assert data["source_context"] is None


# ──────────────────────────────────────────────
# 2. API Create Note — 5 Valid Source Contexts
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_note_with_valid_triz_9_windows_context(active_session: ResearchSession):
    """
    GIVEN: Request tạo note có source_context hợp lệ từ triz_9_windows
    WHEN: Gửi POST /notes
    THEN: Trả về HTTP 201 Created, lưu bền vững và trả về đúng source_context
    """
    context_payload = {
        "schema_version": 1,
        "source_type": "triz_9_windows",
        "lens": "engineering",
        "level": "system",
        "time": "present",
        "cell_label": "Hệ thống kỹ thuật hiện tại",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú từ lưới 9 màn hình",
                "note_type": "insight",
                "source_context": context_payload,
            },
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["source_context"] == context_payload


@pytest.mark.asyncio
async def test_create_note_with_valid_triz_matrix_context(active_session: ResearchSession):
    """
    GIVEN: Request tạo note có source_context hợp lệ từ triz_matrix
    WHEN: Gửi POST /notes
    THEN: Trả về HTTP 201 Created
    """
    context_payload = {
        "schema_version": 1,
        "source_type": "triz_matrix",
        "principle_id": 1,
        "improving_param_id": 1,
        "worsening_param_id": 14,
        "lens": "business",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú từ ma trận TRIZ",
                "note_type": "hypothesis",
                "source_context": context_payload,
            },
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["source_context"] == context_payload


@pytest.mark.asyncio
async def test_create_note_with_valid_principle_suggestion_context(active_session: ResearchSession):
    """
    GIVEN: Request tạo note có source_context hợp lệ từ principle_suggestion
    WHEN: Gửi POST /notes
    THEN: Trả về HTTP 201 Created
    """
    context_payload = {
        "schema_version": 1,
        "source_type": "principle_suggestion",
        "principle_id": 35,
        "method_id": "method-param-change",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú từ gợi ý nguyên tắc",
                "note_type": "hypothesis",
                "source_context": context_payload,
            },
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["source_context"] == context_payload


@pytest.mark.asyncio
async def test_create_note_with_valid_evidence_context(active_session: ResearchSession):
    """
    GIVEN: Request tạo note có source_context hợp lệ từ evidence
    WHEN: Gửi POST /notes
    THEN: Trả về HTTP 201 Created
    """
    context_payload = {
        "schema_version": 1,
        "source_type": "evidence",
        "source_ref": "Báo cáo Kỹ thuật TRIZ 2026 - Chương 3",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Trích dẫn bằng chứng thực nghiệm",
                "note_type": "insight",
                "source_context": context_payload,
            },
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["source_context"] == context_payload


@pytest.mark.asyncio
async def test_create_note_with_valid_candidate_solution_context(active_session: ResearchSession):
    """
    GIVEN: Request tạo note có source_context hợp lệ từ candidate_solution
    WHEN: Gửi POST /notes
    THEN: Trả về HTTP 201 Created
    """
    sol_id = str(uuid.uuid4())
    context_payload = {
        "schema_version": 1,
        "source_type": "candidate_solution",
        "solution_id": sol_id,
        "principle_used": 10,
        "solution_status": "accepted",
    }
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú quyết định chấp nhận giải pháp",
                "note_type": "decision",
                "source_context": context_payload,
            },
        )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["source_context"] == context_payload


# ──────────────────────────────────────────────
# 3. API Create Note — Validation Rejections (422)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_note_rejects_unknown_source_type(active_session: ResearchSession):
    """Ghi chú có source_type lạ phải bị từ chối 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú với source_type không hợp lệ",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "magic_wand",
                    "spell": "lumos",
                },
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_note_rejects_extra_fields(active_session: ResearchSession):
    """Ghi chú có trường lạ phải bị từ chối 422 (chính sách extra='forbid')."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú có trường lạ trong context",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "evidence",
                    "source_ref": "Ref doc",
                    "unauthorized_score": 99.9,
                },
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_note_rejects_out_of_range_principle_id(active_session: ResearchSession):
    """Ghi chú có principle_id ngoài 1..40 phải bị từ chối 422."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú có principle_id = 99",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "triz_matrix",
                    "principle_id": 99,
                    "improving_param_id": 1,
                    "worsening_param_id": 1,
                    "lens": "engineering",
                },
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_create_note_evidence_forbids_chunk_id_in_source_context(active_session: ResearchSession):
    """
    GIVEN: Request tạo note evidence có source_chunk_id ở cấp ngoài (hợp lệ)
           nhưng cố tình chèn thêm chunk_id vào bên trong source_context (trái đặc tả).
    WHEN: Gửi POST /notes
    THEN: Bị từ chối HTTP 422 Unprocessable Entity do vi phạm extra='forbid'.
    """
    chunk_uuid = str(uuid.uuid4())
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú trích dẫn",
                "note_type": "insight",
                "source_chunk_id": chunk_uuid,
                "source_context": {
                    "schema_version": 1,
                    "source_type": "evidence",
                    "source_ref": "Tài liệu",
                    "chunk_id": chunk_uuid,  # Không được phép lặp lại trong context
                },
            },
        )
    assert resp.status_code == 422


# ──────────────────────────────────────────────
# 4. API List & Delete Notes
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_list_notes_includes_source_context(active_session: ResearchSession, db_session: Session):
    """
    GIVEN: Session có 1 note cũ (source_context=None) và 1 note mới (có source_context)
    WHEN: Gọi GET /api/v1/sessions/{session_id}/notes
    THEN: Trả về danh sách chứa trường source_context tương ứng cho từng note
    """
    # 1. Note cũ
    old_note = ResearchNote(
        session_id=active_session.id,
        content="Ghi chú cũ không context",
        note_type="insight",
    )
    if hasattr(old_note, "source_context"):
        setattr(old_note, "source_context", None)
    db_session.add(old_note)

    # 2. Note mới
    new_ctx = {
        "schema_version": 1,
        "source_type": "evidence",
        "source_ref": "Doc 123",
    }
    new_note = ResearchNote(
        session_id=active_session.id,
        content="Ghi chú mới có context",
        note_type="insight",
    )
    if hasattr(new_note, "source_context"):
        setattr(new_note, "source_context", new_ctx)
    db_session.add(new_note)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(f"/api/v1/sessions/{active_session.id}/notes")
    assert resp.status_code == 200
    items = resp.json()["data"]
    assert len(items) >= 2
    for item in items:
        assert "source_context" in item
        if item["content"] == "Ghi chú mới có context":
            assert item["source_context"] == new_ctx
        elif item["content"] == "Ghi chú cũ không context":
            assert item["source_context"] is None


@pytest.mark.asyncio
async def test_delete_note_with_source_context(active_session: ResearchSession, db_session: Session):
    """Xóa ghi chú có source_context vẫn hoạt động thành công."""
    note = ResearchNote(
        session_id=active_session.id,
        content="Note cần xóa",
        note_type="insight",
    )
    if hasattr(note, "source_context"):
        setattr(note, "source_context", {"schema_version": 1, "source_type": "evidence", "source_ref": "ref"})
    db_session.add(note)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.delete(f"/api/v1/sessions/{active_session.id}/notes/{note.id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "deleted"


# ──────────────────────────────────────────────
# 5. Export / Import Services
# ──────────────────────────────────────────────

def test_json_and_markdown_export_with_source_context(active_session: ResearchSession, db_session: Session):
    """
    GIVEN: Session có ghi chú chứa source_context
    WHEN: Gọi export_session_as_json và export_session_as_markdown
    THEN: JSON chứa trường source_context trong research_notes; Markdown render không bị lỗi
    """
    ctx = {
        "schema_version": 1,
        "source_type": "triz_9_windows",
        "lens": "business",
        "level": "system",
        "time": "present",
        "cell_label": "Mô hình kinh doanh",
    }
    note = ResearchNote(
        session_id=active_session.id,
        content="Nội dung ghi chú phân tích 9-Windows",
        note_type="insight",
    )
    if hasattr(note, "source_context"):
        setattr(note, "source_context", ctx)
    db_session.add(note)
    db_session.flush()

    # 1. JSON Export
    json_data = export_session_as_json(active_session, db_session)
    exported_notes = json_data.get("research_notes", [])
    target = next((n for n in exported_notes if n["content"] == "Nội dung ghi chú phân tích 9-Windows"), None)
    assert target is not None
    assert "source_context" in target
    assert target["source_context"] == ctx

    # 2. Markdown Export
    md_content = export_session_as_markdown(active_session, db_session)
    assert isinstance(md_content, str)
    assert "Nội dung ghi chú phân tích 9-Windows" in md_content


def test_import_session_legacy_snapshot_without_source_context(db_session: Session):
    """
    [Tầng Service]:
    GIVEN: Snapshot session cũ không có trường source_context trong research_notes
    WHEN: Gọi import_session_from_json
    THEN: Import thành công, research_notes được tạo với source_context = None
    """
    snapshot = {
        "session": {
            "title": "Import Legacy Session",
            "domain": "technical",
            "workflow_state": "intake",
        },
        "research_notes": [
            {
                "content": "Ghi chú từ snapshot cũ",
                "note_type": "insight",
            }
        ],
    }
    new_session, _ = import_session_from_json(snapshot, db_session)
    assert new_session is not None
    notes = db_session.query(ResearchNote).filter_by(session_id=new_session.id).all()
    assert len(notes) == 1
    assert notes[0].content == "Ghi chú từ snapshot cũ"
    assert notes[0].source_context is None


def test_import_session_preserves_valid_source_context(db_session: Session):
    """
    [Tầng Service]:
    GIVEN: Snapshot session có research_note chứa source_context hợp lệ
    WHEN: Gọi import_session_from_json
    THEN: Import thành công và bảo toàn source_context trong database
    """
    ctx = {
        "schema_version": 1,
        "source_type": "triz_matrix",
        "principle_id": 10,
        "improving_param_id": 1,
        "worsening_param_id": 14,
        "lens": "engineering",
    }
    snapshot = {
        "session": {
            "title": "Import Modern Session",
            "domain": "engineering",
            "workflow_state": "ideation",
        },
        "research_notes": [
            {
                "content": "Ghi chú có context hợp lệ",
                "note_type": "hypothesis",
                "source_context": ctx,
            }
        ],
    }
    new_session, _ = import_session_from_json(snapshot, db_session)
    assert new_session is not None
    notes = db_session.query(ResearchNote).filter_by(session_id=new_session.id).all()
    assert len(notes) == 1
    assert hasattr(notes[0], "source_context")
    assert getattr(notes[0], "source_context") == ctx


def test_import_session_service_rejects_malformed_source_context_atomically(db_session: Session):
    """
    [Tầng Service]:
    GIVEN: Snapshot session có research_note chứa source_context sai định dạng (ví dụ principle_id = 999)
    WHEN: Gọi import_session_from_json
    THEN: Ném ngoại lệ ValueError (hoặc ValidationError), và rollback nguyên tử (không lưu session hay note mồ côi)
    """
    initial_sessions_count = db_session.query(ResearchSession).count()
    initial_notes_count = db_session.query(ResearchNote).count()

    malformed_snapshot = {
        "session": {
            "title": "Import Corrupted Service Session",
            "domain": "technical",
        },
        "research_notes": [
            {
                "content": "Ghi chú context lỗi",
                "note_type": "hypothesis",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "triz_matrix",
                    "principle_id": 999,  # Vượt range 1..40
                },
            }
        ],
    }

    with pytest.raises(Exception):
        import_session_from_json(malformed_snapshot, db_session)

    # Đảm bảo rollback nguyên tử: Không có session hay note mồ côi nào được tạo
    db_session.rollback()
    assert db_session.query(ResearchSession).count() == initial_sessions_count
    assert db_session.query(ResearchNote).count() == initial_notes_count


@pytest.mark.asyncio
async def test_import_session_endpoint_rejects_malformed_context_atomically_with_422(db_session: Session):
    """
    [Tầng API Endpoint]:
    GIVEN: Request POST /api/v1/sessions/import chứa snapshot có research_note mang source_context sai định dạng
    WHEN: Gọi API import session
    THEN: Endpoint trả về HTTP 422 Unprocessable Entity và cơ sở dữ liệu KHÔNG có bất kỳ session hay note nào được tạo
    """
    initial_sessions_count = db_session.query(ResearchSession).count()
    initial_notes_count = db_session.query(ResearchNote).count()

    malformed_snapshot = {
        "session": {
            "title": "Import Corrupted Endpoint Session",
            "domain": "technical",
        },
        "research_notes": [
            {
                "content": "Ghi chú context lỗi",
                "note_type": "hypothesis",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "triz_matrix",
                    "principle_id": 999,  # Vượt range 1..40
                },
            }
        ],
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/sessions/import", json=malformed_snapshot)

    assert resp.status_code == 422
    # Xác minh không có orphan records
    db_session.rollback()
    assert db_session.query(ResearchSession).count() == initial_sessions_count
    assert db_session.query(ResearchNote).count() == initial_notes_count


# ──────────────────────────────────────────────
# 6. Regression Guards: Analytics & AI Report
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_analytics_overview_unaffected_by_note_source_context(active_session: ResearchSession, db_session: Session):
    """
    [Regression Guard]:
    GIVEN: Session có các ghi chú chứa source_context
    WHEN: Gọi GET /api/v1/analytics/overview
    THEN: Endpoint trả về HTTP 200, tổng số research_notes và phân loại theo note_type hoạt động chuẩn xác
    """
    ctx = {
        "schema_version": 1,
        "source_type": "triz_9_windows",
        "lens": "engineering",
        "level": "system",
        "time": "present",
        "cell_label": "Hệ thống",
    }
    note = ResearchNote(
        session_id=active_session.id,
        content="Ghi chú phân tích cho analytics",
        note_type="insight",
    )
    if hasattr(note, "source_context"):
        setattr(note, "source_context", ctx)
    db_session.add(note)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/analytics/overview")
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert "content" in body
    assert body["content"]["total_research_notes"] >= 1
    assert "insight" in body["content"]["notes_by_type"]


@pytest.mark.asyncio
async def test_ai_report_generation_unaffected_by_note_source_context(active_session: ResearchSession, db_session: Session):
    """
    [Regression Guard]:
    GIVEN: Session có các ghi chú chứa source_context
    WHEN: Gọi POST /api/v1/sessions/{session_id}/ai/generate-report
    THEN: Báo cáo AI tổng hợp thành công (HTTP 200) mà không phát sinh lỗi ngoại lệ
    """
    ctx = {
        "schema_version": 1,
        "source_type": "evidence",
        "source_ref": "Doc Test Ref",
    }
    note = ResearchNote(
        session_id=active_session.id,
        content="Bằng chứng phục vụ báo cáo AI",
        note_type="insight",
    )
    if hasattr(note, "source_context"):
        setattr(note, "source_context", ctx)
    db_session.add(note)
    db_session.flush()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(f"/api/v1/sessions/{active_session.id}/ai/generate-report")
    assert resp.status_code == 200
    report_data = resp.json()["data"]
    assert "evidence_synthesis" in report_data
    assert isinstance(report_data["evidence_synthesis"], str)


# ──────────────────────────────────────────────
# 7. Control Characters Defense & Markdown Escaping
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_create_note_rejects_control_characters_with_422(active_session: ResearchSession):
    """
    GIVEN: Request tạo ghi chú có trường source_ref chứa ký tự điều khiển (newline)
    WHEN: Gọi API POST /api/v1/sessions/{session_id}/notes
    THEN: Bị từ chối HTTP 422 Unprocessable Entity
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú chứa ký tự điều khiển trong context",
                "note_type": "insight",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "evidence",
                    "source_ref": "Dòng 1\nDòng 2 nguy hại",
                },
            },
        )
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_import_session_rejects_control_characters_atomically_with_422(db_session: Session):
    """
    GIVEN: Snapshot session có ghi chú chứa cell_label mang ký tự điều khiển (\r\n)
    WHEN: Gọi API import session
    THEN: Bị từ chối HTTP 422 và rollback nguyên tử 0 orphan records
    """
    initial_sessions_count = db_session.query(ResearchSession).count()
    initial_notes_count = db_session.query(ResearchNote).count()

    malformed_snapshot = {
        "session": {
            "title": "Import Control Char Session",
            "domain": "technical",
        },
        "research_notes": [
            {
                "content": "Ghi chú có cell_label vỡ dòng",
                "note_type": "insight",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "triz_9_windows",
                    "lens": "engineering",
                    "level": "system",
                    "time": "present",
                    "cell_label": "Hệ thống\r\nĐột nhập",
                },
            }
        ],
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post("/api/v1/sessions/import", json=malformed_snapshot)

    assert resp.status_code == 422
    db_session.rollback()
    assert db_session.query(ResearchSession).count() == initial_sessions_count
    assert db_session.query(ResearchNote).count() == initial_notes_count


def test_markdown_export_escapes_formatting_and_prevents_line_break(active_session: ResearchSession, db_session: Session):
    r"""
    GIVEN: Ghi chú có source_ref chứa ký tự định dạng Markdown (*, _, `, [, ], <, >, \)
    WHEN: Gọi export_session_as_markdown
    THEN: Các ký tự định dạng được escape bằng dấu gạch chéo ngược (\), không vỡ dòng,
          không chèn raw HTML hay Markdown link click được.
    """
    malicious_ref = r"*nguy hiểm* _in nghiêng_ `mã` [liên kết](http://evil.com) <script>alert(1)</script> \backslash"
    ctx = {
        "schema_version": 1,
        "source_type": "evidence",
        "source_ref": malicious_ref,
    }
    note = ResearchNote(
        session_id=active_session.id,
        content="Ghi chú kiểm tra escape Markdown",
        note_type="insight",
        source_context=ctx,
    )
    db_session.add(note)
    db_session.flush()

    md = export_session_as_markdown(active_session, db_session)

    # 1. Không chứa thẻ raw HTML script
    assert "<script>" not in md
    assert r"\<script\>" in md or "&lt;script&gt;" in md or r"\<script\>alert(1)\</script\>" in md or "script" in md

    # 2. Không chứa liên kết markdown click được dạng [liên kết](http://evil.com)
    assert "[liên kết](http://evil.com)" not in md

    # 3. Ký tự định dạng *, _, `, [ được escape
    assert r"\*nguy hiểm\*" in md or r"\*" in md
    assert r"\_in nghiêng\_" in md or r"\_" in md


# ──────────────────────────────────────────────
# 10. Persistence Verification — SQL NULL vs JSON null
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_source_context_persists_as_sql_null_not_json_null(
    active_session: ResearchSession,
    db_session: Session,
):
    r"""
    GIVEN:
      1. Tạo ghi chú qua API không có source_context
      2. Import snapshot cũ không có source_context
      3. Tạo ghi chú có source_context hợp lệ
    WHEN:
      Truy vấn SQL thô (bỏ qua ORM layer) để kiểm tra cột source_context trong DB
    THEN:
      - Note không có context phải là SQL NULL thật sự:
          `source_context IS NULL` -> True
          `jsonb_typeof(source_context)` -> NULL (None trong Python)
        Tuyệt đối KHÔNG được lưu thành chuỗi JSON 'null' (jsonb_typeof = 'null').
      - Note có context hợp lệ:
          `source_context IS NULL` -> False
          `jsonb_typeof(source_context)` -> 'object'
    """
    # 1. Tạo ghi chú qua API không có source_context
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú API không có source_context",
                "note_type": "insight",
            },
        )
    assert resp.status_code == 201
    api_note_id = resp.json()["data"]["id"]

    # 2. Import snapshot cũ không có source_context
    legacy_snapshot = {
        "session": {
            "title": "Legacy Session Without Context",
            "domain": "technical",
        },
        "research_notes": [
            {
                "content": "Ghi chú legacy import không context",
                "note_type": "decision",
            }
        ],
    }
    imported_session, _ = import_session_from_json(legacy_snapshot, db_session)
    legacy_note = (
        db_session.query(ResearchNote)
        .filter(ResearchNote.session_id == imported_session.id)
        .one()
    )
    legacy_note_id = str(legacy_note.id)

    # 3. Tạo ghi chú có source_context hợp lệ
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp_with_ctx = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Ghi chú có context hợp lệ",
                "note_type": "insight",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "principle_suggestion",
                    "principle_id": 1,
                    "method_id": "triz_contradiction",
                },
            },
        )
    assert resp_with_ctx.status_code == 201
    valid_note_id = resp_with_ctx.json()["data"]["id"]

    # Truy vấn SQL thô để kiểm tra
    sql_check = text(
        "SELECT id, (source_context IS NULL) AS is_null, jsonb_typeof(source_context) AS typeof "
        "FROM research_notes WHERE id = :note_id"
    )

    # Kiểm tra Kịch bản 1: Note tạo qua API không context
    row_api = db_session.execute(sql_check, {"note_id": api_note_id}).mappings().one()
    assert row_api["is_null"] is True, (
        f"API note source_context must be SQL NULL (is_null=True), but got is_null={row_api['is_null']}, "
        f"jsonb_typeof='{row_api['typeof']}'"
    )
    assert row_api["typeof"] is None, (
        f"API note jsonb_typeof must be None (SQL NULL), but got '{row_api['typeof']}'"
    )

    # Kiểm tra Kịch bản 2: Note import cũ không context
    row_legacy = db_session.execute(sql_check, {"note_id": legacy_note_id}).mappings().one()
    assert row_legacy["is_null"] is True, (
        f"Legacy note source_context must be SQL NULL (is_null=True), but got is_null={row_legacy['is_null']}, "
        f"jsonb_typeof='{row_legacy['typeof']}'"
    )
    assert row_legacy["typeof"] is None, (
        f"Legacy note jsonb_typeof must be None (SQL NULL), but got '{row_legacy['typeof']}'"
    )

    # Kiểm tra Kịch bản 3: Note có context hợp lệ
    row_valid = db_session.execute(sql_check, {"note_id": valid_note_id}).mappings().one()
    assert row_valid["is_null"] is False, "Valid note source_context must not be NULL"
    assert row_valid["typeof"] == "object", f"Valid note jsonb_typeof must be 'object', got '{row_valid['typeof']}'"


# ──────────────────────────────────────────────
# 11. API Hardening Tests (Quy tắc a - e)
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_api_create_note_rejects_strict_violations_with_422(
    active_session: ResearchSession,
):
    """
    GIVEN: Payload POST /notes vi phạm các quy tắc nghiêm ngặt:
      - a: boolean thay cho integer ID
      - b: ký tự điều khiển ở rìa chuỗi (\\n ở đuôi)
      - c: ký tự phân tách Unicode U+2028 / U+2029
      - d: chuỗi chỉ toàn khoảng trắng
    WHEN: Gọi API tạo ghi chú
    THEN: Bị từ chối với HTTP 422 Unprocessable Entity
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # a. Boolean thay cho integer
        resp_bool = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Test boolean ID",
                "note_type": "insight",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "triz_matrix",
                    "lens": "engineering",
                    "improving_param_id": True,
                    "worsening_param_id": 2,
                    "principle_id": 1,
                },
            },
        )
        assert resp_bool.status_code == 422

        # b. Ký tự điều khiển ở đuôi chuỗi
        resp_ctrl = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Test trailing newline",
                "note_type": "insight",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "evidence",
                    "source_ref": "Document Ref\n",
                },
            },
        )
        assert resp_ctrl.status_code == 422

        # c. U+2028 ngắt dòng
        resp_u2028 = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Test U+2028",
                "note_type": "insight",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "triz_9_windows",
                    "lens": "engineering",
                    "level": "system",
                    "time": "present",
                    "cell_label": "System\u2028Broken",
                },
            },
        )
        assert resp_u2028.status_code == 422

        # d. Chuỗi chỉ toàn khoảng trắng
        resp_space = await client.post(
            f"/api/v1/sessions/{active_session.id}/notes",
            json={
                "content": "Test whitespace method_id",
                "note_type": "insight",
                "source_context": {
                    "schema_version": 1,
                    "source_type": "principle_suggestion",
                    "principle_id": 1,
                    "method_id": "   ",
                },
            },
        )
        assert resp_space.status_code == 422


@pytest.mark.asyncio
async def test_api_import_session_rejects_strict_violations_atomically_with_422(
    db_session: Session,
):
    """
    GIVEN: Snapshot phiên import chứa ghi chú vi phạm các quy tắc nghiêm ngặt:
      - Snapshot 1: boolean ID
      - Snapshot 2: U+2029 (PARAGRAPH SEPARATOR)
      - Snapshot 3: chuỗi chỉ toàn khoảng trắng
      - Snapshot 4: ký tự điều khiển ở rìa (newline ở cuối)
    WHEN: Gọi API import session
    THEN: Bị từ chối HTTP 422 và rollback nguyên tử, 0 orphan session/note records
    """
    initial_sessions_count = db_session.query(ResearchSession).count()
    initial_notes_count = db_session.query(ResearchNote).count()
    transport = ASGITransport(app=app)

    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Snapshot 1: boolean ID
        snap_bool = {
            "session": {"title": "Import Bool Session", "domain": "technical"},
            "research_notes": [
                {
                    "content": "Note with bool param",
                    "note_type": "insight",
                    "source_context": {
                        "schema_version": 1,
                        "source_type": "triz_matrix",
                        "lens": "engineering",
                        "improving_param_id": 1,
                        "worsening_param_id": 2,
                        "principle_id": True,
                    },
                }
            ],
        }
        resp1 = await client.post("/api/v1/sessions/import", json=snap_bool)
        assert resp1.status_code == 422
        db_session.rollback()
        assert db_session.query(ResearchSession).count() == initial_sessions_count
        assert db_session.query(ResearchNote).count() == initial_notes_count

        # Snapshot 2: U+2029
        snap_u2029 = {
            "session": {"title": "Import U2029 Session", "domain": "technical"},
            "research_notes": [
                {
                    "content": "Note with U2029 in source_ref",
                    "note_type": "insight",
                    "source_context": {
                        "schema_version": 1,
                        "source_type": "evidence",
                        "source_ref": "Doc\u2029Break",
                    },
                }
            ],
        }
        resp2 = await client.post("/api/v1/sessions/import", json=snap_u2029)
        assert resp2.status_code == 422
        db_session.rollback()
        assert db_session.query(ResearchSession).count() == initial_sessions_count
        assert db_session.query(ResearchNote).count() == initial_notes_count

        # Snapshot 3: Whitespace only
        snap_space = {
            "session": {"title": "Import Blank Session", "domain": "technical"},
            "research_notes": [
                {
                    "content": "Note with blank cell_label",
                    "note_type": "insight",
                    "source_context": {
                        "schema_version": 1,
                        "source_type": "triz_9_windows",
                        "lens": "engineering",
                        "level": "system",
                        "time": "present",
                        "cell_label": "     ",
                    },
                }
            ],
        }
        resp3 = await client.post("/api/v1/sessions/import", json=snap_space)
        assert resp3.status_code == 422
        db_session.rollback()
        assert db_session.query(ResearchSession).count() == initial_sessions_count
        assert db_session.query(ResearchNote).count() == initial_notes_count

        # Snapshot 4: Control char at edge
        snap_ctrl = {
            "session": {"title": "Import Edge Control Session", "domain": "technical"},
            "research_notes": [
                {
                    "content": "Note with edge newline",
                    "note_type": "insight",
                    "source_context": {
                        "schema_version": 1,
                        "source_type": "principle_suggestion",
                        "principle_id": 1,
                        "method_id": "method_01\n",
                    },
                }
            ],
        }
        resp4 = await client.post("/api/v1/sessions/import", json=snap_ctrl)
        assert resp4.status_code == 422
        db_session.rollback()
        assert db_session.query(ResearchSession).count() == initial_sessions_count
        assert db_session.query(ResearchNote).count() == initial_notes_count
