ALTER TABLE public.policy_validation_new
ADD COLUMN IF NOT EXISTS max_amount_type_ko text,
ADD COLUMN IF NOT EXISTS max_amount_type_reason text,
ADD COLUMN IF NOT EXISTS roi_apply_method text,
ADD COLUMN IF NOT EXISTS roi_apply_method_ko text,
ADD COLUMN IF NOT EXISTS roi_apply_reason text;

ALTER TABLE public.policy_external_collected
ADD COLUMN IF NOT EXISTS max_amount_type_ko text,
ADD COLUMN IF NOT EXISTS max_amount_type_reason text,
ADD COLUMN IF NOT EXISTS roi_apply_method text,
ADD COLUMN IF NOT EXISTS roi_apply_method_ko text,
ADD COLUMN IF NOT EXISTS roi_apply_reason text;

NOTIFY pgrst, 'reload schema';
