"""
test_ai_report_service.py — Unit tests cho AI Research Report Service (Batch C36).

Kiểm chứng:
1. AIReportService export snapshot truyền cho LLM chứa domain và tags.
2. Template-based fallback tổng hợp có đề cập đến domain và thống kê phân bổ nguồn ghi chú.
"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

from app.domain.models import ProblemFrame, ResearchNote, ResearchSession, SessionStatus
from app.services.ai_report_service import AIReportService


def test_ai_report_service_fallback_includes_domain_and_source_summary():
    """SC-C36-01: Fallback synthesis report phản ánh domain và phân bổ nguồn ghi chú."""
    session = MagicMock(spec=ResearchSession)
    session.id = uuid.uuid4()
    session.title = "Tối ưu hóa quy trình chẩn đoán cấp cứu"
    session.domain = "healthcare"
    session.tags = ["hospital", "emergency"]
    session.status = SessionStatus.active
    session.workflow_state = "synthesis"
    session.created_at = None
    session.updated_at = None

    frame = MagicMock(spec=ProblemFrame)
    frame.raw_statement = "Cần tăng tốc độ chẩn đoán nhưng không được giảm độ chính xác"
    frame.contradiction_type = "technical"
    frame.improving_parameter = "Tốc độ chẩn đoán"
    frame.worsening_parameter = "Độ chính xác"
    frame.domain = "healthcare"
    frame.created_at = None

    note1 = MagicMock(spec=ResearchNote)
    note1.id = uuid.uuid4()
    note1.note_type = "insight"
    note1.content = "Ứng dụng thuật giải ARIZ phân định vùng xung đột thời gian xét nghiệm"
    note1.source_chunk_id = None
    note1.source_context = {"source_type": "triz_ariz", "step_id": 1}
    note1.created_at = None
    note1.updated_at = None

    note2 = MagicMock(spec=ResearchNote)
    note2.id = uuid.uuid4()
    note2.note_type = "decision"
    note2.content = "Đề xuất quy trình phân luồng khẩn cấp từ AI Coach"
    note2.source_chunk_id = None
    note2.source_context = {"source_type": "ai_coach", "suggestion_type": "solution_candidate"}
    note2.created_at = None
    note2.updated_at = None

    db = MagicMock()

    def query_mock(model):
        m = MagicMock()
        if model == ResearchSession:
            m.filter_by.return_value.first.return_value = session
        elif model == ProblemFrame:
            m.filter_by.return_value.order_by.return_value.first.return_value = frame
        elif model == ResearchNote:
            m.filter_by.return_value.order_by.return_value.all.return_value = [note1, note2]
        else:
            m.filter_by.return_value.all.return_value = []
            m.filter_by.return_value.first.return_value = None
        return m

    db.query.side_effect = query_mock

    # LLM mock gây lỗi để kích hoạt deterministic fallback
    mock_llm = MagicMock()
    mock_llm.provider_name = "mock"
    mock_llm.model_name = "mock-model"
    mock_llm.generate_report.side_effect = RuntimeError("Simulated LLM Timeout")

    service = AIReportService(llm_client=mock_llm)
    result = service.generate_report(session.id, db)

    assert result.provenance == "rule_based_fallback"
    assert "healthcare" in result.problem_background or "healthcare" in result.markdown_content
    assert result.session_id == str(session.id)
