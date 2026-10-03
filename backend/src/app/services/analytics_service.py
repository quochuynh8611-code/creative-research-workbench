"""
analytics_service.py — Service tổng hợp dữ liệu phân tích hệ thống và nghiên cứu (Pure Read-Only).

Specification:
  - Feature: Session Analytics & Research Intelligence Overview
  - Endpoint: GET /api/v1/analytics/overview
  - Zero DB Mutation: Chỉ thực thi câu lệnh SELECT aggregation.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

from sqlalchemy import Engine, distinct, func
from sqlalchemy.orm import Session

from app.domain.models import (
    CandidateSolution,
    Chunk,
    Contradiction,
    ContradictionType,
    Document,
    ProblemFrame,
    ResearchNote,
    ResearchSession,
)

logger = logging.getLogger(__name__)


class AnalyticsService:
    """
    Service trích xuất và tổng hợp số liệu phân tích tổng quan cho toàn bộ workspace.
    Đảm bảo 100% read-only, không dirty session, không mutate dữ liệu.
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
        raise RuntimeError("No database engine or session bound to AnalyticsService")

    def get_overview(self) -> dict[str, Any]:
        """
        Thực hiện tổng hợp 4 nhóm số liệu: sessions, content, knowledge_base, triz.
        """
        db = self._get_db_session()
        try:
            # ──────────────────────────────────────────────
            # 1. Sessions Analytics
            # ──────────────────────────────────────────────
            total_sessions = db.query(func.count(ResearchSession.id)).scalar() or 0

            # by_status
            status_rows = (
                db.query(ResearchSession.status, func.count(ResearchSession.id))
                .group_by(ResearchSession.status)
                .all()
            )
            by_status = {
                (k.value if hasattr(k, "value") else str(k)): count
                for k, count in status_rows
                if k is not None
            }

            # by_workflow_state
            workflow_rows = (
                db.query(ResearchSession.workflow_state, func.count(ResearchSession.id))
                .group_by(ResearchSession.workflow_state)
                .all()
            )
            by_workflow_state = {
                str(k): count
                for k, count in workflow_rows
                if k is not None and str(k).strip() != ""
            }

            # by_domain (LEFT JOIN problem_frames, fallback 'unassigned')
            # Đếm distinct session_id gom nhóm theo domain
            domain_expr = func.coalesce(func.nullif(ProblemFrame.domain, ""), "unassigned")
            domain_rows = (
                db.query(domain_expr, func.count(distinct(ResearchSession.id)))
                .select_from(ResearchSession)
                .outerjoin(ProblemFrame, ProblemFrame.session_id == ResearchSession.id)
                .group_by(domain_expr)
                .all()
            )
            by_domain = (
                {
                    str(domain): count
                    for domain, count in domain_rows
                    if domain is not None
                }
                if total_sessions > 0
                else {}
            )

            # ──────────────────────────────────────────────
            # 2. Content Analytics
            # ──────────────────────────────────────────────
            total_problem_frames = db.query(func.count(ProblemFrame.id)).scalar() or 0
            total_research_notes = db.query(func.count(ResearchNote.id)).scalar() or 0

            notes_rows = (
                db.query(ResearchNote.note_type, func.count(ResearchNote.id))
                .group_by(ResearchNote.note_type)
                .all()
            )
            notes_by_type = {
                str(k): count
                for k, count in notes_rows
                if k is not None and str(k).strip() != ""
            }

            total_candidate_solutions = db.query(func.count(CandidateSolution.id)).scalar() or 0

            solutions_rows = (
                db.query(CandidateSolution.status, func.count(CandidateSolution.id))
                .group_by(CandidateSolution.status)
                .all()
            )
            solutions_by_status = {
                str(k): count
                for k, count in solutions_rows
                if k is not None and str(k).strip() != ""
            }

            # ──────────────────────────────────────────────
            # 3. Knowledge Base Analytics
            # ──────────────────────────────────────────────
            total_documents = db.query(func.count(Document.id)).scalar() or 0
            golden_documents = (
                db.query(func.count(Document.id))
                .filter(Document.golden.is_(True))
                .scalar()
                or 0
            )
            total_chunks = db.query(func.count(Chunk.id)).scalar() or 0

            # ──────────────────────────────────────────────
            # 4. TRIZ Analytics
            # Semantic Notes:
            # - total_contradictions: Số thực thể mâu thuẫn được trích xuất trong bảng Contradiction.
            # - by_contradiction_type: Phân bố loại mâu thuẫn từ bảng ProblemFrame của các bài toán nghiên cứu.
            # ──────────────────────────────────────────────
            total_contradictions = db.query(func.count(Contradiction.id)).scalar() or 0

            contradiction_type_rows = (
                db.query(ProblemFrame.contradiction_type, func.count(ProblemFrame.id))
                .filter(ProblemFrame.contradiction_type.notin_([ContradictionType.none, ContradictionType.unknown]))
                .group_by(ProblemFrame.contradiction_type)
                .all()
            )
            by_contradiction_type = {
                (k.value if hasattr(k, "value") else str(k)): count
                for k, count in contradiction_type_rows
                if k is not None
            }

            return {
                "sessions": {
                    "total": total_sessions,
                    "by_status": by_status,
                    "by_workflow_state": by_workflow_state,
                    "by_domain": by_domain,
                },
                "content": {
                    "total_problem_frames": total_problem_frames,
                    "total_research_notes": total_research_notes,
                    "notes_by_type": notes_by_type,
                    "total_candidate_solutions": total_candidate_solutions,
                    "solutions_by_status": solutions_by_status,
                },
                "knowledge_base": {
                    "total_documents": total_documents,
                    "golden_documents": golden_documents,
                    "total_chunks": total_chunks,
                },
                "triz": {
                    "total_contradictions": total_contradictions,
                    "by_contradiction_type": by_contradiction_type,
                },
            }
        finally:
            if self._session is None and self._engine is not None:
                db.close()
