"""
triz_nine_windows_service.py — Dịch vụ nạp, kiểm thực fail-closed và phân giải TRIZ 9-Windows.

Mô hình 9 Màn hình (System Operator / Multi-Screen Scheme):
  - 3 Cấp độ hệ thống (System Levels): supersystem, system, subsystem
  - 3 Chân trời thời gian (Time Horizons): past, present, future
  - 3 Lăng kính (Lenses): engineering, business, everyday

Tuân thủ nghiêm ngặt:
  - Fail-closed validation: từ chối dữ liệu thiếu/sai/rỗng bằng ValueError.
  - Xử lý lỗi I/O & JSONDecodeError an toàn (graceful fallback).
  - Trả về đúng 9 ô theo thứ tự chuẩn canonical.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_VALID_LENSES = ("engineering", "business", "everyday")
_VALID_LEVELS = ("supersystem", "system", "subsystem")
_VALID_TIMES = ("past", "present", "future")

_CANONICAL_GRID_ORDER: list[tuple[str, str]] = [
    ("supersystem", "past"),
    ("supersystem", "present"),
    ("supersystem", "future"),
    ("system", "past"),
    ("system", "present"),
    ("system", "future"),
    ("subsystem", "past"),
    ("subsystem", "present"),
    ("subsystem", "future"),
]

# Module-level data holder for 9-windows, allows unittest.mock.patch isolation
_NINE_WINDOWS_DATA: dict[str, Any] | None = None


def validate_nine_windows_data(data: dict[str, Any]) -> None:
    """
    Xác thực bộ dữ liệu 9-Windows theo nguyên tắc fail-closed.
    Ném ra ValueError với thông điệp rõ ràng nếu phát hiện bất kỳ sai lệch cấu trúc nào.
    """
    if not isinstance(data, dict):
        raise ValueError("Root data must be a dictionary")

    lenses = data.get("lenses")
    if not isinstance(lenses, dict):
        raise ValueError("Missing or invalid 'lenses' dictionary in root data")

    expected_lenses = set(_VALID_LENSES)
    actual_lenses = set(lenses.keys())
    if actual_lenses != expected_lenses:
        raise ValueError(
            f"Lenses must contain exactly {sorted(expected_lenses)}, but found {sorted(actual_lenses)}"
        )

    for lens_name, lens_content in lenses.items():
        if not isinstance(lens_content, dict):
            raise ValueError(f"Lens '{lens_name}' must be a dictionary")

        lens_title = lens_content.get("lens_title")
        if not isinstance(lens_title, str) or not lens_title.strip():
            raise ValueError(f"Lens '{lens_name}' must have a non-empty 'lens_title'")

        windows = lens_content.get("windows")
        if not isinstance(windows, list) or len(windows) != 9:
            found_count = len(windows) if isinstance(windows, list) else 0
            raise ValueError(f"Lens '{lens_name}' must contain exactly 9 windows, found {found_count}")

        seen_coords: set[tuple[str, str]] = set()

        for idx, cell in enumerate(windows):
            if not isinstance(cell, dict):
                raise ValueError(f"Window #{idx} in lens '{lens_name}' must be a dictionary")

            lvl = cell.get("level")
            if lvl not in _VALID_LEVELS:
                raise ValueError(
                    f"Invalid level '{lvl}' in window #{idx} of lens '{lens_name}'. "
                    f"Must be one of {_VALID_LEVELS}"
                )

            tm = cell.get("time")
            if tm not in _VALID_TIMES:
                raise ValueError(
                    f"Invalid time '{tm}' in window #{idx} of lens '{lens_name}'. "
                    f"Must be one of {_VALID_TIMES}"
                )

            coord = (lvl, tm)
            if coord in seen_coords:
                raise ValueError(
                    f"Phát hiện trùng lặp (duplicate) tọa độ {coord} trong lens '{lens_name}'"
                )
            seen_coords.add(coord)

            # Kiểm tra các trường tiếng Việt bắt buộc
            for field in ("label_vi", "prompt_vi", "description_vi"):
                val = cell.get(field)
                if not isinstance(val, str) or not val.strip():
                    raise ValueError(
                        f"Trường '{field}' bị rỗng hoặc không hợp lệ trong cell {coord} của lens '{lens_name}'"
                    )

            # Kiểm tra trường tùy chọn label_en
            if "label_en" in cell and cell["label_en"] is not None:
                if not isinstance(cell["label_en"], str):
                    raise ValueError(
                        f"Trường 'label_en' phải là string trong cell {coord} của lens '{lens_name}'"
                    )

            # Kiểm tra trường tùy chọn examples_vi
            if "examples_vi" in cell and cell["examples_vi"] is not None:
                ex = cell["examples_vi"]
                if not isinstance(ex, list):
                    raise ValueError(
                        f"Trường 'examples_vi' phải là list trong cell {coord} của lens '{lens_name}'"
                    )
                for ex_item in ex:
                    if not isinstance(ex_item, str) or not ex_item.strip():
                        raise ValueError(
                            f"Phần tử trong 'examples_vi' phải là chuỗi không rỗng trong cell {coord} của lens '{lens_name}'"
                        )

        all_coords = {(l, t) for l in _VALID_LEVELS for t in _VALID_TIMES}
        if seen_coords != all_coords:
            raise ValueError(
                f"Lens '{lens_name}' thiếu các tọa độ: {sorted(all_coords - seen_coords)}"
            )


def load_nine_windows_data() -> dict[str, Any]:
    """
    Nạp dữ liệu từ file JSON backend/src/app/data/triz_nine_windows.json.
    - Validate dữ liệu trước khi trả về.
    - Xử lý an toàn các lỗi OSError, FileNotFoundError, JSONDecodeError (ghi log, trả {}).
    - ValueError từ validator được ném ra ngoài để đảm bảo tính fail-closed.
    """
    data_path = Path(__file__).resolve().parent.parent / "data" / "triz_nine_windows.json"
    if not data_path.exists():
        logger.warning("TRIZ 9-windows data file not found at %s", data_path)
        return {}

    try:
        with open(data_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Failed to read or parse TRIZ 9-windows data at %s: %s", data_path, e)
        return {}

    validate_nine_windows_data(data)
    return data


def get_nine_windows(lens: str = "engineering") -> dict[str, Any]:
    """
    Phân giải lưới 9 ô của lăng kính chỉ định theo đúng thứ tự chuẩn canonical.
    Ném ValueError nếu lens không hợp lệ hoặc dữ liệu không sẵn sàng.
    """
    if lens not in _VALID_LENSES:
        raise ValueError(f"Invalid lens '{lens}'. Must be one of {_VALID_LENSES}")

    import sys
    current_module = sys.modules[__name__]
    data = getattr(current_module, "_NINE_WINDOWS_DATA", None)
    if not data:
        data = load_nine_windows_data()

    if not data or "lenses" not in data or lens not in data["lenses"]:
        raise ValueError(f"No valid data available for lens '{lens}'")

    lens_data = data["lenses"][lens]
    windows = lens_data.get("windows", [])

    coord_to_cell = {(cell.get("level"), cell.get("time")): cell for cell in windows}
    grid = [coord_to_cell[coord] for coord in _CANONICAL_GRID_ORDER if coord in coord_to_cell]
    if len(grid) != 9:
        raise ValueError(
            f"Nine-windows grid for lens '{lens}' is incomplete or unordered; "
            f"expected 9 canonical cells, found {len(grid)}"
        )

    return {
        "lens": lens,
        "lens_title": lens_data.get("lens_title", f"Lăng kính {lens.capitalize()}"),
        "grid": grid,
        "meta": {
            "total_windows": len(grid),
            "system_levels": list(_VALID_LEVELS),
            "time_horizons": list(_VALID_TIMES),
        },
    }
