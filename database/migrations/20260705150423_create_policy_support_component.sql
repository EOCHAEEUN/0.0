-- Migration: Create policy support components
-- Date: 2026-07-05
-- Scope: Store multiple reviewed support effects for each active policy.

BEGIN;

CREATE TABLE public.policy_support_component (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    policy_id TEXT NOT NULL,
    component_key TEXT NOT NULL,
    component_name TEXT NOT NULL,

    support_type TEXT NOT NULL,
    effect_layer TEXT NOT NULL,
    calculation_method TEXT NOT NULL,

    roi_apply_method TEXT NOT NULL DEFAULT 'none',

    fixed_amount_manwon NUMERIC NULL,
    cap_amount_manwon NUMERIC NULL,
    support_ratio NUMERIC NULL,
    eligible_cost_ratio NUMERIC NULL,
    unit_value_manwon NUMERIC NULL,

    term_months INTEGER NULL,
    interest_rate NUMERIC NULL,
    interest_subsidy_rate NUMERIC NULL,
    repayment_method TEXT NULL,

    eligible_expense_types JSONB NOT NULL DEFAULT '[]'::JSONB,
    condition_json JSONB NOT NULL DEFAULT '{}'::JSONB,

    stacking_rule TEXT NOT NULL DEFAULT 'unknown',
    stack_group TEXT NULL,

    evidence_text TEXT NULL,
    evidence_source_type TEXT NULL,
    evidence_source_name TEXT NULL,
    evidence_page_or_section TEXT NULL,

    extraction_confidence TEXT NOT NULL DEFAULT 'low',
    review_status TEXT NOT NULL DEFAULT 'pending',

    source_component_json JSONB NOT NULL DEFAULT '{}'::JSONB,
    component_version INTEGER NOT NULL DEFAULT 1,

    valid_from DATE NULL,
    valid_to DATE NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_policy_support_component_policy
        FOREIGN KEY (policy_id)
        REFERENCES public.policy(policy_id)
        ON DELETE CASCADE,

    CONSTRAINT uq_policy_support_component_version
        UNIQUE (policy_id, component_key, component_version),

    CONSTRAINT chk_policy_support_component_support_type
        CHECK (
            support_type IN (
                'direct_grant',
                'voucher',
                'loan',
                'interest_support',
                'guarantee',
                'in_kind',
                'testing_certification',
                'consulting',
                'mentoring',
                'education',
                'equipment_access',
                'other'
            )
        ),

    CONSTRAINT chk_policy_support_component_effect_layer
        CHECK (
            effect_layer IN (
                'capex_offset',
                'financing_effect',
                'execution_support',
                'reference_only'
            )
        ),

    CONSTRAINT chk_policy_support_component_calculation_method
        CHECK (
            calculation_method IN (
                'fixed_cap',
                'ratio_cap',
                'loan_terms',
                'interest_rate_subsidy',
                'guarantee_limit',
                'unit_cost',
                'verified_reference_cost',
                'qualitative',
                'none'
            )
        ),

    CONSTRAINT chk_policy_support_component_roi_apply_method
        CHECK (roi_apply_method IN ('subtract', 'ratio_cap', 'none')),

    CONSTRAINT chk_policy_support_component_stacking_rule
        CHECK (
            stacking_rule IN (
                'exclusive',
                'same_expense_exclusive',
                'parallel_allowed',
                'unknown'
            )
        ),

    CONSTRAINT chk_policy_support_component_review_status
        CHECK (review_status IN ('pending', 'approved', 'rejected')),

    CONSTRAINT chk_policy_support_component_extraction_confidence
        CHECK (extraction_confidence IN ('high', 'medium', 'low', 'manual')),

    CONSTRAINT chk_policy_support_component_support_ratio
        CHECK (
            support_ratio IS NULL
            OR (support_ratio > 0 AND support_ratio <= 1)
        ),

    CONSTRAINT chk_policy_support_component_eligible_cost_ratio
        CHECK (
            eligible_cost_ratio IS NULL
            OR (eligible_cost_ratio > 0 AND eligible_cost_ratio <= 1)
        ),

    CONSTRAINT chk_policy_support_component_nonnegative_rates
        CHECK (
            (interest_rate IS NULL OR interest_rate >= 0)
            AND (
                interest_subsidy_rate IS NULL
                OR interest_subsidy_rate >= 0
            )
        ),

    CONSTRAINT chk_policy_support_component_nonnegative_amounts
        CHECK (
            (fixed_amount_manwon IS NULL OR fixed_amount_manwon >= 0)
            AND (cap_amount_manwon IS NULL OR cap_amount_manwon >= 0)
            AND (unit_value_manwon IS NULL OR unit_value_manwon >= 0)
        ),

    CONSTRAINT chk_policy_support_component_term_months
        CHECK (term_months IS NULL OR term_months > 0),

    CONSTRAINT chk_policy_support_component_json_shapes
        CHECK (
            jsonb_typeof(eligible_expense_types) = 'array'
            AND jsonb_typeof(condition_json) = 'object'
            AND jsonb_typeof(source_component_json) = 'object'
        ),

    CONSTRAINT chk_policy_support_component_version
        CHECK (component_version > 0),

    CONSTRAINT chk_policy_support_component_direct_roi_shape
        CHECK (
            roi_apply_method = 'none'
            OR (
                effect_layer = 'capex_offset'
                AND calculation_method IN ('fixed_cap', 'ratio_cap')
            )
        ),

    CONSTRAINT chk_policy_support_component_ratio_cap
        CHECK (
            roi_apply_method <> 'ratio_cap'
            OR (
                calculation_method = 'ratio_cap'
                AND support_ratio IS NOT NULL
                AND cap_amount_manwon > 0
            )
        ),

    CONSTRAINT chk_policy_support_component_subtract
        CHECK (
            roi_apply_method <> 'subtract'
            OR (
                calculation_method = 'fixed_cap'
                AND (
                    fixed_amount_manwon > 0
                    OR cap_amount_manwon > 0
                )
            )
        ),

    CONSTRAINT chk_policy_support_component_non_capex_roi
        CHECK (
            effect_layer = 'capex_offset'
            OR roi_apply_method = 'none'
        )
);

CREATE INDEX idx_policy_support_component_policy_id
    ON public.policy_support_component (policy_id);

CREATE INDEX idx_policy_support_component_review_effect
    ON public.policy_support_component (review_status, effect_layer);

CREATE INDEX idx_policy_support_component_valid_to
    ON public.policy_support_component (valid_to);

CREATE INDEX idx_policy_support_component_stack_group
    ON public.policy_support_component (stack_group);

ALTER TABLE public.policy_support_component ENABLE ROW LEVEL SECURITY;

GRANT SELECT
    ON TABLE public.policy_support_component
    TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON TABLE public.policy_support_component
    TO service_role;

CREATE POLICY "approved policy support components are publicly readable"
    ON public.policy_support_component
    FOR SELECT
    TO anon, authenticated
    USING (review_status = 'approved');

COMMIT;
