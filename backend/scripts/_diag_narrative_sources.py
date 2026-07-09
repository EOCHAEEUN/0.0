"""One-off diagnostic: narrative_sources for latest demo analysis. Not for commit."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

env_file = ROOT / ".env"
if env_file.exists():
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))

os.environ.setdefault("OPENROUTER_API_KEY", "diag")
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "diag")

USE_LIVE_DB = bool(os.getenv("SUPABASE_URL", "").strip())

if not USE_LIVE_DB:
    os.environ["SUPABASE_URL"] = "http://localhost:54321"

from app.services.application_report import (  # noqa: E402
    _CORE_PDF_NARRATIVE_FIELDS,
    load_application_report_data,
    summarize_narrative_sources,
)

DEMO_COMPANY_ID = "8da9a28d-53b7-4859-8d22-aefd5a86fb13"
DEMO_EQUIPMENT_ID = "dab19f1e-4369-47d5-acb5-4ebd92ba54a2"


def _print_diagnostic(data: dict) -> None:
    sources = data.get("narrative_sources") or {}
    stats = summarize_narrative_sources(sources)

    print("\n=== narrative_source_summary ===")
    print(json.dumps(stats, ensure_ascii=False, indent=2))
    print(f"\ndraft_result_count={stats['draft_result_count']}")
    print(f"template_fallback_count={stats['template_fallback_count']}")
    if stats.get("partial_llm"):
        print("STATUS: 부분 LLM 반영 상태 (LLM 문단 3개 이하)")

    print("\n=== by_field ===")
    for key, value in sorted(sources.items()):
        print(f"{key}: {value}")

    print("\n=== core 6 sections ===")
    summary = data.get("summary") or {}
    for key in _CORE_PDF_NARRATIVE_FIELDS:
        text = summary.get(key) or ""
        print(f"[{key}] source={sources.get(key)} | {text[:80]}")

    print("\n=== summary paragraphs (first 80 chars) ===")
    for key, value in summary.items():
        if isinstance(value, str) and len(value.strip()) >= 20:
            print(f"{key}: {value[:80]}")

    bullets = summary.get("expected_effects_bullets") or []
    if bullets:
        print("\nexpected_effects_bullets:")
        for bullet in bullets:
            print(f"  - {bullet[:80]}")


def _run_fixture_diagnostic() -> None:
    from tests.test_draft_schema import LLM_PAYLOAD, _enrich  # noqa: WPS433
    from tests.test_application_report_draft import (  # noqa: WPS433
        ANALYSIS_ID,
        COMPANY_ID,
        EQUIPMENT_ID,
        POLICY_ID,
        _base_tables,
        _load_report,
    )

    typical_draft = _enrich(LLM_PAYLOAD)
    tables = _base_tables(
        draft_rows=[
            {
                "company_id": COMPANY_ID,
                "equipment_id": EQUIPMENT_ID,
                "policy_id": POLICY_ID,
                "analysis_id": ANALYSIS_ID,
                "created_at": "2026-01-02T00:00:00",
                "draft_content": typical_draft,
            }
        ]
    )
    print("MODE=fixture (SUPABASE_URL unavailable; using extended 7-field LLM draft structure)")
    data = _load_report(tables=tables, analysis_id=ANALYSIS_ID, tone="submission")
    _print_diagnostic(data)


def main() -> None:
    if not USE_LIVE_DB:
        _run_fixture_diagnostic()
        return

    from app.core.database import get_db  # noqa: WPS433

    db = get_db()
    roi = (
        db.table("roi_output")
        .select("id,equipment_id,policy_snapshot,created_at")
        .eq("company_id", DEMO_COMPANY_ID)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not roi.data:
        print("NO_ROI_OUTPUT")
        return

    row = roi.data[0]
    analysis_id = str(row["id"])
    equipment_id = str(row.get("equipment_id") or DEMO_EQUIPMENT_ID)
    snapshot = row.get("policy_snapshot") or {}
    policy_id = snapshot.get("recommended_policy_id")
    policies = snapshot.get("policies")
    if not policy_id and isinstance(policies, list) and policies:
        policy_id = policies[0].get("policy_id")
    policy_id = str(policy_id or "mss-2026-007")

    print(f"MODE=live_db")
    print(f"analysis_id={analysis_id}")
    print(f"equipment_id={equipment_id}")
    print(f"policy_id={policy_id}")

    data = load_application_report_data(
        DEMO_COMPANY_ID,
        equipment_id,
        policy_id,
        analysis_id=analysis_id,
        tone="submission",
    )
    _print_diagnostic(data)


if __name__ == "__main__":
    main()
