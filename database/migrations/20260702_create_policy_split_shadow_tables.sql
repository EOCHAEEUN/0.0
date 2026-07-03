ALTER TABLE public.policy
    ADD COLUMN IF NOT EXISTS roi_apply_method text,
    ADD COLUMN IF NOT EXISTS roi_apply_method_ko text,
    ADD COLUMN IF NOT EXISTS roi_apply_reason text;

CREATE TABLE IF NOT EXISTS public.policy_00_core AS
SELECT
    policy_id,
    title,
    organization,
    policy_category,
    policy_subcategory,
    service_category,
    region,
    posted_at,
    deadline,
    deadline_display,
    deadline_note,
    url,
    summary,
    support_method,
    max_amount,
    max_amount_numeric_manwon,
    max_amount_type,
    max_amount_type_ko,
    roi_support_type,
    roi_support_reason,
    roi_apply_method,
    roi_apply_method_ko,
    is_selected
FROM public.policy
WHERE false;

CREATE TABLE IF NOT EXISTS public.policy_01_amount_detail AS
SELECT
    policy_id,
    max_amount,
    max_amount_numeric_manwon,
    max_amount_actual,
    max_amount_basis_text,
    max_amount_basis_evidence_text,
    max_amount_type,
    max_amount_type_ko,
    max_amount_type_reason,
    roi_apply_method,
    roi_apply_method_ko,
    roi_apply_reason,
    amount_extraction_status,
    support_method,
    support_primary_category,
    support_items
FROM public.policy
WHERE false;

CREATE TABLE IF NOT EXISTS public.policy_02_raw_source AS
SELECT
    policy_id,
    source_name,
    source_id,
    raw_json,
    raw_text,
    attachment_text,
    attachment_parse_status
FROM public.policy
WHERE false;

CREATE TABLE IF NOT EXISTS public.policy_03_safety_profile AS
SELECT
    policy_id,
    policy_primary_nature,
    recommended_safety_viewpoints,
    safety_justification_reason,
    safety_justification_usable,
    application_reflection_recommendation
FROM public.policy
WHERE false;

CREATE TABLE IF NOT EXISTS public.policy_04_eligibility AS
SELECT
    policy_id,
    industry_codes,
    region,
    eligible_company_types,
    eligibility_text,
    eligibility_extraction_status,
    eligibility_evidence,
    required_documents,
    required_documents_json,
    required_documents_count
FROM public.policy
WHERE false;

ALTER TABLE public.policy_00_core
    ADD COLUMN IF NOT EXISTS roi_apply_method text,
    ADD COLUMN IF NOT EXISTS roi_apply_method_ko text,
    DROP COLUMN IF EXISTS service_subcategory,
    DROP COLUMN IF EXISTS max_amount_status,
    DROP COLUMN IF EXISTS selected_reason,
    DROP COLUMN IF EXISTS relevance_score,
    DROP COLUMN IF EXISTS created_at;

ALTER TABLE public.policy_01_amount_detail
    ADD COLUMN IF NOT EXISTS roi_apply_method text,
    ADD COLUMN IF NOT EXISTS roi_apply_method_ko text,
    ADD COLUMN IF NOT EXISTS roi_apply_reason text,
    DROP COLUMN IF EXISTS max_amount_note,
    DROP COLUMN IF EXISTS max_amount_source,
    DROP COLUMN IF EXISTS max_amount_evidence,
    DROP COLUMN IF EXISTS max_amount_status,
    DROP COLUMN IF EXISTS support_categories,
    DROP COLUMN IF EXISTS temp_extraction_json,
    DROP COLUMN IF EXISTS created_at;

ALTER TABLE public.policy_02_raw_source
    DROP COLUMN IF EXISTS attachment_text_source,
    DROP COLUMN IF EXISTS attachment_text_updated_at,
    DROP COLUMN IF EXISTS hashtags,
    DROP COLUMN IF EXISTS created_at;

ALTER TABLE public.policy_03_safety_profile
    DROP COLUMN IF EXISTS safety_justification_strength,
    DROP COLUMN IF EXISTS safety_justification_synced_at,
    DROP COLUMN IF EXISTS created_at;

ALTER TABLE public.policy_04_eligibility
    DROP COLUMN IF EXISTS employee_min,
    DROP COLUMN IF EXISTS employee_max,
    DROP COLUMN IF EXISTS revenue_min_manwon,
    DROP COLUMN IF EXISTS revenue_max_manwon,
    DROP COLUMN IF EXISTS company_age_min,
    DROP COLUMN IF EXISTS company_age_max,
    DROP COLUMN IF EXISTS max_employee_count,
    DROP COLUMN IF EXISTS min_revenue,
    DROP COLUMN IF EXISTS max_revenue,
    DROP COLUMN IF EXISTS revenue_rules,
    DROP COLUMN IF EXISTS required_documents_status,
    DROP COLUMN IF EXISTS created_at;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_00_core_pkey'
    ) THEN
        ALTER TABLE public.policy_00_core
        ADD CONSTRAINT policy_00_core_pkey PRIMARY KEY (policy_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_01_amount_detail_pkey'
    ) THEN
        ALTER TABLE public.policy_01_amount_detail
        ADD CONSTRAINT policy_01_amount_detail_pkey PRIMARY KEY (policy_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_02_raw_source_pkey'
    ) THEN
        ALTER TABLE public.policy_02_raw_source
        ADD CONSTRAINT policy_02_raw_source_pkey PRIMARY KEY (policy_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_03_safety_profile_pkey'
    ) THEN
        ALTER TABLE public.policy_03_safety_profile
        ADD CONSTRAINT policy_03_safety_profile_pkey PRIMARY KEY (policy_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'policy_04_eligibility_pkey'
    ) THEN
        ALTER TABLE public.policy_04_eligibility
        ADD CONSTRAINT policy_04_eligibility_pkey PRIMARY KEY (policy_id);
    END IF;
END $$;

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
        support_items
    )
    SELECT
        policy_id, max_amount, max_amount_numeric_manwon, max_amount_actual,
        max_amount_basis_text, max_amount_basis_evidence_text,
        max_amount_type, max_amount_type_ko, max_amount_type_reason,
        roi_apply_method, roi_apply_method_ko, roi_apply_reason,
        amount_extraction_status, support_method, support_primary_category,
        support_items
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
        support_items = EXCLUDED.support_items;

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

CREATE OR REPLACE FUNCTION public.sync_policy_split_shadow_trigger()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        DELETE FROM public.policy_00_core WHERE policy_id = OLD.policy_id;
        DELETE FROM public.policy_01_amount_detail WHERE policy_id = OLD.policy_id;
        DELETE FROM public.policy_02_raw_source WHERE policy_id = OLD.policy_id;
        DELETE FROM public.policy_03_safety_profile WHERE policy_id = OLD.policy_id;
        DELETE FROM public.policy_04_eligibility WHERE policy_id = OLD.policy_id;
        RETURN OLD;
    END IF;

    PERFORM public.sync_policy_split_shadow_row(NEW.policy_id);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_policy_split_shadow ON public.policy;
CREATE TRIGGER trg_sync_policy_split_shadow
AFTER INSERT OR UPDATE OR DELETE ON public.policy
FOR EACH ROW
EXECUTE FUNCTION public.sync_policy_split_shadow_trigger();

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
    support_items
)
SELECT
    policy_id, max_amount, max_amount_numeric_manwon, max_amount_actual,
    max_amount_basis_text, max_amount_basis_evidence_text,
    max_amount_type, max_amount_type_ko, max_amount_type_reason,
    roi_apply_method, roi_apply_method_ko, roi_apply_reason,
    amount_extraction_status, support_method, support_primary_category,
    support_items
FROM public.policy
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
    support_items = EXCLUDED.support_items;

INSERT INTO public.policy_02_raw_source
SELECT
    policy_id, source_name, source_id, raw_json, raw_text,
    attachment_text, attachment_parse_status
FROM public.policy
ON CONFLICT (policy_id) DO UPDATE SET
    source_name = EXCLUDED.source_name,
    source_id = EXCLUDED.source_id,
    raw_json = EXCLUDED.raw_json,
    raw_text = EXCLUDED.raw_text,
    attachment_text = EXCLUDED.attachment_text,
    attachment_parse_status = EXCLUDED.attachment_parse_status;

INSERT INTO public.policy_03_safety_profile
SELECT
    policy_id, policy_primary_nature, recommended_safety_viewpoints,
    safety_justification_reason, safety_justification_usable,
    application_reflection_recommendation
FROM public.policy
ON CONFLICT (policy_id) DO UPDATE SET
    policy_primary_nature = EXCLUDED.policy_primary_nature,
    recommended_safety_viewpoints = EXCLUDED.recommended_safety_viewpoints,
    safety_justification_reason = EXCLUDED.safety_justification_reason,
    safety_justification_usable = EXCLUDED.safety_justification_usable,
    application_reflection_recommendation = EXCLUDED.application_reflection_recommendation;

INSERT INTO public.policy_04_eligibility
SELECT
    policy_id, industry_codes, region, eligible_company_types, eligibility_text,
    eligibility_extraction_status, eligibility_evidence,
    required_documents, required_documents_json, required_documents_count
FROM public.policy
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

COMMENT ON TABLE public.policy_00_core IS 'policy 핵심 공고 정보 복사 테이블';
COMMENT ON TABLE public.policy_01_amount_detail IS 'policy 금액, 지원 성격, 금액 근거 상세 복사 테이블';
COMMENT ON TABLE public.policy_02_raw_source IS 'policy 수집 원문, 첨부 텍스트, 출처 정보 복사 테이블';
COMMENT ON TABLE public.policy_03_safety_profile IS 'policy 안전근거 분류 및 안전 개선 연결 정보 복사 테이블';
COMMENT ON TABLE public.policy_04_eligibility IS 'policy 신청 자격, 제외 조건, 제출 서류 복사 테이블';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_00_core TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_01_amount_detail TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_02_raw_source TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_03_safety_profile TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.policy_04_eligibility TO service_role;

GRANT SELECT ON public.policy_00_core TO authenticated;
GRANT SELECT ON public.policy_01_amount_detail TO authenticated;
GRANT SELECT ON public.policy_02_raw_source TO authenticated;
GRANT SELECT ON public.policy_03_safety_profile TO authenticated;
GRANT SELECT ON public.policy_04_eligibility TO authenticated;

NOTIFY pgrst, 'reload schema';
