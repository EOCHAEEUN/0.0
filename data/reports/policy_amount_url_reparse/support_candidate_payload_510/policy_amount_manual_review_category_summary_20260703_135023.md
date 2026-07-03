DRY-RUN only. No database rows were updated.
manual_review_rows=221

## category_counts
- 대표금액 회수 가능 후보: 91
- 비현금/수수료/컨설팅성: 31
- 융자/보증/이차보전: 3
- 지원규모 계열 검수: 17
- 지원비율만 있음: 15
- 혼합 수기검수: 64

## columns
- amount_manual_review_required: true
- amount_manual_review_category: machine-readable category
- amount_manual_review_category_ko: Korean category for manual review
- amount_manual_review_reason: reason text
- amount_manual_review_status: pending

## outputs
- csv: `data\reports\policy_amount_url_reparse\support_candidate_payload_510\policy_amount_manual_review_category_payload_20260703_135023.csv`
- json: `data\reports\policy_amount_url_reparse\support_candidate_payload_510\policy_amount_manual_review_category_payload_20260703_135023.json`
- sql: `data\reports\policy_amount_url_reparse\support_candidate_payload_510\policy_amount_manual_review_category_update_20260703_135023.sql`