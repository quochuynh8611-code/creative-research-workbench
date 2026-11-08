"""
everyday_triz_lens.py — Everyday TRIZ Lens Service (Phase 2A)

Nhiệm vụ:
  1. Tải và cung cấp lăng kính đời thường (Everyday Lens) cho 40 nguyên tắc sáng tạo và 39 thông số TRIZ.
  2. Bổ sung các trường giải thích dễ hiểu, ví dụ đời sống (thói quen, học tập, gia đình, công việc) và câu hỏi gợi mở hành động.
  3. Hoàn toàn backward-compatible, không can thiệp vào ma trận toán học tất định Altshuller 1985.
"""
from __future__ import annotations

import json
import logging
import pathlib
from typing import Any

logger = logging.getLogger(__name__)

_DATA_DIR = pathlib.Path(__file__).parent.parent / "data"
_LENS_JSON_PATH = _DATA_DIR / "everyday_triz_lens.json"


class EverydayTrizLens:
    """Service cung cấp góc nhìn đời sống thường nhật cho 40 nguyên tắc và 39 thông số TRIZ."""

    def __init__(self, json_path: pathlib.Path | None = None) -> None:
        self._path = json_path or _LENS_JSON_PATH
        self._principles: dict[int, dict[str, Any]] = {}
        self._parameters: dict[int, dict[str, Any]] = {}
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            logger.warning("Everyday TRIZ lens file not found at %s", self._path)
            return

        try:
            with open(self._path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            logger.error("Failed to load everyday TRIZ lens from %s: %s", self._path, exc)
            return

        for k, v in data.get("principles", {}).items():
            if str(k).isdigit():
                self._principles[int(k)] = v

        for k, v in data.get("parameters", {}).items():
            if str(k).isdigit():
                self._parameters[int(k)] = v

    def get_principle_lens(self, principle_id: int) -> dict[str, Any]:
        """Lấy thông tin lăng kính đời sống của một nguyên tắc (1..40)."""
        if not isinstance(principle_id, int) or principle_id < 1 or principle_id > 40:
            return {}
        return dict(self._principles.get(principle_id, {}))

    def get_parameter_lens(self, param_id: int) -> dict[str, Any]:
        """Lấy diễn giải đời sống của một thông số kỹ thuật (1..39)."""
        if not isinstance(param_id, int) or param_id < 1 or param_id > 39:
            return {}
        return dict(self._parameters.get(param_id, {}))

    def enrich_principle(self, principle_id: int, target: dict[str, Any]) -> dict[str, Any]:
        """Làm giàu một dict principle với các trường đời sống."""
        lens = self.get_principle_lens(principle_id)
        if lens:
            target["everyday_title"] = lens.get("everyday_title", "")
            target["daily_application"] = lens.get("daily_application", "")
            target["daily_examples"] = lens.get("daily_examples", [])
            target["action_prompt"] = lens.get("action_prompt", "")
        else:
            target.setdefault("everyday_title", "")
            target.setdefault("daily_application", "")
            target.setdefault("daily_examples", [])
            target.setdefault("action_prompt", "")
        return target

    def enrich_parameter(self, param_id: int, target: dict[str, Any]) -> dict[str, Any]:
        """Làm giàu một dict parameter với everyday_label."""
        lens = self.get_parameter_lens(param_id)
        if lens:
            target["everyday_label"] = lens.get("everyday_label", "")
        else:
            target.setdefault("everyday_label", "")
        return target


_DEFAULT_LENS: EverydayTrizLens | None = None


def get_everyday_triz_lens() -> EverydayTrizLens:
    """Singleton accessor cho EverydayTrizLens."""
    global _DEFAULT_LENS
    if _DEFAULT_LENS is None:
        _DEFAULT_LENS = EverydayTrizLens()
    return _DEFAULT_LENS
