ALTER TABLE public.policy
ADD COLUMN IF NOT EXISTS roi_apply_method text,
ADD COLUMN IF NOT EXISTS roi_apply_method_ko text,
ADD COLUMN IF NOT EXISTS roi_apply_reason text;

CREATE INDEX IF NOT EXISTS idx_policy_roi_apply_method
ON public.policy (roi_apply_method);

COMMENT ON COLUMN public.policy.roi_apply_method IS
'ROI calculation handling key: subtract, ratio_cap, recommend_only, review, or exclude.';

COMMENT ON COLUMN public.policy.roi_apply_method_ko IS
'Korean display label for roi_apply_method.';

COMMENT ON COLUMN public.policy.roi_apply_reason IS
'Reason why the policy is applied to ROI calculation, recommendation only, review, or exclusion.';

NOTIFY pgrst, 'reload schema';
