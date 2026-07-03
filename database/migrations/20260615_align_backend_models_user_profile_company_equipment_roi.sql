-- Align backend models with the current Supabase schema contract.
-- Applied to Supabase project ctswlkmkyykdbnunmvjs on 2026-06-15.

alter table public.company
  add column if not exists revenue_2y_ago_manwon bigint,
  add column if not exists revenue_3y_ago_manwon bigint,
  add column if not exists established_year integer,
  add column if not exists workplace_type text;

comment on column public.company.annual_revenue is
  'Required previous-year annual revenue in manwon. For 2026 input, this is 2025 revenue.';
comment on column public.company.revenue_2y_ago_manwon is
  'Optional revenue from two years ago in manwon. For 2026 input, this is 2024 revenue.';
comment on column public.company.revenue_3y_ago_manwon is
  'Optional revenue from three years ago in manwon. For 2026 input, this is 2023 revenue.';
comment on column public.company.established_year is
  'Optional company establishment year.';
comment on column public.company.workplace_type is
  'Optional workplace type such as factory, office, or lab.';

alter table public.equipment
  add column if not exists scenario_a_investment_manwon integer,
  add column if not exists scenario_b_investment_manwon integer;

comment on column public.equipment.scenario_a_investment_manwon is
  'Optional scenario A full replacement planned investment amount in manwon. If null, backend uses benchmark average.';
comment on column public.equipment.scenario_b_investment_manwon is
  'Optional scenario B partial replacement planned investment amount in manwon. If null, backend uses benchmark average.';
comment on column public.equipment.new_energy_cost_annual is
  'Deprecated: ROI page no longer collects this as input.';
comment on column public.equipment.new_investment_manwon is
  'Deprecated: replaced by scenario_a_investment_manwon and scenario_b_investment_manwon.';

alter table public.roi_input
  add column if not exists current_capacity_value double precision,
  add column if not exists scenario_a_investment_manwon integer,
  add column if not exists scenario_b_investment_manwon integer;

comment on column public.roi_input.current_capacity_value is
  'ROI input snapshot: current equipment capacity value used for investment estimation.';
comment on column public.roi_input.scenario_a_investment_manwon is
  'ROI input snapshot: scenario A full replacement planned investment in manwon.';
comment on column public.roi_input.scenario_b_investment_manwon is
  'ROI input snapshot: scenario B partial replacement planned investment in manwon.';
