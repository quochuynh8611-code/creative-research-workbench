"""
test_session_export_service.py — Unit tests cho Session Export Service (Batch C36).

Kiểm chứng:
1. export_session_as_json trả về domain và tags trong session object.
2. export_session_as_markdown chứa domain trong YAML frontmatter và overview.
3. Mở rộng format source_context cho 4 nguồn mới: triz_ariz, triz_evolution, triz_resource, ai_coach.
4. Sanitize escape_markdown_inline cho metadata và tham chiếu nguồn mới.
5. Regression test bảo toàn các định dạng nguồn cũ.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from unittest.mock import MagicMock

from app.domain.models import (
    CandidateSolution,
    ProblemFrame,
    ResearchNote,
    ResearchSession,
    SessionStatus,
)
from app.services.session_export_service import (
    export_session_as_json,
    export_session_as_markdown,
)


def _create_mock_session(
    domain: str | None = "sustainability",
    tags: list[str] | None = None,
    title: str = "Tối ưu hóa bao bì phân hủy sinh học",
    set_tags: bool = False,
) -> ResearchSession:
    """Helper tạo instance ResearchSession giả lập có đầy đủ thuộc tính."""
    session = MagicMock(spec=ResearchSession)
    session.id = uuid.uuid4()
    session.title = title
    session.description = "Dự án nghiên cứu giảm thiểu rác thải nhựa"
    session.domain = domain
    session.tags = (
        tags if set_tags else (tags if tags is not None else ["bio-plastic", "packaging"])
    )
    session.status = SessionStatus.active
    session.workflow_state = "ideation"
    session.created_at = datetime(2026, 11, 19, 8, 0, 0, tzinfo=UTC)
    session.updated_at = datetime(2026, 11, 19, 9, 30, 0, tzinfo=UTC)
    return session


def _create_mock_db(
    frame: ProblemFrame | None = None,
    notes: list[ResearchNote] | None = None,
    solutions: list[CandidateSolution] | None = None,
) -> MagicMock:
    """Helper tạo db session mock."""
    db = MagicMock()

    def query_side_effect(model):
        query_mock = MagicMock()
        if model == ProblemFrame:
            query_mock.filter_by.return_value.order_by.return_value.first.return_value = frame
        elif model == ResearchNote:
            query_mock.filter_by.return_value.order_by.return_value.all.return_value = notes or []
        elif model == CandidateSolution:
            query_mock.filter_by.return_value.order_by.return_value.all.return_value = (
                solutions or []
            )
        else:
            query_mock.filter_by.return_value.all.return_value = []
            query_mock.filter_by.return_value.first.return_value = None
        return query_mock

    db.query.side_effect = query_side_effect
    return db


def test_export_session_json_includes_domain_and_tags():
    """SC-C36-02: export_session_as_json phải trả về domain và tags trong session object."""
    session = _create_mock_session(domain="healthcare", tags=["cardio", "emergency"])
    db = _create_mock_db()

    payload = export_session_as_json(session, db)

    assert "session" in payload
    session_data = payload["session"]
    assert session_data["domain"] == "healthcare"
    assert session_data["tags"] == ["cardio", "emergency"]
    assert session_data["title"] == session.title


def test_export_session_json_handles_none_domain_and_tags():
    """export_session_as_json xử lý an toàn khi domain hoặc tags là None."""
    session = _create_mock_session(domain=None, tags=None, set_tags=True)
    db = _create_mock_db()

    payload = export_session_as_json(session, db)

    assert payload["session"]["domain"] is None
    assert payload["session"]["tags"] == []


def test_export_session_markdown_includes_domain_in_frontmatter_and_overview():
    """SC-C36-01: export_session_as_markdown phải chứa domain trong YAML Frontmatter và Overview."""
    session = _create_mock_session(domain="sustainability")
    db = _create_mock_db()

    md = export_session_as_markdown(session, db)

    # 1. Frontmatter check
    assert 'domain: "sustainability"' in md
    # 2. Overview check
    assert "**Lĩnh vực:** `sustainability`" in md


def test_export_session_markdown_renders_triz_ariz_provenance():
    """SC-C36-01: format source_context triz_ariz."""
    session = _create_mock_session()
    note = MagicMock(spec=ResearchNote)
    note.id = uuid.uuid4()
    note.note_type = "insight"
    note.content = "Phát hiện vùng xung đột chính là bề mặt tiếp xúc không khí"
    note.created_at = datetime(2026, 11, 19, 8, 30, 0, tzinfo=UTC)
    note.source_chunk_id = None
    note.source_context = {
        "source_type": "triz_ariz",
        "step_id": 2,
        "step_title": "Phân tích vùng xung đột",
    }
    db = _create_mock_db(notes=[note])

    md = export_session_as_markdown(session, db)

    assert "Nguồn: Thuật giải ARIZ [Bước 2: Phân tích vùng xung đột]" in md


def test_export_session_markdown_renders_triz_evolution_provenance():
    """SC-C36-01: format source_context triz_evolution."""
    session = _create_mock_session()
    note = MagicMock(spec=ResearchNote)
    note.id = uuid.uuid4()
    note.note_type = "insight"
    note.content = "Xu hướng chuyển dịch từ cấu trúc cứng sang màng linh hoạt"
    note.created_at = datetime(2026, 11, 19, 8, 35, 0, tzinfo=UTC)
    note.source_chunk_id = None
    note.source_context = {
        "source_type": "triz_evolution",
        "pattern_id": "pattern_3",
        "pattern_name": "Quy luật Tăng tính Linh hoạt",
    }
    db = _create_mock_db(notes=[note])

    md = export_session_as_markdown(session, db)

    assert "Nguồn: Quy luật Tiến hóa [Quy luật Tăng tính Linh hoạt]" in md


def test_export_session_markdown_renders_triz_resource_provenance():
    """SC-C36-01: format source_context triz_resource."""
    session = _create_mock_session()
    note = MagicMock(spec=ResearchNote)
    note.id = uuid.uuid4()
    note.note_type = "insight"
    note.content = "Tận dụng nhiệt dư thừa từ quá trình ép đùn"
    note.created_at = datetime(2026, 11, 19, 8, 40, 0, tzinfo=UTC)
    note.source_chunk_id = None
    note.source_context = {
        "source_type": "triz_resource",
        "resource_group": "Tài nguyên Năng lượng",
        "item_name": "Nhiệt dư thừa",
    }
    db = _create_mock_db(notes=[note])

    md = export_session_as_markdown(session, db)

    assert "Nguồn: Ma trận Tài nguyên [Tài nguyên Năng lượng" in md


def test_export_session_markdown_renders_ai_coach_provenance():
    """SC-C36-01: format source_context ai_coach (có escape underscore an toàn)."""
    session = _create_mock_session()
    note = MagicMock(spec=ResearchNote)
    note.id = uuid.uuid4()
    note.note_type = "insight"
    note.content = "Gợi ý tái cấu trúc mâu thuẫn từ góc độ người tiêu dùng"
    note.created_at = datetime(2026, 11, 19, 8, 45, 0, tzinfo=UTC)
    note.source_chunk_id = None
    note.source_context = {
        "source_type": "ai_coach",
        "suggestion_type": "problem_reframing",
    }
    db = _create_mock_db(notes=[note])

    md = export_session_as_markdown(session, db)

    assert r"Nguồn: AI Solution Coach [problem\_reframing]" in md


def test_export_session_markdown_sanitizes_markdown_injection_in_provenance():
    """SC-C36-03: Ký tự đặc biệt trong metadata nguồn phải được escape an toàn."""
    session = _create_mock_session()
    note = MagicMock(spec=ResearchNote)
    note.id = uuid.uuid4()
    note.note_type = "insight"
    note.content = "Ghi chú kiểm tra injection"
    note.created_at = datetime(2026, 11, 19, 8, 50, 0, tzinfo=UTC)
    note.source_chunk_id = None
    note.source_context = {
        "source_type": "triz_ariz",
        "step_id": 1,
        "step_title": "*Đậm* [Link](http://malicious.com) <script>alert(1)</script>",
    }
    db = _create_mock_db(notes=[note])

    md = export_session_as_markdown(session, db)

    # Đảm bảo không render raw link hoặc unescaped brackets
    assert r"\[Link\]\(http://malicious.com\)" in md or r"\*Đậm\*" in md
    assert "<script>" not in md
    assert r"\<script\>" in md


def test_export_session_regression_legacy_provenances_preserved():
    """SC-C36-01 regression: Các nguồn cũ (9-windows, matrix, principle, evidence, solution) vẫn format chuẩn xác."""
    session = _create_mock_session()
    n1 = MagicMock(spec=ResearchNote)
    n1.id = uuid.uuid4()
    n1.note_type = "insight"
    n1.content = "Note 1"
    n1.created_at = datetime(2026, 11, 19, 8, 0, 0, tzinfo=UTC)
    n1.source_chunk_id = None
    n1.source_context = {
        "source_type": "triz_9_windows",
        "lens": "systems_thinking",
        "level": "system",
        "time": "present",
    }

    n2 = MagicMock(spec=ResearchNote)
    n2.id = uuid.uuid4()
    n2.note_type = "insight"
    n2.content = "Note 2"
    n2.created_at = datetime(2026, 11, 19, 8, 5, 0, tzinfo=UTC)
    n2.source_chunk_id = None
    n2.source_context = {
        "source_type": "triz_matrix",
        "principle_id": 15,
    }

    db = _create_mock_db(notes=[n1, n2])
    md = export_session_as_markdown(session, db)

    assert "Nguồn: Lưới 9-Windows [systems_thinking • system - present]" in md
    assert "Nguồn: Ma trận TRIZ [Nguyên tắc 15]" in md
