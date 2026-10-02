"""
cross_session_discovery_service.py — Service tìm kiếm tri thức tương đồng giữa các Research Sessions.

Specification:
  - Spec: docs/PHASE_10_2_CROSS_SESSION_DISCOVERY_SPEC.md
  - Features:
      - Deterministic Structural Scoring dựa trên TRIZ parameters, contradiction type, domain, và suggested principles.
      - Loại trừ session nguồn (no self-match).
      - Loại trừ archived sessions.
      - Eager loading chống N+1 query.
      - Xử lý biên deterministic cho session chưa có problem_frame.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import Engine, select
from sqlalchemy.orm import Session, joinedload

from app.domain.models import (
    Contradiction,
    ContradictionType,
    ProblemFrame,
    ResearchSession,
    SessionStatus,
)

logger = logging.getLogger(__name__)


class SessionNotFoundError(Exception):
    """Ném ra khi session_id không tồn tại trong database."""
    pass


@dataclass
class MatchedSessionItem:
    session_id: str
    title: str
    domain: Optional[str]
    status: str
    similarity_score: float
    match_reasons: list[str]
    shared_parameters: dict[str, Any]
    created_at: Optional[str]


@dataclass
class CrossSessionDiscoveryResult:
    source_session_id: str
    has_problem_frame: bool
    reason: Optional[str]
    matched_sessions: list[MatchedSessionItem]
    total_candidates_analyzed: int
    latency_ms: float = 0.0


class CrossSessionDiscoveryService:
    """
    Service phân tích và khám phá các session tương đồng dựa trên cấu trúc bài toán TRIZ.
    """

    def __init__(self, bind: Engine | Session) -> None:
        if isinstance(bind, Session):
            self._session: Optional[Session] = bind
            self._engine: Optional[Engine] = None
        else:
            self._session = None
            self._engine = bind

    def _get_db_session(self) -> Session:
        if self._session is not None:
            return self._session
        if self._engine is not None:
            return Session(bind=self._engine)
        raise RuntimeError("No database engine or session bound to CrossSessionDiscoveryService")

    def discover_related_sessions(
        self,
        session_id: uuid.UUID,
        top_k: int = 5,
        min_score: float = 0.1,
    ) -> CrossSessionDiscoveryResult:
        """
        Tìm kiếm các session tương đồng với session_id nguồn.
        """
        db = self._get_db_session()
        should_close = self._session is None

        try:
            # 1. Fetch source session với eager load problem_frames & contradictions
            stmt_source = (
                select(ResearchSession)
                .options(
                    joinedload(ResearchSession.problem_frames).joinedload(ProblemFrame.contradictions)
                )
                .where(ResearchSession.id == session_id)
            )
            source_session = db.execute(stmt_source).unique().scalar_one_or_none()

            if source_session is None:
                raise SessionNotFoundError(f"Session with id '{session_id}' not found")

            # 2. Kiểm tra nếu source session chưa có problem_frame
            if not source_session.problem_frames:
                return CrossSessionDiscoveryResult(
                    source_session_id=str(session_id),
                    has_problem_frame=False,
                    reason="no_problem_frame",
                    matched_sessions=[],
                    total_candidates_analyzed=0,
                )

            # Lấy problem frame mới nhất của source session
            source_pf = sorted(
                source_session.problem_frames,
                key=lambda pf: pf.created_at if pf.created_at else datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )[0]

            # Trích xuất đặc trưng nguồn
            src_improving = (source_pf.improving_parameter or "").strip()
            src_worsening = (source_pf.worsening_parameter or "").strip()
            src_contra_type = (
                source_pf.contradiction_type.value
                if hasattr(source_pf.contradiction_type, "value")
                else str(source_pf.contradiction_type)
            )
            src_domain = (source_pf.domain or "").strip().lower()

            src_principles: set[int] = set()
            for c in source_pf.contradictions:
                if c.suggested_principles:
                    src_principles.update(c.suggested_principles)

            # 3. Query toàn bộ candidate sessions (trừ self, trừ archived) trong 1 query duy nhất
            stmt_candidates = (
                select(ResearchSession)
                .options(
                    joinedload(ResearchSession.problem_frames).joinedload(ProblemFrame.contradictions)
                )
                .where(
                    ResearchSession.id != session_id,
                    ResearchSession.status != SessionStatus.archived,
                )
            )
            candidates = db.execute(stmt_candidates).unique().scalars().all()

            matched_items: list[MatchedSessionItem] = []
            total_analyzed = 0

            for cand in candidates:
                if not cand.problem_frames:
                    continue

                total_analyzed += 1
                cand_pf = sorted(
                    cand.problem_frames,
                    key=lambda pf: pf.created_at if pf.created_at else datetime.min.replace(tzinfo=timezone.utc),
                    reverse=True,
                )[0]

                score, reasons, shared_params = self._compute_similarity(
                    src_improving=src_improving,
                    src_worsening=src_worsening,
                    src_contra_type=src_contra_type,
                    src_domain=src_domain,
                    src_principles=src_principles,
                    cand_pf=cand_pf,
                )

                if score >= min_score:
                    status_str = (
                        cand.status.value
                        if hasattr(cand.status, "value")
                        else str(cand.status)
                    )
                    created_iso = cand.created_at.isoformat() if cand.created_at else None

                    matched_items.append(
                        MatchedSessionItem(
                            session_id=str(cand.id),
                            title=cand.title,
                            domain=cand_pf.domain,
                            status=status_str,
                            similarity_score=score,
                            match_reasons=reasons,
                            shared_parameters=shared_params,
                            created_at=created_iso,
                        )
                    )

            # 4. Sắp xếp ổn định (Score DESC, Created_at DESC, ID ASC)
            matched_items.sort(
                key=lambda item: (
                    -item.similarity_score,
                    -(datetime.fromisoformat(item.created_at).timestamp() if item.created_at else 0.0),
                    item.session_id,
                )
            )

            # 5. Cắt top_k
            final_matches = matched_items[:top_k]

            return CrossSessionDiscoveryResult(
                source_session_id=str(session_id),
                has_problem_frame=True,
                reason=None,
                matched_sessions=final_matches,
                total_candidates_analyzed=total_analyzed,
            )

        finally:
            if should_close:
                db.close()

    @staticmethod
    def _compute_similarity(
        src_improving: str,
        src_worsening: str,
        src_contra_type: str,
        src_domain: str,
        src_principles: set[int],
        cand_pf: ProblemFrame,
    ) -> tuple[float, list[str], dict[str, Any]]:
        """
        Tính toán Structural Similarity Score theo mô hình trọng số xác định.
        """
        score = 0.0
        reasons: list[str] = []
        shared_params: dict[str, Any] = {}

        cand_improving = (cand_pf.improving_parameter or "").strip()
        cand_worsening = (cand_pf.worsening_parameter or "").strip()
        cand_contra_type = (
            cand_pf.contradiction_type.value
            if hasattr(cand_pf.contradiction_type, "value")
            else str(cand_pf.contradiction_type)
        )
        cand_domain = (cand_pf.domain or "").strip().lower()

        cand_principles: set[int] = set()
        for c in cand_pf.contradictions:
            if c.suggested_principles:
                cand_principles.update(c.suggested_principles)

        # 1. Improving Parameter (Weight: 0.25)
        if src_improving and cand_improving and src_improving.lower() == cand_improving.lower():
            score += 0.25
            reasons.append(f"Trùng thông số cải thiện: {cand_improving}")
            shared_params["improving_parameter"] = cand_improving

        # 2. Worsening Parameter (Weight: 0.25)
        if src_worsening and cand_worsening and src_worsening.lower() == cand_worsening.lower():
            score += 0.25
            reasons.append(f"Trùng thông số xấu đi: {cand_worsening}")
            shared_params["worsening_parameter"] = cand_worsening

        # 3. Contradiction Type (Weight: 0.20)
        if (
            src_contra_type not in ("unknown", "none")
            and cand_contra_type not in ("unknown", "none")
            and src_contra_type.lower() == cand_contra_type.lower()
        ):
            score += 0.20
            reasons.append(f"Trùng loại mâu thuẫn: {cand_contra_type}")
            shared_params["contradiction_type"] = cand_contra_type

        # 4. Domain (Weight: 0.15)
        if src_domain and cand_domain and src_domain == cand_domain:
            score += 0.15
            reasons.append(f"Cùng lĩnh vực: {cand_pf.domain}")

        # 5. Suggested Principles Overlap (Weight: 0.15)
        if src_principles and cand_principles:
            intersection = src_principles.intersection(cand_principles)
            union = src_principles.union(cand_principles)
            if union and intersection:
                jaccard = len(intersection) / len(union)
                score += round(jaccard * 0.15, 4)
                sorted_shared = sorted(list(intersection))
                shared_params["shared_principles"] = sorted_shared
                reasons.append(
                    f"Trùng {len(sorted_shared)} nguyên tắc TRIZ đề xuất (#{', #'.join(map(str, sorted_shared))})"
                )

        return round(min(score, 1.0), 4), reasons, shared_params
