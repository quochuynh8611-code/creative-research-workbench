"""
test_p1_02_explicit_contradiction_contract.py — Contract Hardening Integration Tests for Explicit Contradiction Import.

Bao phủ 8 Scenarios theo chuẩn Gherkin:
1. Scenario: Backward-compatible derive (missing key / null -> derive theo ProblemFrame)
2. Scenario: Respect explicit empty list (contradictions: [] -> 0 Contradiction, không derive)
3. Scenario: Preserve valid explicit items (bảo toàn type, statement đã strip, principles, không derive thêm)
4. Scenario: Reject invalid contradiction structure (sai kiểu, phần tử không phải dict -> HTTP 400)
5. Scenario: Reject invalid type and statement (type ngoài enum, statement thiếu/null/rỗng -> HTTP 400)
6. Scenario: Strict principle IDs (1..40, reject bool, float, chuỗi, out of bounds, bảo toàn thứ tự)
7. Scenario: Invalid last item is atomic (item 1 hợp lệ, item 2 hỏng -> rollback toàn bộ, không tạo session)
8. Scenario: Persistence failure rolls back (lỗi ghi DB -> rollback toàn bộ transaction)
"""
from __future__ import annotations

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.api.v1.endpoints.sessions import get_db
from app.domain.models import Contradiction, ContradictionType, ProblemFrame, ResearchSession
from app.main import app
from app.services.session_import_service import import_session_from_json


@pytest.fixture()
def isolated_db_override(sync_engine: Engine):
    def _get_isolated_db():
        session = Session(bind=sync_engine)
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = _get_isolated_db
    yield
    app.dependency_overrides.pop(get_db, None)


# ── Scenario 1: Backward-compatible derive ──────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize("contras_val", [None, "MISSING_KEY"])
async def test_scenario_backward_compatible_derive(
    sync_engine: Engine, tables: None, contras_val: any
):
    """
    Given snapshot thiếu contradictions hoặc có contradictions null
    And ProblemFrame đủ điều kiện derive
    When import snapshot
    Then Contradiction được derive như contract hiện có.
    """
    snapshot = {
        "session": {"title": "Legacy Session", "workflow_state": "structuring"},
        "problem_frame": {
            "raw_statement": "Speed vs reliability trade-off",
            "contradiction_type": "technical",
            "improving_parameter": "speed",
            "worsening_parameter": "reliability",
        },
    }
    if contras_val != "MISSING_KEY":
        snapshot["contradictions"] = contras_val

    with Session(bind=sync_engine) as db:
        new_sess, summary = import_session_from_json(snapshot, db)
        assert summary["problem_frame"] is True

        contras = db.query(Contradiction).join(ProblemFrame).filter(ProblemFrame.session_id == new_sess.id).all()
        assert len(contras) == 1
        assert contras[0].type == ContradictionType.technical
        assert contras[0].suggested_principles is not None
        assert len(contras[0].suggested_principles) > 0


# ── Scenario 2: Respect explicit empty list ─────────────────────────────────
@pytest.mark.asyncio
async def test_scenario_respect_explicit_empty_list(sync_engine: Engine, tables: None):
    """
    Given snapshot có contradictions []
    And ProblemFrame technical
    When import snapshot
    Then import thành công
    And tạo 0 Contradiction (không derive).
    """
    snapshot = {
        "session": {"title": "Empty Contradictions Session", "workflow_state": "structuring"},
        "problem_frame": {
            "raw_statement": "Technical statement but user explicitly cleared contradictions",
            "contradiction_type": "technical",
            "improving_parameter": "speed",
            "worsening_parameter": "reliability",
        },
        "contradictions": [],
    }

    with Session(bind=sync_engine) as db:
        new_sess, summary = import_session_from_json(snapshot, db)
        assert summary["problem_frame"] is True

        contras = db.query(Contradiction).join(ProblemFrame).filter(ProblemFrame.session_id == new_sess.id).all()
        assert len(contras) == 0


# ── Scenario 3: Preserve valid explicit items ───────────────────────────────
@pytest.mark.asyncio
async def test_scenario_preserve_valid_explicit_items(sync_engine: Engine, tables: None):
    """
    Given snapshot có explicit Contradiction hợp lệ
    When import snapshot
    Then bảo toàn type, statement đã strip, và principles
    And không thêm bản ghi derive.
    """
    snapshot = {
        "session": {"title": "Valid Explicit Session", "workflow_state": "structuring"},
        "problem_frame": {
            "raw_statement": "Some statement",
            "contradiction_type": "technical",
            "improving_parameter": "speed",
            "worsening_parameter": "reliability",
        },
        "contradictions": [
            {
                "type": "technical",
                "statement": "  Khoảng cách và thời gian cần tối ưu   ",
                "suggested_principles": [10, 35, 1],
            },
            {
                "type": "physical",
                "statement": "Vật thể cần vừa nóng vừa lạnh",
                "suggested_principles": [],
            },
            {
                "type": "unknown",
                "statement": "Chưa rõ mâu thuẫn",
                "suggested_principles": None,
            },
        ],
    }

    with Session(bind=sync_engine) as db:
        new_sess, summary = import_session_from_json(snapshot, db)
        contras = db.query(Contradiction).join(ProblemFrame).filter(ProblemFrame.session_id == new_sess.id).order_by(Contradiction.created_at.asc(), Contradiction.id.asc()).all()
        assert len(contras) == 3

        # Item 1
        c1 = next(c for c in contras if c.statement == "Khoảng cách và thời gian cần tối ưu")
        assert c1.type == ContradictionType.technical
        assert c1.suggested_principles == [10, 35, 1]

        # Item 2
        c2 = next(c for c in contras if c.statement == "Vật thể cần vừa nóng vừa lạnh")
        assert c2.type == ContradictionType.physical
        assert c2.suggested_principles == []

        # Item 3
        c3 = next(c for c in contras if c.statement == "Chưa rõ mâu thuẫn")
        assert c3.type == ContradictionType.unknown
        assert c3.suggested_principles is None


# ── Scenario 4: Reject invalid contradiction structure ──────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_contras, expected_loc",
    [
        ("not_a_list", "contradictions"),
        (12345, "contradictions"),
        ([{"type": "technical", "statement": "valid"}, "not_a_dict"], "contradictions[1]"),
        ([None], "contradictions[0]"),
    ],
)
async def test_scenario_reject_invalid_contradiction_structure(
    sync_engine: Engine, tables: None, isolated_db_override: None, invalid_contras: any, expected_loc: str
):
    """
    Given contradictions sai kiểu hoặc chứa item không phải object
    When import snapshot
    Then HTTP 400
    And error detail chỉ đúng vị trí
    And không còn dữ liệu import dở dang.
    """
    snapshot = {
        "session": {"title": "Invalid Structure Session"},
        "problem_frame": {"raw_statement": "statement"},
        "contradictions": invalid_contras,
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sessions/import", json=snapshot)
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert expected_loc in detail

    with Session(bind=sync_engine) as db:
        assert db.query(ResearchSession).filter_by(title="Invalid Structure Session").count() == 0


# ── Scenario 5: Reject invalid type and statement ────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "bad_item, expected_loc",
    [
        # Invalid type
        ({"type": "invalid_type", "statement": "Valid statement"}, "contradictions[0].type"),
        ({"type": None, "statement": "Valid statement"}, "contradictions[0].type"),
        ({"statement": "Missing type"}, "contradictions[0].type"),
        ({"type": "Technical", "statement": "Not lowercase"}, "contradictions[0].type"),  # cấm tự lowercase
        # Invalid statement
        ({"type": "technical", "statement": ""}, "contradictions[0].statement"),
        ({"type": "technical", "statement": "   "}, "contradictions[0].statement"),
        ({"type": "technical", "statement": None}, "contradictions[0].statement"),
        ({"type": "technical"}, "contradictions[0].statement"),
        ({"type": "technical", "statement": 12345}, "contradictions[0].statement"),
    ],
)
async def test_scenario_reject_invalid_type_and_statement(
    sync_engine: Engine, tables: None, isolated_db_override: None, bad_item: dict, expected_loc: str
):
    """
    Given type thiếu/sai hoặc statement thiếu/null/sai kiểu/blank
    When import snapshot
    Then HTTP 400
    And không ép type thành technical hay tạo statement mặc định.
    """
    snapshot = {
        "session": {"title": "Invalid Field Session"},
        "problem_frame": {"raw_statement": "statement"},
        "contradictions": [bad_item],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sessions/import", json=snapshot)
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert expected_loc in detail

    with Session(bind=sync_engine) as db:
        assert db.query(ResearchSession).filter_by(title="Invalid Field Session").count() == 0


# ── Scenario 6: Strict principle IDs ─────────────────────────────────────────
@pytest.mark.asyncio
@pytest.mark.parametrize(
    "invalid_principles, expected_loc",
    [
        ([0], "contradictions[0].suggested_principles[0]"),
        ([41], "contradictions[0].suggested_principles[0]"),
        ([999], "contradictions[0].suggested_principles[0]"),
        ([-5], "contradictions[0].suggested_principles[0]"),
        ([True], "contradictions[0].suggested_principles[0]"),
        ([False], "contradictions[0].suggested_principles[0]"),
        ([10.0], "contradictions[0].suggested_principles[0]"),
        ([14.5], "contradictions[0].suggested_principles[0]"),
        (["10"], "contradictions[0].suggested_principles[0]"),
        ([None], "contradictions[0].suggested_principles[0]"),
        ([10, "bad"], "contradictions[0].suggested_principles[1]"),
        ("not_a_list", "contradictions[0].suggested_principles"),
        (1234, "contradictions[0].suggested_principles"),
    ],
)
async def test_scenario_strict_principle_ids_rejects(
    sync_engine: Engine, tables: None, isolated_db_override: None, invalid_principles: any, expected_loc: str
):
    """
    Given suggested_principles chứa phần tử không phải integer 1..40
    When import snapshot
    Then HTTP 400
    And không lọc/coerce phần tử.
    """
    snapshot = {
        "session": {"title": "Invalid Principles Session"},
        "problem_frame": {"raw_statement": "statement"},
        "contradictions": [
            {
                "type": "technical",
                "statement": "Valid statement",
                "suggested_principles": invalid_principles,
            }
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sessions/import", json=snapshot)
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert expected_loc in detail

    with Session(bind=sync_engine) as db:
        assert db.query(ResearchSession).filter_by(title="Invalid Principles Session").count() == 0


@pytest.mark.asyncio
async def test_scenario_strict_principle_ids_accepts_valid_and_preserves_order(
    sync_engine: Engine, tables: None
):
    """Bao phủ chấp nhận boundary 1, 40 và bảo toàn thứ tự + lặp hợp lệ."""
    snapshot = {
        "session": {"title": "Boundary Principles Session"},
        "problem_frame": {"raw_statement": "statement"},
        "contradictions": [
            {
                "type": "technical",
                "statement": "Boundary statement",
                "suggested_principles": [1, 40, 10, 10, 1],  # chứa 1, 40, lặp 10, 1
            }
        ],
    }

    with Session(bind=sync_engine) as db:
        new_sess, _ = import_session_from_json(snapshot, db)
        contra = db.query(Contradiction).join(ProblemFrame).filter(ProblemFrame.session_id == new_sess.id).first()
        assert contra is not None
        assert contra.suggested_principles == [1, 40, 10, 10, 1]


# ── Scenario 7: Invalid last item is atomic ──────────────────────────────────
@pytest.mark.asyncio
async def test_scenario_invalid_last_item_is_atomic(
    sync_engine: Engine, tables: None, isolated_db_override: None
):
    """
    Given explicit list có item đầu hợp lệ và item cuối không hợp lệ
    When import snapshot
    Then HTTP 400
    And không có entity của snapshot được lưu.
    """
    snapshot = {
        "session": {"title": "Atomic Item Test Session"},
        "problem_frame": {"raw_statement": "Statement"},
        "contradictions": [
            {"type": "technical", "statement": "Valid item 1", "suggested_principles": [1, 2]},
            {"type": "technical", "statement": "Valid item 2", "suggested_principles": [3, 4]},
            {"type": "invalid_type", "statement": "Broken item 3"},
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.post("/api/v1/sessions/import", json=snapshot)
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert "contradictions[2].type" in detail

    with Session(bind=sync_engine) as db:
        assert db.query(ResearchSession).filter_by(title="Atomic Item Test Session").count() == 0
        assert db.query(ProblemFrame).filter_by(raw_statement="Statement").count() == 0


# ── Scenario 8: Persistence failure rolls back ───────────────────────────────
@pytest.mark.asyncio
async def test_scenario_persistence_failure_rolls_back(sync_engine: Engine, tables: None):
    """
    Given payload hợp lệ
    And lỗi persistence xảy ra sau khi đã bắt đầu ghi
    When import thất bại
    Then mọi entity tạo trong transaction bị rollback.
    """
    from unittest.mock import patch

    snapshot = {
        "session": {"title": "Rollback Test Session"},
        "problem_frame": {"raw_statement": "Statement to rollback"},
        "contradictions": [
            {"type": "technical", "statement": "Item 1", "suggested_principles": [10]},
        ],
    }

    with Session(bind=sync_engine) as db:
        # Giả lập lỗi ở bước db.commit()
        with patch.object(db, "commit", side_effect=RuntimeError("Simulated DB Disk Failure")):
            with pytest.raises(RuntimeError, match="Simulated DB Disk Failure"):
                import_session_from_json(snapshot, db)

    # Đọc lại độc lập bằng session mới
    with Session(bind=sync_engine) as db:
        assert db.query(ResearchSession).filter_by(title="Rollback Test Session").count() == 0
        assert db.query(ProblemFrame).filter_by(raw_statement="Statement to rollback").count() == 0
        assert db.query(Contradiction).filter_by(statement="Item 1").count() == 0
