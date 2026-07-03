alter table public.policy
    add column if not exists attachment_text text,
    add column if not exists attachment_parse_status text,
    add column if not exists attachment_text_source text,
    add column if not exists attachment_text_updated_at timestamptz;

comment on column public.policy.attachment_text is
    'Merged attachment text copied from policy_validation_new or policy_external_collected. Used for evidence, re-extraction, and report generation, not list responses.';

comment on column public.policy.attachment_parse_status is
    'Attachment extraction status, e.g. converted_hwp_to_hwpx or mixed_attachments.';

comment on column public.policy.attachment_text_source is
    'Source table that last supplied attachment_text.';

comment on column public.policy.attachment_text_updated_at is
    'Timestamp when attachment_text was last synced into policy.';
