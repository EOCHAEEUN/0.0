alter table public.safety_check_improvement
add column if not exists additional_info text;

comment on column public.safety_check_improvement.additional_info is
'신청서 초안 LLM에 반영할 사용자 작성 안전점검 한줄평';
