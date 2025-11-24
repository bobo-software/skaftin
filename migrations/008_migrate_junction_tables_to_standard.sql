-- Migration: Migrate junction tables to standard structure
-- This migration renames organisation-specific columns (e.g., church_id, company_id) 
-- to the standard "organisation_id" column in junction tables

-- Function to migrate a junction table
DO $$
DECLARE
    schema_record RECORD;
    table_record RECORD;
    schema_name TEXT;
    table_name TEXT;
    old_column_name TEXT;
    has_org_id BOOLEAN;
BEGIN
    -- Loop through all project schemas
    FOR schema_record IN 
        SELECT schema_name 
        FROM public.skaftin_system_projects
        WHERE schema_name IS NOT NULL
    LOOP
        schema_name := schema_record.schema_name;
        
        -- Find junction tables (tables with user_id and an organisation-related _id column)
        FOR table_record IN
            SELECT t.table_name
            FROM information_schema.tables t
            WHERE t.table_schema = schema_name
              AND t.table_type = 'BASE TABLE'
              AND EXISTS (
                  SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema = schema_name
                    AND c.table_name = t.table_name
                    AND c.column_name = 'user_id'
              )
              AND EXISTS (
                  SELECT 1 FROM information_schema.columns c
                  WHERE c.table_schema = schema_name
                    AND c.table_name = t.table_name
                    AND c.column_name LIKE '%_id'
                    AND c.column_name != 'id'
                    AND c.column_name != 'user_id'
              )
        LOOP
            table_name := table_record.table_name;
            
            -- Check if organisation_id already exists
            SELECT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = schema_name
                  AND table_name = table_name
                  AND column_name = 'organisation_id'
            ) INTO has_org_id;
            
            -- If organisation_id doesn't exist, find the organisation column to rename
            IF NOT has_org_id THEN
                -- Find the organisation column (usually ends with _id and is not id or user_id)
                SELECT column_name INTO old_column_name
                FROM information_schema.columns
                WHERE table_schema = schema_name
                  AND table_name = table_name
                  AND column_name LIKE '%_id'
                  AND column_name != 'id'
                  AND column_name != 'user_id'
                ORDER BY 
                  CASE 
                    WHEN column_name LIKE '%church%' THEN 1
                    WHEN column_name LIKE '%company%' THEN 2
                    WHEN column_name LIKE '%organisation%' THEN 3
                    WHEN column_name LIKE '%org%' THEN 4
                    ELSE 5
                  END
                LIMIT 1;
                
                -- Rename the column to organisation_id
                IF old_column_name IS NOT NULL AND old_column_name != 'organisation_id' THEN
                    EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO organisation_id', 
                        schema_name, table_name, old_column_name);
                    RAISE NOTICE 'Renamed column % in %.% to organisation_id', old_column_name, schema_name, table_name;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE '✅ Migration complete: Junction tables migrated to standard structure';
END $$;

