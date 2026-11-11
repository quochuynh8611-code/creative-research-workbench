"""
Unit tests cho dịch vụ TRIZ 9-Windows System Operator (Batch C1 — RED Phase).
Bao gồm:
  - Kiểm thực fail-closed cấu trúc dữ liệu JSON (27 ô trên 3 lăng kính).
  - Bắt lỗi khi thiếu lăng kính, thiếu ô, trùng ô, sai tọa độ.
  - Bắt lỗi khi thiếu các trường tiếng Việt bắt buộc hoặc sai kiểu dữ liệu ví dụ.
  - Xử lý lỗi nạp I/O và JSONDecodeError an toàn (graceful).
  - Phân giải lưới 9 ô theo lăng kính hợp lệ và từ chối lăng kính không hợp lệ.
"""
from __future__ import annotations

import copy
import json
from typing import Any
from unittest.mock import mock_open, patch

import pytest

from app.services.triz_nine_windows_service import (
    get_nine_windows,
    load_nine_windows_data,
    validate_nine_windows_data,
)


def _make_valid_cell(level: str, time: str, idx: int) -> dict[str, Any]:
    return {
        "level": level,
        "time": time,
        "label_vi": f"Nhãn {level} {time}",
        "label_en": f"Label {level} {time}",
        "prompt_vi": f"Câu hỏi gợi mở {level} {time} #{idx}?",
        "description_vi": f"Mô tả phân tích cho {level} {time}.",
        "examples_vi": [f"Ví dụ minh họa {level} {time} 1", f"Ví dụ minh họa {level} {time} 2"],
    }


def _make_valid_dataset() -> dict[str, Any]:
    levels = ["supersystem", "system", "subsystem"]
    times = ["past", "present", "future"]

    dataset: dict[str, Any] = {
        "version": "1.0",
        "title": "TRIZ 9-Windows System Operator",
        "lenses": {},
    }

    for lens in ["engineering", "business", "everyday"]:
        cells = []
        idx = 1
        for lvl in levels:
            for tm in times:
                cells.append(_make_valid_cell(lvl, tm, idx))
                idx += 1
        dataset["lenses"][lens] = {
            "lens_title": f"Lăng kính {lens.capitalize()}",
            "windows": cells,
        }

    return dataset


# ──────────────────────────────────────────────
# 1. Kiểm thực bộ dữ liệu chuẩn
# ──────────────────────────────────────────────

def test_valid_dataset_passes_validator() -> None:
    data = _make_valid_dataset()
    # Không raise exception
    validate_nine_windows_data(data)


# ──────────────────────────────────────────────
# 2. Bắt lỗi thiếu lăng kính
# ──────────────────────────────────────────────

def test_missing_lens_fails_validator() -> None:
    data = _make_valid_dataset()
    del data["lenses"]["business"]

    with pytest.raises(ValueError, match="business"):
        validate_nine_windows_data(data)


def test_non_dict_root_or_lenses_fails_validator() -> None:
    with pytest.raises(ValueError, match="dictionary"):
        validate_nine_windows_data(["not", "a", "dict"])  # type: ignore

    with pytest.raises(ValueError, match="lenses"):
        validate_nine_windows_data({"version": "1.0", "lenses": "invalid"})


# ──────────────────────────────────────────────
# 3. Bắt lỗi thiếu hoặc trùng lặp ô trong lưới
# ──────────────────────────────────────────────

def test_missing_cell_fails_validator() -> None:
    data = _make_valid_dataset()
    # Xóa bớt 1 ô -> chỉ còn 8 ô
    data["lenses"]["engineering"]["windows"].pop()

    with pytest.raises(ValueError, match="9"):
        validate_nine_windows_data(data)


def test_duplicate_cell_coordinates_fails_validator() -> None:
    data = _make_valid_dataset()
    # Nhân bản ô đầu tiên đè lên ô cuối cùng
    data["lenses"]["everyday"]["windows"][-1] = copy.deepcopy(
        data["lenses"]["everyday"]["windows"][0]
    )

    with pytest.raises(ValueError, match="trùng|duplicate"):
        validate_nine_windows_data(data)


# ──────────────────────────────────────────────
# 4. Bắt lỗi sai tọa độ level hoặc time
# ──────────────────────────────────────────────

def test_invalid_level_fails_validator() -> None:
    data = _make_valid_dataset()
    data["lenses"]["engineering"]["windows"][0]["level"] = "galaxy"

    with pytest.raises(ValueError, match="galaxy"):
        validate_nine_windows_data(data)


def test_invalid_time_fails_validator() -> None:
    data = _make_valid_dataset()
    data["lenses"]["business"]["windows"][0]["time"] = "ancient"

    with pytest.raises(ValueError, match="ancient"):
        validate_nine_windows_data(data)


# ──────────────────────────────────────────────
# 5. Bắt lỗi trường tiếng Việt bắt buộc bị rỗng
# ──────────────────────────────────────────────

@pytest.mark.parametrize("field_name", ["label_vi", "prompt_vi", "description_vi"])
def test_empty_required_vietnamese_field_fails_validator(field_name: str) -> None:
    data = _make_valid_dataset()
    data["lenses"]["engineering"]["windows"][0][field_name] = "   "

    with pytest.raises(ValueError, match=field_name):
        validate_nine_windows_data(data)


# ──────────────────────────────────────────────
# 6. Bắt lỗi kiểu dữ liệu hoặc nội dung examples_vi
# ──────────────────────────────────────────────

def test_invalid_examples_type_fails_validator() -> None:
    data = _make_valid_dataset()
    data["lenses"]["business"]["windows"][0]["examples_vi"] = "không phải list"

    with pytest.raises(ValueError, match="examples_vi"):
        validate_nine_windows_data(data)


def test_empty_string_item_in_examples_fails_validator() -> None:
    data = _make_valid_dataset()
    data["lenses"]["business"]["windows"][0]["examples_vi"] = ["Ví dụ hợp lệ", "  "]

    with pytest.raises(ValueError, match="examples_vi"):
        validate_nine_windows_data(data)


def test_empty_list_examples_is_valid() -> None:
    data = _make_valid_dataset()
    data["lenses"]["business"]["windows"][0]["examples_vi"] = []
    # Danh sách ví dụ rỗng [] là hợp lệ, không raise exception
    validate_nine_windows_data(data)


def test_missing_optional_fields_is_valid() -> None:
    data = _make_valid_dataset()
    # label_en và examples_vi là các trường tùy chọn, có thể vắng mặt
    del data["lenses"]["business"]["windows"][0]["label_en"]
    del data["lenses"]["business"]["windows"][0]["examples_vi"]
    validate_nine_windows_data(data)


# ──────────────────────────────────────────────
# 7. Xử lý lỗi nạp file (I/O & JSONDecodeError) an toàn
# ──────────────────────────────────────────────

def test_loader_os_error_handled_gracefully() -> None:
    with patch("builtins.open", side_effect=OSError("Lỗi truy xuất ổ đĩa")), \
         patch("pathlib.Path.exists", return_value=True):
        # Nạp dữ liệu không raise exception sập server
        result = load_nine_windows_data()
        assert result == {} or result is None


def test_loader_json_decode_error_handled_gracefully() -> None:
    bad_json = "{\n  invalid json syntax..."
    with patch("builtins.open", mock_open(read_data=bad_json)), \
         patch("pathlib.Path.exists", return_value=True):
        # JSON lỗi cú pháp được xử lý an toàn
        result = load_nine_windows_data()
        assert result == {} or result is None


# ──────────────────────────────────────────────
# 8. Phân giải lưới 9 ô theo lăng kính
# ──────────────────────────────────────────────

def test_resolver_returns_correct_lens_grid() -> None:
    valid_data = _make_valid_dataset()
    with patch("app.services.triz_nine_windows_service._NINE_WINDOWS_DATA", valid_data):
        res = get_nine_windows("business")
        assert res["lens"] == "business"
        assert res["lens_title"] == "Lăng kính Business"
        assert len(res["grid"]) == 9
        assert res["meta"]["total_windows"] == 9

        # Thứ tự chuẩn: supersystem past -> present -> future -> system ...
        grid = res["grid"]
        assert grid[0]["level"] == "supersystem" and grid[0]["time"] == "past"
        assert grid[1]["level"] == "supersystem" and grid[1]["time"] == "present"
        assert grid[2]["level"] == "supersystem" and grid[2]["time"] == "future"
        assert grid[3]["level"] == "system" and grid[3]["time"] == "past"
        assert grid[4]["level"] == "system" and grid[4]["time"] == "present"
        assert grid[5]["level"] == "system" and grid[5]["time"] == "future"
        assert grid[6]["level"] == "subsystem" and grid[6]["time"] == "past"
        assert grid[7]["level"] == "subsystem" and grid[7]["time"] == "present"
        assert grid[8]["level"] == "subsystem" and grid[8]["time"] == "future"


def test_resolver_rejects_invalid_lens() -> None:
    valid_data = _make_valid_dataset()
    with patch("app.services.triz_nine_windows_service._NINE_WINDOWS_DATA", valid_data):
        with pytest.raises(ValueError, match="invalid_lens"):
            get_nine_windows("invalid_lens")
