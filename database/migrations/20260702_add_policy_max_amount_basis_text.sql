ALTER TABLE public.policy
ADD COLUMN IF NOT EXISTS max_amount_basis_text text,
ADD COLUMN IF NOT EXISTS max_amount_type_reason text;

COMMENT ON COLUMN public.policy.max_amount_basis_text IS
'Combined amount basis text built from max_amount_evidence, max_amount_note, and support_method.';

COMMENT ON COLUMN public.policy.max_amount_type_reason IS
'Reason for classifying max_amount_type_ko, especially amount missing versus amount type unclear.';

NOTIFY pgrst, 'reload schema';
