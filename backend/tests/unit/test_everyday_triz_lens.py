"""
test_everyday_triz_lens.py — Unit & Contract tests cho Everyday TRIZ Lens (Phase 2A)

Kiểm tra:
1. File everyday_triz_lens.json có đủ 40 principles và 39 parameters.
2. Mỗi principle có đủ: everyday_title, daily_application, daily_examples (>=2), action_prompt.
3. Mỗi parameter có đủ: everyday_label.
4. EverydayTrizLens service load và truy vấn chuẩn xác.
5. MethodRecommender trả thêm metadata đời sống (backward-compatible).
"""
import json
import pathlib
import pytest
from unittest.mock import MagicMock
import uuid

from app.services.everyday_triz_lens import EverydayTrizLens, get_everyday_triz_lens
from app.services.method_recommender import MethodRecommender
from app.domain.models import ProblemFrame, Contradiction, ResearchSession


_DATA_DIR = pathlib.Path(__file__).parent.parent.parent / "src" / "app" / "data"
_LENS_JSON_PATH = _DATA_DIR / "everyday_triz_lens.json"


def test_everyday_triz_lens_json_structure():
    """File JSON phải tồn tại và chứa đủ 40 principles, 39 parameters."""
    assert _LENS_JSON_PATH.exists(), f"Không tìm thấy file: {_LENS_JSON_PATH}"

    with open(_LENS_JSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert "principles" in data, "Thiếu trường 'principles' trong JSON"
    assert "parameters" in data, "Thiếu trường 'parameters' trong JSON"

    principles = data["principles"]
    parameters = data["parameters"]

    assert len(principles) == 40, f"Cần đúng 40 principles, hiện có {len(principles)}"
    assert len(parameters) == 39, f"Cần đúng 39 parameters, hiện có {len(parameters)}"

    # Kiểm tra từng principle
    for pid in range(1, 41):
        key = str(pid)
        assert key in principles, f"Thiếu principle #{pid}"
        p = principles[key]
        assert isinstance(p.get("everyday_title"), str) and len(p["everyday_title"].strip()) > 0
        assert isinstance(p.get("daily_application"), str) and len(p["daily_application"].strip()) > 0
        assert isinstance(p.get("daily_examples"), list) and len(p["daily_examples"]) >= 2
        for ex in p["daily_examples"]:
            assert isinstance(ex, str) and len(ex.strip()) > 0
        assert isinstance(p.get("action_prompt"), str) and len(p["action_prompt"].strip()) > 0

    # Kiểm tra từng parameter
    for param_id in range(1, 40):
        key = str(param_id)
        assert key in parameters, f"Thiếu parameter #{param_id}"
        param = parameters[key]
        assert isinstance(param.get("everyday_label"), str) and len(param["everyday_label"].strip()) > 0


def test_everyday_triz_lens_service():
    """Kiểm tra service EverydayTrizLens cung cấp API truy vấn hợp lệ."""
    lens = get_everyday_triz_lens()

    # Principle 1: Segmentation
    p1 = lens.get_principle_lens(1)
    assert p1 is not None
    assert "everyday_title" in p1
    assert "daily_application" in p1
    assert "daily_examples" in p1
    assert len(p1["daily_examples"]) >= 2
    assert "action_prompt" in p1

    # Parameter 22: Energy consumption / loss of money
    param22 = lens.get_parameter_lens(22)
    assert param22 is not None
    assert "everyday_label" in param22
    assert len(param22["everyday_label"]) > 0

    # Boundary check
    assert lens.get_principle_lens(0) == {}
    assert lens.get_principle_lens(41) == {}
    assert lens.get_parameter_lens(0) == {}
    assert lens.get_parameter_lens(40) == {}


def test_method_recommender_includes_everyday_metadata():
    """MethodRecommender phải bổ sung các trường metadata đời sống."""
    from sqlalchemy.orm import Session as SqlSession

    session_id = uuid.uuid4()
    frame_id = uuid.uuid4()

    mock_db = MagicMock(spec=SqlSession)
    mock_frame = MagicMock(spec=ProblemFrame)
    mock_frame.id = frame_id
    mock_frame.session_id = session_id

    mock_contradiction = MagicMock(spec=Contradiction)
    mock_contradiction.problem_frame_id = frame_id
    mock_contradiction.suggested_principles = [1, 35]

    # Mock query chain: first query for ProblemFrame, second query for Contradiction
    mock_query = MagicMock()
    mock_db.query.return_value = mock_query

    # Setup side_effect or separate return_values for different model queries
    def query_side_effect(model):
        q = MagicMock()
        if model == ProblemFrame:
            q.filter_by.return_value.order_by.return_value.first.return_value = mock_frame
        elif model == Contradiction:
            q.filter_by.return_value.first.return_value = mock_contradiction
        return q

    mock_db.query.side_effect = query_side_effect

    recommender = MethodRecommender(bind=mock_db)
    recommendations = recommender.recommend_methods(session_id)

    assert len(recommendations) == 2
    for rec in recommendations:
        # Existing canonical fields preserved
        assert "id" in rec
        assert "principle_id" in rec
        assert "title" in rec
        assert "description" in rec
        assert "explanation" in rec
        assert "examples" in rec

        # New everyday fields
        assert "everyday_title" in rec
        assert "daily_application" in rec
        assert "daily_examples" in rec
        assert isinstance(rec["daily_examples"], list)
        assert len(rec["daily_examples"]) >= 2
        assert "action_prompt" in rec
