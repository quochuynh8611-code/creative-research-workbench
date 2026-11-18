#!/usr/bin/env python3
"""Sample Data Seeder CLI for Creative Research Workbench (Batch C33).

This script provides safe, idempotent seeding of 2 complete demo sessions for
local stakeholder demonstrations and developer sandboxes.

Safety Constraints & Boundaries:
- STRICTLY FOR LOCAL / SANDBOX ENVIRONMENTS.
  THIS IS NOT A PRODUCTION DATA INGESTION TOOL.
- Anti-Production Guard: strictly restricted to localhost / 127.0.0.1 / 0.0.0.0 / testserver.
- Strict Bounds: exactly 2 demo sessions, 1 problem frame, <= 2 notes, <= 2 solutions per session.
- Multi-criteria Idempotency: checks both [DEMO] prefix and exact title to prevent duplicates.
- Zero Secret Leak: all outputs (table and JSON) mask credentials and tokens.
- No DB schema changes: operates purely through standard HTTP REST API endpoints.
"""

import argparse
import asyncio
import json
import re
import sys
from typing import Any
from urllib.parse import urlparse

import httpx

ALLOWED_HOSTS = {"localhost", "127.0.0.1", "0.0.0.0", "testserver"}
VALID_OUTPUT_FORMATS = {"table", "json"}

# 2 Canonical Demo Sessions satisfying all architectural bounds
DEMO_SESSIONS: list[dict[str, Any]] = [
    {
        "title": "[DEMO] Tối ưu Tốc độ Giao hàng & Chi phí Logistics Chặng Cuối",
        "domain": "business",
        "description": "Mô hình giải quyết mâu thuẫn giữa tốc độ giao vận 2h và chi phí kho bãi/tài xế trực chờ.",
        "problem_frames": [
            {
                "raw_statement": (
                    "Cần giao hàng nhanh dưới 2 giờ tới khách hàng nội đô nhưng không làm tăng chi phí "
                    "đội ngũ tài xế và kho bãi chặng cuối."
                ),
                "domain": "business",
            }
        ],
        "notes": [
            {
                "content": (
                    "Khảo sát thời gian chết của đội ngũ giao vận tại 5 quận trung tâm cho thấy 45% thời gian "
                    "tài xế chờ nhận đơn tại kho tổng."
                ),
                "note_type": "insight",
            },
            {
                "content": (
                    "Mô hình Hub phân tán siêu nhỏ (Micro-fulfillment Center) giúp giảm 35% quãng đường di chuyển "
                    "của tài xế chặng cuối."
                ),
                "note_type": "hypothesis",
            },
        ],
        "solutions": [
            {
                "title": "Ứng dụng Nguyên tắc 10 (Hành động trước): Dự đoán nhu cầu SKU bán chạy tại từng cụm dân cư",
                "mechanism": (
                    "Chuyển trước các mặt hàng thiết yếu đến các điểm ký gửi/tủ khóa thông minh trước giờ cao điểm "
                    "để tài xế lấy hàng trong bán kính 500m."
                ),
                "status": "accepted",
                "novelty_score": 0.8,
                "feasibility_score": 0.9,
                "risk_notes": "Cần thuật toán dự báo tồn kho SKU chính xác.",
            },
            {
                "title": "Ứng dụng Nguyên tắc 1 (Phân nhỏ): Chia gói hàng thành cụm bưu kiện theo bán kính 1km",
                "mechanism": (
                    "Gom đơn theo cụm bán kính hẹp và điều phối tài xế bán thời gian tại chỗ giao chặng ngắn."
                ),
                "status": "candidate",
                "novelty_score": 0.7,
                "feasibility_score": 0.8,
                "risk_notes": "Chất lượng phục vụ của tài xế cộng tác viên cần kiểm soát chặt chẽ.",
            },
        ],
    },
    {
        "title": "[DEMO] Tăng cường An ninh Đa tầng & Giảm Độ trễ API Gateway",
        "domain": "software",
        "description": "Mô hình giải quyết mâu thuẫn giữa kiểm tra an ninh đa lớp và yêu cầu độ trễ phản hồi thấp của API Gateway.",
        "problem_frames": [
            {
                "raw_statement": (
                    "Cần kiểm tra chữ ký token và giải mã đa lớp nhưng không được làm tăng độ trễ phản hồi API quá 50ms."
                ),
                "domain": "software",
            }
        ],
        "notes": [
            {
                "content": (
                    "Benchmarking thời gian xác thực asymmetric JWT RSA-2048 cho thấy tiêu tốn 12-18ms CPU per request "
                    "so với <1ms của HMAC-SHA256."
                ),
                "note_type": "insight",
            }
        ],
        "solutions": [
            {
                "title": "Ứng dụng Nguyên tắc 19 (Hành động theo chu kỳ): Xác thực định kỳ và cache phiên token an toàn",
                "mechanism": (
                    "Xác thực toàn diện chữ ký khóa công khai theo chu kỳ 5 phút và lưu phiên xác thực tại in-memory "
                    "cache cục bộ với cơ chế chủ động hủy phiên."
                ),
                "status": "accepted",
                "novelty_score": 0.8,
                "feasibility_score": 0.9,
                "risk_notes": "Cần cơ chế Webhook / Event bus hủy phiên cache tức thì khi tài khoản bị khóa.",
            }
        ],
    },
]


def mask_secrets_in_text(text: str) -> str:
    """Mask sensitive tokens, API keys, and Authorization headers in text output."""
    masked = text
    # Mask OpenAI / API keys
    masked = re.sub(r"sk-[a-zA-Z0-9_\-]{10,}", "sk-proj-***[MASKED]***", masked)
    # Mask Bearer tokens
    masked = re.sub(r"(Bearer\s+)[a-zA-Z0-9_\-\.]+", r"\1***[MASKED]***", masked)
    # Mask password/token fields
    masked = re.sub(
        r"((?:password|token|api_key|secret)\s*[:=]\s*)(?:['\"][^'\"]+['\"]|[^\s,;]+)",
        r"\1***[MASKED]***",
        masked,
        flags=re.IGNORECASE,
    )
    return masked


def validate_seeder_params(
    base_url: str,
    output_format: str = "table",
) -> dict[str, Any]:
    """Validate seeder inputs and enforce the Anti-Production Guard."""
    if output_format not in VALID_OUTPUT_FORMATS:
        raise ValueError(
            f"Unsupported output format '{output_format}'. Must be one of {sorted(VALID_OUTPUT_FORMATS)}"
        )

    parsed = urlparse(base_url)
    hostname = (parsed.hostname or "").lower()

    if hostname not in ALLOWED_HOSTS:
        raise ValueError(
            f"Anti-Production Guard: Host '{hostname}' is not permitted. "
            f"Demo seeder only allowed against localhost/sandbox environments ({sorted(ALLOWED_HOSTS)})."
        )

    return {
        "base_url": base_url.rstrip("/"),
        "output_format": output_format,
    }


def is_session_already_seeded(
    target_session: dict[str, Any],
    existing_sessions: list[dict[str, Any]],
) -> bool:
    """Multi-criteria idempotency check:
    Returns True if an existing session already represents this target demo session:
    - Case 1: Exact title match with [DEMO] prefix.
    - Case b: Exact core title match without [DEMO] prefix.
    - Case a: Session has [DEMO] prefix and matches domain or significant core keywords.
    """
    target_title = target_session["title"].strip()
    target_core = target_title.removeprefix("[DEMO]").strip().lower()
    target_domain = (target_session.get("domain") or "").strip().lower()

    for existing in existing_sessions:
        ext_title = (existing.get("title") or "").strip()
        ext_lower = ext_title.lower()
        ext_domain = (existing.get("domain") or "").strip().lower()

        # Exact match with [DEMO] prefix
        if ext_title == target_title:
            return True

        # Case b: Exact match without [DEMO] prefix
        if ext_lower == target_core or ext_title.removeprefix("[DEMO]").strip().lower() == target_core:
            return True

        # Case a: Existing session has [DEMO] prefix but title was altered
        if ext_title.startswith("[DEMO]"):
            if ext_domain and target_domain and ext_domain == target_domain:
                return True
            # Keyword overlap check
            ext_core_words = set(ext_title.removeprefix("[DEMO]").strip().lower().split())
            target_words = set(target_core.split())
            if len(ext_core_words.intersection(target_words)) >= 2:
                return True

    return False


async def seed_demo_data(client: httpx.AsyncClient) -> dict[str, Any]:
    """Asynchronously seed demo data into the CRW backend via REST API."""
    summary: dict[str, Any] = {
        "total_sessions_target": len(DEMO_SESSIONS),
        "sessions_created": 0,
        "sessions_skipped": 0,
        "problem_frames_created": 0,
        "notes_created": 0,
        "solutions_created": 0,
        "sessions": [],
    }

    # 1. Fetch existing sessions for idempotency
    existing_resp = await client.get("/api/v1/sessions")
    existing_sessions: list[dict[str, Any]] = []
    if existing_resp.status_code == 200:
        data = existing_resp.json()
        if isinstance(data, dict) and "items" in data:
            existing_sessions = data["items"]
        elif isinstance(data, list):
            existing_sessions = data

    # 2. Iterate through demo sessions
    for demo in DEMO_SESSIONS:
        if is_session_already_seeded(demo, existing_sessions):
            summary["sessions_skipped"] += 1
            summary["sessions"].append(
                {
                    "title": demo["title"],
                    "status": "skipped_existing",
                    "domain": demo["domain"],
                }
            )
            continue

        # Create Session: POST /api/v1/sessions
        session_payload = {
            "title": demo["title"],
            "description": demo["description"],
            "domain": demo["domain"],
        }
        create_resp = await client.post("/api/v1/sessions", json=session_payload)
        if create_resp.status_code not in (200, 201):
            raise RuntimeError(
                f"Failed to create session '{demo['title']}': {create_resp.status_code} {create_resp.text}"
            )

        session_data = create_resp.json()
        session_id = session_data.get("id") or session_data.get("session_id")
        summary["sessions_created"] += 1

        session_record: dict[str, Any] = {
            "id": session_id,
            "title": demo["title"],
            "status": "created",
            "domain": demo["domain"],
            "problem_frames": 0,
            "notes": 0,
            "solutions": 0,
        }

        # Create Problem Frame: POST /api/v1/sessions/{id}/problem-frame
        for frame in demo.get("problem_frames", []):
            pf_resp = await client.post(
                f"/api/v1/sessions/{session_id}/problem-frame",
                json=frame,
            )
            if pf_resp.status_code in (200, 201):
                summary["problem_frames_created"] += 1
                session_record["problem_frames"] += 1

        # Create Research Notes: POST /api/v1/sessions/{id}/notes
        for note in demo.get("notes", []):
            note_resp = await client.post(
                f"/api/v1/sessions/{session_id}/notes",
                json=note,
            )
            if note_resp.status_code in (200, 201):
                summary["notes_created"] += 1
                session_record["notes"] += 1

        # Create Candidate Solutions: POST /api/v1/sessions/{id}/solutions
        for sol in demo.get("solutions", []):
            sol_resp = await client.post(
                f"/api/v1/sessions/{session_id}/solutions",
                json=sol,
            )
            if sol_resp.status_code in (200, 201):
                summary["solutions_created"] += 1
                session_record["solutions"] += 1

        summary["sessions"].append(session_record)

    return summary


def format_seeder_table(summary: dict[str, Any]) -> str:
    """Format seeding summary into a clean, masked ASCII table."""
    lines = [
        "=" * 80,
        "CREATIVE RESEARCH WORKBENCH — DEMO DATA SEEDER SUMMARY",
        "=" * 80,
        f"Target Sessions: {summary.get('total_sessions_target', 0)}",
        f"Sessions Created: {summary.get('sessions_created', 0)}",
        f"Sessions Skipped: {summary.get('sessions_skipped', 0)}",
        f"Problem Frames Created: {summary.get('problem_frames_created', 0)}",
        f"Notes Created: {summary.get('notes_created', 0)}",
        f"Solutions Created: {summary.get('solutions_created', 0)}",
        "-" * 80,
        f"{'TITLE':<52} | {'DOMAIN':<10} | {'STATUS':<12}",
        "-" * 80,
    ]

    for s in summary.get("sessions", []):
        title = s.get("title", "")[:50]
        domain = s.get("domain", "")[:10]
        status = s.get("status", "")[:12]
        lines.append(f"{title:<52} | {domain:<10} | {status:<12}")
        if "notes" in s and isinstance(s["notes"], str):
            lines.append(f"  Notes: {s['notes']}")
        if "credentials_preview" in s:
            lines.append(f"  Preview: {s['credentials_preview']}")

    lines.append("=" * 80)
    return mask_secrets_in_text("\n".join(lines))


def format_seeder_json(summary: dict[str, Any]) -> str:
    """Format seeding summary as masked JSON string."""
    raw_json = json.dumps(summary, indent=2, ensure_ascii=False)
    return mask_secrets_in_text(raw_json)


async def main_async(args: argparse.Namespace) -> int:
    """Async coordinator for the demo data seeder."""
    validated = validate_seeder_params(
        base_url=args.base_url,
        output_format=args.format,
    )

    print(f"Connecting to sandbox backend at {validated['base_url']}...")
    async with httpx.AsyncClient(base_url=validated["base_url"], timeout=30.0) as client:
        summary = await seed_demo_data(client=client)

    output_str = (
        format_seeder_json(summary)
        if validated["output_format"] == "json"
        else format_seeder_table(summary)
    )

    if args.output:
        import pathlib
        pathlib.Path(args.output).write_text(output_str, encoding="utf-8")
        print(f"Output saved to {args.output}")
    else:
        print(output_str)

    return 0


def main() -> None:
    """CLI Entrypoint for the demo data seeder."""
    parser = argparse.ArgumentParser(
        description="Seed 2 canonical demo sessions into Creative Research Workbench."
    )
    parser.add_argument(
        "--base-url",
        default="http://localhost:8000",
        help="Base URL of local CRW backend (default: http://localhost:8000).",
    )
    parser.add_argument(
        "--format",
        choices=["table", "json"],
        default="table",
        help="Output format: table or json (default: table).",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Optional file path to write output (default: print to stdout).",
    )

    args = parser.parse_args()

    try:
        exit_code = asyncio.run(main_async(args))
        sys.exit(exit_code)
    except ValueError as val_err:
        print(f"Validation error: {val_err}", file=sys.stderr)
        sys.exit(1)
    except (httpx.HTTPError, RuntimeError) as exc:
        print(f"Seeder execution failed: {exc}", file=sys.stderr)
        sys.exit(1)
    except Exception as exc:  # noqa: BLE001
        print(f"Unexpected error: {exc}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
