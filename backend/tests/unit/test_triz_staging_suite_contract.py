"""
test_triz_staging_suite_contract.py — Contract tests cho việc tách biệt và chuẩn hóa TRIZ Staging Suite.

Mục tiêu (Design Contracts):
  A. Collection Isolation & Suite Location:
     - Lệnh pytest mặc định hoặc explicit tests/ KHÔNG được thu thập staging suite.
     - Các production TRIZ tests vẫn được thu thập đầy đủ (kiểm tra qua 3 guards đại diện).
     - Staging suite phải tồn tại độc quyền tại backend/research_tests/triz_staging/
       và không còn tồn tại tại backend/tests/unit/.
  B. Missing Staging Config:
     - Khi chạy opt-in mà thiếu cấu hình TRIZ_STAGING_DIR, suite phải FAIL rõ ràng (fail-closed)
       với thông điệp chẩn đoán chính xác:
       "TRIZ_STAGING_DIR environment variable must be configured"
  C. Missing Artifact:
     - Khi staging directory thiếu một artifact cụ thể (ví dụ artifact_manifest.json),
       test phải FAIL với thông điệp chẩn đoán chính xác:
       "Required TRIZ staging artifact missing: artifact_manifest.json"
  D. Missing Scaffold:
     - Nhóm test divergence yêu cầu tường minh scaffold reference (qua TRIZ_SCAFFOLD_PATH),
       không silently skip khi thiếu và FAIL với thông điệp chẩn đoán chính xác:
       "Explicit scaffold reference required via TRIZ_SCAFFOLD_PATH"
"""
from __future__ import annotations

import json
import os
import pathlib
import subprocess
import sys
import pytest


REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
BACKEND_DIR = pathlib.Path(__file__).resolve().parents[2]

# Ba node đại diện cho production TRIZ test suite dùng làm collection guards.
# Đây chỉ là các guards đại diện, không thay thế cho toàn bộ production test suite.
REPRESENTATIVE_PRODUCTION_TRIZ_GUARDS = [
    "tests/integration/test_triz_full_matrix.py::test_triz_matrix_json_schema_and_completeness",
    "tests/integration/test_triz_catalog_api.py::test_get_triz_parameters_returns_39_items",
    "tests/unit/test_everyday_triz_lens.py::test_everyday_triz_lens_json_structure",
]

DIAGNOSTIC_MISSING_CONFIG = "TRIZ_STAGING_DIR environment variable must be configured"
DIAGNOSTIC_MISSING_MANIFEST = "Required TRIZ staging artifact missing: artifact_manifest.json"
DIAGNOSTIC_MISSING_SCAFFOLD = "Explicit scaffold reference required via TRIZ_SCAFFOLD_PATH"


def _get_clean_env() -> dict[str, str]:
    """Tạo môi trường subprocess sạch, loại bỏ biến ambient TRIZ và PYTEST_ADDOPTS."""
    env = os.environ.copy()
    for key in list(env.keys()):
        if key.startswith("TRIZ_") or key in ("PYTEST_ADDOPTS", "TEST_DATABASE_URL", "DATABASE_URL"):
            env.pop(key, None)
    return env


def _find_staging_suite_path() -> pathlib.Path:
    """Tìm đường dẫn staging suite tại vị trí research đích hoặc vị trí unit cũ."""
    target_path = BACKEND_DIR / "research_tests/triz_staging/test_triz_staging_validation.py"
    legacy_path = BACKEND_DIR / "tests/unit/test_triz_staging_validation.py"

    if target_path.exists():
        return target_path
    if legacy_path.exists():
        return legacy_path

    raise FileNotFoundError(
        f"Không tìm thấy file staging suite tại cả vị trí đích ({target_path}) lẫn vị trí cũ ({legacy_path})"
    )


def test_staging_suite_located_exclusively_in_research_directory():
    """
    Contract A1: Staging suite BẮT BUỘC phải tồn tại tại vị trí research đích
    (backend/research_tests/triz_staging/test_triz_staging_validation.py)
    và KHÔNG ĐƯỢC tồn tại tại vị trí production unit cũ (backend/tests/unit/).

    Baseline dự kiến RED vì file cũ vẫn ở tests/unit/ và vị trí đích chưa có.
    """
    target_path = BACKEND_DIR / "research_tests/triz_staging/test_triz_staging_validation.py"
    legacy_path = BACKEND_DIR / "tests/unit/test_triz_staging_validation.py"

    assert target_path.exists(), (
        f"Staging suite chưa tồn tại ở vị trí research đích: {target_path}"
    )
    assert not legacy_path.exists(), (
        f"Staging suite vẫn còn tồn tại ở vị trí production unit cũ: {legacy_path}"
    )


def test_default_pytest_collection_excludes_staging_suite():
    """
    Contract A2: Pytest mặc định tại backend không được thu thập staging suite.
    Ba guards đại diện của production TRIZ bắt buộc phải xuất hiện đầy đủ.
    """
    cmd = [sys.executable, "-m", "pytest", "--collect-only", "-q"]
    res = subprocess.run(
        cmd,
        cwd=str(BACKEND_DIR),
        env=_get_clean_env(),
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert res.returncode == 0, (
        f"pytest --collect-only thất bại! Exit code: {res.returncode}\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )

    lines = [line.strip() for line in res.stdout.splitlines() if line.strip()]

    # Production guards đại diện phải được collect đầy đủ
    for guard in REPRESENTATIVE_PRODUCTION_TRIZ_GUARDS:
        assert any(guard in line for line in lines), (
            f"Production TRIZ guard đại diện '{guard}' bị thiếu trong default collection!\n"
            f"Stdout:\n{res.stdout}"
        )

    # Staging suite KHÔNG được xuất hiện trong collection mặc định
    staging_matches = [line for line in lines if "test_triz_staging_validation" in line]
    assert not staging_matches, (
        f"LỖI COLLECTION CONTRACT: Staging suite vẫn bị thu thập trong default collection! "
        f"Các test rò rỉ: {staging_matches}\n"
        f"Stdout:\n{res.stdout}"
    )


def test_explicit_tests_collection_excludes_staging_suite():
    """
    Contract A3: Pytest với explicit path 'tests/' không được thu thập staging suite.
    Ba guards đại diện của production TRIZ bắt buộc phải xuất hiện đầy đủ.
    """
    cmd = [sys.executable, "-m", "pytest", "tests/", "--collect-only", "-q"]
    res = subprocess.run(
        cmd,
        cwd=str(BACKEND_DIR),
        env=_get_clean_env(),
        capture_output=True,
        text=True,
        timeout=15,
    )

    assert res.returncode == 0, (
        f"pytest tests/ --collect-only thất bại! Exit code: {res.returncode}\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )

    lines = [line.strip() for line in res.stdout.splitlines() if line.strip()]

    # Production guards đại diện phải được collect đầy đủ
    for guard in REPRESENTATIVE_PRODUCTION_TRIZ_GUARDS:
        assert any(guard in line for line in lines), (
            f"Production TRIZ guard đại diện '{guard}' bị thiếu trong explicit tests/ collection!\n"
            f"Stdout:\n{res.stdout}"
        )

    # Staging suite KHÔNG được xuất hiện khi collect tests/
    staging_matches = [line for line in lines if "test_triz_staging_validation" in line]
    assert not staging_matches, (
        f"LỖI COLLECTION CONTRACT: Staging suite vẫn bị thu thập khi chạy 'pytest tests/'! "
        f"Các test rò rỉ: {staging_matches}\n"
        f"Stdout:\n{res.stdout}"
    )


def test_research_suite_fails_closed_when_staging_config_missing():
    """
    Contract B: Khi chạy opt-in staging suite mà thiếu cấu hình TRIZ_STAGING_DIR,
    suite phải FAIL rõ ràng (exit theo lỗi test/fixture) với thông điệp chẩn đoán chính xác:
    'TRIZ_STAGING_DIR environment variable must be configured'.
    Không được silently skip, không được lỗi import/collection, và không dùng hardcoded path.
    """
    suite_path = _find_staging_suite_path()
    rel_path = suite_path.relative_to(BACKEND_DIR)

    clean_env = _get_clean_env()  # Đảm bảo không có TRIZ_STAGING_DIR

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        f"{rel_path}::test_manifest_integrity_and_stability",
        "-v",
    ]
    res = subprocess.run(
        cmd,
        cwd=str(BACKEND_DIR),
        env=clean_env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    output = f"{res.stdout}\n{res.stderr}"

    # Reject các lỗi collection / import / môi trường hỏng
    assert "ImportError" not in output, f"Lỗi ImportError ngoài ý muốn!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    assert "ModuleNotFoundError" not in output, f"Lỗi ModuleNotFoundError!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    assert "ERROR: file or package not found" not in output, f"Node path không tồn tại!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    assert "SKIPPED" not in output and "skipped" not in output, f"Test bị silently skip!\nStdout:\n{res.stdout}"

    # Bắt buộc phải thất bại với exit code 1 (lỗi test/fixture)
    assert res.returncode == 1, (
        "LỖI CONFIG CONTRACT: Staging suite không fail với exit code 1 khi thiếu TRIZ_STAGING_DIR! "
        f"Exit code: {res.returncode}\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )

    # Bắt buộc phải có thông điệp chẩn đoán chính xác
    assert DIAGNOSTIC_MISSING_CONFIG in output, (
        f"LỖI CONFIG CONTRACT: Thiếu diagnostic chính xác '{DIAGNOSTIC_MISSING_CONFIG}'.\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )


def test_research_suite_fails_when_specific_artifact_missing(tmp_path):
    """
    Contract C: Khi TRIZ_STAGING_DIR trỏ vào thư mục thiếu artifact (ví dụ thiếu artifact_manifest.json),
    test phải FAIL (exit theo lỗi test/fixture) với thông điệp chẩn đoán chính xác:
    'Required TRIZ staging artifact missing: artifact_manifest.json'.
    Không silently skip và không lỗi import/collection.
    """
    suite_path = _find_staging_suite_path()
    rel_path = suite_path.relative_to(BACKEND_DIR)

    # Thư mục tổng hợp rỗng, cố tình thiếu artifact_manifest.json
    synthetic_staging = tmp_path / "synthetic_staging_missing_manifest"
    synthetic_staging.mkdir()

    env = _get_clean_env()
    env["TRIZ_STAGING_DIR"] = str(synthetic_staging)

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        f"{rel_path}::test_manifest_integrity_and_stability",
        "-v",
    ]
    res = subprocess.run(
        cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    output = f"{res.stdout}\n{res.stderr}"

    # Reject collection/import/skip
    assert "ImportError" not in output, f"Lỗi ImportError!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    assert "ModuleNotFoundError" not in output, f"Lỗi ModuleNotFoundError!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    assert "ERROR: file or package not found" not in output, f"Node path không tồn tại!\nStdout:\n{res.stdout}"
    assert "SKIPPED" not in output and "skipped" not in output, f"Test bị skip!\nStdout:\n{res.stdout}"

    assert res.returncode == 1, (
        f"Test phải fail với exit code 1 khi thiếu artifact_manifest.json! Exit code: {res.returncode}\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )

    # Bắt buộc phải có thông điệp chẩn đoán chính xác
    assert DIAGNOSTIC_MISSING_MANIFEST in output, (
        f"LỖI ARTIFACT CONTRACT: Thiếu diagnostic chính xác '{DIAGNOSTIC_MISSING_MANIFEST}'.\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )


def test_divergence_suite_fails_closed_when_scaffold_missing_without_skip(tmp_path):
    """
    Contract D: Nhóm test divergence yêu cầu tường minh scaffold reference (qua TRIZ_SCAFFOLD_PATH).
    Khi thiếu, BẮT BUỘC phải FAIL với thông điệp chẩn đoán chính xác:
    'Explicit scaffold reference required via TRIZ_SCAFFOLD_PATH'.
    KHÔNG ĐƯỢC silently skip và KHÔNG ĐƯỢC lỗi import/collection.

    Ghi chú: Dữ liệu JSON ở đây chỉ là synthetic minimal structure để thỏa mãn
    staging_data loader mà không đọc artifacts scratch thật; hoàn toàn KHÔNG dùng
    để kiểm toán dataset thật.
    """
    suite_path = _find_staging_suite_path()
    rel_path = suite_path.relative_to(BACKEND_DIR)

    synthetic_staging = tmp_path / "synthetic_staging_for_scaffold_contract"
    synthetic_staging.mkdir()

    # Dữ liệu synthetic tối thiểu để staging_data không bị fail trước khi đến lượt scaffold
    candidate_json_path = synthetic_staging / "triz_matrix_39x39_canonical_candidate.json"
    candidate_json_path.write_text(
        json.dumps({
            "version": "synthetic-contract-test",
            "is_canonical": False,
            "status": "STAGING_CANONICAL_CANDIDATE",
            "matrix": {f"{r}_{c}": [] for r in range(1, 40) for c in range(1, 40)},
        }),
        encoding="utf-8",
    )

    env = _get_clean_env()
    env["TRIZ_STAGING_DIR"] = str(synthetic_staging)
    # Cố tình KHÔNG thiết lập TRIZ_SCAFFOLD_PATH

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        f"{rel_path}::test_divergence_categories_are_mutually_exclusive",
        "-v",
    ]
    res = subprocess.run(
        cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    output = f"{res.stdout}\n{res.stderr}"

    # BẮT BUỘC KHÔNG ĐƯỢC SKIP
    assert "SKIPPED" not in output and "skipped" not in output, (
        f"LỖI CONTRACT: Test divergence bị SILENTLY SKIP khi thiếu scaffold!\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )

    # Reject collection/import failure
    assert "ImportError" not in output, f"Lỗi ImportError!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    assert "ModuleNotFoundError" not in output, f"Lỗi ModuleNotFoundError!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    assert "ERROR: file or package not found" not in output, f"Node path không tồn tại!\nStdout:\n{res.stdout}"

    # Bắt buộc phải thất bại có nguyên nhân với exit code 1
    assert res.returncode == 1, (
        f"Test phải fail với exit code 1 khi thiếu scaffold reference! Exit code: {res.returncode}\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )

    # Bắt buộc phải có thông điệp chẩn đoán chính xác
    assert DIAGNOSTIC_MISSING_SCAFFOLD in output, (
        f"LỖI SCAFFOLD CONTRACT: Thiếu diagnostic chính xác '{DIAGNOSTIC_MISSING_SCAFFOLD}'.\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )


def test_research_suite_fails_when_artifact_is_directory(tmp_path):
    """
    Contract C2: Khi artifact (ví dụ artifact_manifest.json) là một directory thay vì file,
    suite phải FAIL với diagnostic missing/invalid artifact đã chốt,
    tuyệt đối KHÔNG được raise IsADirectoryError chưa được xử lý.
    """
    suite_path = _find_staging_suite_path()
    rel_path = suite_path.relative_to(BACKEND_DIR)

    synthetic_staging = tmp_path / "synthetic_staging_manifest_is_dir"
    synthetic_staging.mkdir()

    # Cố tình tạo một thư mục trùng tên artifact_manifest.json
    (synthetic_staging / "artifact_manifest.json").mkdir()

    env = _get_clean_env()
    env["TRIZ_STAGING_DIR"] = str(synthetic_staging)

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        f"{rel_path}::test_manifest_integrity_and_stability",
        "-v",
    ]
    res = subprocess.run(
        cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    output = f"{res.stdout}\n{res.stderr}"

    assert "IsADirectoryError" not in output, (
        f"Lỗi không được là IsADirectoryError!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )
    assert res.returncode == 1, (
        f"Test phải fail với exit code 1 khi artifact là directory! Exit code: {res.returncode}\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )
    assert DIAGNOSTIC_MISSING_MANIFEST in output, (
        f"LỖI ARTIFACT CONTRACT: Thiếu diagnostic chính xác '{DIAGNOSTIC_MISSING_MANIFEST}'.\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )


def test_divergence_suite_fails_when_scaffold_path_is_directory(tmp_path):
    """
    Contract D2: Khi TRIZ_SCAFFOLD_PATH trỏ vào một directory thay vì file JSON,
    suite phải FAIL với diagnostic scaffold đã chốt,
    tuyệt đối KHÔNG được raise IsADirectoryError chưa được xử lý.
    """
    suite_path = _find_staging_suite_path()
    rel_path = suite_path.relative_to(BACKEND_DIR)

    synthetic_staging = tmp_path / "synthetic_staging_for_scaffold_dir_contract"
    synthetic_staging.mkdir()

    candidate_json_path = synthetic_staging / "triz_matrix_39x39_canonical_candidate.json"
    candidate_json_path.write_text(
        json.dumps({
            "version": "synthetic-contract-test",
            "is_canonical": False,
            "status": "STAGING_CANONICAL_CANDIDATE",
            "matrix": {f"{r}_{c}": [] for r in range(1, 40) for c in range(1, 40)},
        }),
        encoding="utf-8",
    )

    # Cố tình tạo một thư mục làm scaffold path
    scaffold_dir = tmp_path / "scaffold_is_dir"
    scaffold_dir.mkdir()

    env = _get_clean_env()
    env["TRIZ_STAGING_DIR"] = str(synthetic_staging)
    env["TRIZ_SCAFFOLD_PATH"] = str(scaffold_dir)

    cmd = [
        sys.executable,
        "-m",
        "pytest",
        f"{rel_path}::test_divergence_categories_are_mutually_exclusive",
        "-v",
    ]
    res = subprocess.run(
        cmd,
        cwd=str(BACKEND_DIR),
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
    )

    output = f"{res.stdout}\n{res.stderr}"

    assert "IsADirectoryError" not in output, (
        f"Lỗi không được là IsADirectoryError!\nStdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )
    assert res.returncode == 1, (
        f"Test phải fail với exit code 1 khi scaffold path là directory! Exit code: {res.returncode}\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )
    assert DIAGNOSTIC_MISSING_SCAFFOLD in output, (
        f"LỖI SCAFFOLD CONTRACT: Thiếu diagnostic chính xác '{DIAGNOSTIC_MISSING_SCAFFOLD}'.\n"
        f"Stdout:\n{res.stdout}\nStderr:\n{res.stderr}"
    )
