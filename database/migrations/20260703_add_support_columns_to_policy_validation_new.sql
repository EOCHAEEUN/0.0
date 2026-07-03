ALTER TABLE public.policy_validation_new
ADD COLUMN IF NOT EXISTS support_primary_category text,
ADD COLUMN IF NOT EXISTS support_categories text[],
ADD COLUMN IF NOT EXISTS support_items jsonb;

COMMENT ON COLUMN public.policy_validation_new.support_primary_category IS
'Primary support category generated during collection or Gemini enrichment.';

COMMENT ON COLUMN public.policy_validation_new.support_categories IS
'Support category list generated during collection or Gemini enrichment.';

COMMENT ON COLUMN public.policy_validation_new.support_items IS
'Structured support items generated during collection or Gemini enrichment.';
