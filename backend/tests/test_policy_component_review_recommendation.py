from __future__ import annotations

import ast
import json
from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.append(str(ROOT))

from app.services.policy_component_review_recommendation import (  # noqa: E402
    build_decision_template,
    recommend_review_action,
    sha256_file,
)


def _candidate(name: str, **extra):
    candidate = {
        "policy_id": "p1",
        "policy_title": "제조 지원정책",
        "component_key": "support_package_0_direct_grant",
        "component_name": name,
        "source_kind": "support_package",
        "source_index": 0,
        "support_type": "direct_grant",
        "effect_layer": "capex_offset",
        "calculation_method": "fixed_cap",
        "proposed_roi_apply_method": "subtract",
        "fixed_amount_manwon": None,
        "cap_amount_manwon": 3000,
        "support_ratio": None,
        "eligible_cost_ratio": None,
        "evidence_text": f"{name} 최대 3천만원 지원",
        "evidence_source_type": "support_package",
        "evidence_source_name": "지원기관",
        "evidence_page_or_section": None,
        "quality_flags": [],
        "review_reasons": [],
        "source_component_json": {"component": {"name": name}},
        "review_decision": None,
        "reviewer_note": None,
        "reviewed_at": None,
    }
    candidate.update(extra)
    return candidate


def test_explicit_manufacturing_robot_is_ready_without_auto_decision():
    row = recommend_review_action(_candidate("제조로봇 도입 지원"))

    assert row["recommended_action"] == "ready_for_pending_review"
    assert row["risk_level"] == "low"
    assert row["review_decision"] is None


def test_smart_factory_clear_and_complex_conditions_are_distinguished():
    ready = recommend_review_action(_candidate("스마트공장 구축 장비 지원"))
    hold = recommend_review_action(
        _candidate("스마트공장 구축 고도화 목표수준별 재신청 지원")
    )

    assert ready["recommended_action"] == "ready_for_pending_review"
    assert hold["recommended_action"] == "hold_manual_review"
    assert hold["requires_original_notice_check"] is True


def test_research_poc_and_demonstration_are_high_risk_holds():
    for name in ("R&D 생산설비", "PoC 장비 실증", "사업화 시제품 금형"):
        row = recommend_review_action(_candidate(name))
        assert row["recommended_action"] == "hold_manual_review"
        assert row["risk_level"] == "high"


def test_equipment_usage_voucher_and_store_remodeling_are_excluded():
    for name in ("연구시설장비 사용료 바우처", "소상공인 매장 인테리어 모델링"):
        row = recommend_review_action(_candidate(name))
        assert row["recommended_action"] == "exclude_from_capex"
        assert row["risk_level"] == "high"


def test_input_json_is_not_modified_and_output_count_matches(tmp_path):
    input_path = tmp_path / "queue.json"
    payload = {"source": "local", "candidates": [_candidate("생산설비 도입")]}
    input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    before_hash = sha256_file(input_path)
    before_mtime = input_path.stat().st_mtime_ns

    rows = build_decision_template(payload["candidates"])

    assert sha256_file(input_path) == before_hash
    assert input_path.stat().st_mtime_ns == before_mtime
    assert len(rows) == len(payload["candidates"])
    assert all(row["review_decision"] is None for row in rows)


def test_cli_creates_new_files_without_changing_input(tmp_path):
    input_path = tmp_path / "queue.json"
    csv_path = tmp_path / "decision.csv"
    json_path = tmp_path / "decision.json"
    payload = {"source": "local", "candidates": [_candidate("금형 제작 설비")]}
    input_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    before_hash = sha256_file(input_path)
    script = ROOT / "scripts" / "build_policy_component_review_template.py"

    result = subprocess.run(
        [
            sys.executable,
            str(script),
            "--input-json",
            str(input_path),
            "--output-csv",
            str(csv_path),
            "--output-json",
            str(json_path),
        ],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )

    assert result.returncode == 0, result.stderr
    assert sha256_file(input_path) == before_hash
    assert csv_path.exists()
    saved = json.loads(json_path.read_text(encoding="utf-8"))
    assert saved["candidate_count"] == 1
    assert saved["auto_decision_count"] == 0
    assert saved["candidates"][0]["review_decision"] is None


def test_module_and_cli_have_no_supabase_or_database_write_calls():
    paths = [
        ROOT / "app" / "services" / "policy_component_review_recommendation.py",
        ROOT / "scripts" / "build_policy_component_review_template.py",
    ]
    forbidden_imports = {"supabase", "app.core.database"}
    forbidden_calls = {"insert", "update", "delete", "upsert", "rpc"}

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
        calls = {
            node.func.attr
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id in {"client", "db", "query", "supabase"}
        }
        assert not imports.intersection(forbidden_imports)
        assert not calls.intersection(forbidden_calls)
