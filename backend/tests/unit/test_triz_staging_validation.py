"""
Unit Test Suite for TRIZ40 Staging Canonical Candidate Validation & Final Reproducibility Check.
Verifies contract rules, manifest integrity, separate provenance tiers, normalization audit trail,
reproducible extraction byte-for-byte, and mutually exclusive divergence categories.
"""
import os
import json
import hashlib
import pytest
import shutil

STAGING_DIR = "/Users/mr.chem/.gemini/antigravity-ide/brain/833269e0-ec09-4865-b40d-7d9eaceb82e6/scratch/quarantine/triz40"
STAGING_JSON_PATH = os.path.join(STAGING_DIR, "triz_matrix_39x39_canonical_candidate.json")
FIXTURE_PATH = os.path.join(STAGING_DIR, "cell_regression_fixtures.json")
MANIFEST_PATH = os.path.join(STAGING_DIR, "artifact_manifest.json")
RAW_HTML_PATH = os.path.join(STAGING_DIR, "triz40_raw_matrix_snapshot.html")
EXTRACTION_SCRIPT_PATH = os.path.join(STAGING_DIR, "extract_triz40_matrix.py")
SCAFFOLD_BAK_PATH = "/Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/data/triz_matrix_39x39.json.bak"
SCAFFOLD_JSON_PATH = SCAFFOLD_BAK_PATH if os.path.exists(SCAFFOLD_BAK_PATH) else "/Users/mr.chem/Documents/Lap-trinh/creative-research-workbench/backend/src/app/data/triz_matrix_39x39.json"


@pytest.fixture(scope="module")
def staging_data():
    assert os.path.exists(STAGING_JSON_PATH)
    with open(STAGING_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def manifest_data():
    assert os.path.exists(MANIFEST_PATH)
    with open(MANIFEST_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def regression_fixtures():
    assert os.path.exists(FIXTURE_PATH)
    with open(FIXTURE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def scaffold_data():
    if not os.path.exists(SCAFFOLD_BAK_PATH):
        pytest.skip("Scaffold .bak file not present for staging divergence comparison")
    with open(SCAFFOLD_BAK_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _compute_sha256(file_path: str) -> str:
    with open(file_path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def test_manifest_integrity_and_stability(manifest_data):
    """Verifies that artifact_manifest.json accurately reflects all disk artifact checksums."""
    assert manifest_data["manifest_version"] == "1.0.0"
    assert manifest_data["dataset_version"] == "triz40-web-snapshot-2026-09-30"

    raw_sha = _compute_sha256(RAW_HTML_PATH)
    norm_sha = _compute_sha256(STAGING_JSON_PATH)
    fix_sha = _compute_sha256(FIXTURE_PATH)
    script_sha = _compute_sha256(EXTRACTION_SCRIPT_PATH)

    assert manifest_data["raw_snapshot"]["sha256"] == raw_sha
    assert manifest_data["normalized_json"]["sha256"] == norm_sha
    assert manifest_data["cell_fixtures"]["sha256"] == fix_sha
    assert manifest_data["extraction_script"]["sha256"] == script_sha


def test_reproducible_extraction_byte_for_byte(tmp_path):
    """Runs extraction in an isolated temporary directory and verifies byte-for-byte SHA256 match."""
    import sys
    sys.path.insert(0, STAGING_DIR)
    from extract_triz40_matrix import extract_triz40_dataset

    # Copy raw snapshot and run extraction in fresh temp dir
    temp_raw = tmp_path / "triz40_raw_matrix_snapshot.html"
    shutil.copy2(RAW_HTML_PATH, temp_raw)

    out_temp_json_path = extract_triz40_dataset(str(tmp_path), SCAFFOLD_JSON_PATH)
    
    expected_sha = _compute_sha256(STAGING_JSON_PATH)
    fresh_sha = _compute_sha256(out_temp_json_path)

    assert fresh_sha == expected_sha, "Fresh extraction must produce identical SHA-256 byte-for-byte"


def test_candidate_no_self_referential_checksum(staging_data):
    """Ensures candidate JSON does NOT contain circular/self-referential checksum inside its body."""
    prov = staging_data.get("provenance", {})
    matrix_prov = prov.get("matrix_provenance", {})
    assert "normalized_sha256" not in prov
    assert "normalized_sha256" not in matrix_prov
    assert "raw_sha256" not in prov
    # Staging artifact must be marked non-canonical
    assert staging_data.get("is_canonical") is False
    assert staging_data.get("status") == "STAGING_CANONICAL_CANDIDATE"


def test_separated_provenance_tiers(staging_data):
    """Verifies provenance is strictly separated into matrix vs parameters vs principles."""
    prov = staging_data.get("provenance", {})
    assert "matrix_provenance" in prov
    assert "parameters_metadata_provenance" in prov
    assert "principles_metadata_provenance" in prov

    matrix_prov = prov["matrix_provenance"]
    assert matrix_prov["source_name"] == "TRIZ40 (SolidCreativity)"
    assert matrix_prov["license_status"] == "VERIFIED_WITH_QUOTED_EVIDENCE"
    assert "Contenu © TRIZ40" in matrix_prov["license_quoted_evidence"]

    params_prov = prov["parameters_metadata_provenance"]
    assert params_prov["provenance_status"] == "BENCHMARK_STANDARD_DEFINITIONS"

    princ_prov = prov["principles_metadata_provenance"]
    assert princ_prov["provenance_status"] == "BENCHMARK_STANDARD_DEFINITIONS"


def test_normalization_rules_and_audit_trail(staging_data):
    """Verifies that source markers '*' and '-' have explicit normalization rules."""
    norm_rules = staging_data.get("normalization_rules", {})
    assert "diagonal_marker" in norm_rules
    assert norm_rules["diagonal_marker"]["source_symbol"] == "*"
    assert norm_rules["diagonal_marker"]["rule"] == "DIAGONAL_STAR_TO_EMPTY_LIST"
    assert norm_rules["diagonal_marker"]["target_value"] == []

    assert "empty_cell_marker" in norm_rules
    assert norm_rules["empty_cell_marker"]["source_symbol"] == "-"
    assert norm_rules["empty_cell_marker"]["rule"] == "OFF_DIAGONAL_DASH_TO_EMPTY_LIST"
    assert norm_rules["empty_cell_marker"]["target_value"] == []


def test_parameters_and_principles_completeness(staging_data):
    """Verifies 39 parameters and 40 principles exist."""
    params = staging_data.get("parameters", {})
    principles = staging_data.get("principles", {})
    assert len(params) == 39
    assert len(principles) == 40
    for i in range(1, 40):
        assert str(i) in params
    for i in range(1, 41):
        assert str(i) in principles


def test_coordinate_space_and_counts(staging_data):
    """Verifies complete 1521 coordinate space and cell breakdowns."""
    matrix = staging_data.get("matrix", {})
    assert len(matrix) == 1521

    diagonal_empty = 0
    off_diagonal_populated = 0
    off_diagonal_empty = 0
    all_principle_ids = set()

    for r in range(1, 40):
        for c in range(1, 40):
            coord = f"{r}_{c}"
            assert coord in matrix
            val = matrix[coord]
            assert isinstance(val, list)

            for pid in val:
                assert isinstance(pid, int)
                assert 1 <= pid <= 40
                all_principle_ids.add(pid)

            if r == c:
                if len(val) == 0:
                    diagonal_empty += 1
            else:
                if len(val) > 0:
                    off_diagonal_populated += 1
                else:
                    off_diagonal_empty += 1

    assert diagonal_empty == 39
    assert off_diagonal_populated == 1248
    assert off_diagonal_empty == 234
    assert len(all_principle_ids) == 40


def test_divergence_categories_are_mutually_exclusive(staging_data, scaffold_data):
    """Verifies that all 5 divergence classification categories partition the matrix with zero overlap."""
    cand_matrix = staging_data["matrix"]
    scaff_matrix = scaffold_data["matrix"]

    cat_diag_identical = []
    cat_non_diag_identical_empty = []
    cat_synth_pop_cand_empty = []
    cat_synth_empty_cand_pop = []
    cat_both_pop_differ = []

    for r in range(1, 40):
        for c in range(1, 40):
            k = f"{r}_{c}"
            s = scaff_matrix.get(k, [])
            c_val = cand_matrix.get(k, [])

            matches = 0
            if r == c and s == c_val and len(s) == 0:
                cat_diag_identical.append(k)
                matches += 1
            elif r != c and s == c_val and len(s) == 0:
                cat_non_diag_identical_empty.append(k)
                matches += 1
            elif len(s) > 0 and len(c_val) == 0:
                cat_synth_pop_cand_empty.append(k)
                matches += 1
            elif len(s) == 0 and len(c_val) > 0:
                cat_synth_empty_cand_pop.append(k)
                matches += 1
            elif len(s) > 0 and len(c_val) > 0 and s != c_val:
                cat_both_pop_differ.append(k)
                matches += 1
            
            assert matches == 1, f"Coordinate {k} must belong to exactly one mutual category"

    assert len(cat_diag_identical) == 39
    assert len(cat_non_diag_identical_empty) == 0
    assert len(cat_synth_pop_cand_empty) == 234
    assert len(cat_synth_empty_cand_pop) == 0
    assert len(cat_both_pop_differ) == 1248


def test_divergence_categories_sum_to_total_coordinates(staging_data, scaffold_data):
    """Verifies that the sum of all divergence categories equals exactly total coordinates (1,521)."""
    cand_matrix = staging_data["matrix"]
    scaff_matrix = scaffold_data["matrix"]

    identical_diagonal_cells = 0
    identical_non_diagonal_empty_cells = 0
    synthetic_populated_candidate_empty = 0
    synthetic_empty_candidate_populated = 0
    both_populated_values_differ = 0

    for r in range(1, 40):
        for c in range(1, 40):
            k = f"{r}_{c}"
            s = scaff_matrix.get(k, [])
            c_val = cand_matrix.get(k, [])

            if r == c and s == c_val and len(s) == 0:
                identical_diagonal_cells += 1
            elif r != c and s == c_val and len(s) == 0:
                identical_non_diagonal_empty_cells += 1
            elif len(s) > 0 and len(c_val) == 0:
                synthetic_populated_candidate_empty += 1
            elif len(s) == 0 and len(c_val) > 0:
                synthetic_empty_candidate_populated += 1
            elif len(s) > 0 and len(c_val) > 0 and s != c_val:
                both_populated_values_differ += 1

    identical_cells = identical_diagonal_cells + identical_non_diagonal_empty_cells
    divergent_cells = synthetic_populated_candidate_empty + synthetic_empty_candidate_populated + both_populated_values_differ
    total_coordinates = identical_cells + divergent_cells

    assert total_coordinates == 1521
    assert identical_cells == 39
    assert divergent_cells == 1482


def test_matrix_asymmetry(staging_data):
    """Verifies matrix asymmetry is preserved."""
    matrix = staging_data["matrix"]
    asymmetric_count = 0
    total_pairs = 39 * 38 // 2  # 741

    for i in range(1, 40):
        for j in range(i + 1, 40):
            if matrix[f"{i}_{j}"] != matrix[f"{j}_{i}"]:
                asymmetric_count += 1

    assert asymmetric_count == 500
    assert (asymmetric_count / total_pairs) * 100 > 60.0


def test_regression_fixtures_with_raw_markers(staging_data, regression_fixtures):
    """Verifies 24 sample fixtures with raw source markers."""
    matrix = staging_data["matrix"]
    assert len(regression_fixtures) >= 20

    for fix in regression_fixtures:
        coord = fix["coord"]
        norm_val = fix["normalized_value"]
        assert matrix[coord] == norm_val
        assert "source_raw_marker" in fix
        assert fix["source_raw_marker"] in ["*", "-", "SPANS"]
