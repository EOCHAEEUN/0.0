ALTER TABLE public.policy
ADD COLUMN IF NOT EXISTS max_amount_basis_evidence_text text;

COMMENT ON COLUMN public.policy.max_amount_basis_evidence_text IS
'Cleaned source excerpt separated from max_amount_basis_text for amount-basis evidence display.';

NOTIFY pgrst, 'reload schema';
