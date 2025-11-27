-- Migration: Revert junction table column naming
-- Junction tables should use the SAME field name as the data tables
-- e.g., if data tables use "church_id", junction table should use "church_id"
-- e.g., if data tables use "association_id", junction table should use "association_id"

-- This migration reverts the generic "organisation_id" back to the specific field name
-- You'll need to run this for each project based on their organisation_field_name

-- Example for church-based projects:
-- ALTER TABLE <schema>.user_churches RENAME COLUMN organisation_id TO church_id;

-- Example for association-based projects:
-- ALTER TABLE <schema>.user_associations RENAME COLUMN organisation_id TO association_id;

-- Note: Run this manually for each project based on their specific organisation_field_name
DO $$
DECLARE
    schema_record RECORD;
    schema_name TEXT;
    org_field_name TEXT;
BEGIN
    -- Loop through all project schemas
    FOR schema_record IN 
        SELECT p.schema_name, r.organisation_field_name
        FROM public.skaftin_system_projects p
        LEFT JOIN (
            SELECT DISTINCT ON (project_id) 
                project_id,
                organisation_field_name
            FROM (
                SELECT 
                    p.id as project_id,
                    r.organisation_field_name
                FROM public.skaftin_system_projects p
                CROSS JOIN LATERAL (
                    SELECT organisation_field_name
                    FROM information_schema.columns c
                    WHERE c.table_schema = p.schema_name
                      AND c.table_name = 'skaftin_system_roles'
                      AND EXISTS (
                          SELECT 1 FROM information_schema.columns
                          WHERE table_schema = p.schema_name
                            AND table_name = 'skaftin_system_roles'
                            AND column_name = 'organisation_field_name'
                      )
                ) r
                WHERE r.organisation_field_name IS NOT NULL
                  AND r.organisation_field_name != 'user_id'
            ) sub
            WHERE organisation_field_name IS NOT NULL
        ) r ON r.project_id = p.id
        WHERE p.schema_name IS NOT NULL
          AND r.organisation_field_name IS NOT NULL
    LOOP
        schema_name := schema_record.schema_name;
        org_field_name := schema_record.organisation_field_name;
        
        -- Find junction tables with organisation_id that should be renamed
        -- This is a simplified version - you may need to adjust based on your table naming
        RAISE NOTICE 'For schema %, rename organisation_id to % in junction tables', schema_name, org_field_name;
        RAISE NOTICE 'Example: ALTER TABLE %.user_% RENAME COLUMN organisation_id TO %;', 
            schema_name, 
            REPLACE(org_field_name, '_id', ''),
            org_field_name;
    END LOOP;
    
    RAISE NOTICE '⚠️  This migration provides guidance only. Run the ALTER TABLE commands manually for each project.';
END $$;
