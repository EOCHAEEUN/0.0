-- Migration: Normalize safety_rule_legal.inspection_purpose to 3 categories
-- Date: 2026-07-03
-- Purpose:
--   - Normalize legacy values to:
--       안전장치점검 / 유지보수점검 / 안전교육
--   - Enforce NOT NULL + CHECK constraint on safety_rule_legal.inspection_purpose.

BEGIN;

ALTER TABLE public.safety_rule_legal
    ADD COLUMN IF NOT EXISTS inspection_purpose TEXT;

UPDATE public.safety_rule_legal
SET inspection_purpose = CASE
    WHEN inspection_purpose IS NULL OR btrim(inspection_purpose) = '' THEN '유지보수점검'
    WHEN inspection_purpose IN ('안전장치점검', '유지보수점검', '안전교육') THEN inspection_purpose

    -- legacy Korean labels
    WHEN inspection_purpose IN ('안전점검', '안전개선', '안전관련') THEN '안전장치점검'
    WHEN inspection_purpose IN ('정비기록', '정비계획', '정비관련') THEN '유지보수점검'

    -- legacy API labels
    WHEN inspection_purpose IN ('safety_inspection', 'safety_improvement', 'safety_related') THEN '안전장치점검'
    WHEN inspection_purpose IN ('maintenance_record', 'maintenance_plan', 'maintenance_related') THEN '유지보수점검'

    -- keyword fallback
    WHEN inspection_purpose LIKE '%교육%' OR inspection_purpose LIKE '%훈련%' THEN '안전교육'
    WHEN inspection_purpose LIKE '%정비%' OR inspection_purpose LIKE '%유지보수%' OR inspection_purpose LIKE '%보전%' THEN '유지보수점검'
    ELSE '안전장치점검'
END;

ALTER TABLE public.safety_rule_legal
    ALTER COLUMN inspection_purpose SET NOT NULL;

ALTER TABLE public.safety_rule_legal
    DROP CONSTRAINT IF EXISTS safety_rule_legal_inspection_purpose_check;

ALTER TABLE public.safety_rule_legal
    DROP CONSTRAINT IF EXISTS safety_rule_inspection_purpose_check;

ALTER TABLE public.safety_rule_legal
    ADD CONSTRAINT safety_rule_legal_inspection_purpose_check CHECK (
        inspection_purpose IN ('안전장치점검', '유지보수점검', '안전교육')
    );

COMMENT ON COLUMN public.safety_rule_legal.inspection_purpose IS
    '법정점검 목적 분류: 안전장치점검, 유지보수점검, 안전교육.';

COMMIT;

