-- Manual RLS verification for public.user_profile, public.company, public.equipment.
--
-- Run in Supabase SQL Editor after applying:
-- database/migrations/20260616_add_mypage_rls_policies.sql
--
-- Test Auth users:
-- - A: rls-a@example.com / 16fe9ed6-9e0c-4220-afb3-ff69e942867b
-- - B: rls-b@example.com / f0aa145f-9144-4818-821f-7fbe08812a6f
--
-- Expected:
-- - Every row in the final result table should have pass = true.

BEGIN;

CREATE TEMP TABLE rls_test_results (
    sort_order integer PRIMARY KEY,
    test text NOT NULL,
    actual text NOT NULL,
    expected text NOT NULL,
    pass boolean NOT NULL
);

GRANT ALL ON TABLE rls_test_results TO authenticated;

-- ---------------------------------------------------------------------------
-- 1. Seed A/B-owned rows as the SQL Editor owner/service context.
-- ---------------------------------------------------------------------------
INSERT INTO public.user_profile (
    user_id,
    email,
    name,
    phone,
    service_terms_agreed,
    privacy_policy_agreed
)
SELECT
    user_id,
    lower(label) || '-rls-test@example.com',
    'RLS Test User ' || label,
    '0100000000' || CASE label WHEN 'A' THEN '1' ELSE '2' END,
    true,
    true
FROM (
    VALUES
        ('A', '16fe9ed6-9e0c-4220-afb3-ff69e942867b'::uuid),
        ('B', 'f0aa145f-9144-4818-821f-7fbe08812a6f'::uuid)
) AS rls_test_users(label, user_id)
ON CONFLICT (user_id) DO UPDATE
SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    service_terms_agreed = true,
    privacy_policy_agreed = true;

INSERT INTO public.company (
    company_id,
    user_id,
    company_name,
    industry_name,
    industry_code,
    region,
    company_type,
    company_size,
    primary_purpose,
    employee_count,
    annual_revenue,
    revenue_2y_ago_manwon,
    revenue_3y_ago_manwon,
    total_assets_manwon,
    established_year,
    workplace_type
)
VALUES
    (
        '10000000-0000-0000-0000-00000000000a',
        '16fe9ed6-9e0c-4220-afb3-ff69e942867b',
        'RLS 테스트 A 금속가공',
        '금속가공',
        '["C24", "C25"]'::jsonb,
        '경기도 안산시',
        '제조업',
        '중소기업',
        ARRAY['지원사업 추천', 'ROI 분석'],
        45,
        95000,
        90000,
        87000,
        500000,
        2018,
        '공장'
    ),
    (
        '10000000-0000-0000-0000-00000000000b',
        'f0aa145f-9144-4818-821f-7fbe08812a6f',
        'RLS 테스트 B 서울뿌리',
        '뿌리',
        '["C24", "C25", "C29"]'::jsonb,
        '서울특별시',
        '제조업',
        '중견기업',
        ARRAY['지원사업 추천'],
        180,
        430000,
        410000,
        390000,
        1500000,
        2010,
        '공장'
    )
ON CONFLICT (company_id) DO UPDATE
SET
    user_id = EXCLUDED.user_id,
    company_name = EXCLUDED.company_name,
    industry_name = EXCLUDED.industry_name,
    industry_code = EXCLUDED.industry_code,
    region = EXCLUDED.region,
    company_type = EXCLUDED.company_type,
    company_size = EXCLUDED.company_size,
    primary_purpose = EXCLUDED.primary_purpose,
    employee_count = EXCLUDED.employee_count,
    annual_revenue = EXCLUDED.annual_revenue,
    revenue_2y_ago_manwon = EXCLUDED.revenue_2y_ago_manwon,
    revenue_3y_ago_manwon = EXCLUDED.revenue_3y_ago_manwon,
    total_assets_manwon = EXCLUDED.total_assets_manwon,
    established_year = EXCLUDED.established_year,
    workplace_type = EXCLUDED.workplace_type;

INSERT INTO public.equipment (
    equipment_id,
    company_id,
    name,
    category,
    age_years,
    energy_cost_annual,
    defect_rate,
    maintenance_cost_annual,
    current_capacity_value,
    production_qty,
    contribution_margin_won,
    scenario_a_investment_manwon,
    scenario_b_investment_manwon
)
VALUES
    (
        '20000000-0000-0000-0000-00000000000a',
        '10000000-0000-0000-0000-00000000000a',
        'RLS 테스트 A 프레스',
        'press',
        12,
        4500,
        3.2,
        1200,
        1600,
        50000,
        5000,
        22000,
        4994
    ),
    (
        '20000000-0000-0000-0000-00000000000b',
        '10000000-0000-0000-0000-00000000000b',
        'RLS 테스트 B CNC',
        'cnc',
        8,
        7200,
        1.8,
        1500,
        2400,
        70000,
        6500,
        32000,
        8000
    )
ON CONFLICT (equipment_id) DO UPDATE
SET
    company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    age_years = EXCLUDED.age_years,
    energy_cost_annual = EXCLUDED.energy_cost_annual,
    defect_rate = EXCLUDED.defect_rate,
    maintenance_cost_annual = EXCLUDED.maintenance_cost_annual,
    current_capacity_value = EXCLUDED.current_capacity_value,
    production_qty = EXCLUDED.production_qty,
    contribution_margin_won = EXCLUDED.contribution_margin_won,
    scenario_a_investment_manwon = EXCLUDED.scenario_a_investment_manwon,
    scenario_b_investment_manwon = EXCLUDED.scenario_b_investment_manwon;

-- ---------------------------------------------------------------------------
-- 2. A user RLS checks.
-- ---------------------------------------------------------------------------
SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claim.sub',
    '16fe9ed6-9e0c-4220-afb3-ff69e942867b',
    true
);

INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 10, 'A can select own company', COUNT(*)::text, '1', COUNT(*) = 1
FROM public.company
WHERE company_id = '10000000-0000-0000-0000-00000000000a';

INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 20, 'A cannot select B company', COUNT(*)::text, '0', COUNT(*) = 0
FROM public.company
WHERE company_id = '10000000-0000-0000-0000-00000000000b';

INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 30, 'A can select own equipment', COUNT(*)::text, '1', COUNT(*) = 1
FROM public.equipment
WHERE equipment_id = '20000000-0000-0000-0000-00000000000a';

INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 40, 'A cannot select B equipment', COUNT(*)::text, '0', COUNT(*) = 0
FROM public.equipment
WHERE equipment_id = '20000000-0000-0000-0000-00000000000b';

WITH updated AS (
    UPDATE public.equipment
    SET defect_rate = 3.4
    WHERE equipment_id = '20000000-0000-0000-0000-00000000000a'
    RETURNING 1
)
INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 50, 'A can update own equipment', COUNT(*)::text, '1', COUNT(*) = 1
FROM updated;

WITH updated AS (
    UPDATE public.equipment
    SET defect_rate = 9.9
    WHERE equipment_id = '20000000-0000-0000-0000-00000000000b'
    RETURNING 1
)
INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 60, 'A cannot update B equipment', COUNT(*)::text, '0', COUNT(*) = 0
FROM updated;

WITH inserted AS (
    INSERT INTO public.equipment (
        equipment_id,
        company_id,
        name,
        category,
        age_years,
        energy_cost_annual
    )
    VALUES (
        '20000000-0000-0000-0000-0000000000aa',
        '10000000-0000-0000-0000-00000000000a',
        'RLS 테스트 A 추가 설비',
        'injection',
        5,
        3800
    )
    ON CONFLICT (equipment_id) DO UPDATE
    SET name = EXCLUDED.name
    RETURNING 1
)
INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 70, 'A can insert equipment into own company', COUNT(*)::text, '1', COUNT(*) = 1
FROM inserted;

-- This insert should fail with an RLS violation because company_id belongs to B.
-- Run it separately if you want to see the expected error:
-- INSERT INTO public.equipment (
--     equipment_id, company_id, name, category, age_years, energy_cost_annual
-- )
-- VALUES (
--     '20000000-0000-0000-0000-0000000000ab',
--     '10000000-0000-0000-0000-00000000000b',
--     'RLS 테스트 차단 설비',
--     'press',
--     5,
--     3800
-- );

WITH deleted AS (
    DELETE FROM public.equipment
    WHERE equipment_id = '20000000-0000-0000-0000-0000000000aa'
    RETURNING 1
)
INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 80, 'A can delete own equipment', COUNT(*)::text, '1', COUNT(*) = 1
FROM deleted;

WITH deleted AS (
    DELETE FROM public.equipment
    WHERE equipment_id = '20000000-0000-0000-0000-00000000000b'
    RETURNING 1
)
INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT 90, 'A cannot delete B equipment', COUNT(*)::text, '0', COUNT(*) = 0
FROM deleted;

-- ---------------------------------------------------------------------------
-- 3. anon privilege checks. These should all be false.
-- ---------------------------------------------------------------------------
RESET ROLE;

INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT
    100,
    'anon has no user_profile SELECT',
    has_table_privilege('anon', 'public.user_profile', 'SELECT')::text,
    'false',
    has_table_privilege('anon', 'public.user_profile', 'SELECT') = false;

INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT
    110,
    'anon has no company SELECT',
    has_table_privilege('anon', 'public.company', 'SELECT')::text,
    'false',
    has_table_privilege('anon', 'public.company', 'SELECT') = false;

INSERT INTO rls_test_results(sort_order, test, actual, expected, pass)
SELECT
    120,
    'anon has no equipment SELECT',
    has_table_privilege('anon', 'public.equipment', 'SELECT')::text,
    'false',
    has_table_privilege('anon', 'public.equipment', 'SELECT') = false;

-- ---------------------------------------------------------------------------
-- 4. Cleanup.
-- ---------------------------------------------------------------------------
DELETE FROM public.equipment
WHERE equipment_id IN (
    '20000000-0000-0000-0000-00000000000a',
    '20000000-0000-0000-0000-00000000000b',
    '20000000-0000-0000-0000-0000000000aa'
);

DELETE FROM public.company
WHERE company_id IN (
    '10000000-0000-0000-0000-00000000000a',
    '10000000-0000-0000-0000-00000000000b'
);

DELETE FROM public.user_profile
WHERE user_id IN (
    '16fe9ed6-9e0c-4220-afb3-ff69e942867b',
    'f0aa145f-9144-4818-821f-7fbe08812a6f'
);

COMMIT;

SELECT
    test,
    actual,
    expected,
    pass
FROM rls_test_results
ORDER BY sort_order;
