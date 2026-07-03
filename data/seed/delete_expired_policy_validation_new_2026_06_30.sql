-- Deletes policy_validation_new rows whose non-null deadline is before 2026-06-30.
-- Run this in the Supabase SQL Editor if the service role cannot delete from policy_validation_new.

delete from public.policy_validation_new
where deadline is not null
  and deadline < date '2026-06-30';

-- Optional: allow the service role to perform this cleanup through scripts later.
grant delete on public.policy_validation_new to service_role;
