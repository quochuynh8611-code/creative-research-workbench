"""
business_triz_lens.py — Business-TRIZ Lens Service (Batch B1)

Nhiệm vụ:
  1. Cung cấp lăng kính Kinh doanh (Business-TRIZ Lens) cho 40 nguyên tắc sáng tạo và 39 thông số TRIZ.
  2. Xác thực fail-closed dữ liệu JSON (đúng 39 parameters, 40 principles, non-empty text, valid examples).
  3. Hoàn toàn backward-compatible, mang tính additive, không can thiệp vào ma trận toán học Altshuller 1985.
"""
from __future__ import annotations

import json
import logging
import pathlib
from typing import Any

logger = logging.getLogger(__name__)

_DATA_DIR = pathlib.Path(__file__).parent.parent / "data"
_BUSINESS_JSON_PATH = _DATA_DIR / "business_triz_lens.json"

_VALID_PARAM_KEYS = {str(i) for i in range(1, 40)}
_VALID_PRINCIPLE_KEYS = {str(i) for i in range(1, 41)}


def validate_business_triz_lens_data(data: dict[str, Any]) -> None:
    """
    Xác thực tính toàn vẹn fail-closed của dữ liệu Business-TRIZ lens.
    Bắt buộc đúng 39 parameters, 40 principles, key hợp lệ và các trường bắt buộc non-empty.
    """
    if not isinstance(data, dict):
        raise ValueError("Dữ liệu Business-TRIZ lens phải là một dictionary JSON hợp lệ.")

    if "parameters" not in data or not isinstance(data["parameters"], dict):
        raise ValueError("Thiếu trường 'parameters' hoặc dữ liệu không phải dictionary.")

    if "principles" not in data or not isinstance(data["principles"], dict):
        raise ValueError("Thiếu trường 'principles' hoặc dữ liệu không phải dictionary.")

    params = data["parameters"]
    principles = data["principles"]

    if len(params) != 39:
        raise ValueError(
            f"Dữ liệu phải có chính xác 39 parameters (tìm thấy: {len(params)})."
        )

    if len(principles) != 40:
        raise ValueError(
            f"Dữ liệu phải có chính xác 40 principles (tìm thấy: {len(principles)})."
        )

    for k, v in params.items():
        if k not in _VALID_PARAM_KEYS:
            raise ValueError(f"Key parameter không hợp lệ: '{k}'. Phải thuộc 1..39.")
        if not isinstance(v, dict):
            raise ValueError(f"Giá trị parameter '{k}' phải là một dictionary.")
        label = v.get("business_label")
        if not isinstance(label, str) or not label.strip():
            raise ValueError(f"Parameter '{k}' thiếu trường 'business_label' hoặc chuỗi rỗng.")

    for k, v in principles.items():
        if k not in _VALID_PRINCIPLE_KEYS:
            raise ValueError(f"Key principle không hợp lệ: '{k}'. Phải thuộc 1..40.")
        if not isinstance(v, dict):
            raise ValueError(f"Giá trị principle '{k}' phải là một dictionary.")

        title = v.get("business_title")
        if not isinstance(title, str) or not title.strip():
            raise ValueError(f"Principle '{k}' thiếu trường 'business_title' hoặc chuỗi rỗng.")

        app = v.get("business_application")
        if not isinstance(app, str) or not app.strip():
            raise ValueError(f"Principle '{k}' thiếu trường 'business_application' hoặc chuỗi rỗng.")

        prompt = v.get("business_action_prompt")
        if not isinstance(prompt, str) or not prompt.strip():
            raise ValueError(f"Principle '{k}' thiếu trường 'business_action_prompt' hoặc chuỗi rỗng.")

        examples = v.get("business_examples")
        if not isinstance(examples, list) or len(examples) == 0:
            raise ValueError(f"Principle '{k}' thiếu 'business_examples' hoặc danh sách rỗng.")

        for ex in examples:
            if not isinstance(ex, str) or not ex.strip():
                raise ValueError(
                    f"Principle '{k}' chứa phần tử 'business_examples' rỗng hoặc không phải string."
                )


class BusinessTrizLens:
    """Service cung cấp góc nhìn kinh doanh & quản trị cho 40 nguyên tắc và 39 thông số TRIZ."""

    def __init__(self, json_path: pathlib.Path | None = None) -> None:
        self._path = json_path or _BUSINESS_JSON_PATH
        self._principles: dict[int, dict[str, Any]] = {}
        self._parameters: dict[int, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            logger.warning("Business TRIZ lens file not found at %s", self._path)
            return

        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (OSError, json.JSONDecodeError) as exc:
            logger.error("Failed to load business TRIZ lens from %s: %s", self._path, exc)
            return

        # Fail-closed: validation error MUST propagate
        validate_business_triz_lens_data(data)

        for k, v in data.get("principles", {}).items():
            if str(k).isdigit():
                self._principles[int(k)] = v

        for k, v in data.get("parameters", {}).items():
            if str(k).isdigit():
                self._parameters[int(k)] = v

    def get_principle_lens(self, principle_id: int) -> dict[str, Any]:
        """Lấy thông tin lăng kính kinh doanh của một nguyên tắc (1..40)."""
        if not isinstance(principle_id, int) or principle_id < 1 or principle_id > 40:
            return {}
        return dict(self._principles.get(principle_id, {}))

    def get_parameter_lens(self, param_id: int) -> dict[str, Any]:
        """Lấy diễn giải kinh doanh của một thông số kỹ thuật (1..39)."""
        if not isinstance(param_id, int) or param_id < 1 or param_id > 39:
            return {}
        return dict(self._parameters.get(param_id, {}))

    def enrich_principle(self, principle_id: int, target: dict[str, Any]) -> dict[str, Any]:
        """Làm giàu một dict principle với các trường kinh doanh."""
        lens = self.get_principle_lens(principle_id)
        if lens:
            target["business_title"] = lens.get("business_title", "")
            target["business_application"] = lens.get("business_application", "")
            target["business_examples"] = lens.get("business_examples", [])
            target["business_action_prompt"] = lens.get("business_action_prompt", "")
        else:
            target.setdefault("business_title", "")
            target.setdefault("business_application", "")
            target.setdefault("business_examples", [])
            target.setdefault("business_action_prompt", "")
        return target

    def enrich_parameter(self, param_id: int, target: dict[str, Any]) -> dict[str, Any]:
        """Làm giàu một dict parameter với business_label."""
        lens = self.get_parameter_lens(param_id)
        if lens:
            target["business_label"] = lens.get("business_label", "")
        else:
            target.setdefault("business_label", "")
        return target


_DEFAULT_BUSINESS_LENS: BusinessTrizLens | None = None


def get_business_triz_lens() -> BusinessTrizLens:
    """Singleton accessor cho BusinessTrizLens."""
    global _DEFAULT_BUSINESS_LENS
    if _DEFAULT_BUSINESS_LENS is None:
        _DEFAULT_BUSINESS_LENS = BusinessTrizLens()
    return _DEFAULT_BUSINESS_LENS
