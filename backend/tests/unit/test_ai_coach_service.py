"""
test_ai_coach_service.py — Unit tests for AICoachService and RuleBasedCoach (Batch C31).

Tests:
1. Happy path with valid context and LLM client response.
2. Hard Grounding filter: invalid/empty groundings are discarded.
3. Max 5 suggestions constraint.
4. Fallback on LLM timeout -> Rule-Based TRIZ Heuristic.
5. Fallback on malformed JSON -> Rule-Based TRIZ Heuristic.
6. Zero database mutation guard.
7. Session not found error handling.
"""
from __future__ import annotations

import uuid
import pytest
from unittest.mock import MagicMock

from app.domain.models import CandidateSolution, ProblemFrame, ResearchNote, ResearchSession
from app.services.ai_coach_service import (
    AICoachResult,
    AICoachService,
    CoachSuggestion,
    GroundingInfo,
    RuleBasedCoach,
    VALID_GROUNDING_TYPES,
)
from app.services.llm_client import LLMClient


class DummyLLMClient(LLMClient):
    """Dummy client for testing coach generation."""
    provider_name = "mock"
    model_name = "mock-model"

    def analyze(self, raw_statement: str, domain: str | None = None):
        raise NotImplementedError

    def generate_coach_suggestions(self, context_data: dict) -> dict:
        return {
            "summary": "AI Coach analysis summary",
            "suggestions": [
                {
                    "category": "possible_cause",
                    "title": "Manual sorting bottleneck",
                    "description": "Sorting parcels manually causes shipment delays.",
                    "source_grounding": {
                        "source_type": "contradiction",
                        "source_reference": "Technical Contradiction: Speed vs Cost"
                    },
                    "actionable_payload": None,
                },
                {
                    "category": "relevant_principle",
                    "title": "Principle 1: Segmentation",
                    "description": "Divide transit into micro hubs.",
                    "source_grounding": {
                        "source_type": "principle",
                        "source_reference": "TRIZ Principle #1: Segmentation"
                    },
                    "actionable_payload": None,
                },
                {
                    "category": "solution_candidate",
                    "title": "Dynamic Micro-Hubs",
                    "description": "Deploy dynamic neighborhood drop points.",
                    "source_grounding": {
                        "source_type": "principle",
                        "source_reference": "TRIZ Principle #1: Segmentation"
                    },
                    "actionable_payload": {
                        "title": "Dynamic Micro-Hubs",
                        "mechanism": "Cluster orders dynamically to nearest partner hub."
                    },
                },
                {
                    "category": "clarifying_question",
                    "title": "Off-peak delivery tolerance",
                    "description": "What percentage of customers accept deferred delivery?",
                    "source_grounding": {
                        "source_type": "note",
                        "source_reference": "Research Note: Customer delivery expectations"
                    },
                    "actionable_payload": {
                        "content": "Test hypothesis: 30% of customers accept 2h delay for 10% discount",
                        "note_type": "hypothesis"
                    },
                },
            ]
        }


def test_coach_service_happy_path_with_valid_context(db_session):
    # Setup test session with ProblemFrame
    session = ResearchSession(
        title="Delivery Speed Optimization",
        domain="logistics",
    )
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Muốn giao hàng trong 2 giờ nhưng chi phí đội xe quá lớn",
        normalized_statement="Giao hàng nhanh 2h nhưng chi phí cao",
        contradiction_type="technical",
        improving_parameter="speed",
        worsening_parameter="cost",
    )
    db_session.add(frame)
    db_session.commit()

    service = AICoachService(llm_client=DummyLLMClient())
    result = service.get_coach_suggestions(session_id=session.id, db=db_session)

    assert isinstance(result, AICoachResult)
    assert result.session_id == str(session.id)
    assert result.provenance == "ai_coach"
    assert result.provider == "mock"
    assert len(result.suggestions) <= 5
    assert len(result.suggestions) == 4
    for sug in result.suggestions:
        assert sug.source_grounding.source_type in VALID_GROUNDING_TYPES
        assert len(sug.source_grounding.source_reference.strip()) > 0


def test_coach_service_hard_grounding_filter(db_session):
    session = ResearchSession(title="Test Hard Grounding", domain="business")
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Statement",
        contradiction_type="technical",
        improving_parameter="speed",
        worsening_parameter="cost",
    )
    db_session.add(frame)
    db_session.commit()

    mock_llm = MagicMock(spec=LLMClient)
    mock_llm.provider_name = "openai"
    mock_llm.model_name = "gpt-4o-mini"
    # Return 6 suggestions, 2 of which have invalid/missing grounding
    mock_llm.generate_coach_suggestions.return_value = {
        "summary": "Summary",
        "suggestions": [
            {
                "category": "possible_cause",
                "title": "Valid Grounded 1",
                "description": "Desc 1",
                "source_grounding": {"source_type": "contradiction", "source_reference": "Ref 1"},
            },
            {
                "category": "possible_cause",
                "title": "Invalid Grounded - bad type",
                "description": "Desc 2",
                "source_grounding": {"source_type": "hallucinated_type", "source_reference": "Ref 2"},
            },
            {
                "category": "possible_cause",
                "title": "Invalid Grounded - empty reference",
                "description": "Desc 3",
                "source_grounding": {"source_type": "principle", "source_reference": "   "},
            },
            {
                "category": "relevant_principle",
                "title": "Valid Grounded 2",
                "description": "Desc 4",
                "source_grounding": {"source_type": "principle", "source_reference": "Ref 4"},
            },
            {
                "category": "solution_candidate",
                "title": "Valid Grounded 3",
                "description": "Desc 5",
                "source_grounding": {"source_type": "evidence", "source_reference": "Doc #12"},
            },
            {
                "category": "clarifying_question",
                "title": "Valid Grounded 4",
                "description": "Desc 6",
                "source_grounding": {"source_type": "note", "source_reference": "Note #3"},
            },
        ]
    }

    service = AICoachService(llm_client=mock_llm)
    result = service.get_coach_suggestions(session_id=session.id, db=db_session)

    # The 2 invalid ones must be discarded!
    assert len(result.suggestions) == 4
    titles = [s.title for s in result.suggestions]
    assert "Invalid Grounded - bad type" not in titles
    assert "Invalid Grounded - empty reference" not in titles
    assert "Valid Grounded 1" in titles
    assert result.provenance == "ai_coach"


def test_coach_service_max_5_suggestions_cap(db_session):
    session = ResearchSession(title="Cap Test", domain="tech")
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Statement",
        contradiction_type="technical",
        improving_parameter="speed",
        worsening_parameter="cost",
    )
    db_session.add(frame)
    db_session.commit()

    mock_llm = MagicMock(spec=LLMClient)
    mock_llm.provider_name = "openai"
    mock_llm.model_name = "gpt-4o-mini"
    # Return 8 valid suggestions
    mock_llm.generate_coach_suggestions.return_value = {
        "summary": "Summary",
        "suggestions": [
            {
                "category": "possible_cause",
                "title": f"Valid {i}",
                "description": f"Desc {i}",
                "source_grounding": {"source_type": "principle", "source_reference": f"Ref {i}"},
            }
            for i in range(8)
        ]
    }

    service = AICoachService(llm_client=mock_llm)
    result = service.get_coach_suggestions(session_id=session.id, db=db_session)

    # Must be capped at exactly 5
    assert len(result.suggestions) == 5


def test_coach_service_fallback_on_llm_timeout(db_session):
    session = ResearchSession(title="Timeout Test", domain="logistics")
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Muốn nhanh nhưng tốn kém",
        contradiction_type="technical",
        improving_parameter="speed",
        worsening_parameter="cost",
    )
    db_session.add(frame)
    db_session.commit()

    mock_llm = MagicMock(spec=LLMClient)
    mock_llm.provider_name = "openai"
    mock_llm.model_name = "gpt-4o-mini"
    mock_llm.generate_coach_suggestions.side_effect = TimeoutError("Request timed out after 10.0s")

    service = AICoachService(llm_client=mock_llm)
    result = service.get_coach_suggestions(session_id=session.id, db=db_session)

    assert result.provenance == "rule_based_fallback"
    assert result.provider == "rule_based"
    assert "timed out" in (result.fallback_reason or "").lower() or "timeout" in (result.fallback_reason or "").lower()
    assert len(result.suggestions) > 0
    assert len(result.suggestions) <= 5
    for s in result.suggestions:
        assert s.source_grounding.source_type in VALID_GROUNDING_TYPES


def test_coach_service_fallback_on_malformed_json(db_session):
    session = ResearchSession(title="Malformed Test", domain="logistics")
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Muốn bền nhưng nặng",
        contradiction_type="technical",
        improving_parameter="strength",
        worsening_parameter="weight_stationary",
    )
    db_session.add(frame)
    db_session.commit()

    mock_llm = MagicMock(spec=LLMClient)
    mock_llm.generate_coach_suggestions.side_effect = ValueError("Invalid JSON output from LLM")

    service = AICoachService(llm_client=mock_llm)
    result = service.get_coach_suggestions(session_id=session.id, db=db_session)

    assert result.provenance == "rule_based_fallback"
    assert "invalid json" in (result.fallback_reason or "").lower()
    assert len(result.suggestions) > 0


def test_coach_service_zero_database_mutation(db_session):
    session = ResearchSession(title="Zero Mutation Test", domain="logistics")
    db_session.add(session)
    db_session.commit()
    db_session.refresh(session)

    frame = ProblemFrame(
        session_id=session.id,
        raw_statement="Statement",
        contradiction_type="technical",
        improving_parameter="speed",
        worsening_parameter="cost",
    )
    db_session.add(frame)
    db_session.commit()

    initial_solutions_count = db_session.query(CandidateSolution).count()
    initial_notes_count = db_session.query(ResearchNote).count()
    initial_frames_count = db_session.query(ProblemFrame).count()

    service = AICoachService(llm_client=DummyLLMClient())
    service.get_coach_suggestions(session_id=session.id, db=db_session)

    assert db_session.query(CandidateSolution).count() == initial_solutions_count
    assert db_session.query(ResearchNote).count() == initial_notes_count
    assert db_session.query(ProblemFrame).count() == initial_frames_count


def test_coach_service_session_not_found(db_session):
    service = AICoachService(llm_client=DummyLLMClient())
    random_id = uuid.uuid4()
    with pytest.raises(ValueError, match="not found"):
        service.get_coach_suggestions(session_id=random_id, db=db_session)
