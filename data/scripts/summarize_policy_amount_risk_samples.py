from __future__ import annotations

import argparse
import csv
import glob
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Any, Callable


DEFAULT_REPORT_DIR = Path("data/reports/policy_amount_backfill")


def latest_review_file() -> Path:
    files = sorted(glob.glob(str(DEFAULT_REPORT_DIR / "policy_amount_backfill_review_*.json")))
    if not files:
        raise FileNotFoundError("No policy_amount_backfill_review_*.json file found.")
    return Path(files[-1])


def clean_text(value: Any, max_len: int = 220) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, default=str)
    else:
        text = str(value)
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) > max_len:
        return text[:max_len].rstrip() + "..."
    return text


def has_reason(row: dict[str, Any], pattern: str) -> bool:
    return any(pattern in reason for reason in row.get("risk_reasons") or [])


def changed_type(old_type: str, new_type: str) -> Callable[[dict[str, Any]], bool]:
    return lambda row: (row.get("old_amount_type") == old_type and row.get("new_selected_type") == new_type)


GROUPS: list[tuple[str, str, Callable[[dict[str, Any]], bool]]] = [
    (
        "subtract_total_budget_condition_keywords",
        "subtract인데 근거에 전체예산/총사업비/조건성 키워드 포함",
        lambda row: has_reason(row, "subtract 근거에 전체예산/총사업비/조건성 키워드 포함"),
    ),
    (
        "support_amount_to_non_cash",
        "기존 support_amount가 새 기준 non_cash로 바뀌는 후보",
        changed_type("support_amount", "non_cash"),
    ),
    (
        "eok_without_company_basis",
        "억 단위 금액이나 기업당/과제당 근거 부족",
        lambda row: has_reason(row, "억 단위 금액이나 기업당/과제당 근거 부족"),
    ),
    (
        "amount_delta_20_percent",
        "기존 대표금액과 새 대표금액이 20% 이상 차이",
        lambda row: any("대표 금액 20% 이상 차이" in reason for reason in row.get("risk_reasons") or []),
    ),
    (
        "candidate_without_selected",
        "후보는 있으나 대표 후보 없음",
        lambda row: has_reason(row, "후보는 있으나 대표 후보 없음"),
    ),
    (
        "support_amount_to_unknown",
        "기존 support_amount가 새 기준 unknown으로 바뀌는 후보",
        changed_type("support_amount", "unknown"),
    ),
    (
        "unknown_or_support_ratio",
        "기존 max_amount_type이 unknown/support_ratio",
        lambda row: row.get("old_amount_type") in {"unknown", "support_ratio"},
    ),
    (
        "subtract_over_1billion",
        "subtract 금액이 10억원 이상",
        lambda row: has_reason(row, "subtract 금액이 10억원 이상"),
    ),
    (
        "zero_risk",
        "위험 신호 0건 후보",
        lambda row: int(row.get("risk_count") or 0) == 0,
    ),
]


def sort_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return sorted(
        rows,
        key=lambda row: (
            int(row.get("risk_count") or 0),
            int(row.get("candidate_count") or 0),
            float(row.get("old_amount_manwon") or 0),
        ),
        reverse=True,
    )


def sample_groups(rows: list[dict[str, Any]], per_group: int) -> dict[str, list[dict[str, Any]]]:
    result: dict[str, list[dict[str, Any]]] = {}
    for key, _label, predicate in GROUPS:
        result[key] = sort_rows([row for row in rows if predicate(row)])[:per_group]
    return result


def row_summary(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "risk_count": row.get("risk_count"),
        "risk_reasons": " | ".join(row.get("risk_reasons") or []),
        "old_amount_manwon": row.get("old_amount_manwon"),
        "old_amount_type": row.get("old_amount_type"),
        "old_roi_apply_method": row.get("old_roi_apply_method"),
        "new_selected_amount_manwon": row.get("new_selected_amount_manwon"),
        "new_selected_type": row.get("new_selected_type"),
        "new_roi_apply_method": row.get("new_roi_apply_method"),
        "new_support_ratio": row.get("new_support_ratio"),
        "old_actual": clean_text(row.get("old_actual"), 260),
        "old_basis": clean_text(row.get("old_basis"), 260),
        "new_selected_evidence": clean_text((row.get("new_selected_candidate") or {}).get("evidence"), 260),
    }


def write_markdown(
    path: Path,
    review_file: Path,
    rows: list[dict[str, Any]],
    grouped: dict[str, list[dict[str, Any]]],
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# 기존 policy 금액 backfill 위험 유형 샘플",
        "",
        f"- 생성 시각: {datetime.now().isoformat(timespec='seconds')}",
        f"- 원본 검수 파일: `{review_file}`",
        f"- 전체 행: {len(rows)}",
        f"- 위험 신호 1개 이상: {sum(1 for row in rows if row.get('risk_count'))}",
        f"- 위험 신호 0개: {sum(1 for row in rows if not row.get('risk_count'))}",
        "",
        "## 결론",
        "- 위험 유형별 샘플을 먼저 눈검수한 뒤 규칙을 보정해야 합니다.",
        "- 위험 신호 0건은 제한 업데이트 후보지만, 실제 업데이트 전 payload dry-run을 한 번 더 확인해야 합니다.",
        "- 이 파일은 샘플링 리포트이며 DB를 수정하지 않았습니다.",
        "",
    ]

    label_by_key = {key: label for key, label, _predicate in GROUPS}
    for key, samples in grouped.items():
        lines.extend(
            [
                f"## {label_by_key[key]}",
                "",
                f"- 샘플 수: {len(samples)}",
                "",
            ]
        )
        if not samples:
            lines.extend(["해당 없음", ""])
            continue
        for index, row in enumerate(samples, start=1):
            summary = row_summary(row)
            lines.extend(
                [
                    f"### {index}. `{summary['policy_id']}`",
                    f"- 제목: {summary['title']}",
                    f"- 위험 수: {summary['risk_count']}",
                    f"- 위험 사유: {summary['risk_reasons']}",
                    f"- 기존: {summary['old_amount_manwon']}만원 / {summary['old_amount_type']} / {summary['old_roi_apply_method']}",
                    f"- 새 후보: {summary['new_selected_amount_manwon']}만원 / {summary['new_selected_type']} / {summary['new_roi_apply_method']} / ratio={summary['new_support_ratio']}",
                    f"- 기존 actual: {summary['old_actual']}",
                    f"- 기존 basis: {summary['old_basis']}",
                    f"- 새 후보 근거: {summary['new_selected_evidence']}",
                    "",
                ]
            )
    path.write_text("\n".join(lines), encoding="utf-8")


def write_csv(path: Path, grouped: dict[str, list[dict[str, Any]]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "group",
        "policy_id",
        "title",
        "risk_count",
        "risk_reasons",
        "old_amount_manwon",
        "old_amount_type",
        "old_roi_apply_method",
        "new_selected_amount_manwon",
        "new_selected_type",
        "new_roi_apply_method",
        "new_support_ratio",
        "old_actual",
        "old_basis",
        "new_selected_evidence",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for group_key, samples in grouped.items():
            for row in samples:
                summary = row_summary(row)
                writer.writerow({"group": group_key, **summary})


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Summarize policy amount risk samples from dry-run review JSON.")
    parser.add_argument("--input", default="", help="Review JSON path. Default: latest report.")
    parser.add_argument("--per-group", type=int, default=5)
    parser.add_argument("--output-dir", default=str(DEFAULT_REPORT_DIR))
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    review_file = Path(args.input) if args.input else latest_review_file()
    rows = json.loads(review_file.read_text(encoding="utf-8"))
    grouped = sample_groups(rows, args.per_group)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    md_path = output_dir / f"policy_amount_risk_samples_{timestamp}.md"
    csv_path = output_dir / f"policy_amount_risk_samples_{timestamp}.csv"
    write_markdown(md_path, review_file, rows, grouped)
    write_csv(csv_path, grouped)

    print(f"input={review_file}")
    print(f"markdown={md_path}")
    print(f"csv={csv_path}")
    for key, label, _predicate in GROUPS:
        print(f"{key}: {len(grouped[key])} samples | {label}")
    print("No database rows were updated.")


if __name__ == "__main__":
    main()
