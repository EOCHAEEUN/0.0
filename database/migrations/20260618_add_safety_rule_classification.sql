-- Add obligation and purpose classifications to safety rules.
-- Columns remain nullable until existing rules are reviewed and backfilled.

BEGIN;

ALTER TABLE public.safety_rule
    ADD COLUMN IF NOT EXISTS legal_requirement TEXT,
    ADD COLUMN IF NOT EXISTS inspection_purpose TEXT;

ALTER TABLE public.safety_rule
    DROP CONSTRAINT IF EXISTS safety_rule_legal_requirement_check,
    ADD CONSTRAINT safety_rule_legal_requirement_check CHECK (
        legal_requirement IS NULL
        OR legal_requirement IN ('법정점검', '자율점검')
    ),
    DROP CONSTRAINT IF EXISTS safety_rule_inspection_purpose_check,
    ADD CONSTRAINT safety_rule_inspection_purpose_check CHECK (
        inspection_purpose IS NULL
        OR inspection_purpose IN ('안전장치점검', '유지보수점검', '안전교육')
    );

COMMENT ON COLUMN public.safety_rule.legal_requirement IS
    'Whether the inspection is legally required or voluntarily managed: 법정점검, 자율점검.';

COMMENT ON COLUMN public.safety_rule.inspection_purpose IS
    'Primary inspection purpose: 안전장치점검, 유지보수점검, 안전교육.';

COMMIT;
