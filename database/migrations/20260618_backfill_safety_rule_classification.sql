-- Backfill reviewed classifications for the current 33 safety rules.

BEGIN;

UPDATE public.safety_rule
SET legal_requirement = CASE
        WHEN rule_id IN (
            'safety-rule-press-005',
            'safety-rule-press-006',
            'safety-rule-cnc-006',
            'safety-rule-injection-005',
            'safety-rule-injection-006'
        ) THEN '법정점검'
        ELSE '자율점검'
    END,
    inspection_purpose = CASE
        WHEN rule_id IN (
            'safety-rule-press-005',
            'safety-rule-cnc-006',
            'safety-rule-injection-006'
        ) THEN '안전교육'
        WHEN rule_id IN (
            'safety-rule-press-001',
            'safety-rule-press-003',
            'safety-rule-press-004',
            'safety-rule-press-006',
            'safety-rule-press-009',
            'safety-rule-press-011',
            'safety-rule-press-012',
            'safety-rule-cnc-001',
            'safety-rule-cnc-002',
            'safety-rule-cnc-005',
            'safety-rule-cnc-008',
            'safety-rule-injection-001',
            'safety-rule-injection-003',
            'safety-rule-injection-005'
        ) THEN '안전장치점검'
        ELSE '유지보수점검'
    END;

ALTER TABLE public.safety_rule
    ALTER COLUMN legal_requirement SET NOT NULL,
    ALTER COLUMN inspection_purpose SET NOT NULL;

COMMIT;
