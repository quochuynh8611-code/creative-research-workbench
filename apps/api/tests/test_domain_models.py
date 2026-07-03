"""Unit tests for domain models."""
import uuid
import pytest
from apps.api.domain.models import (
    ResearchSession,
    DomainType,
    SessionStatus,
    WorkflowStage,
    ProblemFrame,
    Contradiction,
    ContradictionType,
)
from apps.api.domain.rules import (
    can_advance_to_structuring,
    is_session_editable,
)


def make_session(**kwargs) -> ResearchSession:
    defaults = dict(
        title="Test Session",
        domain=DomainType.BUSINESS,
    )
    defaults.update(kwargs)
    return ResearchSession(**defaults)


class TestResearchSession:
    def test_default_status_is_draft(self):
        session = make_session()
        assert session.status == SessionStatus.DRAFT

    def test_default_stage_is_intake(self):
        session = make_session()
        assert session.current_stage == WorkflowStage.INTAKE

    def test_id_is_uuid(self):
        session = make_session()
        assert isinstance(session.id, uuid.UUID)


class TestDomainRules:
    def test_cannot_advance_without_problem_statement(self):
        session = make_session(problem_statement="")
        assert can_advance_to_structuring(session) is False

    def test_can_advance_with_problem_statement(self):
        session = make_session(problem_statement="We have a delivery delay problem.")
        assert can_advance_to_structuring(session) is True

    def test_archived_session_not_editable(self):
        session = make_session(status=SessionStatus.ARCHIVED)
        assert is_session_editable(session) is False

    def test_active_session_is_editable(self):
        session = make_session(status=SessionStatus.ACTIVE)
        assert is_session_editable(session) is True


class TestContradiction:
    def test_contradiction_fields(self):
        frame_id = uuid.uuid4()
        c = Contradiction(
            problem_frame_id=frame_id,
            type=ContradictionType.TECHNICAL,
            improving_parameter="Speed",
            worsening_parameter="Cost",
            context="Delivery optimization",
        )
        assert c.improving_parameter == "Speed"
        assert c.type == ContradictionType.TECHNICAL
