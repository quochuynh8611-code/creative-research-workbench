"""
test_triz_full_matrix.py — Integration test suite cho Phase 6.3: Full TRIZ 39×39 Matrix & 39 Parameters

Kiểm tra (Test-First):
  1. File backend/src/app/data/triz_matrix_39x39.json tồn tại và có cấu trúc hợp lệ (39 parameters, ma trận 39x39, 40 principles, is_canonical=True).
  2. Từ điển _PARAMETER_KEYWORDS trong ProblemStructuringService chứa đủ 39 thông số song ngữ Việt - Anh.
  3. Tra cứu cặp mâu thuẫn bất kỳ trong 39x39 trả về đúng danh sách nguyên tắc Altshuller kinh điển.
  4. MethodRecommender trả về metadata đầy đủ: id, title, description, explanation, examples cho mọi nguyên tắc từ 1 đến 40.
  5. Ô rỗng (empty contradiction) trả về [] và không bị synthetic fallback.
  6. Ô đường chéo (diagonal contradiction) trả về [] và không bị synthetic fallback.
  7. Dataset loader fails-closed khi gặp principle ID không hợp lệ hoặc dữ liệu hỏng.
"""
from __future__ import annotations

import json
import pathlib
import pytest
from sqlalchemy.orm import Session

from app.domain.models import ContradictionType, ProblemFrame, ResearchSession, SessionStatus
from app.services.method_recommender import MethodRecommender
from app.services.problem_structuring_service import ProblemStructuringService


REPO_ROOT = pathlib.Path(__file__).parent.parent.parent
DATA_PATH = REPO_ROOT / "src" / "app" / "data" / "triz_matrix_39x39.json"


def test_triz_matrix_json_schema_and_completeness():
    """
    1. Kiểm tra file dữ liệu JSON chuẩn ma trận 39x39 tồn tại và đủ 39 parameters, 40 principles,
    đầy đủ 1521 tọa độ và is_canonical=True.
    """
    assert DATA_PATH.exists(), f"File dữ liệu TRIZ 39x39 không tồn tại tại {DATA_PATH}"

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "parameters" in data, "Thiếu khóa 'parameters' trong JSON"
    assert "matrix" in data, "Thiếu khóa 'matrix' trong JSON"
    assert "principles" in data, "Thiếu khóa 'principles' trong JSON"

    # Kiểm tra trạng thái canonical
    assert data.get("is_canonical") is True, "Dataset production phải được đánh dấu is_canonical=True sau khi import"
    assert data.get("status") == "CANONICAL_ALTSHULLER_1985", "Dataset production phải có status CANONICAL_ALTSHULLER_1985"

    # Kiểm tra đủ 39 parameters
    params = data["parameters"]
    assert len(params) == 39, f"Cần đúng 39 thông số, tìm thấy: {len(params)}"
    for idx in range(1, 40):
        key = str(idx)
        assert key in params or idx in params, f"Thiếu thông số ID {idx}"
        p_info = params.get(key) or params.get(idx)
        assert "name_vi" in p_info and p_info["name_vi"], f"Thông số {idx} thiếu name_vi"
        assert "name_en" in p_info and p_info["name_en"], f"Thông số {idx} thiếu name_en"

    # Kiểm tra đủ 40 principles
    principles = data["principles"]
    assert len(principles) == 40, f"Cần đúng 40 nguyên tắc, tìm thấy: {len(principles)}"
    for idx in range(1, 41):
        key = str(idx)
        assert key in principles or idx in principles, f"Thiếu nguyên tắc ID {idx}"
        pr_info = principles.get(key) or principles.get(idx)
        assert "name_vi" in pr_info and pr_info["name_vi"], f"Nguyên tắc {idx} thiếu name_vi"
        assert "name_en" in pr_info and pr_info["name_en"], f"Nguyên tắc {idx} thiếu name_en"
        assert "description" in pr_info and pr_info["description"], f"Nguyên tắc {idx} thiếu description"
        assert "examples" in pr_info and isinstance(pr_info["examples"], list), f"Nguyên tắc {idx} thiếu danh sách examples"

    # Kiểm tra đầy đủ 1521 coordinates
    matrix = data["matrix"]
    assert len(matrix) == 1521, f"Ma trận phải có đủ 1521 coordinates (39x39), tìm thấy {len(matrix)}"


def test_bilingual_39_parameters_keywords_mapping(sync_engine):
    """
    2. Kiểm tra ProblemStructuringService nhận diện được các thông số ngoài top 8 cũ.
    """
    service = ProblemStructuringService(bind=sync_engine)

    # Test nhận diện thông số #17 (Nhiệt độ - Temperature) và #14 (Độ bền - Strength / Durability)
    text_sample = "Tăng nhiệt độ buồng đốt làm suy giảm độ bền của kết cấu kim loại"
    c_type, improving, worsening = service._extract_parameters_and_type(text_sample)
    assert c_type == ContradictionType.technical
    assert improving in ("temperature", "temperature_of_object", "17")
    assert worsening in ("strength", "strength_durability", "durability", "14")

    # Test nhận diện thông số #39 (Năng suất / Hiệu suất - Productivity) và #22 (Tổn hao năng lượng - Energy loss)
    text_sample_2 = "Cải thiện năng suất làm tăng tổn hao năng lượng trong hệ thống"
    c_type_2, improving_2, worsening_2 = service._extract_parameters_and_type(text_sample_2)
    assert c_type_2 == ContradictionType.technical
    assert improving_2 in ("productivity", "39")
    assert worsening_2 in ("energy_consumption", "energy_loss", "waste_of_energy", "22")


def test_contradiction_lookup_full_39x39(sync_engine, db_session: Session):
    """
    3. Kiểm tra structure_problem tra cứu đúng nguyên tắc từ ma trận 39x39 và persist vào DB.
    """
    session = ResearchSession(
        title="Nghiên cứu ma trận 39x39",
        status=SessionStatus.active,
        workflow_state="problem_framing",
    )
    db_session.add(session)
    db_session.flush()

    service = ProblemStructuringService(bind=db_session)
    frame = service.structure_problem(
        session_id=session.id,
        raw_statement="Tăng trọng lượng di động làm tăng chiều dài di động của kết cấu",
        domain="mechanical",
    )

    assert frame.contradiction_type == ContradictionType.technical
    assert len(frame.contradictions) == 1
    contradiction = frame.contradictions[0]
    assert contradiction.suggested_principles is not None
    # Cặp (1, 3) (Weight moving vs Length moving) trong ma trận Altshuller là [15, 8, 29, 34]
    assert contradiction.suggested_principles == [15, 8, 29, 34]


def test_empty_contradiction_returns_empty_list_without_synthetic_fallback(sync_engine, db_session: Session):
    """
    4. Kiểm tra ô mâu thuẫn rỗng (1, 2) (Weight moving vs Weight stationary)
    trả về danh sách rỗng [] và TUYỆT ĐỐI không fallback sang nguyên tắc giả định.
    """
    session = ResearchSession(
        title="Test Empty Contradiction",
        status=SessionStatus.active,
        workflow_state="problem_framing",
    )
    db_session.add(session)
    db_session.flush()

    service = ProblemStructuringService(bind=db_session)
    frame = service.structure_problem(
        session_id=session.id,
        raw_statement="Tăng trọng lượng di động làm tăng trọng lượng tĩnh của bệ đỡ",
        domain="mechanical",
    )

    assert frame.contradiction_type == ContradictionType.technical
    assert len(frame.contradictions) == 1
    contradiction = frame.contradictions[0]
    # Cặp (1, 2) là ô rỗng nguyên bản trong Altshuller matrix
    assert contradiction.suggested_principles == [], "Ô rỗng phải trả về [] thay vì fallback synthetic"

    recommender = MethodRecommender(bind=db_session)
    recs = recommender.recommend_methods(session.id)
    assert recs == [], "MethodRecommender phải trả về [] khi ô mâu thuẫn rỗng"


def test_diagonal_contradiction_returns_empty_list(sync_engine, db_session: Session):
    """
    5. Kiểm tra ô mâu thuẫn đường chéo (10, 10) (Force vs Force)
    trả về danh sách rỗng [] và không fallback sang _DEFAULT_TECHNICAL_PRINCIPLES.
    """
    session = ResearchSession(
        title="Test Diagonal Contradiction",
        status=SessionStatus.active,
        workflow_state="problem_framing",
    )
    db_session.add(session)
    db_session.flush()

    service = ProblemStructuringService(bind=db_session)
    # Trực tiếp gọi hàm tạo mâu thuẫn kỹ thuật với 2 thông số giống nhau
    contradiction = service._create_contradiction(
        frame=ProblemFrame(session_id=session.id, raw_statement="Force vs Force", contradiction_type=ContradictionType.technical),
        contradiction_type=ContradictionType.technical,
        improving_param="force",
        worsening_param="force",
    )
    assert contradiction.suggested_principles == [], "Ô đường chéo phải trả về []"


def test_matrix_data_fails_closed_on_invalid_principles():
    """
    6. Kiểm tra fail-closed validation: Nếu file JSON chứa principle ID ngoài [1..40] (ví dụ: 99),
    hàm validate_triz_matrix_data phải raise RuntimeError rõ ràng thay vì fail-open.
    """
    from app.services.problem_structuring_service import validate_triz_matrix_data

    # Valid structure but with invalid principle 99 at coordinate 1_1
    corrupt_data = {
        "parameters": {str(i): {"name_vi": f"P{i}", "name_en": f"P{i}", "code": f"p{i}"} for i in range(1, 40)},
        "principles": {str(i): {"name_vi": f"Pr{i}", "name_en": f"Pr{i}", "description": "desc", "examples": []} for i in range(1, 41)},
        "matrix": {f"{i}_{j}": [] for i in range(1, 40) for j in range(1, 40)},
    }
    corrupt_data["matrix"]["1_1"] = [99]  # 99 is out of bounds!

    with pytest.raises(RuntimeError, match="Principle ID .* out of bounds"):
        validate_triz_matrix_data(corrupt_data)

    # Missing coordinate test
    corrupt_data_missing_coord = {
        "parameters": {str(i): {"name_vi": f"P{i}", "name_en": f"P{i}", "code": f"p{i}"} for i in range(1, 40)},
        "principles": {str(i): {"name_vi": f"Pr{i}", "name_en": f"Pr{i}", "description": "desc", "examples": []} for i in range(1, 41)},
        "matrix": {},
    }
    with pytest.raises(RuntimeError, match="không đủ 1521 tọa độ|thiếu tọa độ"):
        validate_triz_matrix_data(corrupt_data_missing_coord)


def test_method_recommender_returns_full_metadata(sync_engine, db_session: Session):
    """
    7. Kiểm tra MethodRecommender trả về metadata đầy đủ (title, description, explanation, examples)
    cho toàn bộ 40 nguyên tắc TRIZ.
    """
    session = ResearchSession(
        title="Test Method Recommender Metadata",
        status=SessionStatus.active,
        workflow_state="ideation",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Test statement",
        normalized_statement="Test statement normalized",
        contradiction_type=ContradictionType.technical,
        improving_parameter="speed",
        worsening_parameter="reliability",
    )
    db_session.add(frame)
    db_session.flush()

    from app.domain.models import Contradiction
    c = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Tăng tốc độ làm giảm độ tin cậy.",
        suggested_principles=[1, 15, 35, 40],
    )
    db_session.add(c)
    db_session.flush()

    recommender = MethodRecommender(bind=db_session)
    recommendations = recommender.recommend_methods(session.id)

    assert len(recommendations) == 4
    for item in recommendations:
        assert "id" in item
        assert "principle_id" in item
        assert "title" in item and len(item["title"]) > 0
        assert "description" in item and len(item["description"]) > 0
        assert "explanation" in item
        assert "examples" in item
        assert isinstance(item["examples"], list)
