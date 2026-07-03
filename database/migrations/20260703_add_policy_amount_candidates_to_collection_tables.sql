ALTER TABLE public.policy_validation_new
ADD COLUMN IF NOT EXISTS amount_candidates jsonb,
ADD COLUMN IF NOT EXISTS selected_amount_candidate jsonb,
ADD COLUMN IF NOT EXISTS support_ratio numeric;

ALTER TABLE public.policy_external_collected
ADD COLUMN IF NOT EXISTS amount_candidates jsonb,
ADD COLUMN IF NOT EXISTS selected_amount_candidate jsonb,
ADD COLUMN IF NOT EXISTS support_ratio numeric;

COMMENT ON COLUMN public.policy_validation_new.amount_candidates IS
'All amount candidates extracted during collection before promotion to policy.';

COMMENT ON COLUMN public.policy_validation_new.selected_amount_candidate IS
'Representative amount candidate selected during collection before promotion to policy.';

COMMENT ON COLUMN public.policy_validation_new.support_ratio IS
'Structured support ratio extracted during collection. Store 0.7 for 70%.';

COMMENT ON COLUMN public.policy_external_collected.amount_candidates IS
'All amount candidates extracted during external collection before promotion.';

COMMENT ON COLUMN public.policy_external_collected.selected_amount_candidate IS
'Representative amount candidate selected during external collection before promotion.';

COMMENT ON COLUMN public.policy_external_collected.support_ratio IS
'Structured support ratio extracted during external collection. Store 0.7 for 70%.';

NOTIFY pgrst, 'reload schema';
