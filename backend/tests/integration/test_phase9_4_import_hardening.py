"""
Integration tests for Phase 9.4: Import Hardening.

Covers:
1. Checksum mismatch → HTTP 400 with error_code CHECKSUM_MISMATCH
2. Conflict session ID reject-by-default → HTTP 409 with error_code SESSION_ID_CONFLICT
3. Child-entity constraint violation (invalid FK) → rollback, no partial session in DB
4. Unsupported template version → HTTP 422 with error_code UNSUPPORTED_TEMPLATE_VERSION
5. Snapshot catalog immutability — GET /templates returns identical data across N calls
"""

from __future__ import annotations

import hashlib
import json
import uuid

import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.orm import Session

from app.main import app
from app.domain.models import ResearchSession


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def compute_payload_checksum(payload: dict) -> str:
    """SHA-256 of the canonical JSON representation of the payload (sorted keys, no whitespace)."""
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def make_export_payload_with_checksum(session_data: dict, extras: dict | None = None) -> dict:
    """
    Build a full import payload with a valid embedded checksum.
    The checksum is computed over the content keys, then injected as `payload_checksum`.
    """
    content = {"session": session_data}
    if extras:
        content.update(extras)
    checksum = compute_payload_checksum(content)
    return {**content, "payload_checksum": checksum}


# ──────────────────────────────────────────────
# Fixture: dependency override
# ──────────────────────────────────────────────

@pytest.fixture(autouse=True)
def override_db_dependency(db_session: Session):
    """Dependency override cho get_db."""
    try:
        from app.api.v1.endpoints.sessions import get_db
        app.dependency_overrides[get_db] = lambda: db_session
        yield
        app.dependency_overrides.pop(get_db, None)
    except ImportError:
        yield


# ──────────────────────────────────────────────
# Test 1: Checksum mismatch → 400 CHECKSUM_MISMATCH
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_import_checksum_mismatch_returns_400(db_session: Session):
    """
    Phase 9.4 — Scenario H1: Checksum mismatch
    GIVEN: A snapshot payload with a `payload_checksum` that does NOT match the canonical body.
    WHEN:  POST /api/v1/sessions/import
    THEN:  HTTP 400. Response contains CHECKSUM_MISMATCH signal. No new session created.
    """
    initial_count = db_session.query(ResearchSession).count()

    valid_payload = {
        "session": {
            "title": "Checksum Hardening Test",
            "description": "Session dung de kiem tra checksum",
            "workflow_state": "intake",
        }
    }
    # Inject a deliberately wrong checksum
    tampered_payload = {**valid_payload, "payload_checksum": "deadbeef" + "0" * 56}

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=tampered_payload)

    assert response.status_code == 400, (
        f"Expected 400 for checksum mismatch, got {response.status_code}: {response.text}"
    )
    body = response.json()
    error_signal = (
        body.get("error_code", "") == "CHECKSUM_MISMATCH"
        or "checksum" in str(body.get("detail", "")).lower()
    )
    assert error_signal, f"Expected CHECKSUM_MISMATCH signal in response, got: {body}"
    assert db_session.query(ResearchSession).count() == initial_count


# ──────────────────────────────────────────────
# Test 2: Conflict session ID → 409 SESSION_ID_CONFLICT
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_import_conflict_session_id_rejected_by_default(db_session: Session):
    """
    Phase 9.4 — Scenario H2: Conflict session ID reject-by-default
    GIVEN: A snapshot with `source_session_id` referencing an existing session UUID.
    WHEN:  POST /api/v1/sessions/import (no conflict_strategy override)
    THEN:  HTTP 409. Response contains SESSION_ID_CONFLICT signal. Existing session untouched.
    """
    # Pre-create a session in DB
    existing_id = uuid.uuid4()
    existing_session = ResearchSession(
        id=existing_id,
        title="Pre-existing session",
        status="active",
        workflow_state="intake",
    )
    db_session.add(existing_session)
    db_session.commit()

    conflict_payload = {
        "session": {
            "title": "Conflicting Session Import",
            "workflow_state": "intake",
        },
        "source_session_id": str(existing_id),
        # No conflict_strategy → default should be reject
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=conflict_payload)

    assert response.status_code == 409, (
        f"Expected 409 for session ID conflict, got {response.status_code}: {response.text}"
    )
    body = response.json()
    error_signal = (
        body.get("error_code", "") == "SESSION_ID_CONFLICT"
        or "conflict" in str(body.get("detail", "")).lower()
        or "session_id" in str(body.get("detail", "")).lower()
    )
    assert error_signal, f"Expected SESSION_ID_CONFLICT signal in response, got: {body}"

    # Original session untouched
    db_session.expire_all()
    unchanged = db_session.query(ResearchSession).filter_by(id=existing_id).first()
    assert unchanged is not None
    assert unchanged.title == "Pre-existing session"


# ──────────────────────────────────────────────
# Test 3: Child-entity constraint violation → rollback, no partial session
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_import_child_entity_constraint_violation_triggers_rollback(db_session: Session):
    """
    Phase 9.4 — Scenario H3: Child-entity constraint violation → transaction rollback
    GIVEN: A snapshot with a research_note referencing a non-existent source_chunk_id (FK).
    WHEN:  POST /api/v1/sessions/import
    THEN:  Error response (400/422/500). No partial ResearchSession in DB.
    """
    initial_count = db_session.query(ResearchSession).count()

    non_existent_chunk_id = str(uuid.uuid4())

    snapshot_payload = {
        "session": {
            "title": "FK Constraint Violation Test",
            "workflow_state": "intake",
        },
        "research_notes": [
            {
                "content": "Note hop le",
                "note_type": "insight",
            },
            {
                "content": "Note voi FK bi loi",
                "note_type": "insight",
                "source_chunk_id": non_existent_chunk_id,  # FK to non-existent chunk
            },
        ],
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/import", json=snapshot_payload)

    # Service should reject (400/422) or catch FK violation and rollback (400/500)
    assert response.status_code in {400, 409, 422, 500}, (
        f"Expected error status for FK constraint violation, got {response.status_code}: {response.text}"
    )

    db_session.expire_all()
    after_count = db_session.query(ResearchSession).count()
    assert after_count == initial_count, (
        f"Partial session detected after FK violation! "
        f"Count before={initial_count}, after={after_count}"
    )


# ──────────────────────────────────────────────
# Test 4: Unsupported template version → 422
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_import_unsupported_template_version_returns_error():
    """
    Phase 9.4 — Scenario H4: Unsupported template version
    GIVEN: POST /api/v1/sessions/from-template with `template_version` = "v99.0"
    WHEN:  The system does not support this version
    THEN:  HTTP 400 or 422. Response contains UNSUPPORTED_TEMPLATE_VERSION signal.
    """
    body = {
        "template_id": "engineering_composite_arm",
        "template_version": "v99.0",  # Unknown / unsupported version
        "custom_title": "Version Hardening Test",
    }

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.post("/api/v1/sessions/from-template", json=body)

    assert response.status_code in {400, 422}, (
        f"Expected 400/422 for unsupported template version, got {response.status_code}: {response.text}"
    )
    resp_body = response.json()
    error_signal = (
        resp_body.get("error_code", "") == "UNSUPPORTED_TEMPLATE_VERSION"
        or "version" in str(resp_body.get("detail", "")).lower()
        or "unsupported" in str(resp_body.get("detail", "")).lower()
    )
    assert error_signal, f"Expected UNSUPPORTED_TEMPLATE_VERSION signal in response, got: {resp_body}"


# ──────────────────────────────────────────────
# Test 5: Snapshot catalog immutability
# ──────────────────────────────────────────────

@pytest.mark.asyncio
async def test_snapshot_catalog_is_immutable_across_multiple_calls():
    """
    Phase 9.4 — Scenario H5: Snapshot catalog immutability
    GIVEN: GET /api/v1/sessions/templates
    WHEN:  Called 3 times consecutively
    THEN:  Each call returns HTTP 200 with identical IDs, count, and structure.
    """
    responses = []

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        for _ in range(3):
            r = await client.get("/api/v1/sessions/templates")
            assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text}"
            responses.append(r.json())

    first_data = responses[0].get("data", [])
    for i, resp in enumerate(responses[1:], start=2):
        subsequent_data = resp.get("data", [])
        assert len(subsequent_data) == len(first_data), (
            f"Call #{i} returned {len(subsequent_data)} templates, expected {len(first_data)}"
        )
        first_ids = sorted(t["id"] for t in first_data)
        subsequent_ids = sorted(t["id"] for t in subsequent_data)
        assert first_ids == subsequent_ids, (
            f"Call #{i} returned different template IDs: {subsequent_ids} vs {first_ids}"
        )

    # Structural invariants on final call
    final_data = responses[-1].get("data", [])
    assert len(final_data) >= 3, f"Expected at least 3 templates, got {len(final_data)}"
    for tpl in final_data:
        assert "id" in tpl and tpl["id"]
        assert "title" in tpl and tpl["title"]
        assert "domain" in tpl and tpl["domain"]
        assert "tags" in tpl and isinstance(tpl["tags"], list)
        assert "problem_frame" in tpl and isinstance(tpl["problem_frame"], dict)
