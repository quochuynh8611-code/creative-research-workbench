"""
test_migration_artifact_freshness.py — Failing verification tests for migration artifact freshness

Given/When/Then coverage:
  1. test_source_repository_reports_expected_single_head_revision:
     Given the source repository Alembic script directory,
     When the current heads are inspected,
     Then the repository must expose exactly revision '003'.

  2. test_ci_workflow_enforces_backend_image_or_migration_artifact_verification:
     Given migration artifacts are copied into the backend runtime image,
     When the CI workflow is inspected,
     Then CI must either build the backend image or run an explicit migration artifact verification step.
"""
from __future__ import annotations

import pathlib

from alembic.config import Config
from alembic.script import ScriptDirectory


REPO_ROOT = pathlib.Path(__file__).resolve().parents[2]
ALEMBIC_INI_PATH = REPO_ROOT / "alembic.ini"
ALEMBIC_DIR = REPO_ROOT / "alembic"
CI_WORKFLOW_PATH = REPO_ROOT.parent / ".github" / "workflows" / "ci.yml"


def _get_script_directory() -> ScriptDirectory:
    cfg = Config(str(ALEMBIC_INI_PATH))
    cfg.set_main_option("script_location", str(ALEMBIC_DIR))
    return ScriptDirectory.from_config(cfg)


def test_source_repository_reports_expected_single_head_revision() -> None:
    """
    Given: Source repository chứa các Alembic revisions trong backend/alembic/versions.
    When: Truy vấn danh sách current heads từ ScriptDirectory.
    Then: Phải có đúng một head và head đó là revision '003'.
    """
    script = _get_script_directory()
    heads = script.get_heads()

    assert heads == ["003"], f"Expected Alembic source head ['003'], got {heads}"


def test_ci_workflow_enforces_backend_image_or_migration_artifact_verification() -> None:
    """
    Given: Backend Dockerfile copy alembic artifacts vào runtime image.
    When: Phân tích workflow CI hiện tại.
    Then: CI phải build backend image hoặc có bước verification rõ ràng cho migration artifact freshness.
    """
    workflow_content = CI_WORKFLOW_PATH.read_text(encoding="utf-8")

    has_backend_image_build = any(
        marker in workflow_content
        for marker in (
            "docker build ./backend",
            "docker build backend",
            "docker build -f backend/Dockerfile",
            "docker compose build",
            "docker/build-push-action",
        )
    )
    has_explicit_artifact_verification = any(
        marker in workflow_content
        for marker in (
            "alembic heads",
            "migration artifact freshness",
            "artifact freshness",
            "stale image",
            "docker run",
        )
    )

    assert has_backend_image_build or has_explicit_artifact_verification, (
        "CI thiếu backend image build hoặc migration artifact freshness verification; "
        "stale runtime image có thể không bị phát hiện khi source Alembic head tăng lên '003'."
    )
