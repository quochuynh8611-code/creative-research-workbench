"""
conftest.py — Fixtures cho TRIZ Staging Validation Suite.

Tuân thủ nguyên tắc fail-closed:
  - TRIZ_STAGING_DIR bắt buộc phải được cấu hình qua biến môi trường khi chạy suite.
  - Từng artifact được kiểm tra phụ thuộc độc lập theo nhu cầu của từng test/fixture.
  - Scaffold reference bắt buộc phải được cung cấp tường minh qua TRIZ_SCAFFOLD_PATH.
"""
from __future__ import annotations

import json
import os
import pathlib
from typing import Any, Callable
import pytest


@pytest.fixture(scope="session")
def staging_dir() -> pathlib.Path:
    """Xác thực và trả về đường dẫn staging directory từ biến môi trường."""
    env_val = os.environ.get("TRIZ_STAGING_DIR", "").strip()
    if not env_val:
        raise RuntimeError("TRIZ_STAGING_DIR environment variable must be configured")
    path = pathlib.Path(env_val)
    if not path.exists() or not path.is_dir():
        raise RuntimeError(f"TRIZ staging directory does not exist or is not a directory: {path}")
    return path


@pytest.fixture(scope="session")
def artifact_resolver(staging_dir: pathlib.Path) -> Callable[[str], pathlib.Path]:
    """Trả về hàm kiểm tra và phân giải đường dẫn cho từng artifact trong staging directory."""
    def _resolve(filename: str) -> pathlib.Path:
        target = staging_dir / filename
        if not target.is_file():
            raise RuntimeError(f"Required TRIZ staging artifact missing: {filename}")
        return target
    return _resolve


@pytest.fixture(scope="module")
def manifest_data(artifact_resolver: Callable[[str], pathlib.Path]) -> dict[str, Any]:
    """Nạp dữ liệu từ artifact_manifest.json."""
    manifest_path = artifact_resolver("artifact_manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def staging_data(artifact_resolver: Callable[[str], pathlib.Path]) -> dict[str, Any]:
    """Nạp dữ liệu từ triz_matrix_39x39_canonical_candidate.json."""
    staging_json_path = artifact_resolver("triz_matrix_39x39_canonical_candidate.json")
    with open(staging_json_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def regression_fixtures(artifact_resolver: Callable[[str], pathlib.Path]) -> list[dict[str, Any]]:
    """Nạp dữ liệu từ cell_regression_fixtures.json."""
    fixtures_path = artifact_resolver("cell_regression_fixtures.json")
    with open(fixtures_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def scaffold_path() -> pathlib.Path:
    """
    Xác thực và phân giải đường dẫn scaffold từ biến môi trường TRIZ_SCAFFOLD_PATH.
    Bắt buộc phải là file hợp lệ; không chấp nhận directory hoặc chuỗi rỗng.
    """
    scaffold_env = os.environ.get("TRIZ_SCAFFOLD_PATH", "").strip()
    if not scaffold_env:
        raise RuntimeError("Explicit scaffold reference required via TRIZ_SCAFFOLD_PATH")
    path = pathlib.Path(scaffold_env)
    if not path.is_file():
        raise RuntimeError(
            f"Explicit scaffold reference required via TRIZ_SCAFFOLD_PATH: file not found '{path}'"
        )
    return path


@pytest.fixture(scope="module")
def scaffold_data(scaffold_path: pathlib.Path) -> dict[str, Any]:
    """
    Nạp dữ liệu scaffold từ scaffold_path đã được xác thực là file hợp lệ.
    Tuyệt đối không fallback vào file .bak hoặc canonical production matrix.
    """
    with open(scaffold_path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def raw_html_path(artifact_resolver: Callable[[str], pathlib.Path]) -> pathlib.Path:
    """Phân giải đường dẫn file HTML snapshot gốc."""
    return artifact_resolver("triz40_raw_matrix_snapshot.html")


@pytest.fixture(scope="module")
def staging_json_path(artifact_resolver: Callable[[str], pathlib.Path]) -> pathlib.Path:
    """Phân giải đường dẫn file JSON ứng viên chuẩn hóa."""
    return artifact_resolver("triz_matrix_39x39_canonical_candidate.json")


@pytest.fixture(scope="module")
def fixture_path(artifact_resolver: Callable[[str], pathlib.Path]) -> pathlib.Path:
    """Phân giải đường dẫn file cell regression fixtures."""
    return artifact_resolver("cell_regression_fixtures.json")


@pytest.fixture(scope="module")
def extraction_script_path(artifact_resolver: Callable[[str], pathlib.Path]) -> pathlib.Path:
    """Phân giải đường dẫn script extract_triz40_matrix.py."""
    return artifact_resolver("extract_triz40_matrix.py")
