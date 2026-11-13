"""
test_method_recommender_method_id.py — Unit test suite cho Batch C7c-2d-1:
Kiểm thử hợp đồng method_id trong MethodRecommender theo ADR-016.

Mục tiêu:
  - Chứng minh các recommendation trả về từ MethodRecommender.recommend_methods
    phải chứa trường 'method_id' có định dạng tất định 'triz-principle-<principle_id>'.
  - Xác thực kiểu dữ liệu, giới hạn ký tự và ràng buộc không chứa ký tự điều khiển.
"""
from __future__ import annotations

import re
import uuid
from unittest.mock import MagicMock

import pytest
from sqlalchemy.orm import Session as SqlSession

from app.domain.models import Contradiction, ProblemFrame
from app.services.method_recommender import MethodRecommender

# Regex cấm ký tự điều khiển ASCII và ngắt dòng Unicode đồng bộ với backend note_context schema
_CONTROL_CHAR_RE = re.compile(r"[\x00-\x1f\x7f-\x9f\u2028\u2029]")


def _create_mock_db_with_principles(principles: list[int]) -> MagicMock:
    """Helper tạo SqlSession mock với danh sách suggested_principles chỉ định."""
    session_id = uuid.uuid4()
    frame_id = uuid.uuid4()

    mock_db = MagicMock(spec=SqlSession)
    mock_frame = MagicMock(spec=ProblemFrame)
    mock_frame.id = frame_id
    mock_frame.session_id = session_id

    mock_contradiction = MagicMock(spec=Contradiction)
    mock_contradiction.problem_frame_id = frame_id
    mock_contradiction.suggested_principles = principles

    def query_side_effect(model):
        q = MagicMock()
        if model == ProblemFrame:
            q.filter_by.return_value.order_by.return_value.first.return_value = mock_frame
        elif model == Contradiction:
            q.filter_by.return_value.first.return_value = mock_contradiction
        return q

    mock_db.query.side_effect = query_side_effect
    return mock_db


class TestMethodRecommenderMethodIdContract:
    """Bộ kiểm thử hợp đồng method_id cho MethodRecommender (ADR-016)."""

    def test_recommendation_for_principle_35_has_expected_method_id(self):
        """Case a: recommendation cho principle_id 35 có method_id == 'triz-principle-35'."""
        session_id = uuid.uuid4()
        mock_db = _create_mock_db_with_principles([35])

        recommender = MethodRecommender(bind=mock_db)
        recommendations = recommender.recommend_methods(session_id)

        assert len(recommendations) == 1
        rec = recommendations[0]
        assert "method_id" in rec, "Recommendation item phải chứa trường 'method_id'"
        assert rec["method_id"] == "triz-principle-35"

    def test_recommendation_for_boundary_principle_1_has_expected_method_id(self):
        """Case b: recommendation cho principle_id 1 có method_id == 'triz-principle-1'."""
        session_id = uuid.uuid4()
        mock_db = _create_mock_db_with_principles([1])

        recommender = MethodRecommender(bind=mock_db)
        recommendations = recommender.recommend_methods(session_id)

        assert len(recommendations) == 1
        rec = recommendations[0]
        assert "method_id" in rec, "Recommendation item phải chứa trường 'method_id'"
        assert rec["method_id"] == "triz-principle-1"

    def test_recommendation_for_boundary_principle_40_has_expected_method_id(self):
        """Case c: recommendation cho principle_id 40 có method_id == 'triz-principle-40'."""
        session_id = uuid.uuid4()
        mock_db = _create_mock_db_with_principles([40])

        recommender = MethodRecommender(bind=mock_db)
        recommendations = recommender.recommend_methods(session_id)

        assert len(recommendations) == 1
        rec = recommendations[0]
        assert "method_id" in rec, "Recommendation item phải chứa trường 'method_id'"
        assert rec["method_id"] == "triz-principle-40"

    def test_method_id_is_string(self):
        """Case d: method_id phải là kiểu string (str)."""
        session_id = uuid.uuid4()
        mock_db = _create_mock_db_with_principles([1, 10, 35, 40])

        recommender = MethodRecommender(bind=mock_db)
        recommendations = recommender.recommend_methods(session_id)

        assert len(recommendations) == 4
        for rec in recommendations:
            assert "method_id" in rec, "Recommendation item phải chứa trường 'method_id'"
            assert isinstance(rec["method_id"], str), (
                f"method_id phải là str, nhận được {type(rec['method_id'])}"
            )

    def test_method_id_contains_no_control_characters(self):
        """Case e: method_id không chứa ký tự control theo regex [\\x00-\\x1f\\x7f-\\x9f\\u2028\\u2029]."""
        session_id = uuid.uuid4()
        mock_db = _create_mock_db_with_principles([1, 10, 20, 30, 40])

        recommender = MethodRecommender(bind=mock_db)
        recommendations = recommender.recommend_methods(session_id)

        assert len(recommendations) == 5
        for rec in recommendations:
            assert "method_id" in rec, "Recommendation item phải chứa trường 'method_id'"
            val = rec["method_id"]
            assert not _CONTROL_CHAR_RE.search(val), (
                f"method_id '{val}' không được chứa ký tự điều khiển hoặc ngắt dòng Unicode"
            )

    def test_method_id_length_within_limits_and_non_empty(self):
        """Case f: method_id có độ dài <= 100 code points và không rỗng / không chỉ gồm khoảng trắng."""
        session_id = uuid.uuid4()
        mock_db = _create_mock_db_with_principles([1, 35, 40])

        recommender = MethodRecommender(bind=mock_db)
        recommendations = recommender.recommend_methods(session_id)

        assert len(recommendations) == 3
        for rec in recommendations:
            assert "method_id" in rec, "Recommendation item phải chứa trường 'method_id'"
            val = rec["method_id"]
            code_points_len = len(list(val))
            assert 1 <= code_points_len <= 100, (
                f"method_id '{val}' độ dài ({code_points_len}) phải nằm trong [1, 100]"
            )
            assert val.strip(), "method_id không được rỗng hoặc chỉ chứa khoảng trắng"
