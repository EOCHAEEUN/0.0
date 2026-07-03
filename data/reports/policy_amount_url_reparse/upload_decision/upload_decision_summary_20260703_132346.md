DRY-RUN only. No database rows were updated.
upload_ready_rows=217
manual_review_rows=100
no_upload_rows=193

## upload_ready_counts
- amount_update: 186
- support_ratio_only: 31

## manual_review_counts
- candidate_missing: 55
- hold_large_delta_or_selected: 38
- residual_risk_reason: 5
- total_scale_hold: 2

## no_upload_counts
- non_cash_only: 10
- resolved_keep_old: 43
- safe_non_update_remainder: 46
- selected_candidate_missing: 94

## manual_input_columns
- manual_review_decision: adopt_new / keep_old / exclude / support_ratio_only / needs_ocr / hold
- manual_amount_manwon: 수기 채택 금액(만원)
- manual_amount_actual: 화면 표시 문구
- manual_amount_type: support_amount / subsidy / voucher / support_ratio / non_cash / loan / unknown
- manual_roi_apply_method: subtract / ratio_cap / recommend_only / exclude / review
- manual_support_ratio: 지원비율이 있으면 0.7 형태
- manual_evidence: 사람이 확인한 근거 문장
- manual_note: 검수 메모

## outputs
- upload_ready_sheet: `data\reports\policy_amount_url_reparse\upload_decision\upload_ready_sheet_20260703_132346.csv`
- manual_review_sheet: `data\reports\policy_amount_url_reparse\upload_decision\manual_review_sheet_20260703_132346.csv`
- no_upload_sheet: `data\reports\policy_amount_url_reparse\upload_decision\no_upload_sheet_20260703_132346.csv`