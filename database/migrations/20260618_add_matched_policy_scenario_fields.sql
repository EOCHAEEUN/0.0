alter table public.matched_policy
  add column if not exists scenario_match jsonb,
  add column if not exists scenario_label text;

comment on column public.matched_policy.scenario_match is
  'ROI scenario tags for the matched policy. Example: ["a"], ["b"], ["c"].';

comment on column public.matched_policy.scenario_label is
  'Human-readable ROI scenario label. Example: A안 전체교체 적합, B안 부분개선 적합, C안 공통 적합.';
