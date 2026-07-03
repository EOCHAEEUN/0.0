ALTER TABLE public.policy_01_amount_detail
ADD COLUMN IF NOT EXISTS url text;

COMMENT ON COLUMN public.policy_01_amount_detail.url IS
'Shadow copy of policy.url for manual amount review.';

CREATE OR REPLACE FUNCTION public.sync_policy_01_amount_detail_url()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.policy_01_amount_detail (policy_id, url)
    VALUES (NEW.policy_id, NEW.url)
    ON CONFLICT (policy_id) DO UPDATE SET
        url = EXCLUDED.url;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_policy_01_amount_detail_url ON public.policy;
CREATE TRIGGER trg_sync_policy_01_amount_detail_url
AFTER INSERT OR UPDATE OF url ON public.policy
FOR EACH ROW
EXECUTE FUNCTION public.sync_policy_01_amount_detail_url();

UPDATE public.policy_01_amount_detail AS detail
SET url = policy.url
FROM public.policy AS policy
WHERE detail.policy_id = policy.policy_id
  AND detail.url IS DISTINCT FROM policy.url;
