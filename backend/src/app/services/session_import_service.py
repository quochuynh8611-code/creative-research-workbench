"""
session_import_service.py — Session Import Service for Phase 9.3.
Restores a full ResearchSession from an exported JSON snapshot with deep relations.
"""

from __future__ import annotations

import uuid
from typing import Any
from sqlalchemy.orm import Session

from app.domain.models import (
    ResearchSession,
    SessionStatus,
    ProblemFrame,
    ContradictionType,
    ResearchNote,
    CandidateSolution,
)


def import_session_from_json(
    snapshot: dict[str, Any],
    db: Session,
) -> tuple[ResearchSession, dict[str, Any]]:
    """
    Import a ResearchSession from a JSON export snapshot.

    Args:
        snapshot: Dict containing session, problem_frame, research_notes, candidate_solutions.
        db: SQLAlchemy database session.

    Returns:
        tuple[ResearchSession, dict[str, Any]]: The created session and import metadata summary.

    Raises:
        ValueError: If the snapshot format is invalid or missing required session fields.
    """
    if not isinstance(snapshot, dict):
        raise ValueError("Invalid snapshot payload: expected a JSON object.")

    session_data = snapshot.get("session")
    if not isinstance(session_data, dict):
        raise ValueError("Invalid snapshot payload: missing required 'session' object.")

    title = session_data.get("title")
    if not title or not isinstance(title, str) or not title.strip():
        raise ValueError("Missing required session title.")

    description = session_data.get("description")
    if description and isinstance(description, str):
        description = description.strip()
    else:
        description = None

    raw_domain = session_data.get("domain") or "technical"
    raw_workflow_state = session_data.get("workflow_state") or "intake"
    tags = session_data.get("tags") if isinstance(session_data.get("tags"), list) else None

    # 1. Create new session with unique UUID
    new_session = ResearchSession(
        id=uuid.uuid4(),
        title=title.strip(),
        description=description,
        status=SessionStatus.active,
        workflow_state=raw_workflow_state,
    )
    db.add(new_session)
    db.flush()

    has_frame = False
    notes_count = 0
    solutions_count = 0

    # 2. Import Problem Frame if present
    frame_data = snapshot.get("problem_frame")
    if isinstance(frame_data, dict) and frame_data.get("raw_statement"):
        raw_statement = frame_data.get("raw_statement", "").strip()
        normalized_statement = frame_data.get("normalized_statement")
        if normalized_statement and isinstance(normalized_statement, str):
            normalized_statement = normalized_statement.strip()

        contra_type_raw = str(frame_data.get("contradiction_type") or "technical").lower()
        if contra_type_raw == "physical":
            contra_type = ContradictionType.physical
        else:
            contra_type = ContradictionType.technical

        improving_param = frame_data.get("improving_parameter")
        worsening_param = frame_data.get("worsening_parameter")
        frame_domain = frame_data.get("domain") or raw_domain

        problem_frame = ProblemFrame(
            session_id=new_session.id,
            raw_statement=raw_statement,
            normalized_statement=normalized_statement,
            contradiction_type=contra_type,
            improving_parameter=improving_param,
            worsening_parameter=worsening_param,
            domain=frame_domain,
        )
        db.add(problem_frame)
        has_frame = True

    # 3. Import Research Notes if present
    notes_data = snapshot.get("research_notes")
    if isinstance(notes_data, list):
        for n in notes_data:
            if isinstance(n, dict) and n.get("content") and str(n.get("content")).strip():
                content = str(n.get("content")).strip()
                note_type = str(n.get("note_type") or "insight").strip().lower()
                if note_type not in {"insight", "hypothesis", "decision", "question", "action"}:
                    note_type = "insight"

                source_chunk_id = None
                raw_chunk_id = n.get("source_chunk_id")
                if raw_chunk_id:
                    try:
                        source_chunk_id = uuid.UUID(str(raw_chunk_id))
                    except (ValueError, TypeError):
                        source_chunk_id = None

                note_record = ResearchNote(
                    session_id=new_session.id,
                    content=content,
                    note_type=note_type,
                    source_chunk_id=source_chunk_id,
                )
                db.add(note_record)
                notes_count += 1

    # 4. Import Candidate Solutions if present
    solutions_data = snapshot.get("candidate_solutions")
    if isinstance(solutions_data, list):
        for s in solutions_data:
            if isinstance(s, dict) and s.get("title") and str(s.get("title")).strip():
                sol_title = str(s.get("title")).strip()
                mechanism = str(s.get("mechanism") or "").strip()
                sol_status = str(s.get("status") or "candidate").strip().lower()
                if sol_status not in {"candidate", "accepted", "rejected"}:
                    sol_status = "candidate"

                novelty_score = None
                if s.get("novelty_score") is not None:
                    try:
                        novelty_score = float(s["novelty_score"])
                    except (ValueError, TypeError):
                        novelty_score = None

                feasibility_score = None
                if s.get("feasibility_score") is not None:
                    try:
                        feasibility_score = float(s["feasibility_score"])
                    except (ValueError, TypeError):
                        feasibility_score = None

                risk_notes = str(s.get("risk_notes") or "").strip() if s.get("risk_notes") else None

                solution_record = CandidateSolution(
                    session_id=new_session.id,
                    title=sol_title,
                    mechanism=mechanism,
                    status=sol_status,
                    novelty_score=novelty_score,
                    feasibility_score=feasibility_score,
                    risk_notes=risk_notes,
                )
                db.add(solution_record)
                solutions_count += 1

    db.commit()
    db.refresh(new_session)

    elements_summary = {
        "problem_frame": has_frame,
        "notes_count": notes_count,
        "solutions_count": solutions_count,
    }

    return new_session, elements_summary
