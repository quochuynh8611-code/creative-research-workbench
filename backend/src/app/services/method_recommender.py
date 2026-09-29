"""
method_recommender.py — Core Domain Service cho Phase 4: TRIZ Method & Principle Recommendation

Nhiệm vụ:
  1. Gợi ý các phương pháp / nguyên tắc sáng tạo TRIZ (40 Inventive Principles)
     dựa trên mâu thuẫn kỹ thuật / vật lý của ProblemFrame trong ResearchSession.
  2. Tái sử dụng dữ liệu đã phân tích và lưu trữ trong Contradiction entity.

Ref: docs/ADR-001-architecture.md, docs/DOMAIN_SCHEMA.md, docs/TEST_PLAN.md
"""
from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.models import Contradiction, ProblemFrame, ResearchSession

logger = logging.getLogger(__name__)

# Danh mục 40 nguyên tắc sáng tạo TRIZ (Mẫu thông dụng)
_PRINCIPLES_MAP: dict[int, str] = {
    1: "Segmentation (Phân đoạn)",
    2: "Taking out / Extraction (Tách rời)",
    3: "Local quality (Chất lượng cục bộ)",
    4: "Asymmetry (Bất đối xứng)",
    8: "Anti-weight (Phản trọng lượng)",
    10: "Preliminary action (Tác động sơ bộ)",
    13: "The other way round (Làm ngược lại)",
    14: "Spheroidality - Curvature (Cầu hóa)",
    15: "Dynamization (Linh hoạt hóa)",
    19: "Periodic action (Tác động chu kỳ)",
    28: "Mechanics substitution (Thay thế cơ học)",
    29: "Pneumatics and hydraulics (Khí nén và thủy lực)",
    32: "Color changes (Thay đổi màu sắc)",
    35: "Parameter changes (Chuyển đổi thông số)",
    38: "Strong oxidants (Chất oxy hóa mạnh)",
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
        Tính toán và gợi ý các nguyên tắc sáng tạo TRIZ phù hợp với mâu thuẫn của session.

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
                title = _PRINCIPLES_MAP.get(p_num, f"Principle {p_num}")
                recommendations.append({
                    "id": p_num,
                    "principle_id": p_num,
                    "principle": p_num,
                    "title": title,
                    "description": f"Nguyên tắc sáng tạo TRIZ số {p_num}: {title}",
                })
            return recommendations
        finally:
            if should_close:
                db.close()
