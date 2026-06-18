-- Align company onboarding with the final contract:
-- employee_count is optional, annual_revenue remains required by API contract.

ALTER TABLE public.company
    ALTER COLUMN employee_count DROP NOT NULL;

COMMENT ON COLUMN public.company.employee_count IS
    'Optional employee count. Signup/onboarding may omit this and mypage can fill it later.';
