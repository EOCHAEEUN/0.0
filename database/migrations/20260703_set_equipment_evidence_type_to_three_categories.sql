-- Migration: Set equipment evidence_type to 3 categories
-- Date: 2026-07-03
-- Purpose:
--   - Normalize evidence_type to:
--       안전장치 점검 / 유지보수 / 안전교육
--   - Keep backward compatibility for legacy values.

BEGIN;

DO $$
DECLARE
    target_table TEXT;
BEGIN
    FOREACH target_table IN ARRAY ARRAY[
        'equipment_evidence_records',
        'equipment_evidence_record',
        'equipment_evidence'
    ]
    LOOP
        IF EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = target_table
              AND column_name = 'evidence_type'
        ) THEN
            EXECUTE format(
                $sql$
                UPDATE public.%I
                SET evidence_type = CASE
                    WHEN evidence_type IN (
                        '유지보수',
                        'maintenance_related',
                        'maintenance_record',
                        'maintenance_plan',
                        '정비기록',
                        '정비계획',
                        '정비관련'
                    ) THEN '유지보수'
                    WHEN evidence_type IN (
                        '안전교육',
                        'safety_education',
                        'safety_training'
                    ) THEN '안전교육'
                    ELSE '안전장치 점검'
                END
                WHERE evidence_type IS NOT NULL
                $sql$,
                target_table
            );

            EXECUTE format(
                'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
                target_table,
                target_table || '_evidence_type_check'
            );

            EXECUTE format(
                $sql$
                ALTER TABLE public.%I
                ADD CONSTRAINT %I
                CHECK (evidence_type IN ('안전장치 점검', '유지보수', '안전교육'))
                $sql$,
                target_table,
                target_table || '_evidence_type_check'
            );
        END IF;
    END LOOP;
END $$;

COMMIT;

