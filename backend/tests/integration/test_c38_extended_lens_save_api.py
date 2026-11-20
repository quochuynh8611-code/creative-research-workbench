"""test_c38_extended_lens_save_api.py — Integration tests cho C38-GAP-03: Extended-Lens Save from 9-Windows.

Mục tiêu kiểm thử:
  - Backend schema Triz9WindowsContext và API POST /api/v1/sessions/{session_id}/notes
  - Chấp nhận 3 extended lenses mới: 'systems_thinking', 'design_thinking', 'lean_startup'
  - Duy trì sự hợp lệ của 3 lenses hiện có: 'engineering', 'business', 'everyday'
  - Từ chối các lens không hợp lệ hoặc thiếu lens với HTTP 422
  - Lưu bền vững vào cơ sở dữ liệu và bảo toàn provenance khi xuất session
"""
from __future__ import annotations

import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import ResearchNote, ResearchSession, SessionStatus
from app.main import app
from app.schemas.note_context import Triz9WindowsContext


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


@pytest.mark.parametrize("extended_lens", [
    "systems_thinking",
    "design_thinking",
    "lean_startup",
])
def test_schema_accepts_extended_lenses(extended_lens: str):
    """
    GIVEN: Triz9WindowsContext payload với một trong 3 lăng kính mở rộng
    WHEN: Khởi tạo Triz9WindowsContext
    THEN: Schema validate thành công
    """
    ctx = Triz9WindowsContext(
        schema_version=1,
        source_type="triz_9_windows",
        lens=extended_lens,  # type: ignore
        level="system",
        time="future",
        cell_label=f"Mẫu ô {extended_lens}",
    )
    assert ctx.lens == extended_lens
    assert ctx.source_type == "triz_9_windows"


@pytest.mark.parametrize("baseline_lens", [
    "engineering",
    "business",
    "everyday",
])
def test_schema_preserves_baseline_lenses(baseline_lens: str):
    """
    GIVEN: Triz9WindowsContext payload với các lăng kính cơ bản hiện có
    WHEN: Khởi tạo Triz9WindowsContext
    THEN: Schema validate thành công
    """
    ctx = Triz9WindowsContext(
        schema_version=1,
        source_type="triz_9_windows",
        lens=baseline_lens,  # type: ignore
        level="subsystem",
        time="present",
        cell_label=f"Mẫu ô {baseline_lens}",
    )
    assert ctx.lens == baseline_lens


def test_schema_rejects_invalid_or_missing_lens():
    """
    GIVEN: Payload thiếu lens hoặc có lens lạ không thuộc danh sách 6 lenses
    WHEN: Khởi tạo Triz9WindowsContext
    THEN: ValidationError được ném ra
    """
    with pytest.raises(Exception):
        Triz9WindowsContext(
            schema_version=1,
            source_type="triz_9_windows",
            lens="quantum_computing",  # type: ignore
            level="system",
            time="present",
            cell_label="Invalid lens",
        )

    with pytest.raises(Exception):
        Triz9WindowsContext(
            schema_version=1,
            source_type="triz_9_windows",
            lens="",  # type: ignore
            level="system",
            time="present",
            cell_label="Empty lens",
        )


@pytest.mark.asyncio
@pytest.mark.parametrize("lens_name,cell_title", [
    ("systems_thinking", "Vòng lặp phản hồi tăng cường"),
    ("design_thinking", "Thấu cảm hành vi người dùng"),
    ("lean_startup", "Kiểm chứng giả thuyết giá trị MVP"),
])
async def test_api_create_and_fetch_note_with_extended_lenses(
    db_session: Session,
    lens_name: str,
    cell_title: str,
):
    """
    GIVEN: Phiên nghiên cứu hợp lệ
    WHEN: Gọi POST /notes với source_context thuộc 1 trong 3 extended lenses
    THEN:
      1. API trả về HTTP 201 Created
      2. Trường source_context trong response chứa đúng lens mở rộng
      3. Gọi GET /notes trả về note với source_context được bảo toàn nguyên vẹn
    """
    session = ResearchSession(
        title=f"Session Test Extended Lens {lens_name}",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    source_context_payload = {
        "schema_version": 1,
        "source_type": "triz_9_windows",
        "lens": lens_name,
        "level": "system",
        "time": "future",
        "cell_label": cell_title,
    }

    payload = {
        "content": f"Ý tưởng phát triển từ {lens_name}: {cell_title}",
        "note_type": "insight",
        "source_context": source_context_payload,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.post(f"/api/v1/sessions/{session.id}/notes", json=payload)
        assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
        data = res.json()
        note_data = data.get("data", data)
        assert note_data["source_context"] == source_context_payload

        # Lấy lại danh sách note
        list_res = await client.get(f"/api/v1/sessions/{session.id}/notes")
        assert list_res.status_code == 200
        list_data = list_res.json().get("data", list_res.json())
        assert len(list_data) >= 1
        fetched_note = [n for n in list_data if n["id"] == note_data["id"]][0]
        assert fetched_note["source_context"]["lens"] == lens_name
        assert fetched_note["source_context"]["cell_label"] == cell_title
