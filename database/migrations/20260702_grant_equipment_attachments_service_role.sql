-- Migration: Grant service_role access to equipment_attachments
-- Date: 2026-07-02
-- Purpose: Backend uses Supabase service_role; table was created without CRUD grants.

BEGIN;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.equipment_attachments
    TO service_role;

COMMIT;
