from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_20260703_120128.json"
DEFAULT_ANALYSIS_CSV = REPORT_DIR / "large_amount_delta_after_parser" / "large_amount_delta_analysis.csv"

SAFE_PATTERN = "likely_new_limit_candidate"
HOLD_PATTERNS = {"needs_manual_review", "possible_unit_scale_error"}
KEEP_OLD_PATTERNS = {
    "risk_exclusion_or_threshold_selected",
    "risk_penalty_or_sanction_selected",
    "risk_revenue_condition_selected",
    "risk_total_or_cumulative_selected",
}

CASH_TYPES = {"support_amount", "subsidy", "voucher"}
SAFE_LIMIT_WORDS = [
    "기업당",
    "기업별",
    "업체당",
    "과제당",
    "사업장당",
    "제품당",
    "컨소시엄당",
    "최대",
    "한도",
    "이내",
    "내외",
    "지원금액",
    "지원 금액",
    "지원한도",
    "지원 한도",
]
ENTERPRISE_LIMIT_WORDS = [
    "기업당",
    "기업별",
    "업체당",
    "사업장당",
    "1개사",
    "개사당",
]
HARD_RISK_WORDS = [
    "벌금",
    "징역",
    "벌칙",
    "제재",
    "부정",
    "매출액",
    "연매출",
    "누적",
    "초과",
    "제외",
    "총 지원금",
    "총지원금",
    "합계액",
]
AMBIGUOUS_UNIT_WORDS = [
    "월",
    "월별",
    "1명당",
    "명당",
    "건당",
    "/건",
    "점",
    "취득금액",
    "연간 한도",
    "판매기업",
]
FINANCE_CONTEXT_WORDS = [
    "융자",
    "대출",
    "팩토링",
    "보증",
    "이차보전",
    "이자지원",
]
OLD_SCALE_WORDS = [
    "총지원규모",
    "총 지원규모",
    "지원규모",
    "예산",
    "전체",
    "총사업비",
    "총 사업비",
    "사업비",
]


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def numeric(value: Any) -> float | None:
    try:
        if value in (None, ""):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def selected_context(row: dict[str, Any]) -> str:
    selected = row.get("new_selected_candidate") or {}
    return clean(
        selected.get("local_context")
        or selected.get("evidence")
        or selected.get("raw_text")
        or "",
        1200,
    )


def candidates_summary(row: dict[str, Any], limit: int = 8) -> str:
    candidates = row.get("new_amount_candidates") or []
    parts: list[str] = []
    for candidate in candidates[:limit]:
        parts.append(
            (
                f"{candidate.get('amount_manwon')}만원/"
                f"{candidate.get('max_amount_type')}/"
                f"{candidate.get('roi_apply_method')}: "
                f"{clean(candidate.get('local_context') or candidate.get('evidence') or candidate.get('raw_text'), 160)}"
            )
        )
    if len(candidates) > limit:
        parts.append(f"... 후보 {len(candidates) - limit}개 추가")
    return " || ".join(parts)


def ratio_text(old_amount: float | None, new_amount: float | None) -> str:
    if old_amount in (None, 0) or new_amount is None:
        return ""
    return f"{new_amount / old_amount:.3g}x"


def has_any(text: str, words: list[str]) -> bool:
    return any(word in text for word in words)


def suggest_action(row: dict[str, Any], pattern: str) -> tuple[str, str]:
    context = selected_context(row)
    old_actual = clean(row.get("old_actual"), 500)
    new_type = clean(row.get("new_selected_type"))
    new_method = clean(row.get("new_roi_apply_method"))
    old_amount = numeric(row.get("old_amount_manwon"))
    new_amount = numeric(row.get("new_selected_amount_manwon"))

    if pattern in KEEP_OLD_PATTERNS:
        return "keep_old", f"새 후보 문맥이 위험 패턴({pattern})에 해당합니다."
    if pattern in HOLD_PATTERNS:
        return "hold", f"문맥만으로 기존값/새값 확정이 어렵습니다({pattern})."
    if new_method != "subtract" or new_type not in CASH_TYPES:
        return "hold", "새 후보가 현금성 직접 차감 지원금으로 확정되지 않습니다."
    if has_any(context, HARD_RISK_WORDS):
        return "keep_old", "새 후보 주변에 벌칙/매출/누적/제외/총액성 위험 문맥이 있습니다."
    if has_any(context, FINANCE_CONTEXT_WORDS):
        return "hold", "새 후보가 금융성 지원/한도 문맥일 수 있어 ROI 직접 차감 확정이 어렵습니다."
    if has_any(context, AMBIGUOUS_UNIT_WORDS):
        return "hold", "새 후보가 월별/인원별/건별/취득금액/연간한도 문맥이라 대표금액 확정이 어렵습니다."
    if not has_any(context, SAFE_LIMIT_WORDS):
        return "hold", "새 후보에 기업당/최대/한도 등 대표 지원금 문맥이 부족합니다."
    if old_amount and new_amount and (new_amount / old_amount >= 100 or new_amount / old_amount <= 0.01):
        return "hold", "기존값과 새값 차이가 100배 이상이라 단위/표 연결 수동 확인이 필요합니다."
    has_enterprise_limit = has_any(context, ENTERPRISE_LIMIT_WORDS)
    if has_enterprise_limit and has_any(old_actual, OLD_SCALE_WORDS):
        return "adopt_new", "새 후보는 한도 문맥이고 기존 텍스트는 총규모/예산성 표현으로 보입니다."
    if pattern == SAFE_PATTERN and old_amount and new_amount:
        ratio = new_amount / old_amount
        if has_enterprise_limit and 0.2 <= ratio <= 5:
            return "adopt_new", "새 후보가 기업 단위 한도 문맥이고 차이 배율이 극단적이지 않습니다."
    return "hold", "새 후보가 한도처럼 보이나 기존값과 차이가 커 최종 수동 확인이 필요합니다."


def load_analysis(path: Path) -> dict[str, dict[str, str]]:
    content = path.read_text(encoding="utf-8-sig").replace("\x00", "")
    reader = csv.DictReader(content.splitlines())
    return {clean(row.get("policy_id")): row for row in reader if clean(row.get("policy_id"))}


def main() -> None:
    parser = argparse.ArgumentParser(description="Build adjudication table for large amount delta rows.")
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--analysis-csv", default=str(DEFAULT_ANALYSIS_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "large_amount_delta_adjudication"))
    args = parser.parse_args()

    reparse_path = Path(args.reparse_json)
    analysis_path = Path(args.analysis_csv)
    rows = json.loads(reparse_path.read_text(encoding="utf-8"))
    analysis_by_id = load_analysis(analysis_path)

    output_rows: list[dict[str, Any]] = []
    for row in rows:
        policy_id = clean(row.get("policy_id"))
        analysis = analysis_by_id.get(policy_id, {})
        pattern = clean(analysis.get("pattern")) or "unknown"
        old_amount = numeric(row.get("old_amount_manwon"))
        new_amount = numeric(row.get("new_selected_amount_manwon"))
        action, reason = suggest_action(row, pattern)
        output_rows.append(
            {
                "policy_id": policy_id,
                "title": clean(row.get("title")),
                "organization": clean(row.get("organization")),
                "old_amount_manwon": old_amount,
                "old_amount_actual": clean(row.get("old_actual"), 500),
                "old_amount_type": clean(row.get("old_amount_type")),
                "old_roi_apply_method": clean(row.get("old_roi_apply_method")),
                "new_amount_manwon": new_amount,
                "new_amount_actual": clean((row.get("derived_fields") or {}).get("max_amount_actual")),
                "new_amount_type": clean(row.get("new_selected_type")),
                "new_roi_apply_method": clean(row.get("new_roi_apply_method")),
                "delta_ratio": ratio_text(old_amount, new_amount),
                "delta_bucket": clean(analysis.get("delta_bucket")),
                "pattern": pattern,
                "suggested_action": action,
                "suggested_reason": reason,
                "decision_reasons": " | ".join(row.get("decision_reasons") or []),
                "comparison_reasons": " | ".join(row.get("comparison_reasons") or []),
                "new_selected_context": selected_context(row),
                "candidate_summary": candidates_summary(row),
                "url": clean(row.get("url")),
            }
        )

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "large_amount_delta_adjudication.csv"
    md_path = output_dir / "large_amount_delta_adjudication.md"

    fields = list(output_rows[0].keys()) if output_rows else []
    with csv_path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, escapechar="\\")
        writer.writeheader()
        writer.writerows(output_rows)

    action_counts: dict[str, int] = {}
    pattern_counts: dict[str, int] = {}
    for row in output_rows:
        action_counts[row["suggested_action"]] = action_counts.get(row["suggested_action"], 0) + 1
        pattern_counts[row["pattern"]] = pattern_counts.get(row["pattern"], 0) + 1

    lines = [
        f"reparse_json={reparse_path}",
        f"analysis_csv={analysis_path}",
        f"rows={len(output_rows)}",
        "",
        "## suggested_action",
    ]
    lines.extend(f"- {key}: {value}" for key, value in sorted(action_counts.items()))
    lines.extend(["", "## pattern"])
    lines.extend(f"- {key}: {value}" for key, value in sorted(pattern_counts.items()))
    for action in ["adopt_new", "keep_old", "hold"]:
        lines.extend(["", f"## {action} samples"])
        for row in [item for item in output_rows if item["suggested_action"] == action][:8]:
            lines.extend(
                [
                    (
                        f"- {row['policy_id']} | old={row['old_amount_manwon']} "
                        f"-> new={row['new_amount_manwon']} ({row['delta_ratio']}) | {row['title']}"
                    ),
                    f"  - reason: {row['suggested_reason']}",
                    f"  - context: {row['new_selected_context'][:260]}",
                ]
            )
    md_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"rows={len(output_rows)}")
    print(f"actions={action_counts}")
    print(f"patterns={pattern_counts}")
    print(f"csv={csv_path}")
    print(f"md={md_path}")


if __name__ == "__main__":
    main()
