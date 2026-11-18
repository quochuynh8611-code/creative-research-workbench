"""Unit tests for the Demo Data Seeder (Batch C33 PR 2).

Enforces:
- Anti-Production Guard (rejects https://api.crw-workbench.com, http://staging.crw-workbench.com, https://example.com, etc.).
- Sandbox acceptance (localhost, 127.0.0.1, 0.0.0.0, testserver).
- Strict bounds: exactly 2 demo sessions, 1 problem frame, <= 2 notes, <= 2 solutions per session.
- Idempotency: re-running skips existing demo sessions without duplicate creation.
- Zero secret leak in both table and JSON outputs.
"""

import json
import sys
import uuid
from pathlib import Path
from typing import Any

import httpx
import pytest

# Ensure repo root and backend directory are in sys.path
backend_dir = Path(__file__).resolve().parent.parent.parent
repo_root = backend_dir.parent
for p in [str(backend_dir), str(repo_root)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from scripts.seed_demo_data import (
    DEMO_SESSIONS,
    format_seeder_json,
    format_seeder_table,
    seed_demo_data,
    validate_seeder_params,
)


def test_validate_seeder_params_accepts_sandbox_hosts():
    """Verify that localhost, 127.0.0.1, 0.0.0.0, and testserver are accepted."""
    for host in ["http://localhost:8000", "http://127.0.0.1:8000", "http://0.0.0.0:8000", "http://testserver"]:
        params = validate_seeder_params(base_url=host, output_format="table")
        assert params["base_url"] == host.rstrip("/")
        assert params["output_format"] == "table"


@pytest.mark.parametrize(
    "prohibited_url",
    [
        "https://api.crw-workbench.com",
        "http://staging.crw-workbench.com",
        "https://example.com",
        "http://production-db.internal",
        "https://192.168.1.100",
    ],
)
def test_validate_seeder_params_anti_production_guard_rejects_external_urls(prohibited_url):
    """Anti-Production Guard must strictly reject all external or production URLs."""
    with pytest.raises(ValueError, match="Anti-Production Guard"):
        validate_seeder_params(base_url=prohibited_url)


def test_validate_seeder_params_rejects_invalid_output_format():
    """Unsupported output format must raise ValueError."""
    with pytest.raises(ValueError, match="Unsupported output format"):
        validate_seeder_params(base_url="http://localhost:8000", output_format="yaml")


def test_demo_sessions_definition_strictly_satisfies_bounds():
    """Enforce architectural bounds on static demo session templates:
    - Exactly 2 demo sessions.
    - Each session has exactly 1 problem frame.
    - <= 2 notes per session.
    - <= 2 candidate solutions per session.
    """
    assert len(DEMO_SESSIONS) == 2, "Must contain strictly 2 demo sessions"

    for session in DEMO_SESSIONS:
        assert session["title"].startswith("[DEMO]"), "Demo session title must start with [DEMO]"
        assert session["domain"] in {"business", "software", "everyday"}
        assert len(session["problem_frames"]) == 1, "Must have exactly 1 problem frame"
        assert len(session["notes"]) <= 2, "Must not exceed 2 research notes"
        assert len(session["solutions"]) <= 2, "Must not exceed 2 candidate solutions"


@pytest.mark.asyncio
async def test_demo_seeder_creates_2_sessions_with_canonical_bounds():
    """Verify asynchronous seeding when no demo sessions exist."""
    created_resources: dict[str, list[dict[str, Any]]] = {
        "sessions": [],
        "problem_frames": [],
        "notes": [],
        "solutions": [],
    }

    def handler(request: httpx.Request) -> httpx.Response:
        url_path = request.url.path
        method = request.method

        # GET /api/v1/sessions
        if method == "GET" and url_path == "/api/v1/sessions":
            return httpx.Response(200, json={"items": created_resources["sessions"], "total": len(created_resources["sessions"])})

        # POST /api/v1/sessions
        if method == "POST" and url_path == "/api/v1/sessions":
            payload = json.loads(request.content.decode("utf-8"))
            session_id = str(uuid.uuid4())
            record = {"id": session_id, **payload}
            created_resources["sessions"].append(record)
            return httpx.Response(201, json={"id": session_id, **payload})

        # POST /api/v1/sessions/{id}/problem-frame
        if method == "POST" and "/problem-frame" in url_path:
            payload = json.loads(request.content.decode("utf-8"))
            frame_id = str(uuid.uuid4())
            record = {"id": frame_id, **payload}
            created_resources["problem_frames"].append(record)
            return httpx.Response(201, json={"id": frame_id, **payload})

        # POST /api/v1/sessions/{id}/notes
        if method == "POST" and "/notes" in url_path:
            payload = json.loads(request.content.decode("utf-8"))
            note_id = str(uuid.uuid4())
            record = {"id": note_id, **payload}
            created_resources["notes"].append(record)
            return httpx.Response(201, json={"id": note_id, **payload})

        # POST /api/v1/sessions/{id}/solutions
        if method == "POST" and "/solutions" in url_path:
            payload = json.loads(request.content.decode("utf-8"))
            sol_id = str(uuid.uuid4())
            record = {"id": sol_id, **payload}
            created_resources["solutions"].append(record)
            return httpx.Response(201, json={"id": sol_id, **payload})

        return httpx.Response(404, json={"detail": f"Not found: {method} {url_path}"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        summary = await seed_demo_data(client=client)

    assert summary["total_sessions_target"] == 2
    assert summary["sessions_created"] == 2
    assert summary["sessions_skipped"] == 0
    assert summary["problem_frames_created"] == 2
    assert summary["notes_created"] == 3  # Session 1 has 2 notes, Session 2 has 1 note
    assert summary["solutions_created"] == 3  # Session 1 has 2 solutions, Session 2 has 1 solution

    # Verify resource counts in mock
    assert len(created_resources["sessions"]) == 2
    assert len(created_resources["problem_frames"]) == 2
    assert len(created_resources["notes"]) == 3
    assert len(created_resources["solutions"]) == 3


@pytest.mark.asyncio
async def test_demo_seeder_idempotency_skips_existing_sessions():
    """When demo sessions already exist, seeder must skip without creating duplicates."""
    # Pre-existing demo sessions
    pre_existing_sessions = [
        {"id": str(uuid.uuid4()), "title": "[DEMO] Tối ưu Tốc độ Giao hàng & Chi phí Logistics Chặng Cuối", "domain": "business"},
        {"id": str(uuid.uuid4()), "title": "[DEMO] Tăng cường An ninh Đa tầng & Giảm Độ trễ API Gateway", "domain": "software"},
    ]

    post_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url_path = request.url.path
        method = request.method

        if method == "GET" and url_path == "/api/v1/sessions":
            return httpx.Response(200, json={"items": pre_existing_sessions, "total": len(pre_existing_sessions)})

        if method == "POST":
            post_calls.append(url_path)
            return httpx.Response(201, json={"id": str(uuid.uuid4())})

        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        summary = await seed_demo_data(client=client)

    assert summary["total_sessions_target"] == 2
    assert summary["sessions_created"] == 0
    assert summary["sessions_skipped"] == 2
    assert len(post_calls) == 0, "No POST calls should be made when sessions already exist"


@pytest.mark.asyncio
async def test_demo_seeder_idempotency_case_a_skips_when_prefix_demo_present_with_altered_title():
    """Case a: Session has [DEMO] prefix but altered title/domain -> must skip to prevent duplicate demo sessions."""
    pre_existing_sessions = [
        {"id": str(uuid.uuid4()), "title": "[DEMO] Logistics Chặng Cuối Tối Ưu Đội Ngũ Giao Vận", "domain": "business"},
        {"id": str(uuid.uuid4()), "title": "[DEMO] API Gateway An Ninh Đa Tầng", "domain": "software"},
    ]

    post_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url_path = request.url.path
        method = request.method

        if method == "GET" and url_path == "/api/v1/sessions":
            return httpx.Response(200, json={"items": pre_existing_sessions, "total": len(pre_existing_sessions)})

        if method == "POST":
            post_calls.append(url_path)
            return httpx.Response(201, json={"id": str(uuid.uuid4())})

        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        summary = await seed_demo_data(client=client)

    assert summary["sessions_created"] == 0
    assert summary["sessions_skipped"] == 2
    assert len(post_calls) == 0


@pytest.mark.asyncio
async def test_demo_seeder_idempotency_case_b_skips_when_exact_title_matches_without_demo_prefix():
    """Case b: Session has exact target title but user or system stripped the [DEMO] prefix -> must skip."""
    pre_existing_sessions = [
        {"id": str(uuid.uuid4()), "title": "Tối ưu Tốc độ Giao hàng & Chi phí Logistics Chặng Cuối", "domain": "business"},
        {"id": str(uuid.uuid4()), "title": "Tăng cường An ninh Đa tầng & Giảm Độ trễ API Gateway", "domain": "software"},
    ]

    post_calls: list[str] = []

    def handler(request: httpx.Request) -> httpx.Response:
        url_path = request.url.path
        method = request.method

        if method == "GET" and url_path == "/api/v1/sessions":
            return httpx.Response(200, json={"items": pre_existing_sessions, "total": len(pre_existing_sessions)})

        if method == "POST":
            post_calls.append(url_path)
            return httpx.Response(201, json={"id": str(uuid.uuid4())})

        return httpx.Response(404)

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
        summary = await seed_demo_data(client=client)

    assert summary["sessions_created"] == 0
    assert summary["sessions_skipped"] == 2
    assert len(post_calls) == 0


def test_demo_seeder_zero_secret_leak_table_and_json_outputs():
    """Ensure neither table nor JSON output contains unmasked secrets or sensitive tokens."""
    dummy_summary = {
        "total_sessions_target": 2,
        "sessions_created": 2,
        "sessions_skipped": 0,
        "problem_frames_created": 2,
        "notes_created": 3,
        "solutions_created": 3,
        "sessions": [
            {
                "id": str(uuid.uuid4()),
                "title": "[DEMO] Tối ưu Tốc độ Giao hàng & Chi phí Logistics Chặng Cuối",
                "status": "created",
                "problem_frames": 1,
                "notes": 2,
                "solutions": 2,
                "credentials_preview": "sk-proj-abc12345678901234567890, Bearer secrettoken12345678",
            }
        ],
    }

    # Test Table Format
    table_str = format_seeder_table(dummy_summary)
    assert "[DEMO]" in table_str
    assert "sk-proj-abc12345678901234567890" not in table_str
    assert "Bearer secrettoken12345678" not in table_str
    assert "sk-proj-***" in table_str or "[MASKED]" in table_str

    # Test JSON Format
    json_str = format_seeder_json(dummy_summary)
    parsed = json.loads(json_str)
    assert isinstance(parsed, dict)
    assert parsed["sessions_created"] == 2
    assert "sk-proj-abc12345678901234567890" not in json_str
    assert "Bearer secrettoken12345678" not in json_str
