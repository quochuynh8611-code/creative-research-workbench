"""
test_workflow_engine.py — Integration tests cho Phase 4: WorkflowEngine FSM & MethodRecommender

Specifications:
  - Feature: TRIZ Reasoning Workflow Orchestration
  - Architecture: ADR-001 (Workflow Engine + Retrieval Layer)
  - Roadmap: Phase 4 (WorkflowEngine, MethodRecommender, FSM)
  - Scope: Phase 4 — RED Integration Tests
"""
from __future__ import annotations

import uuid
import pytest
from sqlalchemy.orm import Session

from app.domain.models import (
    Contradiction,
    ContradictionType,
    ProblemFrame,
    ResearchSession,
    SessionStatus,
)
from app.services.workflow_engine import (
    InvalidTransitionError,
    WorkflowEngine,
    WorkflowState,
)
from app.services.method_recommender import MethodRecommender


# ──────────────────────────────────────────────
# WorkflowEngine FSM Tests
# ──────────────────────────────────────────────

def test_workflow_engine_initial_state_is_idle(db_session: Session):
    """
    GIVEN: Một ResearchSession mới tạo
    WHEN: Khởi tạo WorkflowEngine cho session
    THEN: workflow_state ban đầu là 'idle'
    """
    session = ResearchSession(
        title="Session FSM test initial state",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session)
    db_session.flush()

    engine = WorkflowEngine(bind=db_session)
    current_state = engine.get_current_state(session.id)
    assert current_state == WorkflowState.IDLE.value or current_state == "idle"


def test_workflow_engine_transitions_idle_to_structuring(db_session: Session):
    """
    GIVEN: Session ở trạng thái 'idle'
    WHEN: WorkflowEngine thực hiện transition sang 'structuring'
    THEN: Transition thành công và state mới là 'structuring'
    """
    session = ResearchSession(
        title="Session transition idle -> structuring",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session)
    db_session.flush()

    engine = WorkflowEngine(bind=db_session)
    new_state = engine.transition(session.id, target_state="structuring")
    assert new_state in ("structuring", WorkflowState.STRUCTURING.value)


def test_workflow_engine_transitions_structuring_to_retrieval(db_session: Session):
    """
    GIVEN: Session ở trạng thái 'structuring' và đã có ProblemFrame
    WHEN: WorkflowEngine transition sang 'retrieval'
    THEN: Transition thành công và state mới là 'retrieval'
    """
    session = ResearchSession(
        title="Session transition structuring -> retrieval",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng tốc độ làm giảm độ tin cậy",
        normalized_statement="speed vs reliability",
        contradiction_type=ContradictionType.technical,
    )
    db_session.add(frame)
    db_session.flush()

    engine = WorkflowEngine(bind=db_session)
    new_state = engine.transition(session.id, target_state="retrieval")
    assert new_state in ("retrieval", WorkflowState.RETRIEVAL.value)


def test_workflow_engine_rejects_invalid_transition(db_session: Session):
    """
    GIVEN: Session ở trạng thái 'idle'
    WHEN: WorkflowEngine cố transition nhảy cóc sang 'synthesis' (bỏ qua structuring, retrieval, ideation)
    THEN: Bị từ chối và raise InvalidTransitionError
    """
    session = ResearchSession(
        title="Session invalid transition test",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session)
    db_session.flush()

    engine = WorkflowEngine(bind=db_session)
    with pytest.raises(InvalidTransitionError):
        engine.transition(session.id, target_state="synthesis")


def test_workflow_engine_persists_state_transition(db_session: Session):
    """
    GIVEN: Session ở trạng thái 'idle'
    WHEN: WorkflowEngine chuyển trạng thái sang 'structuring'
    THEN: Giá trị workflow_state trong database được cập nhật tương ứng
    """
    session = ResearchSession(
        title="Session persist transition test",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session)
    db_session.flush()

    engine = WorkflowEngine(bind=db_session)
    engine.transition(session.id, target_state="structuring")

    db_session.refresh(session)
    assert session.workflow_state in ("structuring", WorkflowState.STRUCTURING.value)


# ──────────────────────────────────────────────
# MethodRecommender Tests
# ──────────────────────────────────────────────

def test_method_recommender_returns_principles_for_technical_contradiction(
    db_session: Session,
):
    """
    GIVEN: Session có ProblemFrame với Technical Contradiction (speed vs reliability)
    WHEN: MethodRecommender tính toán phương pháp gợi ý
    THEN: Trả về danh sách inventive principles (vd: [10, 35, 1, 28])
    """
    session = ResearchSession(
        title="Method recommender test technical",
        status=SessionStatus.active,
        workflow_state="structuring",
    )
    db_session.add(session)
    db_session.flush()

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Tăng tốc độ làm giảm độ tin cậy",
        normalized_statement="speed vs reliability",
        contradiction_type=ContradictionType.technical,
        improving_parameter="speed",
        worsening_parameter="reliability",
    )
    db_session.add(frame)
    db_session.flush()

    contradiction = Contradiction(
        problem_frame_id=frame.id,
        type=ContradictionType.technical,
        statement="Tăng tốc độ làm giảm độ tin cậy",
        suggested_principles=[10, 35, 1, 28],
    )
    db_session.add(contradiction)
    db_session.flush()

    recommender = MethodRecommender(bind=db_session)
    recommendations = recommender.recommend_methods(session.id)

    assert len(recommendations) > 0
    principles = [rec.get("principle_id") or rec.get("id") for rec in recommendations if isinstance(rec, dict)]
    # Nếu recommender trả list int hoặc dict
    if not principles:
        principles = [rec for rec in recommendations if isinstance(rec, int)]
    assert any(p in [10, 35, 1, 28] for p in principles)


def test_method_recommender_returns_empty_or_fallback_for_unknown_contradiction(
    db_session: Session,
):
    """
    GIVEN: Session chưa có ProblemFrame hoặc Contradiction không xác định
    WHEN: MethodRecommender tính toán phương pháp gợi ý
    THEN: Trả về fallback hoặc danh sách rỗng, không gây crash/exception
    """
    session = ResearchSession(
        title="Method recommender test unknown",
        status=SessionStatus.active,
        workflow_state="idle",
    )
    db_session.add(session)
    db_session.flush()

    recommender = MethodRecommender(bind=db_session)
    recommendations = recommender.recommend_methods(session.id)
    assert isinstance(recommendations, list)
