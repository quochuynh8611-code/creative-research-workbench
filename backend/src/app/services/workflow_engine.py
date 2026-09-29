"""
workflow_engine.py — Core Domain Service cho Phase 4: Workflow Engine & Finite State Machine (FSM)

Nhiệm vụ:
  1. Quản lý vòng đời (lifecycle) và trạng thái workflow của ResearchSession.
  2. Enforce quy tắc chuyển đổi trạng thái tuần tự theo quy trình TRIZ (ADR-001).
  3. Validate điều kiện tiên quyết trước khi cho phép chuyển trạng thái.
  4. Cập nhật và persist `workflow_state` vào database.

Ref: docs/ADR-001-architecture.md, docs/DOMAIN_SCHEMA.md, docs/TEST_PLAN.md
"""
from __future__ import annotations

import enum
import logging
import uuid
from typing import Any

from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.domain.models import ProblemFrame, ResearchSession

logger = logging.getLogger(__name__)


class WorkflowState(str, enum.Enum):
    """Các trạng thái tuần tự của quy trình nghiên cứu TRIZ."""
    IDLE = "idle"
    STRUCTURING = "structuring"
    RETRIEVAL = "retrieval"
    IDEATION = "ideation"
    EVALUATION = "evaluation"
    SYNTHESIS = "synthesis"
    COMPLETED = "completed"


class InvalidTransitionError(Exception):
    """Ngoại lệ ném ra khi cố tình chuyển trạng thái không hợp lệ trong FSM."""
    pass


# Bảng định nghĩa chuyển trạng thái hợp lệ (Từ trạng thái nguồn -> Tập trạng thái đích hợp lệ)
_VALID_TRANSITIONS: dict[WorkflowState, list[WorkflowState]] = {
    WorkflowState.IDLE: [WorkflowState.STRUCTURING],
    WorkflowState.STRUCTURING: [WorkflowState.RETRIEVAL, WorkflowState.IDLE],
    WorkflowState.RETRIEVAL: [WorkflowState.IDEATION, WorkflowState.STRUCTURING],
    WorkflowState.IDEATION: [WorkflowState.EVALUATION, WorkflowState.RETRIEVAL],
    WorkflowState.EVALUATION: [WorkflowState.SYNTHESIS, WorkflowState.IDEATION],
    WorkflowState.SYNTHESIS: [WorkflowState.COMPLETED, WorkflowState.EVALUATION],
    WorkflowState.COMPLETED: [],
}

_NEXT_STATE_MAP: dict[WorkflowState, WorkflowState] = {
    WorkflowState.IDLE: WorkflowState.STRUCTURING,
    WorkflowState.STRUCTURING: WorkflowState.RETRIEVAL,
    WorkflowState.RETRIEVAL: WorkflowState.IDEATION,
    WorkflowState.IDEATION: WorkflowState.EVALUATION,
    WorkflowState.EVALUATION: WorkflowState.SYNTHESIS,
    WorkflowState.SYNTHESIS: WorkflowState.COMPLETED,
}


class WorkflowEngine:
    """
    Finite State Machine quản lý tiến trình nghiên cứu cho ResearchSession.

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
        raise RuntimeError("WorkflowEngine không có Engine hoặc Session hợp lệ.")

    def get_current_state(self, session_id: uuid.UUID | str) -> str:
        """Lấy trạng thái workflow hiện tại của ResearchSession."""
        session_uuid = uuid.UUID(str(session_id))
        db, should_close = self._get_db_session()
        try:
            record = db.query(ResearchSession).filter_by(id=session_uuid).first()
            if not record:
                raise ValueError(f"ResearchSession with id '{session_id}' not found.")
            return record.workflow_state
        finally:
            if should_close:
                db.close()

    def get_next_state(self, session_id: uuid.UUID | str) -> str | None:
        """Xác định trạng thái tiếp theo mặc định theo FSM."""
        current_str = self.get_current_state(session_id)
        try:
            current_state = WorkflowState(current_str)
        except ValueError:
            current_state = WorkflowState.IDLE
        next_state = _NEXT_STATE_MAP.get(current_state)
        return next_state.value if next_state else None

    def transition(self, session_id: uuid.UUID | str, target_state: str | WorkflowState) -> str:
        """
        Thực hiện chuyển đổi trạng thái FSM cho ResearchSession.

        Args:
            session_id: ID phiên nghiên cứu.
            target_state: Trạng thái đích muốn chuyển tới.

        Returns:
            Tên trạng thái mới sau khi chuyển đổi.

        Raises:
            ValueError: Nếu session_id không tồn tại.
            InvalidTransitionError: Nếu chuyển đổi không hợp lệ hoặc vi phạm điều kiện tiên quyết.
        """
        session_uuid = uuid.UUID(str(session_id))
        if isinstance(target_state, str):
            try:
                target_enum = WorkflowState(target_state)
            except ValueError:
                raise InvalidTransitionError(f"Trạng thái đích '{target_state}' không hợp lệ.")
        else:
            target_enum = target_state

        db, should_close = self._get_db_session()
        try:
            session_record = db.query(ResearchSession).filter_by(id=session_uuid).first()
            if not session_record:
                raise ValueError(f"ResearchSession with id '{session_id}' not found.")

            try:
                current_enum = WorkflowState(session_record.workflow_state)
            except ValueError:
                current_enum = WorkflowState.IDLE

            # Kiểm tra tính hợp lệ của transition
            allowed_targets = _VALID_TRANSITIONS.get(current_enum, [])
            if target_enum not in allowed_targets:
                raise InvalidTransitionError(
                    f"Không thể chuyển từ trạng thái '{current_enum.value}' sang '{target_enum.value}'. "
                    f"Các trạng thái hợp lệ: {[s.value for s in allowed_targets]}"
                )

            # Kiểm tra điều kiện tiên quyết (Prerequisites)
            if target_enum == WorkflowState.RETRIEVAL:
                # Chuyển sang retrieval bắt buộc đã có ít nhất 1 ProblemFrame
                frames_count = db.query(ProblemFrame).filter_by(session_id=session_uuid).count()
                if frames_count == 0:
                    raise InvalidTransitionError(
                        "Không thể chuyển sang 'retrieval' khi chưa có ProblemFrame nào được tạo cho session."
                    )

            # Cập nhật và persist state
            session_record.workflow_state = target_enum.value
            db.flush()
            db.refresh(session_record)
            return session_record.workflow_state
        finally:
            if should_close:
                db.close()
