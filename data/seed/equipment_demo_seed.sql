-- Demo seed for registered equipments used by the safety dashboard.
-- Apply before or with data/seed/safety_demo_seed.sql.
-- Current demo company_id: 2758ab0f-4951-4afe-b819-f7252588f00d

INSERT INTO equipment (
    equipment_id,
    company_id,
    name,
    category,
    age_years,
    energy_cost_annual,
    defect_rate,
    new_energy_cost_annual,
    new_investment_manwon,
    maintenance_cost_annual,
    current_capacity_value,
    production_qty,
    contribution_margin_won
) VALUES
(
    '11111111-1111-4111-8111-111111111111',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '유압프레스 250톤',
    'press',
    15,
    4800,
    3.4,
    NULL,
    NULL,
    900,
    250,
    120000,
    18000
),
(
    '22222222-2222-4222-8222-222222222222',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    'CNC 머시닝센터 5축',
    'cnc',
    9,
    2600,
    1.6,
    NULL,
    NULL,
    420,
    35,
    85000,
    22000
),
(
    '33333333-3333-4333-8333-333333333333',
    '2758ab0f-4951-4afe-b819-f7252588f00d',
    '전동식 사출성형기 450톤',
    'injection',
    12,
    3900,
    2.8,
    NULL,
    NULL,
    780,
    450,
    100000,
    16000
)
ON CONFLICT (equipment_id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    name = EXCLUDED.name,
    category = EXCLUDED.category,
    age_years = EXCLUDED.age_years,
    energy_cost_annual = EXCLUDED.energy_cost_annual,
    defect_rate = EXCLUDED.defect_rate,
    new_energy_cost_annual = EXCLUDED.new_energy_cost_annual,
    new_investment_manwon = EXCLUDED.new_investment_manwon,
    maintenance_cost_annual = EXCLUDED.maintenance_cost_annual,
    current_capacity_value = EXCLUDED.current_capacity_value,
    production_qty = EXCLUDED.production_qty,
    contribution_margin_won = EXCLUDED.contribution_margin_won;
