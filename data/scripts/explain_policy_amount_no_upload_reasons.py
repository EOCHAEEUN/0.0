from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path
from typing import Any


REPORT_DIR = Path("data/reports/policy_amount_url_reparse")
DEFAULT_REPARSE_JSON = REPORT_DIR / "policy_amount_url_reparse_reevaluated_20260703_114737.json"
DEFAULT_NO_UPLOAD_CSV = REPORT_DIR / "upload_decision" / "no_upload_sheet_20260703_132346.csv"


def clean(value: Any, max_len: int | None = None) -> str:
    text = "" if value is None else str(value)
    text = text.replace("\x00", "").replace("\r", " ").replace("\n", " ")
    text = " ".join(text.split())
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def read_csv(path: Path) -> list[dict[str, str]]:
    content = path.read_text(encoding="utf-8-sig").replace("\x00", "")
    return list(csv.DictReader(content.splitlines()))


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        path.write_text("", encoding="utf-8-sig")
        return
    fields = list(rows[0].keys())
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields, escapechar="\\")
        writer.writeheader()
        writer.writerows(rows)


def candidate_summary(candidates: list[dict[str, Any]], limit: int = 5) -> str:
    parts: list[str] = []
    for candidate in candidates[:limit]:
        parts.append(
            (
                f"{candidate.get('amount_manwon')}만원/"
                f"{clean(candidate.get('max_amount_type'))}/"
                f"{clean(candidate.get('roi_apply_method'))}: "
                f"{clean(candidate.get('local_context') or candidate.get('evidence') or candidate.get('raw_text'), 220)}"
            )
        )
    if len(candidates) > limit:
        parts.append(f"... 후보 {len(candidates) - limit}개 추가")
    return " || ".join(parts)


def explain(row: dict[str, str], reparse: dict[str, Any]) -> tuple[str, str, str, str]:
    group = clean(row.get("no_upload_group"))
    action = clean(row.get("recommended_action"))
    candidates = reparse.get("new_amount_candidates") or []
    selected_type = clean(reparse.get("new_selected_type"))
    roi_method = clean(reparse.get("new_roi_apply_method"))
    old_amount = clean(row.get("old_amount_actual")) or clean(row.get("old_amount_manwon"))

    if group == "resolved_keep_old":
        return (
            "기존값 유지",
            "새 파싱값보다 기존값이 더 타당하다고 판정되어 업데이트하지 않음",
            "기존값을 보존. 필요하면 수기검수에서 keep_old로 확정",
            "업로드하면 오히려 검수된 기존 대표금액을 덮어쓸 위험",
        )
    if group == "non_cash_only":
        return (
            "비현금/수수료/컨설팅성",
            "후보가 현금 보조금이 아니라 인증/시험/컨설팅/장비활용/수수료 계열",
            "ROI 직접 차감 대신 추천/참고 정보로만 사용",
            "현금지원금처럼 차감하면 ROI가 과대 계산될 위험",
        )
    if group == "selected_candidate_missing" and action == "no_representative_amount":
        return (
            "대표금액 없음",
            "Gemini/규칙 검수 후에도 기업당/과제당 최대 지원금으로 볼 후보가 없음",
            "금액 업데이트 제외. 필요하면 수기검수로 근거 문장 직접 확인",
            "총규모/조건/비현금 후보를 대표금액으로 오인할 위험",
        )
    if group == "selected_candidate_missing" and action == "exclude_or_policy_decision":
        return (
            "정책판단/대표 제외",
            "후보는 있으나 대부분 총규모, 조건금액, 비현금, 수수료 등 대표 제외 성격",
            "자동 업로드 제외. 정책상 보여줄 필요가 있으면 별도 타입으로 수기 결정",
            "업로드 기준이 정책 판단에 따라 달라져 자동 확정 불가",
        )
    if group == "safe_non_update_remainder":
        if roi_method in {"recommend_only", "exclude"} or selected_type in {"non_cash", "loan", "guarantee", "interest_support"}:
            return (
                "안전하지만 ROI 차감 대상 아님",
                f"새 후보 타입이 {selected_type or '-'} / 적용방식이 {roi_method or '-'}라 금액 차감 payload에서 제외",
                "추천/제외 타입으로 별도 저장 여부 결정",
                "금액은 안전해도 현금 차감 필드에 넣으면 의미가 달라짐",
            )
        return (
            "안전하지만 현재 업로드 범위 밖",
            "위험 사유는 없지만 tier-a 금액 업데이트 조건에는 들어가지 않음",
            "원하면 2차 업로드 범위로 별도 payload 생성 가능",
            "현재 일괄 업로드 범위 밖이라 자동 반영하지 않음",
        )
    return (
        "기타 자동 제외",
        row.get("no_upload_reason") or "자동 업로드 제외 기준에 해당",
        "수기검수 또는 별도 정책 결정",
        "자동 확정 근거 부족",
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Explain no-upload policy amount rows in detail.")
    parser.add_argument("--reparse-json", default=str(DEFAULT_REPARSE_JSON))
    parser.add_argument("--no-upload-csv", default=str(DEFAULT_NO_UPLOAD_CSV))
    parser.add_argument("--output-dir", default=str(REPORT_DIR / "upload_decision"))
    args = parser.parse_args()

    reparse_rows = json.loads(Path(args.reparse_json).read_text(encoding="utf-8"))
    rows_by_id = {clean(row.get("policy_id")): row for row in reparse_rows}
    no_upload_rows = read_csv(Path(args.no_upload_csv))

    explained: list[dict[str, Any]] = []
    for row in no_upload_rows:
        policy_id = clean(row.get("policy_id"))
        reparse = rows_by_id.get(policy_id, {})
        reason_group, detailed_reason, next_action, risk_if_uploaded = explain(row, reparse)
        explained.append(
            {
                "policy_id": policy_id,
                "title": row.get("title"),
                "organization": row.get("organization"),
                "no_upload_group": row.get("no_upload_group"),
                "reason_group_ko": reason_group,
                "detailed_reason_ko": detailed_reason,
                "risk_if_uploaded_ko": risk_if_uploaded,
                "next_action_ko": next_action,
                "recommended_action": row.get("recommended_action"),
                "old_amount_manwon": row.get("old_amount_manwon"),
                "old_amount_actual": row.get("old_amount_actual"),
                "new_selected_amount_manwon": reparse.get("new_selected_amount_manwon"),
                "new_selected_type": reparse.get("new_selected_type"),
                "new_roi_apply_method": reparse.get("new_roi_apply_method"),
                "candidate_count": row.get("candidate_count"),
                "candidate_summary": candidate_summary(reparse.get("new_amount_candidates") or []),
                "url": row.get("url"),
            }
        )

    counts: dict[tuple[str, str], int] = {}
    for row in explained:
        key = (row["no_upload_group"], row["reason_group_ko"])
        counts[key] = counts.get(key, 0) + 1

    output_dir = Path(args.output_dir)
    detail_path = output_dir / "no_upload_reason_detail.csv"
    summary_path = output_dir / "no_upload_reason_detail.md"
    write_csv(detail_path, explained)

    lines = [
        "DRY-RUN only. No database rows were updated.",
        f"no_upload_rows={len(explained)}",
        "",
        "## reason_counts",
    ]
    for (group, reason), count in sorted(counts.items()):
        lines.append(f"- {group} / {reason}: {count}")
    lines.extend(["", "## samples"])
    for reason in sorted({row["reason_group_ko"] for row in explained}):
        lines.extend(["", f"### {reason}"])
        for row in [item for item in explained if item["reason_group_ko"] == reason][:6]:
            lines.extend(
                [
                    f"- {row['policy_id']} | {row['title']}",
                    f"  - why: {row['detailed_reason_ko']}",
                    f"  - risk: {row['risk_if_uploaded_ko']}",
                    f"  - next: {row['next_action_ko']}",
                    f"  - candidates: {clean(row['candidate_summary'], 260)}",
                ]
            )
    summary_path.write_text("\n".join(lines), encoding="utf-8")

    print(f"no_upload_rows={len(explained)}")
    for (group, reason), count in sorted(counts.items()):
        print(f"{group} / {reason}: {count}")
    print(f"detail_csv={detail_path}")
    print(f"summary_md={summary_path}")


if __name__ == "__main__":
    main()
