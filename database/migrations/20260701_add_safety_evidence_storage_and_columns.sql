-- Migration: Add safety evidence private storage integration
-- Date: 2026-07-01
-- Purpose:
--   1) create private storage bucket for safety evidence PDF files
--   2) extend user_safety_files for private storage metadata and soft-delete status
--   3) add indexes for analysis/policy/equipment scoped lookups

BEGIN;

INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
)
VALUES (
    'safety-evidence',
    'safety-evidence',
    false,
    20971520,
    ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

ALTER TABLE public.user_safety_files
ADD COLUMN IF NOT EXISTS company_id UUID,
ADD COLUMN IF NOT EXISTS storage_bucket TEXT NOT NULL DEFAULT 'safety-evidence',
ADD COLUMN IF NOT EXISTS storage_path TEXT,
ADD COLUMN IF NOT EXISTS upload_status TEXT NOT NULL DEFAULT 'uploaded',
ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'not_reviewed',
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE public.user_safety_files
DROP CONSTRAINT IF EXISTS user_safety_files_upload_status_check;

ALTER TABLE public.user_safety_files
ADD CONSTRAINT user_safety_files_upload_status_check
CHECK (upload_status IN ('uploaded', 'deleted'));

ALTER TABLE public.user_safety_files
DROP CONSTRAINT IF EXISTS user_safety_files_verification_status_check;

ALTER TABLE public.user_safety_files
ADD CONSTRAINT user_safety_files_verification_status_check
CHECK (verification_status IN ('not_reviewed', 'reviewed_valid', 'reviewed_rejected'));

CREATE INDEX IF NOT EXISTS idx_user_safety_files_company_analysis_policy_equipment
    ON public.user_safety_files (company_id, analysis_id, policy_id, equipment_id);

CREATE INDEX IF NOT EXISTS idx_user_safety_files_company_analysis_policy_viewpoint
    ON public.user_safety_files (company_id, analysis_id, policy_id, viewpoint_key);

CREATE INDEX IF NOT EXISTS idx_user_safety_files_storage_bucket_path
    ON public.user_safety_files (storage_bucket, storage_path);

COMMIT;

