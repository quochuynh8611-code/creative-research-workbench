"""
test_triz_separation_principles.py — Unit tests cho TRIZ Separation Principles (Batch A: RED Phase)

Ref: docs/SEPARATION_PRINCIPLES_SPEC.md
Tuân thủ:
1. Fail-closed validation cho file JSON dữ liệu separation principles (chính xác 4 strategies, id hợp lệ, principle_ids in [1..40]).
2. Ánh xạ nguyên tắc sáng tạo cho từng chiến lược:
   - space: [1, 2, 3, 4, 7, 13, 17, 24, 26, 30]
   - time: [9, 10, 11, 15, 16, 18, 19, 20, 21, 29, 34, 37]
   - condition: [28, 31, 32, 35, 36, 38, 39, 40]
   - system_level: [1, 3, 5, 6, 7, 12, 25, 27, 33, 40]
3. Hợp nhất (Union) và khử trùng lặp khi chọn nhiều chiến lược.
4. Fallback [1, 2, 3, 4] khi không chọn chiến lược nào.
5. Chỉ áp dụng cho mâu thuẫn vật lý (ContradictionType.physical).
"""
from __future__ import annotations

import pathlib
from typing import Any
import pytest

from app.domain.models import ContradictionType


_DATA_DIR = pathlib.Path(__file__).parent.parent.parent / "src" / "app" / "data"
_SEPARATION_JSON_PATH = _DATA_DIR / "triz_separation_principles.json"


def test_separation_principles_json_file_presence() -> None:
    """File triz_separation_principles.json phải tồn tại trong backend/src/app/data."""
    assert _SEPARATION_JSON_PATH.exists(), (
        f"File canonical {_SEPARATION_JSON_PATH} chưa tồn tại (kỳ vọng RED trong Batch A)."
    )


def test_validate_separation_principles_missing_strategies_raises_error() -> None:
    """Validator phải kích hoạt ngoại lệ nếu thiếu key 'strategies' hoặc không phải list."""
    from app.services.problem_structuring_service import validate_separation_principles_data

    with pytest.raises((RuntimeError, ValueError), match="strategies"):
        validate_separation_principles_data({})

    with pytest.raises((RuntimeError, ValueError), match="strategies"):
        validate_separation_principles_data({"strategies": "invalid_type"})


def test_validate_separation_principles_incomplete_strategy_count_raises_error() -> None:
    """Validator phải kích hoạt ngoại lệ nếu số lượng strategies khác 4."""
    from app.services.problem_structuring_service import validate_separation_principles_data

    data_only_3 = {
        "strategies": [
            {"id": "space", "name_vi": "Không gian", "diagnostic_question_vi": "Q1", "principle_ids": [1, 2]},
            {"id": "time", "name_vi": "Thời gian", "diagnostic_question_vi": "Q2", "principle_ids": [9, 10]},
            {"id": "condition", "name_vi": "Điều kiện", "diagnostic_question_vi": "Q3", "principle_ids": [28, 31]},
        ]
    }
    with pytest.raises((RuntimeError, ValueError), match="4"):
        validate_separation_principles_data(data_only_3)


def test_validate_separation_principles_invalid_strategy_id_raises_error() -> None:
    """Validator phải kích hoạt ngoại lệ nếu strategy ID không thuộc tập hợp 4 ID hợp lệ."""
    from app.services.problem_structuring_service import validate_separation_principles_data

    data_invalid_id = {
        "strategies": [
            {"id": "space", "name_vi": "Không gian", "diagnostic_question_vi": "Q1", "principle_ids": [1, 2]},
            {"id": "time", "name_vi": "Thời gian", "diagnostic_question_vi": "Q2", "principle_ids": [9, 10]},
            {"id": "condition", "name_vi": "Điều kiện", "diagnostic_question_vi": "Q3", "principle_ids": [28, 31]},
            {"id": "energy", "name_vi": "Năng lượng", "diagnostic_question_vi": "Q4", "principle_ids": [1, 3]},
        ]
    }
    with pytest.raises((RuntimeError, ValueError), match="ID"):
        validate_separation_principles_data(data_invalid_id)


def test_validate_separation_principles_duplicate_strategy_id_raises_error() -> None:
    """Validator phải kích hoạt ngoại lệ nếu xuất hiện strategy ID trùng lặp."""
    from app.services.problem_structuring_service import validate_separation_principles_data

    data_duplicate = {
        "strategies": [
            {"id": "space", "name_vi": "Không gian", "diagnostic_question_vi": "Q1", "principle_ids": [1, 2]},
            {"id": "space", "name_vi": "Không gian 2", "diagnostic_question_vi": "Q2", "principle_ids": [3, 4]},
            {"id": "condition", "name_vi": "Điều kiện", "diagnostic_question_vi": "Q3", "principle_ids": [28, 31]},
            {"id": "system_level", "name_vi": "Mức hệ thống", "diagnostic_question_vi": "Q4", "principle_ids": [1, 3]},
        ]
    }
    with pytest.raises((RuntimeError, ValueError), match="trùng"):
        validate_separation_principles_data(data_duplicate)


def test_validate_separation_principles_out_of_bounds_principle_id_raises_error() -> None:
    """Validator phải kích hoạt ngoại lệ nếu principle_id nằm ngoài [1..40]."""
    from app.services.problem_structuring_service import validate_separation_principles_data

    data_out_of_bounds = {
        "strategies": [
            {"id": "space", "name_vi": "Không gian", "diagnostic_question_vi": "Q1", "principle_ids": [1, 41]},
            {"id": "time", "name_vi": "Thời gian", "diagnostic_question_vi": "Q2", "principle_ids": [9, 10]},
            {"id": "condition", "name_vi": "Điều kiện", "diagnostic_question_vi": "Q3", "principle_ids": [28, 31]},
            {"id": "system_level", "name_vi": "Mức hệ thống", "diagnostic_question_vi": "Q4", "principle_ids": [1, 3]},
        ]
    }
    with pytest.raises((RuntimeError, ValueError), match="1..40"):
        validate_separation_principles_data(data_out_of_bounds)


def test_validate_separation_principles_empty_required_fields_raises_error() -> None:
    """Validator phải kích hoạt ngoại lệ nếu thiếu name_vi hoặc diagnostic_question_vi."""
    from app.services.problem_structuring_service import validate_separation_principles_data

    data_missing_text = {
        "strategies": [
            {"id": "space", "name_vi": "", "diagnostic_question_vi": "Q1", "principle_ids": [1, 2]},
            {"id": "time", "name_vi": "Thời gian", "diagnostic_question_vi": "", "principle_ids": [9, 10]},
            {"id": "condition", "name_vi": "Điều kiện", "diagnostic_question_vi": "Q3", "principle_ids": [28, 31]},
            {"id": "system_level", "name_vi": "Mức hệ thống", "diagnostic_question_vi": "Q4", "principle_ids": [1, 3]},
        ]
    }
    with pytest.raises((RuntimeError, ValueError)):
        validate_separation_principles_data(data_missing_text)


def test_validate_separation_principles_valid_contract_passes() -> None:
    """Validator chấp nhận cấu trúc chuẩn xác 4 chiến lược và principle_ids thuộc [1..40]."""
    from app.services.problem_structuring_service import validate_separation_principles_data

    valid_data = {
        "strategies": [
            {"id": "space", "name_vi": "Phân tách trong không gian", "diagnostic_question_vi": "Q1", "principle_ids": [1, 2, 3, 4, 7, 13, 17, 24, 26, 30]},
            {"id": "time", "name_vi": "Phân tách trong thời gian", "diagnostic_question_vi": "Q2", "principle_ids": [9, 10, 11, 15, 16, 18, 19, 20, 21, 29, 34, 37]},
            {"id": "condition", "name_vi": "Phân tách theo điều kiện", "diagnostic_question_vi": "Q3", "principle_ids": [28, 31, 32, 35, 36, 38, 39, 40]},
            {"id": "system_level", "name_vi": "Phân tách giữa hệ thống và các thành phần", "diagnostic_question_vi": "Q4", "principle_ids": [1, 3, 5, 6, 7, 12, 25, 27, 33, 40]},
        ]
    }
    # Hàm không được raise exception
    validate_separation_principles_data(valid_data)


def test_resolve_separation_principles_space_mapping() -> None:
    """Chiến lược 'space' phải phân giải đúng 10 nguyên tắc theo spec."""
    from app.services.problem_structuring_service import resolve_separation_principles

    expected_space = [1, 2, 3, 4, 7, 13, 17, 24, 26, 30]
    resolved = resolve_separation_principles(["space"])
    assert resolved == expected_space


def test_resolve_separation_principles_multi_selection_union_and_deduplication() -> None:
    """Chọn 'space' và 'condition' phải hợp nhất và khử trùng lặp principle IDs."""
    from app.services.problem_structuring_service import resolve_separation_principles

    # space: [1, 2, 3, 4, 7, 13, 17, 24, 26, 30]
    # condition: [28, 31, 32, 35, 36, 38, 39, 40]
    # Không có principle trùng nhau giữa space và condition, tổng 18 principles
    resolved = resolve_separation_principles(["space", "condition"])
    assert len(resolved) == len(set(resolved)), "Danh sách nguyên tắc hợp nhất không được trùng lặp"
    assert 1 in resolved
    assert 28 in resolved
    assert 40 in resolved
    assert len(resolved) == 18


def test_resolve_separation_principles_empty_selection_fallback() -> None:
    """Khi không chọn chiến lược nào (empty list), phải trả về fallback mặc định [1, 2, 3, 4]."""
    from app.services.problem_structuring_service import resolve_separation_principles

    resolved = resolve_separation_principles([])
    assert resolved == [1, 2, 3, 4]


def test_separation_principles_enrichment_only_for_physical_contradiction() -> None:
    """Chiến lược phân tách chỉ khả dụng cho physical; technical/none/unknown trả về None hoặc empty."""
    from app.services.problem_structuring_service import get_separation_strategies_for_contradiction

    physical_res = get_separation_strategies_for_contradiction(ContradictionType.physical)
    assert physical_res is not None
    assert len(physical_res) == 4

    technical_res = get_separation_strategies_for_contradiction(ContradictionType.technical)
    assert technical_res is None or technical_res == []

    none_res = get_separation_strategies_for_contradiction(ContradictionType.none)
    assert none_res is None or none_res == []

    unknown_res = get_separation_strategies_for_contradiction(ContradictionType.unknown)
    assert unknown_res is None or unknown_res == []


# ---------------------------------------------------------------------------
# Tests for _load_separation_principles() fail-closed behavior (added fix)
# ---------------------------------------------------------------------------

def test_load_separation_principles_io_error_is_graceful(tmp_path: pathlib.Path) -> None:
    """Lỗi mở file (OSError) phải graceful: không raise, function thoát sớm."""
    import importlib
    import app.services.problem_structuring_service as svc

    # Trỏ _SEPARATION_JSON_PATH tới file không tồn tại
    original_path = svc._SEPARATION_JSON_PATH
    svc._SEPARATION_JSON_PATH = tmp_path / "nonexistent_file.json"
    original_data = svc._SEPARATION_DATA
    original_map = svc._SEPARATION_STRATEGIES_MAP
    try:
        # Phải không raise, chỉ log warning
        svc._load_separation_principles()
        # Dữ liệu không được thay đổi
        assert svc._SEPARATION_DATA == original_data
    finally:
        svc._SEPARATION_JSON_PATH = original_path
        svc._SEPARATION_DATA = original_data
        svc._SEPARATION_STRATEGIES_MAP = original_map


def test_load_separation_principles_validation_error_propagates(tmp_path: pathlib.Path) -> None:
    """JSON parse được nhưng validation fail (< 4 strategies) phải raise ValueError — fail-closed."""
    import json as _json
    import app.services.problem_structuring_service as svc

    # Tạo JSON hợp lệ về cú pháp nhưng chỉ có 3 strategies (thiếu 1)
    invalid_data = {
        "strategies": [
            {
                "id": "space",
                "name_vi": "Phân tách Không gian",
                "diagnostic_question_vi": "Hỏi?",
                "principle_ids": [1, 2, 3],
            },
            {
                "id": "time",
                "name_vi": "Phân tách Thời gian",
                "diagnostic_question_vi": "Hỏi?",
                "principle_ids": [9, 10, 11],
            },
            {
                "id": "condition",
                "name_vi": "Phân tách Điều kiện",
                "diagnostic_question_vi": "Hỏi?",
                "principle_ids": [28, 31],
            },
            # Thiếu "system_level" → validator phải raise ValueError
        ]
    }
    # Viết file JSON không hợp lệ về logic
    bad_json_file = tmp_path / "bad_separation.json"
    bad_json_file.write_text(_json.dumps(invalid_data), encoding="utf-8")

    original_path = svc._SEPARATION_JSON_PATH
    original_data = svc._SEPARATION_DATA
    original_map = svc._SEPARATION_STRATEGIES_MAP
    svc._SEPARATION_JSON_PATH = bad_json_file
    try:
        with pytest.raises(ValueError):
            svc._load_separation_principles()
    finally:
        svc._SEPARATION_JSON_PATH = original_path
        svc._SEPARATION_DATA = original_data
        svc._SEPARATION_STRATEGIES_MAP = original_map
