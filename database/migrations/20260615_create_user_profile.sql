-- Purpose: Connect Supabase Auth users to application-level profile data.
-- Backend flow:
-- 1. /api/auth/send-email-code creates/verifies the Supabase Auth user.
-- 2. /api/auth/signup upserts user_profile.
-- 3. /api/onboarding inserts company data.
-- Do not auto-create user_profile from auth.users; the backend owns profile creation.

CREATE TABLE IF NOT EXISTS public.user_profile (
    user_id UUID PRIMARY KEY
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    email TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    business_registration_no TEXT,

    service_terms_agreed BOOLEAN NOT NULL DEFAULT FALSE,
    privacy_policy_agreed BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_profile
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS business_registration_no TEXT,
    ADD COLUMN IF NOT EXISTS service_terms_agreed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS privacy_policy_agreed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.user_profile AS profile
SET email = auth_user.email
FROM auth.users AS auth_user
WHERE profile.user_id = auth_user.id
  AND profile.email IS NULL;

ALTER TABLE public.company
    ADD COLUMN IF NOT EXISTS user_id UUID
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_company_user_id
    ON public.company(user_id);

ALTER TABLE public.user_profile
    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profile_select_own
    ON public.user_profile;

CREATE POLICY user_profile_select_own
    ON public.user_profile
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS user_profile_update_own
    ON public.user_profile;

CREATE POLICY user_profile_update_own
    ON public.user_profile
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

REVOKE ALL ON public.user_profile FROM anon;

GRANT SELECT, UPDATE
    ON public.user_profile
    TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.user_profile
    TO service_role;

CREATE OR REPLACE FUNCTION public.update_user_profile_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_profile_updated_at
    ON public.user_profile;

CREATE TRIGGER set_user_profile_updated_at
    BEFORE UPDATE ON public.user_profile
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_profile_updated_at();

-- If an older migration created an auth.users -> user_profile trigger,
-- remove it so Auth signup cannot fail because of application profile data.
DROP TRIGGER IF EXISTS on_auth_user_created_profile
    ON auth.users;

DROP FUNCTION IF EXISTS public.handle_new_user_profile();
