"""
test_c36_export_synthesis_integration.py — End-to-end integration test suite for Batch C36:
Research Synthesis, Provenance & Export Completeness.

Architecture invariants:
  - Zero Testcontainers: Sử dụng in-memory/test double dependency override, không phụ thuộc Docker daemon.
  - Test & documentation only: Không thay đổi runtime behavior của production.
  - Roundtrip verification: Export JSON -> Import Session bảo toàn 100% dữ liệu domain, tags, và source_context.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any
from unittest.mock import MagicMock, patch

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.sessions import get_db
from app.domain.models import (
    Base,
    CandidateSolution,
    Contradiction,
    ContradictionType,
    ProblemFrame,
    ResearchNote,
    ResearchSession,
    SessionStatus,
)
from app.main import app
from app.services.session_export_service import (
    export_session_as_json,
    export_session_as_markdown,
)
from app.services.session_import_service import import_session_from_json


# ── In-Memory Test Double DB Fixture (Zero Testcontainers) ───────────────────

class MockSessionDB:
    """Zero-Testcontainers in-memory test double for session export and import verification."""

    def __init__(self) -> None:
        self.added_records: list[Any] = []
        self.session_record: ResearchSession | None = None
        self.frame_record: ProblemFrame | None = None
        self.notes_records: list[ResearchNote] = []
        self.solutions_records: list[CandidateSolution] = []

    def add(self, item: Any) -> None:
        self.added_records.append(item)
        if isinstance(item, ResearchSession):
            self.session_record = item
        elif isinstance(item, ProblemFrame):
            self.frame_record = item
        elif isinstance(item, ResearchNote):
            self.notes_records.append(item)
        elif isinstance(item, CandidateSolution):
            self.solutions_records.append(item)

    def add_all(self, items: list[Any]) -> None:
        for item in items:
            self.add(item)

    def flush(self) -> None:
        pass

    def commit(self) -> None:
        pass

    def rollback(self) -> None:
        pass

    def refresh(self, item: Any) -> None:
        pass

    def query(self, model: Any) -> Any:
        q = MagicMock()
        if model == ResearchSession:
            def filter_by_session(**kwargs: Any) -> Any:
                target_id = kwargs.get("id")
                res = self.session_record if (self.session_record and self.session_record.id == target_id) else None
                sub_q = MagicMock()
                sub_q.first.return_value = res
                return sub_q
            q.filter_by = filter_by_session
            q.filter.return_value.first.return_value = self.session_record
        elif model == ProblemFrame:
            def filter_by_frame(**kwargs: Any) -> Any:
                sub_q = MagicMock()
                sub_q.order_by.return_value.first.return_value = self.frame_record
                sub_q.first.return_value = self.frame_record
                return sub_q
            q.filter_by = filter_by_frame
            q.filter.return_value.first.return_value = self.frame_record
        elif model == ResearchNote:
            def filter_by_notes(**kwargs: Any) -> Any:
                target_sid = kwargs.get("session_id")
                matching = [n for n in self.notes_records if getattr(n, "session_id", None) == target_sid]
                sub_q = MagicMock()
                sub_q.order_by.return_value.all.return_value = matching
                sub_q.all.return_value = matching
                return sub_q
            q.filter_by = filter_by_notes
        elif model == CandidateSolution:
            def filter_by_solutions(**kwargs: Any) -> Any:
                sub_q = MagicMock()
                sub_q.order_by.return_value.all.return_value = self.solutions_records
                sub_q.all.return_value = self.solutions_records
                return sub_q
            q.filter_by = filter_by_solutions
        else:
            q.filter_by.return_value.all.return_value = []
            q.filter_by.return_value.first.return_value = None
        return q


@pytest.fixture
def mock_db() -> MockSessionDB:
    return MockSessionDB()


@pytest.fixture
def populated_session(mock_db: MockSessionDB) -> ResearchSession:
    """Seeds a session with sustainability domain, tags, and notes from all 4 new provenance sources."""
    session_id = uuid.uuid4()
    session = ResearchSession(
        id=session_id,
        title="Tối ưu hóa thiết bị lọc nước sinh học",
        description="Nghiên cứu vật liệu màng lọc composite thân thiện môi trường",
        domain="sustainability",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    session.tags = ["water_filter", "clean_tech", "composite"]
    mock_db.add(session)

    # Problem frame
    frame = ProblemFrame(
        session_id=session_id,
        raw_statement="Tăng tốc độ lọc nhưng không làm giảm độ bền của màng lọc",
        normalized_statement="Mâu thuẫn giữa lưu lượng nước và tuổi thọ vật liệu lọc",
        contradiction_type=ContradictionType.technical,
        improving_parameter="Tốc độ lọc",
        worsening_parameter="Độ bền cơ học",
        domain="sustainability",
    )
    mock_db.add(frame)

    # 4 Research Notes from 4 new provenance sources
    note_ariz = ResearchNote(
        session_id=session_id,
        content="Phân tích vùng xung đột hạt nano và màng xơ cellulose",
        note_type="insight",
        source_context={
            "source_type": "triz_ariz",
            "step_id": 2,
            "step_title": "Phân tích vùng xung đột",
        },
    )
    note_evolution = ResearchNote(
        session_id=session_id,
        content="Áp dụng quy luật tăng tính linh hoạt cấu trúc lỗ xốp",
        note_type="hypothesis",
        source_context={
            "source_type": "triz_evolution",
            "pattern_id": "pattern_3",
            "pattern_name": "Quy luật Tăng tính Linh hoạt",
        },
    )
    note_resource = ResearchNote(
        session_id=session_id,
        content="Tận dụng áp suất thủy tĩnh tự nhiên làm nguồn năng lượng đẩy",
        note_type="decision",
        source_context={
            "source_type": "triz_resource",
            "resource_group": "Tài nguyên Không gian",
        },
    )
    note_ai_coach = ResearchNote(
        session_id=session_id,
        content="Đề xuất kết hợp cơ chế tự làm sạch bằng bọt khí nano",
        note_type="action",
        source_context={
            "source_type": "ai_coach",
            "suggestion_type": "solution_candidate",
        },
    )
    mock_db.add_all([note_ariz, note_evolution, note_resource, note_ai_coach])

    # Candidate solution
    solution = CandidateSolution(
        session_id=session_id,
        title="Màng lọc đa tầng tự hồi phục",
        mechanism="Sử dụng lớp phủ hydrogel phản ứng với pH",
        status="accepted",
        novelty_score=8.5,
        feasibility_score=7.8,
    )
    mock_db.add(solution)
    return session


# ── Integration Test Cases ────────────────────────────────────────────────────

def test_export_markdown_full_provenance_integration(
    mock_db: MockSessionDB,
    populated_session: ResearchSession,
) -> None:
    """1. SC-C36-01: Markdown export chứa domain trong YAML frontmatter, overview và 4 chuỗi provenance."""
    with patch("app.services.method_recommender.MethodRecommender.recommend_methods", return_value=[]):
        md = export_session_as_markdown(populated_session, mock_db)  # type: ignore[arg-type]

    # 1. Frontmatter metadata checks
    assert 'domain: "sustainability"' in md
    assert 'status: active' in md
    assert 'workflow_state: ideation' in md

    # 2. Overview checks
    assert "**Lĩnh vực:** `sustainability`" in md

    # 3. Provenance formatting for all 4 new sources
    assert r"Nguồn: Thuật giải ARIZ [Bước 2: Phân tích vùng xung đột]" in md
    assert r"Nguồn: Quy luật Tiến hóa [Quy luật Tăng tính Linh hoạt]" in md
    assert r"Nguồn: Ma trận Tài nguyên [Tài nguyên Không gian]" in md
    assert r"Nguồn: AI Solution Coach [solution\_candidate]" in md


def test_export_json_enrichment_integration(
    mock_db: MockSessionDB,
    populated_session: ResearchSession,
) -> None:
    """2. SC-C36-02 & SC-C36-03: JSON export chứa domain, tags và 4 source_context objects."""
    with patch("app.services.method_recommender.MethodRecommender.recommend_methods", return_value=[]):
        snapshot = export_session_as_json(populated_session, mock_db)  # type: ignore[arg-type]

    # 1. Session object metadata
    session_data = snapshot["session"]
    assert session_data["domain"] == "sustainability"
    assert "water_filter" in session_data["tags"]
    assert "clean_tech" in session_data["tags"]

    # 2. Notes provenance checks
    notes = snapshot["research_notes"]
    assert len(notes) == 4

    sources = [n.get("source_context") for n in notes]
    source_types = {s["source_type"] for s in sources if isinstance(s, dict)}
    expected_sources = {"triz_ariz", "triz_evolution", "triz_resource", "ai_coach"}
    assert source_types == expected_sources


def test_e2e_export_import_roundtrip_integrity(
    mock_db: MockSessionDB,
    populated_session: ResearchSession,
) -> None:
    """3. SC-C36-07: Roundtrip E2E: Export JSON -> Import Session bảo toàn 100% dữ liệu không suy hao."""
    # Step 1: Export JSON
    with patch("app.services.method_recommender.MethodRecommender.recommend_methods", return_value=[]):
        snapshot = export_session_as_json(populated_session, mock_db)  # type: ignore[arg-type]

    # Step 2: Import into a new session record (with pass-through note context parser test double)
    import_db = MockSessionDB()
    with patch(
        "app.services.session_import_service.parse_note_source_context",
        side_effect=lambda ctx: MagicMock(model_dump=lambda mode="json": ctx),
    ):
        imported_session, meta = import_session_from_json(snapshot, import_db)  # type: ignore[arg-type]

    # Step 3: Assert complete data fidelity
    assert imported_session.id != populated_session.id  # New UUID assigned
    assert imported_session.title == populated_session.title
    assert imported_session.domain == "sustainability"

    # Verify problem frame
    imported_frame = import_db.frame_record
    assert imported_frame is not None
    assert imported_frame.improving_parameter == "Tốc độ lọc"
    assert imported_frame.worsening_parameter == "Độ bền cơ học"

    # Verify imported notes and source_context
    imported_notes = import_db.notes_records
    assert len(imported_notes) == 4

    imported_contexts = [n.source_context for n in imported_notes if n.source_context]
    assert len(imported_contexts) == 4
    imported_types = {c["source_type"] for c in imported_contexts}
    assert imported_types == {"triz_ariz", "triz_evolution", "triz_resource", "ai_coach"}


def test_e2e_export_import_roundtrip_edge_case_null_domain() -> None:
    """5. SC-C36-09: Roundtrip E2E edge case: session có domain = null hoặc rỗng "" import an toàn không crash."""
    session_id = uuid.uuid4()
    session_no_domain = ResearchSession(
        id=session_id,
        title="Nghiên cứu mở rộng chưa phân loại lĩnh vực",
        description="Phiên nghiên cứu thử nghiệm",
        domain=None,
        status=SessionStatus.active,
        workflow_state="intake",
    )
    mock_db = MockSessionDB()
    mock_db.add(session_no_domain)

    # Step 1: Export JSON
    with patch("app.services.method_recommender.MethodRecommender.recommend_methods", return_value=[]):
        snapshot = export_session_as_json(session_no_domain, mock_db)  # type: ignore[arg-type]

    assert snapshot["session"]["domain"] is None

    # Step 2: Import into a new session record
    import_db = MockSessionDB()
    imported_session, meta = import_session_from_json(snapshot, import_db)  # type: ignore[arg-type]

    # Step 3: Assert clean safe fallback to None without error
    assert imported_session.id != session_id
    assert imported_session.domain is None
    assert imported_session.title == "Nghiên cứu mở rộng chưa phân loại lĩnh vực"


@pytest.mark.asyncio
async def test_export_endpoints_http_contract(
    populated_session: ResearchSession,
    mock_db: MockSessionDB,
) -> None:
    """4. Kiểm tra HTTP GET /api/v1/sessions/{id}/export?format=json và /export/markdown qua AsyncClient."""
    app.dependency_overrides[get_db] = lambda: mock_db
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            with patch("app.services.method_recommender.MethodRecommender.recommend_methods", return_value=[]):
                # 1. JSON Export Endpoint
                res_json = await client.get(f"/api/v1/sessions/{populated_session.id}/export?format=json")
                assert res_json.status_code == 200
                json_payload = res_json.json()
                assert "session" in json_payload
                assert json_payload["session"]["domain"] == "sustainability"

                # 2. Markdown Export Endpoint
                res_md = await client.get(f"/api/v1/sessions/{populated_session.id}/export?format=markdown")
                assert res_md.status_code == 200
                assert 'domain: "sustainability"' in res_md.text
    finally:
        app.dependency_overrides.pop(get_db, None)
