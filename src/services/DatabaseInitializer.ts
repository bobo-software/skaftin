import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';

/**
 * DatabaseInitializer - Handles database table creation and initialization using Drizzle ORM
 */
export class DatabaseInitializer {
  private pool: Pool;
  private db: ReturnType<typeof drizzle>;

  constructor(pool: Pool) {
    this.pool = pool;
    this.db = drizzle(pool);
  }

  /**
   * Initialize all necessary database schemas
   * This ensures all required schemas exist before creating tables
   */
  async initializeSchemas(): Promise<void> {
    try {
      // Create public schema if it doesn't exist
      // While public schema should exist by default, some PostgreSQL setups may not have it
      await this.db.execute(sql`
        CREATE SCHEMA IF NOT EXISTS public;
      `);
      console.log('✅ Public schema initialized');
    } catch (err: any) {
      // Ignore if schema already exists (error code 42P06 = duplicate_schema)
      if (err.code !== '42P06') {
        console.error('❌ Public schema creation error:', err.message);
        throw err;
      }
      console.log('✅ Public schema already exists');
    }

    try {
      // Create supertokens schema for SuperTokens authentication
      // This schema is required for SuperTokens to store authentication data
      await this.db.execute(sql`
        CREATE SCHEMA IF NOT EXISTS supertokens;
      `);
      console.log('✅ SuperTokens schema initialized');
    } catch (err: any) {
      // Ignore if schema already exists (error code 42P06 = duplicate_schema)
      if (err.code !== '42P06') {
        console.error('❌ SuperTokens schema creation error:', err.message);
        throw err;
      }
      console.log('✅ SuperTokens schema already exists');
    }

    // Set search path to include public schema
    try {
      await this.db.execute(sql`
        SET search_path TO public, supertokens;
      `);
    } catch (err: any) {
      console.warn('⚠️ Could not set search path:', err.message);
    }

    // Note: Project schemas (project_*) are created dynamically when projects are created
    // They don't need to be initialized here as they're created on-demand
  }

  /**
   * Initialize users table using Drizzle
   * Always creates in public schema
   */
  async initializeUsersTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'users'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_users'
          ) THEN
            ALTER TABLE public.users RENAME TO skaftin_system_users;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          full_name VARCHAR(255),
          last_name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      // Ignore if table/sequence already exists
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Users table creation error:', err.message);
      }
    }

    try {
      // Add password_hash column if it doesn't exist (migration for existing databases)
      await this.db.execute(sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_schema='public' AND table_name='skaftin_system_users' AND column_name='password_hash') THEN
            ALTER TABLE public.skaftin_system_users ADD COLUMN password_hash VARCHAR(255);
          END IF;
        END $$;
      `);
    } catch (err: any) {
      if (err.code !== '42710') {
        console.error('❌ Users password_hash migration error:', err.message);
      }
    }

    try {
      // Add last_name column if it doesn't exist (migration for existing databases)
      await this.db.execute(sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_schema='public' AND table_name='skaftin_system_users' AND column_name='last_name') THEN
            ALTER TABLE public.skaftin_system_users ADD COLUMN last_name VARCHAR(255);
          END IF;
        END $$;
      `);
    } catch (err: any) {
      if (err.code !== '42710') {
        console.error('❌ Users last_name migration error:', err.message);
      }
    }

    try {
      // Create index on email
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_email ON public.skaftin_system_users(email);
      `);
    } catch (err: any) {
      // Ignore if index already exists
      if (err.code !== '42P07') {
        console.error('❌ Users index creation error:', err.message);
      }
    }

    console.log('✅ Users table initialized');
  }

  /**
   * Initialize organizations table using Drizzle
   * Always creates in public schema
   */
  async initializeOrganizationsTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'organizations'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_organizations'
          ) THEN
            ALTER TABLE public.organizations RENAME TO skaftin_system_organizations;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_organizations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          owner_id VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Organizations table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_organizations_owner_id ON public.skaftin_system_organizations(owner_id);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Organizations index creation error:', err.message);
      }
    }

    console.log('✅ Organizations table initialized');
  }

  /**
   * Initialize organization_members table using Drizzle
   * Always creates in public schema
   */
  async initializeOrganizationMembersTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'organization_members'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_organization_members'
          ) THEN
            ALTER TABLE public.organization_members RENAME TO skaftin_system_organization_members;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_organization_members (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER NOT NULL REFERENCES public.skaftin_system_organizations(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'member',
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(organization_id, user_id)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Organization members table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_organization_members_org_id ON public.skaftin_system_organization_members(organization_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_organization_members_user_id ON public.skaftin_system_organization_members(user_id);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Organization members index creation error:', err.message);
      }
    }

    console.log('✅ Organization members table initialized');
  }

  /**
   * Initialize projects table using Drizzle
   * NOTE: Projects now belong to organizations
   * Always creates in public schema
   */
  async initializeProjectsTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'projects'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_projects'
          ) THEN
            ALTER TABLE public.projects RENAME TO skaftin_system_projects;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_projects (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          schema_name VARCHAR(255) NOT NULL UNIQUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      // Ignore if table/sequence already exists
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Projects table creation error:', err.message);
      }
    }

    try {
      // Check current column type
      const columnCheck = await this.db.execute(sql`
        SELECT data_type FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='skaftin_system_projects' AND column_name='user_id'
      `);
      
      const currentType = (columnCheck.rows[0] as any)?.data_type;
      
      if (currentType === 'integer') {
        // Migrate existing user_id column from INTEGER to VARCHAR
        await this.db.execute(sql`
          DO $$ 
          BEGIN
            -- Drop foreign key constraint if it exists
            ALTER TABLE public.skaftin_system_projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
            -- Change column type to VARCHAR
            ALTER TABLE public.skaftin_system_projects ALTER COLUMN user_id TYPE VARCHAR(255);
            RAISE NOTICE 'Successfully migrated user_id to VARCHAR(255)';
          END $$;
        `);
        
        console.log('✅ user_id column migrated to VARCHAR(255)');
      }
    } catch (err: any) {
      console.error('Projects user_id migration error:', err);
      if (err.code !== '42710') {
        throw err; // Re-throw if not a "duplicate object" error
      }
    }

    try {
      // Add organization_id column if it doesn't exist
      await this.db.execute(sql`
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_schema='public' AND table_name='skaftin_system_projects' AND column_name='organization_id') THEN
            ALTER TABLE public.skaftin_system_projects ADD COLUMN organization_id INTEGER;
          END IF;
        END $$;
      `);
    } catch (err: any) {
      if (err.code !== '42710') {
        console.error('❌ Projects organization_id migration error:', err.message);
      }
    }

    try {
      // Create indexes
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_projects_user_id ON public.skaftin_system_projects(user_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_projects_organization_id ON public.skaftin_system_projects(organization_id);
      `);
    } catch (err: any) {
      // Ignore if index already exists
      if (err.code !== '42P07') {
        console.error('❌ Projects index creation error:', err.message);
      }
    }

    console.log('✅ Projects table initialized');
  }

  /**
   * Initialize project_buckets table using Drizzle
   * Always creates in public schema
   */
  async initializeProjectBucketsTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'project_buckets'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_project_buckets'
          ) THEN
            ALTER TABLE public.project_buckets RENAME TO skaftin_system_project_buckets;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_project_buckets (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          bucket_name VARCHAR(255) NOT NULL UNIQUE,
          description TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      // Ignore if table/sequence already exists
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Project buckets table creation error:', err.message);
      }
    }

    try {
      // Create indexes
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_buckets_project_id ON public.skaftin_system_project_buckets(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_buckets_bucket_name ON public.skaftin_system_project_buckets(bucket_name);
      `);
    } catch (err: any) {
      // Ignore if index already exists
      if (err.code !== '42P07') {
        console.error('❌ Project buckets index creation error:', err.message);
      }
    }

    console.log('✅ Project buckets table initialized');
  }

  /**
   * Initialize email_providers table using Drizzle
   * Always creates in public schema
   */
  async initializeEmailProvidersTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'email_providers'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_email_providers'
          ) THEN
            ALTER TABLE public.email_providers RENAME TO skaftin_system_email_providers;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_email_providers (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('nodemailer', 'mailtrap')),
          smtp_host VARCHAR(255) NOT NULL,
          smtp_port INTEGER NOT NULL,
          smtp_secure BOOLEAN DEFAULT false,
          smtp_user VARCHAR(255) NOT NULL,
          smtp_password TEXT NOT NULL,
          from_email VARCHAR(255) NOT NULL,
          from_name VARCHAR(255),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, name)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Email providers table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_email_providers_project_id ON public.skaftin_system_email_providers(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_email_providers_is_active ON public.skaftin_system_email_providers(is_active);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Email providers index creation error:', err.message);
      }
    }

    console.log('✅ Email providers table initialized');
  }

  /**
   * Initialize sms_providers table using Drizzle
   * Always creates in public schema
   */
  async initializeSmsProvidersTable(): Promise<void> {
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.sms_providers (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('mymobileapi', 'sa_mobile_sms', 'twilio')),
          api_key TEXT NOT NULL,
          api_secret TEXT NOT NULL,
          post_url VARCHAR(500),
          messaging_service_sid VARCHAR(255),
          phone_number VARCHAR(50),
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, name)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ SMS providers table creation error:', err.message);
      }
    }

    // Migration: Add Twilio support to existing tables
    try {
      // Add new columns for Twilio if they don't exist
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sms_providers' AND column_name = 'messaging_service_sid'
          ) THEN
            ALTER TABLE public.sms_providers ADD COLUMN messaging_service_sid VARCHAR(255);
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'sms_providers' AND column_name = 'phone_number'
          ) THEN
            ALTER TABLE public.sms_providers ADD COLUMN phone_number VARCHAR(50);
          END IF;

          -- Make post_url nullable for Twilio (which doesn't need it)
          ALTER TABLE public.sms_providers ALTER COLUMN post_url DROP NOT NULL;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END $$;
      `));

      // Update CHECK constraint to include twilio
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          ALTER TABLE public.sms_providers DROP CONSTRAINT IF EXISTS sms_providers_provider_type_check;
          ALTER TABLE public.sms_providers ADD CONSTRAINT sms_providers_provider_type_check 
            CHECK (provider_type IN ('mymobileapi', 'sa_mobile_sms', 'twilio'));
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END $$;
      `));
    } catch (err: any) {
      // Ignore migration errors for existing databases
      console.log('SMS providers migration note:', err.message);
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sms_providers_project_id ON public.sms_providers(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_sms_providers_is_active ON public.sms_providers(is_active);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ SMS providers index creation error:', err.message);
      }
    }

    console.log('✅ SMS providers table initialized');
  }

  /**
   * Initialize email_templates table using Drizzle
   * Always creates in public schema
   */
  async initializeEmailTemplatesTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'email_templates'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_email_templates'
          ) THEN
            ALTER TABLE public.email_templates RENAME TO skaftin_system_email_templates;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_email_templates (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          subject VARCHAR(500) NOT NULL,
          html_content TEXT,
          text_content TEXT,
          variables JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, name)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Email templates table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_email_templates_project_id ON public.skaftin_system_email_templates(project_id);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Email templates index creation error:', err.message);
      }
    }

    console.log('✅ Email templates table initialized');
  }

  /**
   * Initialize sms_templates table using Drizzle
   * Always creates in public schema
   */
  async initializeSmsTemplatesTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'sms_templates'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_sms_templates'
          ) THEN
            ALTER TABLE public.sms_templates RENAME TO skaftin_system_sms_templates;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_sms_templates (
          id SERIAL PRIMARY KEY,
          project_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          content TEXT NOT NULL,
          variables JSONB DEFAULT '[]'::jsonb,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, name)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ SMS templates table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_sms_templates_project_id ON public.skaftin_system_sms_templates(project_id);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ SMS templates index creation error:', err.message);
      }
    }

    console.log('✅ SMS templates table initialized');
  }

  /**
   * Initialize project_members table using Drizzle
   * Links users to specific projects they have access to
   */
  async initializeProjectMembersTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'project_members'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_project_members'
          ) THEN
            ALTER TABLE public.project_members RENAME TO skaftin_system_project_members;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_project_members (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          user_id VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'member',
          invited_by VARCHAR(255),
          joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, user_id)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Project members table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_members_project_id ON public.skaftin_system_project_members(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_members_user_id ON public.skaftin_system_project_members(user_id);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Project members index creation error:', err.message);
      }
    }

    console.log('✅ Project members table initialized');
  }

  /**
   * Initialize project_invitations table using Drizzle
   * Stores pending invitations to projects
   */
  async initializeProjectInvitationsTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'project_invitations'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_project_invitations'
          ) THEN
            ALTER TABLE public.project_invitations RENAME TO skaftin_system_project_invitations;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_project_invitations (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          email VARCHAR(255) NOT NULL,
          invite_code VARCHAR(255) NOT NULL UNIQUE,
          role VARCHAR(50) NOT NULL DEFAULT 'member',
          status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
          invited_by VARCHAR(255) NOT NULL,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          accepted_at TIMESTAMP,
          UNIQUE(project_id, email)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Project invitations table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_invitations_project_id ON public.skaftin_system_project_invitations(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_invitations_email ON public.skaftin_system_project_invitations(email);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_invitations_code ON public.skaftin_system_project_invitations(invite_code);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_invitations_status ON public.skaftin_system_project_invitations(status);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Project invitations index creation error:', err.message);
      }
    }

    console.log('✅ Project invitations table initialized');
  }

  /**
   * Initialize api_credentials table using Drizzle
   * Stores API keys and access tokens for external application integration
   */
  async initializeApiCredentialsTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'api_credentials'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_api_credentials'
          ) THEN
            ALTER TABLE public.api_credentials RENAME TO skaftin_system_api_credentials;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_api_credentials (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          credential_type VARCHAR(50) NOT NULL CHECK (credential_type IN ('api_key', 'access_token', 'mcp_key')),
          token VARCHAR(255) NOT NULL UNIQUE,
          permissions JSONB NOT NULL DEFAULT '[]',
          is_active BOOLEAN DEFAULT true,
          last_used_at TIMESTAMP,
          created_by VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at TIMESTAMP,
          UNIQUE(project_id, name)
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ API credentials table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_credentials_project_id ON public.skaftin_system_api_credentials(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_credentials_token ON public.skaftin_system_api_credentials(token);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_credentials_is_active ON public.skaftin_system_api_credentials(is_active);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ API credentials index creation error:', err.message);
      }
    }

    console.log('✅ API credentials table initialized');
  }

  /**
   * Initialize auth_settings table using Drizzle
   * Stores authentication and authorization settings per project
   * Always creates in public schema
   */
  async initializeAuthSettingsTable(): Promise<void> {
    try {
      // Migrate existing table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'auth_settings'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_auth_settings'
          ) THEN
            ALTER TABLE public.auth_settings RENAME TO skaftin_system_auth_settings;
          END IF;
        END $$;
      `));

      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_auth_settings (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL UNIQUE REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          allow_duplicate_emails BOOLEAN DEFAULT false,
          require_email BOOLEAN DEFAULT true,
          require_email_verification BOOLEAN DEFAULT false,
          require_phone_verification BOOLEAN DEFAULT false,
          enable_password_reset BOOLEAN DEFAULT true,
          enable_mfa BOOLEAN DEFAULT false,
          registration_enabled BOOLEAN DEFAULT true,
          auth_enabled BOOLEAN DEFAULT true,
          default_role_id INTEGER,
          email_provider_id INTEGER REFERENCES public.skaftin_system_email_providers(id) ON DELETE SET NULL,
          sms_provider_id INTEGER,
          send_registration_email BOOLEAN DEFAULT false,
          send_registration_sms BOOLEAN DEFAULT false,
          send_verification_email BOOLEAN DEFAULT false,
          send_verification_sms BOOLEAN DEFAULT false,
          send_password_reset_email BOOLEAN DEFAULT true,
          send_password_reset_sms BOOLEAN DEFAULT false,
          send_welcome_email BOOLEAN DEFAULT false,
          send_welcome_sms BOOLEAN DEFAULT false,
          require_otp_for_password_change BOOLEAN DEFAULT false,
          require_otp_for_account_deletion BOOLEAN DEFAULT false,
          otp_length INTEGER DEFAULT 6 CHECK (otp_length >= 4 AND otp_length <= 6),
          settings_json JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      // Migration: Add missing columns if they don't exist (for existing databases)
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          -- Add require_email if missing (default true for backward compatibility)
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_auth_settings' AND column_name = 'require_email'
          ) THEN
            ALTER TABLE public.skaftin_system_auth_settings ADD COLUMN require_email BOOLEAN DEFAULT true;
          END IF;
          
          -- Add otp_length if missing
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_auth_settings' AND column_name = 'otp_length'
          ) THEN
            ALTER TABLE public.skaftin_system_auth_settings ADD COLUMN otp_length INTEGER DEFAULT 6 CHECK (otp_length >= 4 AND otp_length <= 6);
          END IF;
          
          -- Add SMS notification columns if missing
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_auth_settings' AND column_name = 'send_registration_sms'
          ) THEN
            ALTER TABLE public.skaftin_system_auth_settings ADD COLUMN send_registration_sms BOOLEAN DEFAULT false;
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_auth_settings' AND column_name = 'send_verification_sms'
          ) THEN
            ALTER TABLE public.skaftin_system_auth_settings ADD COLUMN send_verification_sms BOOLEAN DEFAULT false;
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_auth_settings' AND column_name = 'send_password_reset_sms'
          ) THEN
            ALTER TABLE public.skaftin_system_auth_settings ADD COLUMN send_password_reset_sms BOOLEAN DEFAULT false;
          END IF;
          
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_auth_settings' AND column_name = 'send_welcome_sms'
          ) THEN
            ALTER TABLE public.skaftin_system_auth_settings ADD COLUMN send_welcome_sms BOOLEAN DEFAULT false;
          END IF;
        END $$;
      `));
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Auth settings table creation error:', err.message);
      }
    }


    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_auth_settings_project_id ON public.skaftin_system_auth_settings(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_auth_settings_email_provider_id ON public.skaftin_system_auth_settings(email_provider_id);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Auth settings index creation error:', err.message);
      }
    }

    console.log('✅ Auth settings table initialized');
  }

  /**
   * Initialize auth tables for a specific project schema
   * Creates skaftin_system_users, skaftin_system_roles, skaftin_system_user_roles, and skaftin_system_user_custom_fields tables
   */
  async initializeProjectAuthTables(schemaName: string, projectId: number): Promise<void> {
    try {
      // Backward-compatible rename: if legacy app_* tables exist, rename them to skaftin_system_*
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          -- Users table
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'app_users'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'skaftin_system_users'
          ) THEN
            EXECUTE format('ALTER TABLE %I.app_users RENAME TO skaftin_system_users', '${schemaName}');
          END IF;
          
          -- Roles table
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'app_roles'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'skaftin_system_roles'
          ) THEN
            EXECUTE format('ALTER TABLE %I.app_roles RENAME TO skaftin_system_roles', '${schemaName}');
          END IF;
          
          -- User roles junction
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'app_user_roles'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'skaftin_system_user_roles'
          ) THEN
            EXECUTE format('ALTER TABLE %I.app_user_roles RENAME TO skaftin_system_user_roles', '${schemaName}');
          END IF;
          
          -- Custom fields
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'app_user_custom_fields'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = '${schemaName}' AND table_name = 'skaftin_system_user_custom_fields'
          ) THEN
            EXECUTE format('ALTER TABLE %I.app_user_custom_fields RENAME TO skaftin_system_user_custom_fields', '${schemaName}');
          END IF;
        END
        $$;
      `));

      // Create skaftin_system_users table in project schema
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_users (
          id SERIAL PRIMARY KEY,
          supertokens_user_id VARCHAR(255) UNIQUE,
          name VARCHAR(255) NOT NULL,
          last_name VARCHAR(255),
          email VARCHAR(255),
          password VARCHAR(255),
          phone VARCHAR(50),
          metadata JSONB DEFAULT '{}',
          organisation_id INTEGER,
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          phone_verified BOOLEAN DEFAULT false,
          deletion_requested_at TIMESTAMP,
          deletion_scheduled_at TIMESTAMP,
          deletion_reason TEXT,
          deleted_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `));

      // Add organisation_id column to existing users table if it doesn't exist
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_users' 
            AND column_name = 'organisation_id'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_users 
            ADD COLUMN organisation_id INTEGER;
          END IF;
        END $$;
      `));

      // Make email column nullable if it's currently NOT NULL (migration for existing databases)
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          -- Check if email column exists and is NOT NULL, then make it nullable
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_users' 
            AND column_name = 'email'
            AND is_nullable = 'NO'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_users 
            ALTER COLUMN email DROP NOT NULL;
          END IF;
        END $$;
      `));

      // Add last_name column to existing users table if it doesn't exist
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_users' 
            AND column_name = 'last_name'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_users 
            ADD COLUMN last_name VARCHAR(255);
          END IF;
        END $$;
      `));

      // Add custom_field_1 and custom_field_2 columns if they don't exist
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_users' 
            AND column_name = 'custom_field_1'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_users 
            ADD COLUMN custom_field_1 VARCHAR(255);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_users' 
            AND column_name = 'custom_field_2'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_users 
            ADD COLUMN custom_field_2 VARCHAR(255);
          END IF;
        END $$;
      `));

      // Create indexes for skaftin_system_users
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_email ON ${schemaName}.skaftin_system_users(email);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_supertokens_user_id ON ${schemaName}.skaftin_system_users(supertokens_user_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_is_active ON ${schemaName}.skaftin_system_users(is_active);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_organisation_id ON ${schemaName}.skaftin_system_users(organisation_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_phone ON ${schemaName}.skaftin_system_users(phone);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_custom_field_1 ON ${schemaName}.skaftin_system_users(custom_field_1);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_users_custom_field_2 ON ${schemaName}.skaftin_system_users(custom_field_2);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_users_deletion_scheduled ON ${schemaName}.skaftin_system_users(deletion_scheduled_at) WHERE deletion_scheduled_at IS NOT NULL AND deleted_at IS NULL;
      `));

      console.log(`✅ skaftin_system_users table created in schema: ${schemaName}`);

      // Create skaftin_system_otp_verifications table in project schema
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_otp_verifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES ${schemaName}.skaftin_system_users(id) ON DELETE CASCADE,
          otp_code VARCHAR(10) NOT NULL,
          otp_method VARCHAR(10) NOT NULL CHECK (otp_method IN ('email', 'sms')),
          destination VARCHAR(255) NOT NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'failed')),
          expires_at TIMESTAMP NOT NULL,
          verified_at TIMESTAMP,
          attempts INTEGER DEFAULT 0,
          purpose VARCHAR(20) NOT NULL DEFAULT 'registration' CHECK (purpose IN ('registration', 'password_reset', 'password_change', 'account_deletion', 'otp_login')),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `));

      // Create indexes for skaftin_system_otp_verifications
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_otp_user_id ON ${schemaName}.skaftin_system_otp_verifications(user_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_otp_status ON ${schemaName}.skaftin_system_otp_verifications(status);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_otp_expires_at ON ${schemaName}.skaftin_system_otp_verifications(expires_at);
      `));

      console.log(`✅ skaftin_system_otp_verifications table created in schema: ${schemaName}`);

      // Create skaftin_system_roles table in project schema
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_roles (
          id SERIAL PRIMARY KEY,
          role_name VARCHAR(255) NOT NULL,
          role_key VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          permissions JSONB DEFAULT '[]',
          session_duration_minutes INTEGER DEFAULT 10080,
          is_system_role BOOLEAN DEFAULT false,
          organisation_field_name VARCHAR(255),
          organisation_lookup_table VARCHAR(255),
          organisation_lookup_field VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `));

      // Create index for skaftin_system_roles
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_roles_role_key ON ${schemaName}.skaftin_system_roles(role_key);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_roles_is_system_role ON ${schemaName}.skaftin_system_roles(is_system_role);
      `));

      console.log(`✅ skaftin_system_roles table created in schema: ${schemaName}`);

      // Add organization fields to existing roles table if they don't exist
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_roles' 
            AND column_name = 'organisation_field_name'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_roles 
            ADD COLUMN organisation_field_name VARCHAR(255);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_roles' 
            AND column_name = 'organisation_lookup_table'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_roles 
            ADD COLUMN organisation_lookup_table VARCHAR(255);
          END IF;

          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = '${schemaName}' 
            AND table_name = 'skaftin_system_roles' 
            AND column_name = 'organisation_lookup_field'
          ) THEN
            ALTER TABLE ${schemaName}.skaftin_system_roles 
            ADD COLUMN organisation_lookup_field VARCHAR(255);
          END IF;
        END $$;
      `));

      // Insert default roles (Admin and User)
      await this.db.execute(sql.raw(`
        INSERT INTO ${schemaName}.skaftin_system_roles (role_name, role_key, description, permissions, session_duration_minutes, is_system_role)
        VALUES 
          ('Admin', 'admin', 'Administrator with full access', '["*"]', 60, true),
          ('User', 'user', 'Standard user with limited access', '["read"]', 10080, true)
        ON CONFLICT (role_key) DO NOTHING;
      `));

      console.log(`✅ Default roles seeded in schema: ${schemaName}`);

      // Create skaftin_system_user_roles junction table
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_user_roles (
          id SERIAL PRIMARY KEY,
          app_user_id INTEGER NOT NULL REFERENCES ${schemaName}.skaftin_system_users(id) ON DELETE CASCADE,
          role_id INTEGER NOT NULL REFERENCES ${schemaName}.skaftin_system_roles(id) ON DELETE CASCADE,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_by VARCHAR(255),
          UNIQUE(app_user_id, role_id)
        );
      `));

      // Create indexes for skaftin_system_user_roles
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_user_roles_app_user_id ON ${schemaName}.skaftin_system_user_roles(app_user_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_user_roles_role_id ON ${schemaName}.skaftin_system_user_roles(role_id);
      `));

      console.log(`✅ skaftin_system_user_roles table created in schema: ${schemaName}`);

      // Create skaftin_system_user_custom_fields table
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_user_custom_fields (
          id SERIAL PRIMARY KEY,
          field_name VARCHAR(255) NOT NULL UNIQUE,
          field_label VARCHAR(255) NOT NULL,
          field_type VARCHAR(50) NOT NULL CHECK (field_type IN ('text', 'number', 'boolean', 'date', 'select', 'multi_select', 'reference')),
          is_required BOOLEAN DEFAULT false,
          default_value TEXT,
          options JSONB,
          reference_table VARCHAR(255),
          reference_column VARCHAR(255),
          validation_rules JSONB,
          display_order INTEGER DEFAULT 0,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `));

      // Create index for skaftin_system_user_custom_fields
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_user_custom_fields_field_name ON ${schemaName}.skaftin_system_user_custom_fields(field_name);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_user_custom_fields_is_active ON ${schemaName}.skaftin_system_user_custom_fields(is_active);
      `));

      console.log(`✅ skaftin_system_user_custom_fields table created in schema: ${schemaName}`);

      // Create skaftin_system_payment_providers table in project schema
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_payment_providers (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('payfast', 'yoco', 'paystack', 'peach_payments', 'ozow', 'flutterwave')),
          merchant_id VARCHAR(255),
          merchant_key VARCHAR(255),
          passphrase VARCHAR(255),
          api_key TEXT,
          api_secret TEXT,
          public_key TEXT,
          return_url VARCHAR(500),
          cancel_url VARCHAR(500),
          notify_url VARCHAR(500),
          sandbox_mode BOOLEAN DEFAULT true,
          is_active BOOLEAN DEFAULT true,
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_id, name)
        );
      `));

      // Create indexes for skaftin_system_payment_providers
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_payment_providers_project_id ON ${schemaName}.skaftin_system_payment_providers(project_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_payment_providers_is_active ON ${schemaName}.skaftin_system_payment_providers(is_active);
      `));

      console.log(`✅ skaftin_system_payment_providers table created in schema: ${schemaName}`);

      // Create skaftin_system_payment_transactions table in project schema
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_payment_transactions (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          provider_id INTEGER NOT NULL REFERENCES ${schemaName}.skaftin_system_payment_providers(id) ON DELETE RESTRICT,
          transaction_id VARCHAR(100) NOT NULL UNIQUE,
          external_payment_id VARCHAR(255),
          amount DECIMAL(15, 2) NOT NULL,
          currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
          item_name VARCHAR(255) NOT NULL,
          item_description TEXT,
          customer_email VARCHAR(255),
          customer_name VARCHAR(255),
          customer_phone VARCHAR(50),
          payment_type VARCHAR(20) NOT NULL DEFAULT 'once' CHECK (payment_type IN ('once', 'subscription')),
          subscription_type VARCHAR(20) CHECK (subscription_type IN ('subscription', 'tokenization')),
          frequency VARCHAR(20) CHECK (frequency IN ('monthly', 'quarterly', 'biannually', 'annual')),
          cycles INTEGER,
          return_url VARCHAR(500),
          cancel_url VARCHAR(500),
          payment_url TEXT,
          status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed', 'cancelled', 'refunded')),
          status_message TEXT,
          webhook_data JSONB,
          metadata JSONB DEFAULT '{}',
          paid_at TIMESTAMP,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `));

      // Create indexes for skaftin_system_payment_transactions
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_project_id ON ${schemaName}.skaftin_system_payment_transactions(project_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON ${schemaName}.skaftin_system_payment_transactions(provider_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON ${schemaName}.skaftin_system_payment_transactions(transaction_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON ${schemaName}.skaftin_system_payment_transactions(status);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_email ON ${schemaName}.skaftin_system_payment_transactions(customer_email);
      `));

      console.log(`✅ skaftin_system_payment_transactions table created in schema: ${schemaName}`);

      // Update auth_settings with default role
      const defaultRoleResult = await this.db.execute(sql.raw(`
        SELECT id FROM ${schemaName}.skaftin_system_roles WHERE role_key = 'user' LIMIT 1;
      `));

      if (defaultRoleResult.rows.length > 0) {
        const defaultRoleId = (defaultRoleResult.rows[0] as any).id;
        await this.db.execute(sql`
          UPDATE public.skaftin_system_auth_settings 
          SET default_role_id = ${defaultRoleId}
          WHERE project_id = ${projectId} AND default_role_id IS NULL;
        `);
      }

    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07' && err.code !== '42P06') {
        console.error(`❌ Error creating auth tables in schema ${schemaName}:`, err.message);
        throw err;
      }
    }
  }

  /**
   * Initialize analytics tables using Drizzle
   * Always creates in public schema
   */
  async initializeAnalyticsTables(): Promise<void> {
    try {
      // Migrate existing api_metrics table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'api_metrics'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_api_metrics'
          ) THEN
            ALTER TABLE public.api_metrics RENAME TO skaftin_system_api_metrics;
          END IF;
        END $$;
      `));

      // API Metrics table - tracks all API requests
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_api_metrics (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          endpoint VARCHAR(500) NOT NULL,
          method VARCHAR(10) NOT NULL,
          status_code INTEGER,
          response_time_ms INTEGER NOT NULL,
          user_id VARCHAR(255),
          api_key_id INTEGER REFERENCES public.skaftin_system_api_credentials(id) ON DELETE SET NULL,
          ip_address VARCHAR(45),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ API metrics table creation error:', err.message);
      }
    }

    try {
      // Migrate existing database_metrics table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'database_metrics'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_database_metrics'
          ) THEN
            ALTER TABLE public.database_metrics RENAME TO skaftin_system_database_metrics;
          END IF;
        END $$;
      `));

      // Database Metrics table - tracks database queries
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_database_metrics (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          query_type VARCHAR(20) NOT NULL,
          table_name VARCHAR(255),
          execution_time_ms INTEGER NOT NULL,
          rows_affected INTEGER,
          user_id VARCHAR(255),
          api_key_id INTEGER REFERENCES public.skaftin_system_api_credentials(id) ON DELETE SET NULL,
          query_hash VARCHAR(64),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Database metrics table creation error:', err.message);
      }
    }

    try {
      // Migrate existing storage_metrics table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'storage_metrics'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_storage_metrics'
          ) THEN
            ALTER TABLE public.storage_metrics RENAME TO skaftin_system_storage_metrics;
          END IF;
        END $$;
      `));

      // Storage Metrics table - tracks storage operations
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_storage_metrics (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('upload', 'download', 'delete', 'list', 'search')),
          file_path VARCHAR(1000),
          file_size_bytes BIGINT,
          bucket_name VARCHAR(255),
          user_id VARCHAR(255),
          api_key_id INTEGER REFERENCES public.skaftin_system_api_credentials(id) ON DELETE SET NULL,
          success BOOLEAN DEFAULT true,
          error_message TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Storage metrics table creation error:', err.message);
      }
    }

    try {
      // Migrate existing analytics_aggregates table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'analytics_aggregates'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_analytics_aggregates'
          ) THEN
            ALTER TABLE public.analytics_aggregates RENAME TO skaftin_system_analytics_aggregates;
          END IF;
        END $$;
      `));

      // Analytics Aggregates table - pre-aggregated metrics for faster queries
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_analytics_aggregates (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('api', 'database', 'storage')),
          aggregation_period VARCHAR(20) NOT NULL CHECK (aggregation_period IN ('hour', 'day', 'week', 'month')),
          period_start TIMESTAMP NOT NULL,
          period_end TIMESTAMP NOT NULL,
          total_count BIGINT DEFAULT 0,
          total_response_time_ms BIGINT DEFAULT 0,
          avg_response_time_ms NUMERIC(10, 2),
          error_count BIGINT DEFAULT 0,
          success_count BIGINT DEFAULT 0,
          endpoint VARCHAR(500),
          table_name VARCHAR(255),
          operation_type VARCHAR(50),
          metadata JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Analytics aggregates table creation error:', err.message);
      }
    }

    try {
      // Create unique index for analytics_aggregates (using COALESCE in index, not constraint)
      await this.db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_skaftin_system_analytics_aggregates_unique 
        ON public.skaftin_system_analytics_aggregates(
          project_id, 
          metric_type, 
          aggregation_period, 
          period_start, 
          COALESCE(endpoint, ''), 
          COALESCE(table_name, ''), 
          COALESCE(operation_type, '')
        );
      `);
    } catch (err: any) {
      if (err.code !== '42P07' && err.code !== '23505') {
        console.error('❌ Analytics aggregates unique index creation error:', err.message);
      }
    }

    try {
      // Create indexes for api_metrics
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_metrics_project_time ON public.skaftin_system_api_metrics(project_id, created_at);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_metrics_endpoint ON public.skaftin_system_api_metrics(endpoint, created_at);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_metrics_status_code ON public.skaftin_system_api_metrics(status_code);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_api_metrics_user_id ON public.skaftin_system_api_metrics(user_id, created_at);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ API metrics index creation error:', err.message);
      }
    }

    try {
      // Create indexes for database_metrics
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_database_metrics_project_time ON public.skaftin_system_database_metrics(project_id, created_at);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_database_metrics_table_name ON public.skaftin_system_database_metrics(table_name, created_at);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_database_metrics_query_type ON public.skaftin_system_database_metrics(query_type, created_at);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Database metrics index creation error:', err.message);
      }
    }

    try {
      // Create indexes for storage_metrics
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_storage_metrics_project_time ON public.skaftin_system_storage_metrics(project_id, created_at);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_storage_metrics_operation_type ON public.skaftin_system_storage_metrics(operation_type, created_at);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Storage metrics index creation error:', err.message);
      }
    }

    try {
      // Create indexes for analytics_aggregates
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_analytics_aggregates_project_period ON public.skaftin_system_analytics_aggregates(project_id, metric_type, aggregation_period, period_start);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Analytics aggregates index creation error:', err.message);
      }
    }

    console.log('✅ Analytics tables initialized');
  }

  /**
   * Initialize workflow tables
   */
  async initializeWorkflowTables(): Promise<void> {
    try {
      // Create workflow_execution_status enum in public schema
      await this.db.execute(sql`
        DO $$ BEGIN
          CREATE TYPE public.workflow_execution_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      // Migrate existing workflow tables if they exist
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflows')
            AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skaftin_system_workflows')
          THEN ALTER TABLE public.workflows RENAME TO skaftin_system_workflows; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_nodes')
            AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skaftin_system_workflow_nodes')
          THEN ALTER TABLE public.workflow_nodes RENAME TO skaftin_system_workflow_nodes; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_edges')
            AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skaftin_system_workflow_edges')
          THEN ALTER TABLE public.workflow_edges RENAME TO skaftin_system_workflow_edges; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_executions')
            AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skaftin_system_workflow_executions')
          THEN ALTER TABLE public.workflow_executions RENAME TO skaftin_system_workflow_executions; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_node_executions')
            AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skaftin_system_workflow_node_executions')
          THEN ALTER TABLE public.workflow_node_executions RENAME TO skaftin_system_workflow_node_executions; END IF;
          IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'workflow_schedules')
            AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skaftin_system_workflow_schedules')
          THEN ALTER TABLE public.workflow_schedules RENAME TO skaftin_system_workflow_schedules; END IF;
        END $$;
      `));

      // Create workflows table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_workflows (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          enabled BOOLEAN DEFAULT true NOT NULL,
          schedule VARCHAR(100),
          cron_job_id INTEGER,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
          created_by VARCHAR(255)
        );
      `);

      // Create workflow_nodes table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_nodes (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE,
          node_id VARCHAR(100) NOT NULL,
          type VARCHAR(50) NOT NULL,
          position_x INTEGER NOT NULL,
          position_y INTEGER NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
          UNIQUE(workflow_id, node_id)
        );
      `);

      // Create workflow_edges table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_edges (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE,
          source_node_id VARCHAR(100) NOT NULL,
          target_node_id VARCHAR(100) NOT NULL,
          source_handle VARCHAR(100),
          target_handle VARCHAR(100),
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Create workflow_executions table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_executions (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE,
          status public.workflow_execution_status DEFAULT 'pending' NOT NULL,
          started_at TIMESTAMP DEFAULT NOW() NOT NULL,
          completed_at TIMESTAMP,
          triggered_by VARCHAR(50),
          input_data JSONB,
          result_data JSONB,
          error_message TEXT,
          execution_log JSONB,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Create workflow_node_executions table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_node_executions (
          id SERIAL PRIMARY KEY,
          execution_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflow_executions(id) ON DELETE CASCADE,
          node_id VARCHAR(100) NOT NULL,
          status VARCHAR(20) NOT NULL,
          started_at TIMESTAMP DEFAULT NOW() NOT NULL,
          completed_at TIMESTAMP,
          result_data JSONB,
          error_message TEXT,
          execution_time_ms INTEGER,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      // Create workflow_schedules table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_workflow_schedules (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER NOT NULL REFERENCES public.skaftin_system_workflows(id) ON DELETE CASCADE UNIQUE,
          cron_job_id INTEGER NOT NULL,
          schedule VARCHAR(100) NOT NULL,
          enabled BOOLEAN DEFAULT true NOT NULL,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);

      console.log('✅ Workflow tables initialized');
    } catch (err: any) {
      console.error('❌ Error initializing workflow tables:', err);
      // Don't throw - allow server to continue
    }
  }

  /**
   * Initialize backup schedules table
   */
  async initializeBackupSchedulesTable(): Promise<void> {
    try {
      // Migrate existing backup_schedules table if it exists
      await this.db.execute(sql.raw(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'backup_schedules'
          ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = 'skaftin_system_backup_schedules'
          ) THEN
            ALTER TABLE public.backup_schedules RENAME TO skaftin_system_backup_schedules;
          END IF;
        END $$;
      `));

      // Create backup_schedules table
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.skaftin_system_backup_schedules (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.skaftin_system_projects(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          schedule VARCHAR(100) NOT NULL,
          enabled BOOLEAN DEFAULT true NOT NULL,
          backup_name_prefix VARCHAR(255),
          retention_days INTEGER,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
          created_by VARCHAR(255),
          last_run_at TIMESTAMP,
          next_run_at TIMESTAMP
        );
      `);

      // Create indexes
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_backup_schedules_project_id ON public.skaftin_system_backup_schedules(project_id);
      `);

      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_skaftin_system_backup_schedules_enabled ON public.skaftin_system_backup_schedules(enabled);
      `);

      console.log('✅ Backup schedules table initialized');
    } catch (err: any) {
      console.error('❌ Error initializing backup schedules table:', err);
      // Don't throw - allow server to continue
    }
  }

  /**
   * Migrate organization context fields to existing project role tables
   */
  async migrateOrganizationContextToRoles(): Promise<void> {
    try {
      // Get all project schemas
      const projectsResult = await this.pool.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE schema_name IS NOT NULL'
      );

      for (const project of projectsResult.rows) {
        const schemaName = project.schema_name;
        
        // Add organisation_field_name if it doesn't exist
        await this.db.execute(sql.raw(`
          DO $$
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = '${schemaName}' 
              AND table_name = 'skaftin_system_roles' 
              AND column_name = 'organisation_field_name'
            ) THEN
              ALTER TABLE ${schemaName}.skaftin_system_roles ADD COLUMN organisation_field_name VARCHAR(255);
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = '${schemaName}' 
              AND table_name = 'skaftin_system_roles' 
              AND column_name = 'organisation_lookup_table'
            ) THEN
              ALTER TABLE ${schemaName}.skaftin_system_roles ADD COLUMN organisation_lookup_table VARCHAR(255);
            END IF;

            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_schema = '${schemaName}' 
              AND table_name = 'skaftin_system_roles' 
              AND column_name = 'organisation_lookup_field'
            ) THEN
              ALTER TABLE ${schemaName}.skaftin_system_roles ADD COLUMN organisation_lookup_field VARCHAR(255);
            END IF;
          END $$;
        `));
      }

      console.log('✅ Organization context fields migrated to existing project role tables');
    } catch (error) {
      console.error('Error migrating organization context fields:', error);
      // Don't throw - allow server to continue
    }
  }

  /**
   * Migrate email column to nullable for all existing project schemas
   */
  async migrateEmailColumnToNullable(): Promise<void> {
    try {
      console.log('🔧 Migrating email column to nullable for all project schemas...');
      
      // Get all project schemas
      const projectsResult = await this.pool.query(
        'SELECT id, name, schema_name FROM skaftin_system_projects WHERE schema_name IS NOT NULL'
      );
      
      let migratedCount = 0;
      for (const project of projectsResult.rows) {
        const schemaName = project.schema_name;
        
        try {
          // Check if email column exists and is NOT NULL, then make it nullable
          const checkResult = await this.pool.query(`
            SELECT is_nullable
            FROM information_schema.columns 
            WHERE table_schema = $1 
            AND table_name = 'skaftin_system_users' 
            AND column_name = 'email'
          `, [schemaName]);
          
          if (checkResult.rows.length > 0 && checkResult.rows[0].is_nullable === 'NO') {
            await this.pool.query(`
              ALTER TABLE ${schemaName}.skaftin_system_users 
              ALTER COLUMN email DROP NOT NULL
            `);
            console.log(`  ✅ Made email nullable in schema: ${schemaName}`);
            migratedCount++;
          }
        } catch (error: any) {
          // Log but don't fail - some schemas might not have the table yet
          if (error.code !== '42P01') { // 42P01 = relation does not exist
            console.error(`  ⚠️  Error migrating ${schemaName}:`, error.message);
          }
        }
      }
      
      if (migratedCount > 0) {
        console.log(`✅ Migrated ${migratedCount} project schema(s)`);
      } else {
        console.log('✅ All email columns are already nullable');
      }
    } catch (error: any) {
      console.error('❌ Error migrating email columns:', error.message);
      // Don't throw - allow server to continue
    }
  }

  /**
   * Initialize all database tables
   * Order matters: organizations must be created before organization_members and projects
   */
  async initializeAllTables(): Promise<void> {
    // First, ensure all necessary schemas exist
    await this.initializeSchemas();
    
    // Then initialize all tables
    await this.initializeUsersTable();
    await this.initializeOrganizationsTable();
    await this.initializeOrganizationMembersTable();
    await this.initializeProjectsTable();
    await this.initializeProjectBucketsTable();
    await this.initializeEmailProvidersTable();
    await this.initializeSmsProvidersTable();
    await this.initializeEmailTemplatesTable();
    await this.initializeSmsTemplatesTable();
    await this.initializeProjectMembersTable();
    await this.initializeProjectInvitationsTable();
    await this.initializeApiCredentialsTable();
    await this.initializeAuthSettingsTable();
    await this.initializeAnalyticsTables();
    await this.initializeWorkflowTables();
    await this.initializeBackupSchedulesTable();
    
    // Migrate organization context fields to existing projects
    await this.migrateOrganizationContextToRoles();
    
    // Migrate email column to nullable for all existing project schemas
    await this.migrateEmailColumnToNullable();
  }

  /**
   * Check if a table exists
   */
  async tableExists(tableName: string): Promise<boolean> {
    try {
      const result = await this.db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        );
      `);
      return (result.rows[0] as any).exists;
    } catch (err) {
      console.error(`Error checking if table ${tableName} exists:`, err);
      return false;
    }
  }
}


