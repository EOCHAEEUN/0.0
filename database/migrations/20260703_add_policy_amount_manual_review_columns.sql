ALTER TABLE public.policy
ADD COLUMN IF NOT EXISTS amount_manual_review_required boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS amount_manual_review_category text,
ADD COLUMN IF NOT EXISTS amount_manual_review_category_ko text,
ADD COLUMN IF NOT EXISTS amount_manual_review_reason text,
ADD COLUMN IF NOT EXISTS amount_manual_review_status text NOT NULL DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS amount_manual_review_note text;

ALTER TABLE public.policy_01_amount_detail
ADD COLUMN IF NOT EXISTS amount_manual_review_required boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS amount_manual_review_category text,
ADD COLUMN IF NOT EXISTS amount_manual_review_category_ko text,
ADD COLUMN IF NOT EXISTS amount_manual_review_reason text,
ADD COLUMN IF NOT EXISTS amount_manual_review_status text NOT NULL DEFAULT 'not_required',
ADD COLUMN IF NOT EXISTS amount_manual_review_note text;

COMMENT ON COLUMN public.policy.amount_manual_review_required IS
'Whether the amount extraction needs a human review before representative max_amount can be finalized.';

COMMENT ON COLUMN public.policy.amount_manual_review_category IS
'Machine-readable manual review category for amount extraction.';

COMMENT ON COLUMN public.policy.amount_manual_review_category_ko IS
'Korean manual review category shown to operators.';

COMMENT ON COLUMN public.policy.amount_manual_review_reason IS
'Reason why amount extraction needs manual review.';

COMMENT ON COLUMN public.policy.amount_manual_review_status IS
'Manual review workflow status: not_required, pending, reviewed, hold.';

COMMENT ON COLUMN public.policy.amount_manual_review_note IS
'Operator note for amount manual review.';

COMMENT ON COLUMN public.policy_01_amount_detail.amount_manual_review_required IS
'Shadow copy of policy.amount_manual_review_required for amount audit.';

COMMENT ON COLUMN public.policy_01_amount_detail.amount_manual_review_category IS
'Shadow copy of policy.amount_manual_review_category.';

COMMENT ON COLUMN public.policy_01_amount_detail.amount_manual_review_category_ko IS
'Shadow copy of policy.amount_manual_review_category_ko.';

COMMENT ON COLUMN public.policy_01_amount_detail.amount_manual_review_reason IS
'Shadow copy of policy.amount_manual_review_reason.';

COMMENT ON COLUMN public.policy_01_amount_detail.amount_manual_review_status IS
'Shadow copy of policy.amount_manual_review_status.';

COMMENT ON COLUMN public.policy_01_amount_detail.amount_manual_review_note IS
'Shadow copy of policy.amount_manual_review_note.';
