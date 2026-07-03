from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

import collect_external_policy_sources as external
import policy_amount_utils as amount_utils
import upload_final as core


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parent.parent
DEFAULT_OUTPUT_DIR = ROOT / "data" / "reports" / "policy_amount_url_reparse"

for env_path in [
    Path.cwd() / ".env",
    SCRIPT_DIR / ".env",
    SCRIPT_DIR.parent / ".env",
    SCRIPT_DIR.parent.parent / ".env",
    SCRIPT_DIR / "backend" / ".env",
    SCRIPT_DIR.parent / "backend" / ".env",
    SCRIPT_DIR.parent.parent / "backend" / ".env",
]:
    if env_path.exists():
        load_dotenv(env_path)

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    or os.getenv("SUPABASE_SERVICE_KEY")
    or ""
).strip()

SELECT_COLUMNS = ",".join(
    [
        "policy_id",
        "title",
        "organization",
        "url",
        "summary",
        "support_method",
        "raw_text",
        "max_amount",
        "max_amount_numeric_manwon",
        "max_amount_actual",
        "max_amount_type",
        "max_amount_type_ko",
        "max_amount_evidence",
        "max_amount_basis_text",
        "max_amount_basis_evidence_text",
        "roi_apply_method",
        "support_ratio",
    ]
)

RISK_CONTEXT_KEYWORDS = [
    "전체예산",
    "전체 예산",
    "총예산",
    "총 예산",
    "지원규모",
    "총지원규모",
    "총 사업비",
    "총사업비",
    "사업비",
    "과제비",
    "매출액",
    "연매출",
    "자부담",
    "민간부담",
    "수수료",
    "교육비",
    "컨설팅비",
    "장비사용료",
]

SOFT_RISK_CONTEXT_KEYWORDS = [
    "사업비",
    "과제비",
    "자부담",
    "민간부담",
    "수수료",
]

SAFE_LIMIT_KEYWORDS = [
    "기업당",
    "기업별",
    "업체당",
    "과제당",
    "사업장당",
    "컨소시엄당",
    "개사당",
    "1개사",
    "개별기업",
    "최대",
    "한도",
    "이내",
    "내외",
]

SAFE_SUPPORT_CONTEXT_KEYWORDS = [
    "지원금액",
    "지원 금액",
    "지원한도",
    "지원 한도",
    "지원액",
    "사업화 지원금",
    "기업지원금",
    "신청 지원금",
    "정부지원금",
]

UNSAFE_LIMIT_CONTEXT_KEYWORDS = [
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
    "합계액",
    "총 금액",
    "총금액",
    "총 지원금",
    "총지원금",
    "당 1명",
]

DECISION_REASON_KO = {
    "clear_selected_candidate": "대표금액 후보가 명확함",
    "source_fetch_failed": "원문 URL/API 조회 실패",
    "source_fetched_empty": "원문 조회는 됐지만 본문이 비어 있음",
    "source_missing_url": "원문 URL 없음",
    "used_fallback_text": "URL 원문 대신 기존 DB 텍스트로 분석",
    "candidate_missing": "금액 후보 자체를 찾지 못함",
    "selected_candidate_missing": "금액 후보는 있으나 대표금액을 선택하지 못함",
    "large_amount_delta": "기존 금액과 새 대표금액 차이가 큼",
    "subtract_without_limit_context": "직접 차감 후보이나 기업당/한도 문맥이 부족함",
    "selected_context_has_risk_keyword": "선택 후보 주변에 총사업비/자부담 등 위험 키워드가 있음",
}

DECISION_REASON_PREFIX_KO = {
    "selected_excluded_type": "대표 제외 타입이 선택됨",
    "selected_uncertain_type": "불확실한 타입이 선택됨",
}


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def clean_text(value: Any, max_len: int | None = None) -> str:
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        text = json.dumps(value, ensure_ascii=False, default=str)
    else:
        text = str(value)
    text = re.sub(r"\s+", " ", text).strip()
    if max_len and len(text) > max_len:
        return text[:max_len].rstrip()
    return text


def numeric_or_none(value: Any) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def translate_reason(reason: str) -> str:
    text = clean_text(reason)
    if text in DECISION_REASON_KO:
        return DECISION_REASON_KO[text]
    if ":" in text:
        prefix, value = text.split(":", 1)
        if prefix in DECISION_REASON_PREFIX_KO:
            return f"{DECISION_REASON_PREFIX_KO[prefix]}: {value}"
    return text


def translate_reasons(reasons: list[str] | None) -> list[str]:
    return [translate_reason(reason) for reason in reasons or []]


def has_safe_limit_context(local_context: str) -> bool:
    if any(keyword in local_context for keyword in SAFE_LIMIT_KEYWORDS):
        return True
    if not any(keyword in local_context for keyword in SAFE_SUPPORT_CONTEXT_KEYWORDS):
        return False
    return not any(keyword in local_context for keyword in UNSAFE_LIMIT_CONTEXT_KEYWORDS)


def has_risky_selected_context(local_context: str) -> bool:
    if not any(keyword in local_context for keyword in RISK_CONTEXT_KEYWORDS):
        return False
    hard_risk_keywords = [
        keyword
        for keyword in RISK_CONTEXT_KEYWORDS
        if keyword not in SOFT_RISK_CONTEXT_KEYWORDS
    ]
    if any(keyword in local_context for keyword in hard_risk_keywords):
        return True
    return not has_safe_limit_context(local_context)


def fetch_rows(supabase: Client, table: str, limit: int, only_missing_candidates: bool) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    page_size = 500
    while True:
        if limit and len(rows) >= limit:
            return rows[:limit]
        end = start + min(page_size, limit - len(rows) if limit else page_size) - 1
        query = (
            supabase.table(table)
            .select(SELECT_COLUMNS)
            .order("policy_id")
            .range(start, end)
        )
        if only_missing_candidates:
            query = query.is_("amount_candidates", "null")
        response = query.execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < (end - start + 1):
            break
        start += page_size
    return rows[:limit] if limit else rows


def fallback_text(row: dict[str, Any]) -> str:
    parts = [
        row.get("title"),
        row.get("summary"),
        row.get("support_method"),
        row.get("detail_text"),
        row.get("attachment_text"),
        row.get("raw_text"),
        row.get("max_amount_actual"),
        row.get("max_amount_evidence"),
        row.get("max_amount_basis_text"),
        row.get("max_amount_basis_evidence_text"),
    ]
    return "\n".join(clean_text(part, 60000) for part in parts if clean_text(part))


def parse_smart_factory_policy_id(policy_id: str) -> tuple[str, str] | None:
    parts = clean_text(policy_id).split(":")
    if len(parts) >= 3 and parts[0].upper() == "SMARTFACTORY":
        return parts[1], parts[2]
    return None


def fetch_smart_factory_source(session: requests.Session, row: dict[str, Any]) -> dict[str, Any] | None:
    ids = parse_smart_factory_policy_id(clean_text(row.get("policy_id")))
    if not ids:
        return None
    pbanc_id, pbanc_sn = ids
    try:
        detail = external.fetch_smart_factory_detail(session, pbanc_id, pbanc_sn)
        detail_text = core.clean_text(
            core.clean_html(
                external.pick(detail, "pbancCn", "dtlCn", "cn", default="")
            ),
            60000,
        )
        attachments = external.fetch_smart_factory_attachments(
            session,
            core.clean_text(detail.get("atchFileId")),
        )
        attachment_text = clean_text(attachments.get("attachment_text"), 60000)
        detail_url = (
            f"{external.SMART_FACTORY_BASE_URL}"
            f"{external.SMART_FACTORY_PUBLIC_DETAIL_PATH}?"
            f"pbancId={pbanc_id}&pbancSn={pbanc_sn}"
        )
        status = "fetched"
        if not detail_text and not attachment_text:
            status = "fetched_empty"
        return {
            "fetch_status": status,
            "fetch_method": "smart_factory_api",
            "resolved_url": detail_url,
            "detail_text": detail_text,
            "attachment_text": attachment_text,
            "attachment_files": attachments.get("attachment_files") or [],
            "attachment_error": attachments.get("error_message") or "",
            "attachment_stats": attachments.get("attachment_stats") or {},
            "source_api_json": {
                "detail": detail,
                "attachments": attachments.get("source_api_json") or {},
            },
            "error_message": "",
        }
    except Exception as exc:
        return {
            "fetch_status": "fetch_failed",
            "fetch_method": "smart_factory_api",
            "detail_text": "",
            "attachment_text": "",
            "attachment_files": [],
            "error_message": str(exc),
        }


def fetch_url_source(session: requests.Session, row: dict[str, Any]) -> dict[str, Any]:
    smart_factory = fetch_smart_factory_source(session, row)
    if smart_factory is not None:
        return smart_factory

    url = clean_text(row.get("url"))
    if not url:
        return {
            "fetch_status": "missing_url",
            "fetch_method": "url",
            "detail_text": "",
            "attachment_text": "",
            "attachment_files": [],
            "error_message": "url is empty",
        }
    try:
        response = session.get(
            url,
            headers=external.SCRIPT_HEADERS,
            timeout=45,
            allow_redirects=True,
        )
        response.raise_for_status()
        if not response.encoding or response.encoding.lower() in {"iso-8859-1", "ascii"}:
            response.encoding = response.apparent_encoding or "utf-8"
        html = response.text
        detail_text = core.clean_text(core.clean_html(html), 60000)
        attachments = external.fetch_web_attachment_content(session, html, response.url)
        attachment_text = clean_text(attachments.get("attachment_text"), 60000)
        status = "fetched"
        if not detail_text and not attachment_text:
            status = "fetched_empty"
        return {
            "fetch_status": status,
            "fetch_method": "url",
            "resolved_url": response.url,
            "detail_text": detail_text,
            "attachment_text": attachment_text,
            "attachment_files": attachments.get("attachment_files") or [],
            "attachment_error": attachments.get("error_message") or "",
            "attachment_stats": attachments.get("attachment_stats") or {},
            "error_message": "",
        }
    except Exception as exc:
        return {
            "fetch_status": "fetch_failed",
            "fetch_method": "url",
            "detail_text": "",
            "attachment_text": "",
            "attachment_files": [],
            "error_message": str(exc),
        }


def source_for_amount(row: dict[str, Any], fetched: dict[str, Any]) -> tuple[str, str]:
    fetched_text = "\n".join(
        part
        for part in [
            clean_text(row.get("title")),
            clean_text(row.get("organization")),
            fetched.get("detail_text") or "",
            fetched.get("attachment_text") or "",
        ]
        if part
    )
    if clean_text(fetched_text):
        return fetched_text, "url"
    fallback = fallback_text(row)
    if fallback:
        return fallback, "fallback"
    return "", "empty"


def compare_reparse(row: dict[str, Any], selected: dict[str, Any] | None) -> list[str]:
    reasons: list[str] = []
    old_amount = numeric_or_none(row.get("max_amount_numeric_manwon") or row.get("max_amount"))
    old_type = clean_text(row.get("max_amount_type")).lower() or "unknown"
    old_method = clean_text(row.get("roi_apply_method")).lower() or "unknown"
    new_amount = numeric_or_none(selected.get("amount_manwon")) if selected else None
    new_type = clean_text(selected.get("max_amount_type")).lower() if selected else None
    new_method = clean_text(selected.get("roi_apply_method")).lower() if selected else None

    if selected and old_type != new_type:
        reasons.append(f"type_changed:{old_type}->{new_type}")
    if selected and old_method != new_method:
        reasons.append(f"roi_method_changed:{old_method}->{new_method}")
    if old_amount is not None and new_amount is None:
        reasons.append("old_amount_without_new_selected_amount")
    if old_amount is None and new_amount is not None:
        reasons.append("new_amount_found_from_source")
    if old_amount is not None and new_amount is not None:
        delta = abs(old_amount - new_amount)
        if delta >= 1 and delta / max(old_amount, 1) >= 0.2:
            reasons.append(f"amount_delta_20_percent:old={old_amount:g},new={new_amount:g}")
    return reasons


def classify_decision(
    fetched: dict[str, Any],
    source_kind: str,
    candidates: list[dict[str, Any]],
    selected: dict[str, Any] | None,
    comparison_reasons: list[str],
) -> tuple[str, list[str]]:
    reasons: list[str] = []
    fetch_status = clean_text(fetched.get("fetch_status"))
    if fetch_status in {"fetch_failed", "missing_url", "fetched_empty"} and source_kind != "fallback":
        reasons.append(f"source_{fetch_status}")
    if source_kind == "fallback":
        reasons.append("used_fallback_text")
    if not candidates:
        return "needs_review", reasons + ["candidate_missing"]
    if not selected:
        return "needs_review", reasons + ["selected_candidate_missing"]

    selected_type = clean_text(selected.get("max_amount_type")).lower()
    selected_method = clean_text(selected.get("roi_apply_method")).lower()
    local_context = clean_text(selected.get("local_context") or selected.get("evidence") or selected.get("raw_text"))

    if selected_type in amount_utils.REPRESENTATIVE_EXCLUDED_TYPES:
        reasons.append(f"selected_excluded_type:{selected_type}")
    if selected_type in {"unknown", "support_ratio"}:
        reasons.append(f"selected_uncertain_type:{selected_type}")
    if selected_method == "subtract" and has_risky_selected_context(local_context):
        reasons.append("selected_context_has_risk_keyword")
    if selected_method == "subtract" and not has_safe_limit_context(local_context):
        reasons.append("subtract_without_limit_context")
    if any(reason.startswith("amount_delta_20_percent") for reason in comparison_reasons):
        reasons.append("large_amount_delta")

    if reasons:
        return "needs_review", reasons
    return "safe", ["clear_selected_candidate"]


def review_row(session: requests.Session, row: dict[str, Any]) -> dict[str, Any]:
    fetched = fetch_url_source(session, row)
    source_text, source_kind = source_for_amount(row, fetched)
    candidates, selected = amount_utils.normalize_candidate_selection(
        amount_utils.extract_amount_candidates(source_text)
    )
    derived = amount_utils.derive_policy_amount_fields(selected, candidates)
    comparison_reasons = compare_reparse(row, selected)
    decision, decision_reasons = classify_decision(
        fetched,
        source_kind,
        candidates,
        selected,
        comparison_reasons,
    )
    return {
        "policy_id": row.get("policy_id"),
        "title": row.get("title"),
        "organization": row.get("organization"),
        "url": row.get("url"),
        "fetch_status": fetched.get("fetch_status"),
        "fetch_method": fetched.get("fetch_method"),
        "source_kind": source_kind,
        "decision": decision,
        "decision_reasons": decision_reasons,
        "decision_reasons_ko": translate_reasons(decision_reasons),
        "comparison_reasons": comparison_reasons,
        "old_amount_manwon": numeric_or_none(row.get("max_amount_numeric_manwon") or row.get("max_amount")),
        "old_amount_type": row.get("max_amount_type"),
        "old_roi_apply_method": row.get("roi_apply_method"),
        "old_actual": row.get("max_amount_actual"),
        "candidate_count": len(candidates),
        "new_selected_amount_manwon": selected.get("amount_manwon") if selected else None,
        "new_selected_type": selected.get("max_amount_type") if selected else None,
        "new_roi_apply_method": selected.get("roi_apply_method") if selected else None,
        "new_support_ratio": derived.get("support_ratio"),
        "new_selected_candidate": selected,
        "new_amount_candidates": candidates,
        "derived_fields": derived,
        "resolved_url": fetched.get("resolved_url"),
        "detail_text_length": len(clean_text(fetched.get("detail_text"))),
        "attachment_text_length": len(clean_text(fetched.get("attachment_text"))),
        "attachment_files": fetched.get("attachment_files") or [],
        "attachment_stats": fetched.get("attachment_stats") or {},
        "fetch_error": fetched.get("error_message") or fetched.get("attachment_error") or "",
    }


def write_json(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(rows, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fields = [
        "policy_id",
        "title",
        "organization",
        "fetch_status",
        "source_kind",
        "decision",
        "decision_reasons",
        "decision_reasons_ko",
        "comparison_reasons",
        "old_amount_manwon",
        "old_amount_type",
        "old_roi_apply_method",
        "candidate_count",
        "new_selected_amount_manwon",
        "new_selected_type",
        "new_roi_apply_method",
        "new_support_ratio",
        "detail_text_length",
        "attachment_text_length",
        "fetch_error",
        "url",
    ]
    with path.open("w", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            if "decision_reasons_ko" not in row:
                row["decision_reasons_ko"] = translate_reasons(row.get("decision_reasons") or [])
            flat = {field: row.get(field) for field in fields}
            flat["decision_reasons"] = " | ".join(row.get("decision_reasons") or [])
            flat["decision_reasons_ko"] = " | ".join(row.get("decision_reasons_ko") or [])
            flat["comparison_reasons"] = " | ".join(row.get("comparison_reasons") or [])
            writer.writerow(flat)


def load_policy_ids_csv(path: str) -> set[str]:
    if not path:
        return set()
    content = Path(path).read_text(encoding="utf-8-sig").replace("\x00", "")
    reader = csv.DictReader(io.StringIO(content))
    return {
        clean_text(row.get("policy_id"))
        for row in reader
        if clean_text(row.get("policy_id"))
    }


def reevaluate_report_rows(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    reviewed: list[dict[str, Any]] = []
    for row in rows:
        updated = dict(row)
        comparison_reasons = row.get("comparison_reasons") or []
        decision, decision_reasons = classify_decision(
            {"fetch_status": row.get("fetch_status")},
            clean_text(row.get("source_kind")),
            row.get("new_amount_candidates") or [],
            row.get("new_selected_candidate"),
            comparison_reasons,
        )
        updated["decision"] = decision
        updated["decision_reasons"] = decision_reasons
        updated["decision_reasons_ko"] = translate_reasons(decision_reasons)
        reviewed.append(updated)
    return reviewed


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Dry-run URL/attachment reparse for existing policy amount candidates. "
            "No database rows are updated."
        )
    )
    parser.add_argument("--table", default="policy")
    parser.add_argument("--limit", type=int, default=20, help="0 means all rows")
    parser.add_argument("--sleep", type=float, default=0.2)
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument(
        "--only-missing-candidates",
        action="store_true",
        help="Only rows where amount_candidates is null.",
    )
    parser.add_argument(
        "--csv-from-json",
        default="",
        help="Existing reparse JSON report to convert to a CSV with translated reason columns. No fetching.",
    )
    parser.add_argument(
        "--reevaluate-json",
        default="",
        help="Existing reparse JSON report to reclassify with current decision rules. No fetching.",
    )
    parser.add_argument(
        "--policy-ids-csv",
        default="",
        help="CSV containing policy_id column. Only those rows will be fetched and reparsed.",
    )
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    if args.csv_from_json:
        input_path = Path(args.csv_from_json)
        rows = json.loads(input_path.read_text(encoding="utf-8"))
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path(args.output_dir)
        csv_path = output_dir / f"policy_amount_url_reparse_translated_{timestamp}.csv"
        write_csv(csv_path, rows)
        print("CSV conversion only. No fetching and no database rows were updated.")
        print(f"input={input_path}")
        print(f"rows={len(rows)}")
        print(f"csv={csv_path}")
        return
    if args.reevaluate_json:
        input_path = Path(args.reevaluate_json)
        rows = json.loads(input_path.read_text(encoding="utf-8"))
        reviewed = reevaluate_report_rows(rows)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_dir = Path(args.output_dir)
        json_path = output_dir / f"policy_amount_url_reparse_reevaluated_{timestamp}.json"
        csv_path = output_dir / f"policy_amount_url_reparse_reevaluated_{timestamp}.csv"
        write_json(json_path, reviewed)
        write_csv(csv_path, reviewed)
        decisions: dict[str, int] = {}
        reason_counts: dict[str, int] = {}
        for row in reviewed:
            decisions[row["decision"]] = decisions.get(row["decision"], 0) + 1
            for reason in row.get("decision_reasons") or []:
                reason_counts[reason] = reason_counts.get(reason, 0) + 1
        print("Re-evaluation only. No fetching and no database rows were updated.")
        print(f"input={input_path}")
        print(f"rows={len(reviewed)}")
        print(f"decisions={decisions}")
        print(f"reason_counts={reason_counts}")
        print(f"json={json_path}")
        print(f"csv={csv_path}")
        return

    supabase = client()
    rows = fetch_rows(
        supabase,
        args.table,
        limit=args.limit,
        only_missing_candidates=args.only_missing_candidates,
    )
    policy_ids = load_policy_ids_csv(args.policy_ids_csv)
    if policy_ids:
        rows = [row for row in rows if clean_text(row.get("policy_id")) in policy_ids]
    session = requests.Session()
    reviewed: list[dict[str, Any]] = []
    for index, row in enumerate(rows, start=1):
        result = review_row(session, row)
        reviewed.append(result)
        print(
            f"[{index}/{len(rows)}] {result['policy_id']} | "
            f"fetch={result['fetch_status']} | "
            f"source={result['source_kind']} | "
            f"decision={result['decision']} | "
            f"candidates={result['candidate_count']} | "
            f"selected={result['new_selected_amount_manwon']} {result['new_selected_type']}"
        )
        if args.sleep:
            time.sleep(args.sleep)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = Path(args.output_dir)
    json_path = output_dir / f"policy_amount_url_reparse_{timestamp}.json"
    csv_path = output_dir / f"policy_amount_url_reparse_{timestamp}.csv"
    write_json(json_path, reviewed)
    write_csv(csv_path, reviewed)

    decisions: dict[str, int] = {}
    fetches: dict[str, int] = {}
    for row in reviewed:
        decisions[row["decision"]] = decisions.get(row["decision"], 0) + 1
        fetch_status = clean_text(row.get("fetch_status")) or "unknown"
        fetches[fetch_status] = fetches.get(fetch_status, 0) + 1

    print("=" * 80)
    print("DRY-RUN only. No database rows were updated.")
    print(f"table={args.table}")
    print(f"rows={len(reviewed)}")
    print(f"decisions={decisions}")
    print(f"fetch_statuses={fetches}")
    print(f"json={json_path}")
    print(f"csv={csv_path}")


if __name__ == "__main__":
    main()
