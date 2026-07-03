-- Purpose: Allow authenticated users to access My Page tables while RLS limits rows to owned data.
-- Scope:
-- - user_profile: basic user info owned by user_profile.user_id
-- - company: company/detail/revenue info owned by company.user_id
-- - equipment: equipment info owned through equipment.company_id -> company.company_id

BEGIN;

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.user_profile TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipment TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON public.user_profile FROM anon;
REVOKE ALL ON public.company FROM anon;
REVOKE ALL ON public.equipment FROM anon;

CREATE UNIQUE INDEX IF NOT EXISTS company_user_id_unique
    ON public.company(user_id);

ALTER TABLE public.user_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_profile_select_own
    ON public.user_profile;

CREATE POLICY user_profile_select_own
    ON public.user_profile
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_profile_insert_own
    ON public.user_profile;

CREATE POLICY user_profile_insert_own
    ON public.user_profile
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS user_profile_update_own
    ON public.user_profile;

CREATE POLICY user_profile_update_own
    ON public.user_profile
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS company_select_own
    ON public.company;

CREATE POLICY company_select_own
    ON public.company
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

DROP POLICY IF EXISTS company_insert_own
    ON public.company;

CREATE POLICY company_insert_own
    ON public.company
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS company_update_own
    ON public.company;

CREATE POLICY company_update_own
    ON public.company
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS equipment_select_own_company
    ON public.equipment;

CREATE POLICY equipment_select_own_company
    ON public.equipment
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company AS company
            WHERE company.company_id = equipment.company_id
              AND company.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS equipment_insert_own_company
    ON public.equipment;

CREATE POLICY equipment_insert_own_company
    ON public.equipment
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.company AS company
            WHERE company.company_id = equipment.company_id
              AND company.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS equipment_update_own_company
    ON public.equipment;

CREATE POLICY equipment_update_own_company
    ON public.equipment
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company AS company
            WHERE company.company_id = equipment.company_id
              AND company.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.company AS company
            WHERE company.company_id = equipment.company_id
              AND company.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS equipment_delete_own_company
    ON public.equipment;

CREATE POLICY equipment_delete_own_company
    ON public.equipment
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.company AS company
            WHERE company.company_id = equipment.company_id
              AND company.user_id = auth.uid()
        )
    );

COMMIT;
