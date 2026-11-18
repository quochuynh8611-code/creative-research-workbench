"""
test_nine_windows_expansion.py — Unit test suite cho mở rộng 3 lăng kính mới của TRIZ 9-Windows (Batch C35).
Lăng kính mới: systems_thinking, design_thinking, lean_startup.
Tổng cộng đúng 6 lăng kính.
"""
from __future__ import annotations

from app.services.triz_nine_windows_service import (
    _CANONICAL_GRID_ORDER,
    _VALID_LENSES,
    _VALID_LEVELS,
    _VALID_TIMES,
    get_nine_windows,
    load_nine_windows_data,
    validate_nine_windows_data,
)

NEW_LENSES = ["systems_thinking", "design_thinking", "lean_startup"]
ALL_6_LENSES = ["engineering", "business", "everyday", "systems_thinking", "design_thinking", "lean_startup"]


def test_valid_lenses_constant_contains_all_6_lenses() -> None:
    """Xác nhận _VALID_LENSES định nghĩa đúng 6 lăng kính theo đặc tả Batch C35."""
    assert set(_VALID_LENSES) == set(ALL_6_LENSES)
    assert len(_VALID_LENSES) == 6


def test_triz_nine_windows_data_contains_all_6_lenses() -> None:
    """Xác nhận dữ liệu nạp từ triz_nine_windows.json chứa đủ 6 lăng kính."""
    data = load_nine_windows_data()
    assert "lenses" in data
    lenses_dict = data["lenses"]
    for lens in ALL_6_LENSES:
        assert lens in lenses_dict, f"Lăng kính '{lens}' thiếu trong file triz_nine_windows.json."


def test_new_lenses_contain_valid_9_windows() -> None:
    """Xác nhận mỗi lăng kính mới chứa đúng 9 ô tọa độ, bao phủ 3 levels x 3 times và không duplicate."""
    data = load_nine_windows_data()
    validate_nine_windows_data(data)

    for lens_name in NEW_LENSES:
        lens_obj = data["lenses"][lens_name]
        assert "lens_title" in lens_obj and len(lens_obj["lens_title"].strip()) > 0
        windows = lens_obj.get("windows", [])
        assert len(windows) == 9, f"Lăng kính '{lens_name}' phải có đúng 9 windows, thực tế: {len(windows)}"

        coords = [(w["level"], w["time"]) for w in windows]
        assert len(set(coords)) == 9, f"Lăng kính '{lens_name}' có tọa độ bị trùng lặp."
        for lvl, tm in coords:
            assert lvl in _VALID_LEVELS
            assert tm in _VALID_TIMES


def test_get_nine_windows_for_new_lenses() -> None:
    """Xác nhận get_nine_windows trả về đúng cấu trúc canonical cho 3 lăng kính mới."""
    for lens_name in NEW_LENSES:
        result = get_nine_windows(lens_name)
        assert result["lens"] == lens_name
        assert len(result["lens_title"].strip()) > 0
        grid = result["grid"]
        assert len(grid) == 9

        # Thứ tự chuẩn canonical grid order
        grid_coords = [(cell["level"], cell["time"]) for cell in grid]
        assert grid_coords == _CANONICAL_GRID_ORDER
