"""
session_import_service.py — Session Import Service for Phase 9.3/9.4.
Restores a full ResearchSession from an exported JSON snapshot with deep relations.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from typing import Any
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.domain.models import (
    ResearchSession,
    SessionStatus,
    ProblemFrame,
    Contradiction,
    ContradictionType,
    ResearchNote,
    CandidateSolution,
)
from app.services.problem_structuring_service import create_contradiction_record

# Supported template schema versions (Phase 9.4 hardening)
_SUPPORTED_SNAPSHOT_VERSIONS: frozenset[str] = frozenset({"v1", "v1.0", "1", "1.0"})
_VALID_CONTRADICTION_TYPES: frozenset[str] = frozenset({"technical", "physical", "none", "unknown"})


def _validate_and_parse_explicit_contradictions(
    raw_contras: Any,
    has_explicit_key: bool,
) -> tuple[bool, list[dict[str, Any]]]:
    """
    Validate and parse explicit contradictions payload before database mutation (Fail-Closed).

    Returns:
        tuple[bool, list[dict[str, Any]]]:
          - (False, []): Key is missing or explicitly null -> trigger backward-compatible derivation.
          - (True, []): Explicit empty list [] -> respect intention, save 0 records, do NOT derive.
          - (True, [items]): Valid explicit items -> save exactly as given.

    Raises:
        ValueError: with precise field location (e.g. contradictions[0].type) if contract is violated.
    """
    if not has_explicit_key or raw_contras is None:
        return False, []

    if not isinstance(raw_contras, list):
        raise ValueError("Invalid snapshot payload at 'contradictions': expected a list or null.")

    parsed_items: list[dict[str, Any]] = []
    for idx, item in enumerate(raw_contras):
        loc = f"contradictions[{idx}]"
        if not isinstance(item, dict):
            raise ValueError(f"Invalid snapshot payload at '{loc}': expected an object.")

        # 1. Validate type strictly
        c_type = item.get("type")
        if not isinstance(c_type, str) or c_type not in _VALID_CONTRADICTION_TYPES:
            raise ValueError(
                f"Invalid contradiction type at '{loc}.type': expected one of "
                f"{sorted(_VALID_CONTRADICTION_TYPES)}, received {c_type!r}."
            )

        # 2. Validate statement strictly
        raw_stmt = item.get("statement")
        if not isinstance(raw_stmt, str) or not raw_stmt.strip():
            raise ValueError(
                f"Invalid contradiction statement at '{loc}.statement': "
                "statement is required, must be a string, and cannot be blank."
            )
        clean_stmt = raw_stmt.strip()

        # 3. Validate suggested_principles strictly
        principles_val = item.get("suggested_principles")
        parsed_principles: list[int] | None = None
        if principles_val is not None:
            if not isinstance(principles_val, list):
                raise ValueError(
                    f"Invalid suggested_principles at '{loc}.suggested_principles': "
                    "expected a list of integer IDs or null."
                )
            parsed_principles = []
            for p_idx, p in enumerate(principles_val):
                p_loc = f"{loc}.suggested_principles[{p_idx}]"
                # Python bool is a subclass of int, so reject bool explicitly
                if isinstance(p, bool) or not isinstance(p, int) or p < 1 or p > 40:
                    raise ValueError(
                        f"Invalid principle ID at '{p_loc}': expected an integer in 1..40, received {p!r}."
                    )
                parsed_principles.append(p)

        parsed_items.append({
            "type": ContradictionType(c_type),
            "statement": clean_stmt,
            "suggested_principles": parsed_principles,
        })

    return True, parsed_items


def _compute_payload_checksum(payload: dict) -> str:
    """SHA-256 of canonical JSON (sorted keys, no extra whitespace, UTF-8)."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


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

    # ── Phase 9.4 H1: Checksum verification (pre-mutation, fail-closed) ──────
    provided_checksum = snapshot.get("payload_checksum")
    if provided_checksum is not None:
        # Build the body without the checksum field for verification
        body_without_checksum = {k: v for k, v in snapshot.items() if k != "payload_checksum"}
        expected_checksum = _compute_payload_checksum(body_without_checksum)
        if provided_checksum != expected_checksum:
            raise ValueError(
                "CHECKSUM_MISMATCH: payload_checksum does not match the canonical SHA-256 "
                "of the request body. The snapshot may have been tampered with."
            )

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

    raw_domain = session_data.get("domain")
    clean_domain = (
        raw_domain.strip(" ")
        if (raw_domain is not None and isinstance(raw_domain, str))
        else None
    )
    if clean_domain == "":
        clean_domain = None

    raw_workflow_state = session_data.get("workflow_state") or "intake"
    tags = session_data.get("tags") if isinstance(session_data.get("tags"), list) else None

    # ── Phase 9.4 H2: Conflict session ID detection (pre-mutation, fail-closed) ──
    source_session_id_raw = snapshot.get("source_session_id")
    conflict_strategy = snapshot.get("conflict_strategy")  # None or "overwrite"
    if source_session_id_raw is not None:
        try:
            source_uuid = uuid.UUID(str(source_session_id_raw))
        except (ValueError, TypeError):
            source_uuid = None
        if source_uuid is not None and conflict_strategy != "overwrite":
            existing = db.query(ResearchSession).filter_by(id=source_uuid).first()
            if existing is not None:
                raise ValueError(
                    f"SESSION_ID_CONFLICT: A session with id '{source_uuid}' already exists. "
                    "Use conflict_strategy='overwrite' to replace it."
                )

    # Pre-mutation fail-closed validation
    frame_data = snapshot.get("problem_frame")
    if frame_data is not None and not isinstance(frame_data, dict):
        raise ValueError("Invalid snapshot: problem_frame must be an object.")

    has_explicit_contras = False
    raw_contras = None
    if "contradictions" in snapshot:
        raw_contras = snapshot.get("contradictions")
        has_explicit_contras = True
    elif isinstance(frame_data, dict) and "contradictions" in frame_data:
        raw_contras = frame_data.get("contradictions")
        has_explicit_contras = True

    is_explicit_contras, parsed_contras = _validate_and_parse_explicit_contradictions(
        raw_contras=raw_contras,
        has_explicit_key=has_explicit_contras,
    )

    notes_data = snapshot.get("research_notes")
    if notes_data is not None and not isinstance(notes_data, list):
        raise ValueError("Invalid snapshot: research_notes must be a list.")

    solutions_data = snapshot.get("candidate_solutions")
    if solutions_data is not None and not isinstance(solutions_data, list):
        raise ValueError("Invalid snapshot: candidate_solutions must be a list.")

    try:
        # 1. Create new session with unique UUID
        new_session = ResearchSession(
            id=uuid.uuid4(),
            title=title.strip(),
            description=description,
            domain=clean_domain,
            status=SessionStatus.active,
            workflow_state=raw_workflow_state,
        )
        db.add(new_session)
        db.flush()

        has_frame = False
        notes_count = 0
        solutions_count = 0

        # 2. Import Problem Frame if present
        if isinstance(frame_data, dict) and frame_data.get("raw_statement"):
            raw_statement = frame_data.get("raw_statement", "").strip()
            normalized_statement = frame_data.get("normalized_statement")
            if normalized_statement and isinstance(normalized_statement, str):
                normalized_statement = normalized_statement.strip()

            contra_type_raw = str(frame_data.get("contradiction_type") or "technical").lower()
            if contra_type_raw == "physical":
                contra_type = ContradictionType.physical
            elif contra_type_raw == "none":
                contra_type = ContradictionType.none
            elif contra_type_raw == "unknown":
                contra_type = ContradictionType.unknown
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

            # 2b. Import explicit or derive Contradictions (P1-02 contract hardening)
            if is_explicit_contras:
                # Explicit list is respected: if empty ([]), save 0 records and do NOT derive
                for c_item in parsed_contras:
                    contra_rec = Contradiction(
                        problem_frame=problem_frame,
                        type=c_item["type"],
                        statement=c_item["statement"],
                        suggested_principles=c_item["suggested_principles"],
                    )
                    db.add(contra_rec)
            elif contra_type in (ContradictionType.technical, ContradictionType.physical):
                if contra_type == ContradictionType.technical:
                    if improving_param or worsening_param:
                        contra_rec = create_contradiction_record(
                            contradiction_type=contra_type,
                            improving_param=improving_param,
                            worsening_param=worsening_param,
                        )
                        contra_rec.problem_frame = problem_frame
                        db.add(contra_rec)
                elif contra_type == ContradictionType.physical:
                    contra_rec = create_contradiction_record(
                        contradiction_type=contra_type,
                    )
                    contra_rec.problem_frame = problem_frame
                    db.add(contra_rec)

        # 3. Import Research Notes if present
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
    except IntegrityError as exc:
        # ── Phase 9.4 H3: FK / unique constraint violation → clean rollback ──
        db.rollback()
        raise ValueError(
            f"CONSTRAINT_VIOLATION: A child entity could not be persisted due to a database "
            f"constraint (e.g. invalid foreign key). Full rollback applied. Detail: {exc.orig}"
        ) from exc
    except Exception:
        db.rollback()
        raise

    elements_summary = {
        "problem_frame": has_frame,
        "notes_count": notes_count,
        "solutions_count": solutions_count,
    }

    return new_session, elements_summary
