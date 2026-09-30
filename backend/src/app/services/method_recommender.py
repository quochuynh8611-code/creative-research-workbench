"""
method_recommender.py — Core Domain Service cho Phase 4 & 6.3: TRIZ Method & 40 Principles Recommendation

Nhiệm vụ:
  1. Gợi ý các phương pháp / nguyên tắc sáng tạo TRIZ (Đầy đủ 40 Inventive Principles)
     dựa trên mâu thuẫn kỹ thuật / vật lý của ProblemFrame trong ResearchSession.
  2. Cung cấp đầy đủ metadata: title, description, explanation, examples.
  3. Tái sử dụng dữ liệu đã phân tích và lưu trữ trong Contradiction entity.

Ref: docs/ADR-001-architecture.md, docs/DOMAIN_SCHEMA.md, docs/PHASE_6_7_EXECUTION_SPEC.md
"""
from __future__ import annotations

import json
import logging
import pathlib
import uuid
from typing import Any

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.models import Contradiction, ProblemFrame, ResearchSession

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────
# Tải Dữ liệu Chuẩn 40 Nguyên Tắc Sáng Tạo TRIZ
# ──────────────────────────────────────────────

_DATA_DIR = pathlib.Path(__file__).parent.parent / "data"
_MATRIX_JSON_PATH = _DATA_DIR / "triz_matrix_39x39.json"

_PRINCIPLES_METADATA: dict[int, dict[str, Any]] = {}


def _load_principles_metadata() -> None:
    global _PRINCIPLES_METADATA
    if not _MATRIX_JSON_PATH.exists():
        raise RuntimeError(f"TRIZ matrix file not found at {_MATRIX_JSON_PATH}")
    try:
        with open(_MATRIX_JSON_PATH, "r", encoding="utf-8") as _f:
            _data = json.load(_f)
    except Exception as _e:
        raise RuntimeError(f"Failed to parse TRIZ principles JSON at {_MATRIX_JSON_PATH}: {_e}") from _e

    _raw_principles = _data.get("principles", {})
    if not isinstance(_raw_principles, dict) or len(_raw_principles) != 40:
        raise RuntimeError(f"Dữ liệu 'principles' không đủ 40 nguyên tắc trong {_MATRIX_JSON_PATH}")

    for _k, _v in _raw_principles.items():
        if str(_k).isdigit():
            _p_id = int(_k)
            _PRINCIPLES_METADATA[_p_id] = _v


_load_principles_metadata()


# Danh mục 40 nguyên tắc sáng tạo TRIZ (Fallback cơ bản)
_PRINCIPLES_MAP_FALLBACK: dict[int, str] = {
    1: "Segmentation (Phân đoạn)",
    2: "Taking out / Extraction (Tách rời)",
    3: "Local quality (Chất lượng cục bộ)",
    4: "Asymmetry (Bất đối xứng)",
    5: "Consolidation / Merging (Kết hợp)",
    6: "Universality (Vạn năng)",
    7: "Nested doll (Chứa trong)",
    8: "Anti-weight (Phản trọng lượng)",
    9: "Preliminary anti-action (Gây ứng suất sơ bộ)",
    10: "Preliminary action (Tác động sơ bộ)",
    11: "Beforehand cushioning (Dự phòng trước)",
    12: "Equipotentiality (Đẳng thế)",
    13: "The other way round (Làm ngược lại)",
    14: "Spheroidality - Curvature (Cầu hóa)",
    15: "Dynamization (Linh hoạt hóa)",
    16: "Partial or excessive actions (Tác động một phần hoặc quá mức)",
    17: "Another dimension (Chuyển sang chiều khác)",
    18: "Mechanical vibration (Sử dụng dao động cơ học)",
    19: "Periodic action (Tác động chu kỳ)",
    20: "Continuity of useful action (Liên tục tác động có ích)",
    21: "Skipping / Rushing through (Vượt nhanh)",
    22: "Blessing in disguise (Biến hại thành lợi)",
    23: "Feedback (Phản hồi)",
    24: "Intermediary (Trung gian)",
    25: "Self-service (Tự phục vụ)",
    26: "Copying (Sao chép)",
    27: "Cheap short-living objects (Thay thế bằng vật rẻ tiền)",
    28: "Mechanics substitution (Thay thế sơ đồ cơ học)",
    29: "Pneumatics and hydraulics (Chất lỏng và khí)",
    30: "Flexible shells and thin films (Màng dẻo và màng mỏng)",
    31: "Porous materials (Sử dụng vật liệu xốp)",
    32: "Color changes (Thay đổi màu sắc)",
    33: "Homogeneity (Đồng nhất)",
    34: "Discarding and recovering (Phân hủy và tái sinh)",
    35: "Parameter changes (Chuyển đổi thông số)",
    36: "Phase transitions (Chuyển pha)",
    37: "Thermal expansion (Giãn nở nhiệt)",
    38: "Strong oxidants (Chất oxy hóa mạnh)",
    39: "Inert atmosphere (Môi trường trơ)",
    40: "Composite materials (Vật liệu composite)",
}


class MethodRecommender:
    """
    Service gợi ý phương pháp giải quyết mâu thuẫn cho ResearchSession.

    Hỗ trợ đa hình bind: Engine hoặc Session.
    """

    def __init__(self, bind: Engine | Session) -> None:
        if isinstance(bind, Session):
            self._session: Session | None = bind
            self._engine: Engine | None = None
        else:
            self._session = None
            self._engine = bind

    def _get_db_session(self) -> tuple[Session, bool]:
        """Trả về (session, should_close)."""
        if self._session is not None:
            return self._session, False
        if self._engine is not None:
            return Session(self._engine), True
        raise RuntimeError("MethodRecommender không có Engine hoặc Session hợp lệ.")

    def recommend_methods(self, session_id: uuid.UUID | str) -> list[dict[str, Any]]:
        """
        Tính toán và gợi ý các nguyên tắc sáng tạo TRIZ phù hợp với mâu thuẫn của session
        kèm đầy đủ metadata giải thích và ví dụ minh họa.

        Args:
            session_id: ID của ResearchSession.

        Returns:
            Danh sách các dict chứa thông tin nguyên tắc gợi ý.
        """
        session_uuid = uuid.UUID(str(session_id))
        db, should_close = self._get_db_session()
        try:
            # Tìm ProblemFrame mới nhất của session
            frame = (
                db.query(ProblemFrame)
                .filter_by(session_id=session_uuid)
                .order_by(ProblemFrame.created_at.desc())
                .first()
            )
            if not frame:
                return []

            # Tìm Contradiction gắn với ProblemFrame
            contradiction = (
                db.query(Contradiction)
                .filter_by(problem_frame_id=frame.id)
                .first()
            )
            if not contradiction or not contradiction.suggested_principles:
                return []

            recommendations: list[dict[str, Any]] = []
            for p_num in contradiction.suggested_principles:
                meta = _PRINCIPLES_METADATA.get(p_num)
                if meta:
                    title = meta.get("name_vi", _PRINCIPLES_MAP_FALLBACK.get(p_num, f"Principle {p_num}"))
                    description = meta.get("description", f"Nguyên tắc sáng tạo TRIZ số {p_num}: {title}")
                    explanation = meta.get("explanation", f"Áp dụng nguyên tắc #{p_num} để giải quyết mâu thuẫn.")
                    examples = meta.get("examples", [])
                    name_en = meta.get("name_en", "")
                    name_vi = meta.get("name_vi", "")
                else:
                    title = _PRINCIPLES_MAP_FALLBACK.get(p_num, f"Principle {p_num}")
                    description = f"Nguyên tắc sáng tạo TRIZ số {p_num}: {title}"
                    explanation = f"Áp dụng nguyên tắc #{p_num} ({title}) để giải quyết mâu thuẫn kỹ thuật."
                    examples = []
                    name_en = ""
                    name_vi = title

                recommendations.append({
                    "id": p_num,
                    "principle_id": p_num,
                    "principle": p_num,
                    "title": title,
                    "name_vi": name_vi,
                    "name_en": name_en,
                    "description": description,
                    "explanation": explanation,
                    "examples": examples,
                })
            return recommendations
        finally:
            if should_close:
                db.close()
