ALTER TABLE public.policy
ADD COLUMN IF NOT EXISTS amount_candidates jsonb,
ADD COLUMN IF NOT EXISTS selected_amount_candidate jsonb,
ADD COLUMN IF NOT EXISTS support_ratio numeric;

ALTER TABLE public.policy_01_amount_detail
ADD COLUMN IF NOT EXISTS amount_candidates jsonb,
ADD COLUMN IF NOT EXISTS selected_amount_candidate jsonb,
ADD COLUMN IF NOT EXISTS support_ratio numeric;

COMMENT ON COLUMN public.policy.amount_candidates IS
'All amount candidates extracted from the announcement. Populated by a later enrichment step.';

COMMENT ON COLUMN public.policy.selected_amount_candidate IS
'Amount candidate selected as the representative max_amount source.';

COMMENT ON COLUMN public.policy.support_ratio IS
'Structured support ratio for ratio_cap ROI calculation. Store 0.7 for 70%.';

COMMENT ON COLUMN public.policy_01_amount_detail.amount_candidates IS
'Shadow copy of policy.amount_candidates for amount audit.';

COMMENT ON COLUMN public.policy_01_amount_detail.selected_amount_candidate IS
'Shadow copy of policy.selected_amount_candidate for amount audit.';

COMMENT ON COLUMN public.policy_01_amount_detail.support_ratio IS
'Shadow copy of policy.support_ratio for ratio_cap ROI calculation.';

CREATE OR REPLACE FUNCTION public.sync_policy_split_shadow_row(target_policy_id text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.policy_00_core (
        policy_id, title, organization, policy_category, policy_subcategory,
        service_category, region, posted_at, deadline, deadline_display,
        deadline_note, url, summary, support_method, max_amount,
        max_amount_numeric_manwon, max_amount_type, max_amount_type_ko,
        roi_support_type, roi_support_reason, roi_apply_method,
        roi_apply_method_ko, is_selected
    )
    SELECT
        policy_id, title, organization, policy_category, policy_subcategory,
        service_category, region, posted_at, deadline, deadline_display,
        deadline_note, url, summary, support_method, max_amount,
        max_amount_numeric_manwon, max_amount_type, max_amount_type_ko,
        roi_support_type, roi_support_reason, roi_apply_method,
        roi_apply_method_ko, is_selected
    FROM public.policy
    WHERE policy_id = target_policy_id
    ON CONFLICT (policy_id) DO UPDATE SET
        title = EXCLUDED.title,
        organization = EXCLUDED.organization,
        policy_category = EXCLUDED.policy_category,
        policy_subcategory = EXCLUDED.policy_subcategory,
        service_category = EXCLUDED.service_category,
        region = EXCLUDED.region,
        posted_at = EXCLUDED.posted_at,
        deadline = EXCLUDED.deadline,
        deadline_display = EXCLUDED.deadline_display,
        deadline_note = EXCLUDED.deadline_note,
        url = EXCLUDED.url,
        summary = EXCLUDED.summary,
        support_method = EXCLUDED.support_method,
        max_amount = EXCLUDED.max_amount,
        max_amount_numeric_manwon = EXCLUDED.max_amount_numeric_manwon,
        max_amount_type = EXCLUDED.max_amount_type,
        max_amount_type_ko = EXCLUDED.max_amount_type_ko,
        roi_support_type = EXCLUDED.roi_support_type,
        roi_support_reason = EXCLUDED.roi_support_reason,
        roi_apply_method = EXCLUDED.roi_apply_method,
        roi_apply_method_ko = EXCLUDED.roi_apply_method_ko,
        is_selected = EXCLUDED.is_selected;

    INSERT INTO public.policy_01_amount_detail (
        policy_id, max_amount, max_amount_numeric_manwon, max_amount_actual,
        max_amount_basis_text, max_amount_basis_evidence_text,
        max_amount_type, max_amount_type_ko, max_amount_type_reason,
        roi_apply_method, roi_apply_method_ko, roi_apply_reason,
        amount_extraction_status, support_method, support_primary_category,
        support_items, amount_candidates, selected_amount_candidate, support_ratio
    )
    SELECT
        policy_id, max_amount, max_amount_numeric_manwon, max_amount_actual,
        max_amount_basis_text, max_amount_basis_evidence_text,
        max_amount_type, max_amount_type_ko, max_amount_type_reason,
        roi_apply_method, roi_apply_method_ko, roi_apply_reason,
        amount_extraction_status, support_method, support_primary_category,
        support_items, amount_candidates, selected_amount_candidate, support_ratio
    FROM public.policy
    WHERE policy_id = target_policy_id
    ON CONFLICT (policy_id) DO UPDATE SET
        max_amount = EXCLUDED.max_amount,
        max_amount_numeric_manwon = EXCLUDED.max_amount_numeric_manwon,
        max_amount_actual = EXCLUDED.max_amount_actual,
        max_amount_basis_text = EXCLUDED.max_amount_basis_text,
        max_amount_basis_evidence_text = EXCLUDED.max_amount_basis_evidence_text,
        max_amount_type = EXCLUDED.max_amount_type,
        max_amount_type_ko = EXCLUDED.max_amount_type_ko,
        max_amount_type_reason = EXCLUDED.max_amount_type_reason,
        roi_apply_method = EXCLUDED.roi_apply_method,
        roi_apply_method_ko = EXCLUDED.roi_apply_method_ko,
        roi_apply_reason = EXCLUDED.roi_apply_reason,
        amount_extraction_status = EXCLUDED.amount_extraction_status,
        support_method = EXCLUDED.support_method,
        support_primary_category = EXCLUDED.support_primary_category,
        support_items = EXCLUDED.support_items,
        amount_candidates = EXCLUDED.amount_candidates,
        selected_amount_candidate = EXCLUDED.selected_amount_candidate,
        support_ratio = EXCLUDED.support_ratio;

    INSERT INTO public.policy_02_raw_source (
        policy_id, source_name, source_id, raw_json, raw_text,
        attachment_text, attachment_parse_status
    )
    SELECT
        policy_id, source_name, source_id, raw_json, raw_text,
        attachment_text, attachment_parse_status
    FROM public.policy
    WHERE policy_id = target_policy_id
    ON CONFLICT (policy_id) DO UPDATE SET
        source_name = EXCLUDED.source_name,
        source_id = EXCLUDED.source_id,
        raw_json = EXCLUDED.raw_json,
        raw_text = EXCLUDED.raw_text,
        attachment_text = EXCLUDED.attachment_text,
        attachment_parse_status = EXCLUDED.attachment_parse_status;

    INSERT INTO public.policy_03_safety_profile (
        policy_id, policy_primary_nature, recommended_safety_viewpoints,
        safety_justification_reason, safety_justification_usable,
        application_reflection_recommendation
    )
    SELECT
        policy_id, policy_primary_nature, recommended_safety_viewpoints,
        safety_justification_reason, safety_justification_usable,
        application_reflection_recommendation
    FROM public.policy
    WHERE policy_id = target_policy_id
    ON CONFLICT (policy_id) DO UPDATE SET
        policy_primary_nature = EXCLUDED.policy_primary_nature,
        recommended_safety_viewpoints = EXCLUDED.recommended_safety_viewpoints,
        safety_justification_reason = EXCLUDED.safety_justification_reason,
        safety_justification_usable = EXCLUDED.safety_justification_usable,
        application_reflection_recommendation = EXCLUDED.application_reflection_recommendation;

    INSERT INTO public.policy_04_eligibility (
        policy_id, industry_codes, region, eligible_company_types, eligibility_text,
        eligibility_extraction_status, eligibility_evidence,
        required_documents, required_documents_json, required_documents_count
    )
    SELECT
        policy_id, industry_codes, region, eligible_company_types, eligibility_text,
        eligibility_extraction_status, eligibility_evidence,
        required_documents, required_documents_json, required_documents_count
    FROM public.policy
    WHERE policy_id = target_policy_id
    ON CONFLICT (policy_id) DO UPDATE SET
        industry_codes = EXCLUDED.industry_codes,
        region = EXCLUDED.region,
        eligible_company_types = EXCLUDED.eligible_company_types,
        eligibility_text = EXCLUDED.eligibility_text,
        eligibility_extraction_status = EXCLUDED.eligibility_extraction_status,
        eligibility_evidence = EXCLUDED.eligibility_evidence,
        required_documents = EXCLUDED.required_documents,
        required_documents_json = EXCLUDED.required_documents_json,
        required_documents_count = EXCLUDED.required_documents_count;
END;
$$;

NOTIFY pgrst, 'reload schema';
