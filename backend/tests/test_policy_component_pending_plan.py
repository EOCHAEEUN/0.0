from __future__ import annotations

import ast
import csv
import json
import os
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_component_pending_plan import (  # noqa: E402
    build_pending_plan,
    component_fingerprint,
    load_decision_csv,
    sha256_file,
)


def _row(decision: str = "", **extra):
    row = {
        "policy_id": "p1",
        "component_key": "support_package_0_direct_grant",
        "component_name": "생산설비 지원",
        "support_type": "direct_grant",
        "effect_layer": "capex_offset",
        "calculation_method": "fixed_cap",
        "proposed_roi_apply_method": "subtract",
        "cap_amount_manwon": "3000",
        "support_ratio": "",
        "recommended_action": "ready_for_pending_review",
        "risk_level": "low",
        "requires_original_notice_check": "false",
        "review_decision": decision,
        "reviewer_note": "",
        "source_component_json": "{}",
    }
    row.update(extra)
    return row


def _plan(rows):
    return build_pending_plan(
        rows,
        input_file="fixture.csv",
        input_sha256="ABC",
    )


def test_blank_decisions_and_recommendations_do_not_create_plan():
    payload, audit = _plan([_row()])

    assert payload["planned_insert_count"] == 0
    assert payload["blank_decision_count"] == 1
    assert audit[0]["included_in_pending_plan"] == "false"


def test_approved_for_pending_creates_safe_pending_none_row():
    payload, audit = _plan([_row("approve_for_pending_import")])
    planned = payload["planned_rows"][0]

    assert payload["planned_insert_count"] == 1
    assert planned["review_status"] == "pending"
    assert planned["roi_apply_method"] == "none"
    assert planned["condition_json"]["candidate_proposed_roi_apply_method"] == "subtract"
    assert planned["condition_json"]["human_review_decision"] == "approve_for_pending_import"
    assert "approved" not in planned.values()
    assert audit[0]["planned_review_status"] == "pending"


def test_hold_and_exclude_are_not_planned():
    payload, audit = _plan(
        [_row("hold_manual_review"), _row("exclude_from_capex")]
    )

    assert payload["planned_insert_count"] == 0
    assert payload["hold_count"] == 1
    assert payload["excluded_count"] == 1
    assert all(row["included_in_pending_plan"] == "false" for row in audit)


def test_invalid_decision_is_reported_and_excluded():
    payload, audit = _plan([_row("approved")])

    assert payload["planned_insert_count"] == 0
    assert payload["invalid_decision_count"] == 1
    assert audit[0]["validation_status"] == "invalid"
    assert "invalid_review_decision:approved" in audit[0]["validation_errors"]


def test_component_fingerprint_is_stable_and_numeric_normalized():
    first = _row(cap_amount_manwon="3000.0", support_ratio="0.50")
    second = _row(cap_amount_manwon="3000", support_ratio=".5")

    assert component_fingerprint(first) == component_fingerprint(second)


def test_input_file_hash_mtime_and_rows_are_unchanged(tmp_path):
    input_path = tmp_path / "decision.csv"
    fields = list(_row())
    with input_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerow(_row())
    before_hash = sha256_file(input_path)
    before_mtime = input_path.stat().st_mtime_ns

    _, rows = load_decision_csv(input_path)
    payload, _ = _plan(rows)

    assert payload["total_candidates"] == 1
    assert sha256_file(input_path) == before_hash
    assert input_path.stat().st_mtime_ns == before_mtime


def test_cli_requires_explicit_local_export_flag(tmp_path):
    script = ROOT / "scripts" / "build_pending_component_import_plan.py"
    input_path = tmp_path / "decision.csv"
    input_path.write_text("review_decision\n", encoding="utf-8")
    output_json = tmp_path / "plan.json"
    output_csv = tmp_path / "audit.csv"

    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--input-csv",
            str(input_path),
            "--output-json",
            str(output_json),
            "--output-audit-csv",
            str(output_csv),
        ],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
    )

    assert result.returncode == 2
    assert not output_json.exists()
    assert not output_csv.exists()


def test_production_files_have_no_supabase_env_or_database_write_calls():
    paths = [
        ROOT / "app" / "services" / "policy_component_pending_plan.py",
        ROOT / "scripts" / "build_pending_component_import_plan.py",
    ]
    forbidden_imports = {"supabase", "app.core.database", "os"}
    forbidden_names = {"getenv", "environ", "create_client"}
    forbidden_db_calls = {"insert", "update", "delete", "upsert", "rpc", "table"}

    for path in paths:
        tree = ast.parse(path.read_text(encoding="utf-8"))
        imports = {
            alias.name
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        }
        imports.update(
            node.module
            for node in ast.walk(tree)
            if isinstance(node, ast.ImportFrom) and node.module
        )
        names = {
            node.func.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        db_calls = {
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id in {"client", "db", "query", "supabase"}
        }
        assert not imports.intersection(forbidden_imports)
        assert not names.intersection(forbidden_names)
        assert not db_calls.intersection(forbidden_db_calls)
