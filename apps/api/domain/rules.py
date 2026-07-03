"""Domain business rules for Creative Research Workbench."""
from .models import ResearchSession, WorkflowStage, SessionStatus


def can_advance_to_structuring(session: ResearchSession) -> bool:
    """A session can move to structuring only if problem_statement is filled."""
    return bool(session.problem_statement and session.problem_statement.strip())


def can_advance_to_retrieval(session: ResearchSession) -> bool:
    """Must be past structuring stage."""
    stage_order = list(WorkflowStage)
    current_idx = stage_order.index(session.current_stage)
    structuring_idx = stage_order.index(WorkflowStage.STRUCTURING)
    return current_idx >= structuring_idx


def is_session_editable(session: ResearchSession) -> bool:
    """Archived sessions cannot be edited."""
    return session.status != SessionStatus.ARCHIVED
