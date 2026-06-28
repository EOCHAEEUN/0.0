"""Add and backfill safety_rule_legal legal check group columns."""

from __future__ import annotations

import os
import time
from pathlib import Path

from dotenv import load_dotenv
from supabase import create_client


def main() -> None:
    load_dotenv(Path("backend/.env"))
    supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

    sql = """
ALTER TABLE public.safety_rule_legal
  ADD COLUMN IF NOT EXISTS legal_check_process_type text,
  ADD COLUMN IF NOT EXISTS legal_check_process_label text,
  ADD COLUMN IF NOT EXISTS legal_check_group text,
  ADD COLUMN IF NOT EXISTS legal_check_group_label text,
  ADD COLUMN IF NOT EXISTS legal_check_detail text,
  ADD COLUMN IF NOT EXISTS certificate_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS direct_report_required boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS record_keep_required boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS enforcement_type text,
  ADD COLUMN IF NOT EXISTS enforcement_label text,
  ADD COLUMN IF NOT EXISTS process_reason text;

UPDATE public.safety_rule_legal
SET
  legal_check_process_type = CASE
    WHEN concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%제93조%'
      OR inspection_type LIKE '%법정 안전검사%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%안전검사기관%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%합격표시%'
      THEN 'certificate_issue'
    WHEN inspection_type IN ('안전관리자 선임', '안전보건관리책임자 선임')
      THEN 'direct_report_appointment'
    WHEN inspection_type LIKE '%작업환경측정%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과 보고%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과를 보고%'
      OR inspection_type LIKE '%특수건강진단%'
      THEN 'direct_report_result'
    WHEN inspection_type LIKE '%교육%'
      OR inspection_type LIKE '%게시%'
      OR inspection_type LIKE '%부착%'
      OR inspection_type LIKE '%위험성평가%'
      OR inspection_type LIKE '%관리감독자 지정%'
      THEN 'internal_action_record'
    ELSE 'internal_check_record'
  END,
  legal_check_process_label = CASE
    WHEN concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%제93조%'
      OR inspection_type LIKE '%법정 안전검사%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%안전검사기관%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%합격표시%'
      THEN '검사증 발급형'
    WHEN inspection_type IN ('안전관리자 선임', '안전보건관리책임자 선임')
      THEN '선임보고형'
    WHEN inspection_type LIKE '%작업환경측정%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과 보고%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과를 보고%'
      OR inspection_type LIKE '%특수건강진단%'
      THEN '결과보고형'
    WHEN inspection_type LIKE '%교육%'
      OR inspection_type LIKE '%게시%'
      OR inspection_type LIKE '%부착%'
      OR inspection_type LIKE '%위험성평가%'
      OR inspection_type LIKE '%관리감독자 지정%'
      THEN '자체이행/기록보관형'
    ELSE '자체점검/기록보관형'
  END,
  legal_check_group = CASE
    WHEN concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%제93조%'
      OR inspection_type LIKE '%법정 안전검사%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%안전검사기관%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%합격표시%'
      THEN 'certificate'
    WHEN inspection_type IN ('안전관리자 선임', '안전보건관리책임자 선임')
      OR inspection_type LIKE '%작업환경측정%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과 보고%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과를 보고%'
      OR inspection_type LIKE '%특수건강진단%'
      THEN 'report'
    ELSE 'internal'
  END,
  legal_check_group_label = CASE
    WHEN concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%제93조%'
      OR inspection_type LIKE '%법정 안전검사%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%안전검사기관%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%합격표시%'
      THEN '확인증형'
    WHEN inspection_type IN ('안전관리자 선임', '안전보건관리책임자 선임')
      OR inspection_type LIKE '%작업환경측정%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과 보고%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과를 보고%'
      OR inspection_type LIKE '%특수건강진단%'
      THEN '신고보고형'
    ELSE '자체관리형'
  END,
  legal_check_detail = CASE
    WHEN concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%제93조%'
      OR inspection_type LIKE '%법정 안전검사%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%안전검사기관%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%합격표시%'
      THEN '검사증 발급형'
    WHEN inspection_type IN ('안전관리자 선임', '안전보건관리책임자 선임')
      THEN '선임보고형'
    WHEN inspection_type LIKE '%작업환경측정%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과 보고%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과를 보고%'
      OR inspection_type LIKE '%특수건강진단%'
      THEN '결과보고형'
    WHEN inspection_type LIKE '%교육%'
      OR inspection_type LIKE '%게시%'
      OR inspection_type LIKE '%부착%'
      OR inspection_type LIKE '%위험성평가%'
      OR inspection_type LIKE '%관리감독자 지정%'
      THEN '자체이행/기록보관형'
    ELSE '자체점검/기록보관형'
  END,
  certificate_required = CASE
    WHEN concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%제93조%'
      OR inspection_type LIKE '%법정 안전검사%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%안전검사기관%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%합격표시%'
      THEN true ELSE false END,
  direct_report_required = CASE
    WHEN inspection_type IN ('안전관리자 선임', '안전보건관리책임자 선임')
      OR inspection_type LIKE '%작업환경측정%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과 보고%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과를 보고%'
      OR inspection_type LIKE '%특수건강진단%'
      THEN true ELSE false END,
  record_keep_required = true,
  enforcement_type = CASE
    WHEN penalty_type = 'direct_fine' THEN 'immediate_fine'
    WHEN penalty_type = 'audit_trigger' THEN 'audit_trigger'
    WHEN penalty_type = 'criminal_liability' THEN 'criminal_liability'
    WHEN legal_check_group = 'internal' THEN 'record_required'
    ELSE NULL
  END,
  enforcement_label = CASE
    WHEN penalty_type = 'direct_fine' THEN '즉시 과태료 가능'
    WHEN penalty_type = 'audit_trigger' THEN '감독전환위험'
    WHEN penalty_type = 'criminal_liability' THEN '사고 시 형사처벌'
    WHEN legal_check_group = 'internal' THEN '기록·증빙 보관 필요'
    ELSE NULL
  END,
  process_reason = CASE
    WHEN concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%제93조%'
      OR inspection_type LIKE '%법정 안전검사%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%안전검사기관%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%합격표시%'
      THEN '산업안전보건법 제93조 안전검사 대상. 지정 안전검사기관 또는 자율안전검사기관 검사 후 검사 결과·합격표시 등 증빙을 받아 관리하는 유형.'
    WHEN inspection_type IN ('안전관리자 선임', '안전보건관리책임자 선임')
      THEN '안전보건 담당자 선임 사실을 사업장이 신고·보고하고 내부 기록을 관리하는 유형.'
    WHEN inspection_type LIKE '%작업환경측정%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과 보고%'
      OR concat_ws(' ', inspection_type, legal_basis, source_name, evidence_text, penalty_basis) LIKE '%결과를 보고%'
      THEN '법정 작업환경측정 결과를 사업장 또는 측정기관을 통해 보고·보존하는 성격의 의무.'
    WHEN inspection_type LIKE '%특수건강진단%'
      THEN '특수건강진단 실시 결과를 관리·보고·보존하는 성격의 법정 의무.'
    WHEN inspection_type LIKE '%교육%'
      OR inspection_type LIKE '%게시%'
      OR inspection_type LIKE '%부착%'
      OR inspection_type LIKE '%위험성평가%'
      OR inspection_type LIKE '%관리감독자 지정%'
      THEN '교육·게시·평가·지정 등 사업장 자체 이행 후 증빙자료를 보관하는 유형.'
    ELSE '관리감독자 작업시작 전 점검 또는 사업장 자체 점검 성격. 외부 확인증 발급이나 정기 신고보다 내부 이행·기록 관리가 핵심.'
  END
WHERE rule_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
"""
    supabase.rpc("execute_sql", {"sql": sql}).execute()
    time.sleep(2)

    check_rows = (
        supabase.table("safety_rule_legal")
        .select("rule_id,legal_check_group,legal_check_group_label,legal_check_detail")
        .order("rule_id")
        .execute()
        .data
        or []
    )

    print(f"verified_rows={len(check_rows)}")
    counts = {}
    for row in check_rows:
        key = f"{row['legal_check_group']} / {row['legal_check_detail']}"
        counts[key] = counts.get(key, 0) + 1
    for key, count in sorted(counts.items()):
        print(f"{key}: {count}")


if __name__ == "__main__":
    main()
