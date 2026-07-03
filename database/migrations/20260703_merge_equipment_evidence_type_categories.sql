-- Migration: Merge equipment evidence type categories
-- Date: 2026-07-03
-- Purpose:
--   - Merge legacy 4 evidence_type values into 2 categories
--     * safety_inspection / safety_improvement -> safety_related
--     * maintenance_record / maintenance_plan -> maintenance_related
--   - Keep schema changes safe when table names differ by environment.

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
                    WHEN evidence_type IN ('safety_inspection', 'safety_improvement') THEN 'safety_related'
                    WHEN evidence_type IN ('maintenance_record', 'maintenance_plan') THEN 'maintenance_related'
                    ELSE evidence_type
                END
                WHERE evidence_type IN (
                    'safety_inspection',
                    'safety_improvement',
                    'maintenance_record',
                    'maintenance_plan'
                )
                $sql$,
                target_table
            );

            -- Replace check constraint if a standard constraint name exists.
            EXECUTE format(
                'ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I',
                target_table,
                target_table || '_evidence_type_check'
            );

            EXECUTE format(
                $sql$
                ALTER TABLE public.%I
                ADD CONSTRAINT %I
                CHECK (evidence_type IN ('safety_related', 'maintenance_related'))
                $sql$,
                target_table,
                target_table || '_evidence_type_check'
            );
        END IF;
    END LOOP;
END $$;

COMMIT;

