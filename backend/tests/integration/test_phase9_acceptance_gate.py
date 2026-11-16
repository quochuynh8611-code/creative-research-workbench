"""
test_phase9_acceptance_gate.py — Batch C23: Phase 9 Acceptance Gate Verification

Gherkin Feature: Phase 9 acceptance gate verification
  - Scenario 1: Export session as Markdown
  - Scenario 2: Export session as JSON
  - Scenario 3: Import session from template
  - Scenario 4: Export end-to-end (latency < 2s, content integrity)
"""
from __future__ import annotations

import time
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.orm import Session

from app.domain.models import (
    CandidateSolution,
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
    """Dependency override cho get_db và db session."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


@pytest.mark.asyncio
async def test_scenario_1_export_session_as_markdown(db_session: Session):
    """
    Scenario 1: Export session as Markdown
    Given a session with problem statement and recommended principles
    When the user triggers "Export as Markdown"
    Then the system generates a Markdown report
    And the Markdown includes problem statement, principles, and evidence
    And the Markdown is downloadable
    """
    session = ResearchSession(
        title="Tối ưu hệ thống sạc không dây công suất cao",
        description="Nghiên cứu hiện tượng quá nhiệt và bức xạ từ trường",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Cần tăng công suất truyền tải sạc không dây nhưng không được làm tăng nhiệt độ cuộn cảm",
        normalized_statement="Tăng công suất sạc không dây trong giới hạn nhiệt độ an toàn của cuộn cảm",
        contradiction_type=ContradictionType.technical,
        improving_parameter="power",
        worsening_parameter="temperature",
        domain="energy",
    )
    db_session.add(frame)
    db_session.flush()

    contra = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Công suất vs Nhiệt độ",
        suggested_principles=[19, 35, 2],
    )
    db_session.add(contra)

    note = ResearchNote(
        session_id=session.id,
        content="Bằng chứng: Cuộn cảm dây dẹt Litz wire giảm tổn hao hiệu ứng bề mặt xuống 30%.",
        note_type="insight",
    )
    db_session.add(note)
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=markdown")

    assert response.status_code == 200
    assert "text/markdown" in response.headers.get("content-type", "")
    assert f'filename="session_{session.id}.md"' in response.headers.get("content-disposition", "")

    body = response.text
    # Kiểm tra YAML Frontmatter và metadata
    assert body.startswith("---")
    assert session.title in body
    assert str(session.id) in body

    # Kiểm tra Problem Statement
    assert "# 1. BÀI TOÁN & PHÂN TÍCH MÂU THUẪN TRIZ" in body
    assert "Cần tăng công suất truyền tải sạc không dây" in body

    # Kiểm tra Recommended Principles
    assert "# 2. NGUYÊN TẮC SÁNG TẠO ĐỀ XUẤT" in body
    assert "#19" in body or "Periodic Action" in body or "Tác động định kỳ" in body
    assert "#35" in body or "Parameter Changes" in body or "Thay đổi thông số" in body

    # Kiểm tra Evidence / Research Notes
    assert "# 3. SỔ TAY GHI CHÉP NGHIÊN CỨU" in body
    assert "Cuộn cảm dây dẹt Litz wire" in body


@pytest.mark.asyncio
async def test_scenario_2_export_session_as_json(db_session: Session):
    """
    Scenario 2: Export session as JSON
    Given a session with problem statement and recommended principles
    When the user triggers "Export as JSON"
    Then the system generates a JSON report
    And the JSON includes problem statement, principles, and evidence
    And the JSON is downloadable
    """
    session = ResearchSession(
        title="Tối ưu thuật toán lập lịch tác vụ",
        description="Nghiên cứu cân bằng tải đa cụm",
        status=SessionStatus.active,
        workflow_state="evaluation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Giảm độ trễ phân phối tác vụ mà không làm tăng lượng tiêu thụ RAM",
        normalized_statement="Tối ưu latency với ràng buộc dung lượng bộ nhớ",
        contradiction_type=ContradictionType.technical,
        improving_parameter="speed",
        worsening_parameter="capacity",
        domain="software",
    )
    db_session.add(frame)
    db_session.flush()

    contra = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Độ trễ vs Bộ nhớ",
        suggested_principles=[1, 10, 15],
    )
    db_session.add(contra)

    note = ResearchNote(
        session_id=session.id,
        content="Evidence: Hàng đợi ưu tiên Ring Buffer lock-free giảm độ trễ 40%.",
        note_type="evidence",
    )
    sol = CandidateSolution(
        session_id=session.id,
        title="Ring Buffer Lock-Free",
        mechanism="Sử dụng bộ nhớ tuần hoàn chia sẻ không khóa để tránh context switch.",
        status="accepted",
        novelty_score=0.85,
        feasibility_score=0.9,
    )
    db_session.add_all([note, sol])
    db_session.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=json")

    assert response.status_code == 200
    assert "application/json" in response.headers.get("content-type", "")

    data = response.json()
    assert "session" in data
    assert data["session"]["title"] == "Tối ưu thuật toán lập lịch tác vụ"
    assert "problem_frame" in data
    assert "raw_statement" in data["problem_frame"]
    assert "research_notes" in data
    assert len(data["research_notes"]) >= 1
    assert "Ring Buffer lock-free" in data["research_notes"][0]["content"]
    assert "candidate_solutions" in data
    assert len(data["candidate_solutions"]) >= 1
    assert data["candidate_solutions"][0]["title"] == "Ring Buffer Lock-Free"
    assert "recommended_methods" in data


@pytest.mark.asyncio
async def test_scenario_3_import_session_from_template(db_session: Session):
    """
    Scenario 3: Import session from template
    Given a session template is available
    When the user imports the template
    Then a new session is created with pre-filled problem statement
    And the session is ready for further editing
    """
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Lấy danh sách template có sẵn
        templates_res = await client.get("/api/v1/sessions/templates")
        assert templates_res.status_code == 200
        templates_list = templates_res.json().get("data", [])
        assert len(templates_list) >= 1

        selected_template = templates_list[0]
        template_id = selected_template["id"]

        # Instantiate session từ template qua endpoint /from-template
        instantiate_res = await client.post(
            "/api/v1/sessions/from-template",
            json={
                "template_id": template_id,
                "custom_title": "Phiên nghiên cứu mới từ template kiểm thử",
            },
        )

    assert instantiate_res.status_code == 201
    result = instantiate_res.json()
    assert "data" in result
    session_id_str = result["data"]["id"]
    new_session_id = uuid.UUID(session_id_str)

    # Verify trong DB: Session và ProblemFrame đã được tạo và pre-fill đúng
    new_session = db_session.get(ResearchSession, new_session_id)
    assert new_session is not None
    assert new_session.title == "Phiên nghiên cứu mới từ template kiểm thử"
    assert new_session.status == SessionStatus.active

    frames = db_session.query(ProblemFrame).filter_by(session_id=new_session_id).all()
    assert len(frames) >= 1
    assert frames[0].raw_statement is not None
    assert len(frames[0].raw_statement) > 0

    # Kiểm tra thêm đường import snapshot trực tiếp qua POST /api/v1/sessions/import
    snapshot_payload = {
        "session": {
            "title": "Session Imported Từ Snapshot Template",
            "description": "Mẫu bài toán kiểm thử import",
            "status": "active",
            "workflow_state": "structuring",
        },
        "problem_frame": {
            "raw_statement": selected_template["problem_frame"]["raw_statement"],
            "normalized_statement": "Phát biểu chuẩn hóa từ template",
            "contradiction_type": "technical",
        },
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        import_res = await client.post("/api/v1/sessions/import", json=snapshot_payload)

    assert import_res.status_code == 201
    import_data = import_res.json()
    assert "data" in import_data
    imported_id = uuid.UUID(import_data["data"]["id"])
    assert db_session.get(ResearchSession, imported_id) is not None


@pytest.mark.asyncio
async def test_scenario_4_export_end_to_end_latency_and_content(db_session: Session):
    """
    Scenario 4: Export end-to-end
    Given a session with problem statement, ingested documents, and recommended principles
    When the user triggers "Export as Markdown"
    Then the Markdown includes all relevant data (problem, principles, evidence)
    And the export latency is within acceptable threshold (< 2s)
    """
    session = ResearchSession(
        title="Tối ưu cánh quạt phong điện composite",
        description="Khảo sát sức bền uốn và quán tính gió",
        status=SessionStatus.active,
        workflow_state="evaluation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng sải cánh đón gió để tăng sản lượng điện nhưng không được tăng khối lượng",
        normalized_statement="Mở rộng kích thước cánh trong giới hạn trọng lượng và độ võng",
        contradiction_type=ContradictionType.technical,
        improving_parameter="length_moving",
        worsening_parameter="weight_moving",
        domain="renewable_energy",
    )
    db_session.add(frame)
    db_session.flush()

    contra = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Sải cánh vs Khối lượng",
        suggested_principles=[35, 14, 40],
    )
    db_session.add(contra)

    note1 = ResearchNote(
        session_id=session.id,
        content="Evidence 1: Dầm carbon đùn pultrusion giảm 40% trọng lượng so với composite sợi thủy tinh.",
        note_type="evidence",
    )
    note2 = ResearchNote(
        session_id=session.id,
        content="Evidence 2: Biên dạng khí động học vortex generator giảm hiện tượng stall ở đầu cánh.",
        note_type="insight",
    )
    sol = CandidateSolution(
        session_id=session.id,
        title="Dầm chính carbon pultruded nắp cánh khí động",
        mechanism="Sử dụng sợi carbon kéo định hình liên tục chịu tải uốn kết hợp cánh phụ tự điều chỉnh.",
        status="accepted",
        novelty_score=0.88,
        feasibility_score=0.82,
        risk_notes="Chi phí khuôn đùn ban đầu cao.",
    )
    db_session.add_all([note1, note2, sol])
    db_session.commit()

    # Đo latency export
    start_time = time.perf_counter()
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get(f"/api/v1/sessions/{session.id}/export?format=markdown")
    elapsed_seconds = time.perf_counter() - start_time

    assert response.status_code == 200
    assert elapsed_seconds < 2.0, f"Export latency {elapsed_seconds:.3f}s exceeds threshold 2.0s"

    body = response.text
    # Đảm bảo đầy đủ dữ liệu
    assert "Tối ưu cánh quạt phong điện composite" in body
    assert "Tăng sải cánh đón gió để tăng sản lượng điện" in body
    assert "#35" in body or "Thay đổi thông số" in body or "Parameter Changes" in body
    assert "Dầm carbon đùn pultrusion" in body
    assert "Dầm chính carbon pultruded nắp cánh khí động" in body
    assert "[ACCEPTED]" in body or "accepted" in body.lower()
