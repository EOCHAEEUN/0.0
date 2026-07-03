from __future__ import annotations

import argparse
import json
import os
import re
import time
from pathlib import Path
from typing import Any

import requests
from dotenv import load_dotenv
from supabase import Client, create_client

from sync_policy_from_validation import (
    build_max_amount_basis_evidence_text,
    build_max_amount_basis_text,
    build_max_amount_type_reason,
    clean_text,
)


SCRIPT_DIR = Path(__file__).resolve().parent

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
DEFAULT_TARGET_TABLE = os.getenv("POLICY_SYNC_TARGET_TABLE", "policy").strip()
GEMINI_API_KEY = (
    os.getenv("GEMINI_API_KEY")
    or os.getenv("GOOGLE_API_KEY")
    or ""
).strip()
DEFAULT_GEMINI_MODEL = (
    os.getenv("GEMINI_MODEL")
    or os.getenv("DATA_LLM_MODEL")
    or "gemini-2.5-flash-lite"
).replace("google/", "").removeprefix("models/").strip()
GEMINI_TIMEOUT_SECONDS = 45


def client() -> Client:
    if not SUPABASE_URL:
        raise ValueError("SUPABASE_URL is missing from .env files.")
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise ValueError("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SERVICE_KEY is missing from .env files.")
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def fetch_all(supabase: Client, table: str, select: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    start = 0
    batch_size = 1000
    while True:
        end = start + batch_size - 1
        response = supabase.table(table).select(select).range(start, end).execute()
        batch = response.data or []
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        start += batch_size
    return rows


def apply_schema(supabase: Client, table: str, *, apply: bool) -> None:
    sql = f"""
ALTER TABLE public.{table}
ADD COLUMN IF NOT EXISTS max_amount_basis_text text,
ADD COLUMN IF NOT EXISTS max_amount_basis_evidence_text text,
ADD COLUMN IF NOT EXISTS max_amount_type_reason text;

NOTIFY pgrst, 'reload schema';
""".strip()
    if not apply:
        print(f"[dry-run] would add {table}.max_amount_basis_text and max_amount_basis_evidence_text")
        return
    supabase.rpc("execute_sql", {"sql": sql}).execute()
    print("schema_applied=True")


def compact_prompt_value(value: Any, max_len: int = 900) -> str:
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


def needs_gemini_refine(row: dict[str, Any], basis_text: str | None) -> bool:
    text = basis_text or ""
    amount_type = compact_prompt_value(row.get("max_amount_type_ko") or row.get("max_amount_type"))
    weak_markers = [
        "금액 미기재",
        "금액 성격 미확인",
        "검토 필요",
        "찾지 못함",
        "확인 불가",
        "원천 API",
    ]
    if len(text) > 420:
        return True
    if any(marker in amount_type or marker in text for marker in weak_markers):
        return True
    return False


def extract_json_object(text: str) -> dict[str, Any]:
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).strip()
        text = re.sub(r"```$", "", text).strip()
    start = text.find("{")
    if start >= 0:
        text = text[start:]
    decoder = json.JSONDecoder()
    parsed, _ = decoder.raw_decode(text)
    if not isinstance(parsed, dict):
        raise ValueError("Gemini response is not a JSON object")
    return parsed


def refine_basis_text_with_gemini(
    row: dict[str, Any],
    *,
    rule_basis_text: str | None,
    rule_type_reason: str | None,
    model: str,
) -> str | None:
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY or GOOGLE_API_KEY is missing.")

    prompt = f"""
너는 정부지원사업 공고의 금액 근거 문장을 정제하는 데이터 운영자다.

목표:
- max_amount_basis_text를 운영자가 바로 읽을 수 있는 짧은 한국어 문장으로 정제한다.
- 없는 정보를 만들지 않는다.
- 금액이 없으면 금액을 지어내지 않는다.
- 금액 미기재와 금액 성격 미확인은 구분한다.
- 1~4개 절을 " / "로 연결한다.
- 원문 전체를 복붙하지 말고 금액 판단, 지원 방식만 남긴다.
- 원문 근거 발췌는 max_amount_basis_evidence_text로 별도 저장하므로 max_amount_basis_text에는 넣지 않는다.
- 출력은 JSON 하나만 반환한다.

반환 형식:
{{"max_amount_basis_text":"..."}}

입력:
policy_id: {compact_prompt_value(row.get("policy_id"))}
title: {compact_prompt_value(row.get("title"))}
max_amount: {compact_prompt_value(row.get("max_amount") or row.get("max_amount_numeric_manwon"))}
max_amount_actual: {compact_prompt_value(row.get("max_amount_actual"))}
max_amount_type: {compact_prompt_value(row.get("max_amount_type"))}
max_amount_type_ko: {compact_prompt_value(row.get("max_amount_type_ko"))}
max_amount_evidence: {compact_prompt_value(row.get("max_amount_evidence"))}
max_amount_note: {compact_prompt_value(row.get("max_amount_note"))}
support_method: {compact_prompt_value(row.get("support_method"))}
rule_type_reason: {compact_prompt_value(rule_type_reason)}
rule_basis_text: {compact_prompt_value(rule_basis_text)}
summary: {compact_prompt_value(row.get("summary"))}
""".strip()

    model = model.replace("google/", "").removeprefix("models/")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    response = requests.post(
        url,
        params={"key": GEMINI_API_KEY},
        json={
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.1,
                "responseMimeType": "application/json",
            },
        },
        timeout=GEMINI_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    data = response.json()
    text = (
        data.get("candidates", [{}])[0]
        .get("content", {})
        .get("parts", [{}])[0]
        .get("text", "")
    )
    parsed = extract_json_object(text)
    refined = compact_prompt_value(parsed.get("max_amount_basis_text"), max_len=500)
    return refined or rule_basis_text


def resolve_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Add and backfill policy.max_amount_basis_text and max_amount_basis_evidence_text."
    )
    parser.add_argument("--target-table", default=DEFAULT_TARGET_TABLE)
    parser.add_argument("--apply", action="store_true", help="Actually update DB. Default is dry-run.")
    parser.add_argument("--limit", type=int, default=0, help="Limit rows to process. 0 means all.")
    parser.add_argument("--gemini", action="store_true", help="Second-pass refine ambiguous basis text with Gemini.")
    parser.add_argument("--gemini-limit", type=int, default=80, help="Max Gemini calls when --gemini is set.")
    parser.add_argument("--force-gemini", action="store_true", help="Call Gemini even when current text differs from rule output.")
    parser.add_argument("--model", default=DEFAULT_GEMINI_MODEL)
    parser.add_argument("--sleep", type=float, default=0.15, help="Sleep seconds between Gemini calls.")
    return parser.parse_args()


def main() -> None:
    args = resolve_args()
    supabase = client()
    apply_schema(supabase, args.target_table, apply=args.apply)

    rows = fetch_all(
        supabase,
        args.target_table,
        "policy_id,max_amount,max_amount_numeric_manwon,max_amount_type,"
        "max_amount_type_ko,max_amount_actual,max_amount_evidence,"
        "max_amount_note,support_method,summary,"
        "max_amount_basis_text,max_amount_basis_evidence_text,max_amount_type_reason",
    )
    if args.limit > 0:
        rows = rows[: args.limit]
    changed = 0
    gemini_calls = 0
    gemini_errors = 0

    for row in rows:
        policy_id = clean_text(row.get("policy_id"))
        if not policy_id:
            continue
        rule_basis_text = build_max_amount_basis_text(row)
        basis_text = rule_basis_text
        basis_evidence_text = build_max_amount_basis_evidence_text(row)
        reason = build_max_amount_type_reason(row)
        already_gemini_refined = bool(
            row.get("max_amount_basis_text")
            and row.get("max_amount_basis_text") != rule_basis_text
        )
        if (
            args.gemini
            and gemini_calls < args.gemini_limit
            and (args.force_gemini or not already_gemini_refined)
            and needs_gemini_refine(row, basis_text)
        ):
            try:
                basis_text = refine_basis_text_with_gemini(
                    row,
                    rule_basis_text=basis_text,
                    rule_type_reason=reason,
                    model=args.model,
                )
                gemini_calls += 1
            except Exception as exc:
                gemini_errors += 1
                print(f"gemini_error policy_id={policy_id} error={type(exc).__name__}", flush=True)
            if args.sleep > 0:
                time.sleep(args.sleep)
        payload = {
            "max_amount_basis_text": basis_text,
            "max_amount_basis_evidence_text": basis_evidence_text,
            "max_amount_type_reason": reason,
        }
        if (
            row.get("max_amount_basis_text") == basis_text
            and row.get("max_amount_basis_evidence_text") == basis_evidence_text
            and row.get("max_amount_type_reason") == reason
        ):
            continue
        changed += 1
        if args.apply:
            (
                supabase.table(args.target_table)
                .update(payload)
                .eq("policy_id", policy_id)
                .execute()
            )

    print(f"target_rows={len(rows)}")
    print(f"gemini_calls={gemini_calls}")
    print(f"gemini_errors={gemini_errors}")
    print(f"updated={changed if args.apply else 0} would_update={0 if args.apply else changed}")


if __name__ == "__main__":
    main()
