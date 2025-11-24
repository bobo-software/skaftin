-- Migration: Add Organization Context Fields to Roles
-- This migration adds organisation_field_name, organisation_lookup_table, and organisation_lookup_field
-- to the skaftin_system_roles table in all existing project schemas

-- Function to add columns to roles table in a schema
DO $$
DECLARE
    schema_record RECORD;
    schema_name TEXT;
BEGIN
    -- Loop through all project schemas
    FOR schema_record IN 
        SELECT schema_name 
        FROM public.skaftin_system_projects
        WHERE schema_name IS NOT NULL
    LOOP
        schema_name := schema_record.schema_name;
        
        -- Add organisation_field_name if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = schema_name 
            AND table_name = 'skaftin_system_roles' 
            AND column_name = 'organisation_field_name'
        ) THEN
            EXECUTE format('ALTER TABLE %I.skaftin_system_roles ADD COLUMN organisation_field_name VARCHAR(255)', schema_name);
            RAISE NOTICE 'Added organisation_field_name to %.skaftin_system_roles', schema_name;
        END IF;

        -- Add organisation_lookup_table if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = schema_name 
            AND table_name = 'skaftin_system_roles' 
            AND column_name = 'organisation_lookup_table'
        ) THEN
            EXECUTE format('ALTER TABLE %I.skaftin_system_roles ADD COLUMN organisation_lookup_table VARCHAR(255)', schema_name);
            RAISE NOTICE 'Added organisation_lookup_table to %.skaftin_system_roles', schema_name;
        END IF;

        -- Add organisation_lookup_field if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = schema_name 
            AND table_name = 'skaftin_system_roles' 
            AND column_name = 'organisation_lookup_field'
        ) THEN
            EXECUTE format('ALTER TABLE %I.skaftin_system_roles ADD COLUMN organisation_lookup_field VARCHAR(255)', schema_name);
            RAISE NOTICE 'Added organisation_lookup_field to %.skaftin_system_roles', schema_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Migration complete: Organization context fields added to all project role tables';
END $$;

