CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.safety_viewer_policy (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    analysis_id TEXT NOT NULL,
    policy_id TEXT NOT NULL,
    equipment_id TEXT,
    investment_plan_id TEXT NOT NULL DEFAULT '',

    equipment_name TEXT,
    equipment_type TEXT,

    can_run_safety_logic BOOLEAN NOT NULL DEFAULT FALSE,

    generated_viewpoints JSONB NOT NULL DEFAULT '{}'::jsonb,
    safety_preview_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_evidences JSONB NOT NULL DEFAULT '[]'::jsonb,
    matched_safety_rules JSONB NOT NULL DEFAULT '[]'::jsonb,

    generation_source TEXT NOT NULL DEFAULT 'rule_based',
    description_model TEXT,
    status TEXT NOT NULL DEFAULT 'generated',
    usage_status TEXT NOT NULL DEFAULT 'preview',
    used_in_draft_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (analysis_id, policy_id, equipment_id, investment_plan_id)
);

CREATE INDEX IF NOT EXISTS idx_safety_viewer_policy_lookup
    ON public.safety_viewer_policy (analysis_id, policy_id, equipment_id);

CREATE TABLE IF NOT EXISTS public.user_safety_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    analysis_id TEXT NOT NULL,
    safety_viewer_policy_id UUID REFERENCES public.safety_viewer_policy(id) ON DELETE CASCADE,

    policy_id TEXT NOT NULL,
    equipment_id TEXT,
    investment_plan_id TEXT,

    viewpoint_key TEXT,
    safety_rule_id TEXT,
    evidence_type TEXT NOT NULL,
    evidence_label TEXT,
    base_evidence_label TEXT,

    file_url TEXT,
    file_name TEXT,
    file_mime_type TEXT,
    file_size_bytes BIGINT,

    uploaded_by UUID,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    memo TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_safety_files_viewer_policy
    ON public.user_safety_files (safety_viewer_policy_id);

CREATE INDEX IF NOT EXISTS idx_user_safety_files_lookup
    ON public.user_safety_files (analysis_id, policy_id, equipment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_viewer_policy TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_safety_files TO service_role;
