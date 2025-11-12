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
   * Initialize users table using Drizzle
   * Always creates in public schema
   */
  async initializeUsersTable(): Promise<void> {
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(100) UNIQUE NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255),
          full_name VARCHAR(255),
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
                        WHERE table_schema='public' AND table_name='users' AND column_name='password_hash') THEN
            ALTER TABLE public.users ADD COLUMN password_hash VARCHAR(255);
          END IF;
        END $$;
      `);
    } catch (err: any) {
      if (err.code !== '42710') {
        console.error('❌ Users password_hash migration error:', err.message);
      }
    }

    try {
      // Create index on email
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
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
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.organizations (
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
        CREATE INDEX IF NOT EXISTS idx_organizations_owner_id ON public.organizations(owner_id);
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
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.organization_members (
          id SERIAL PRIMARY KEY,
          organization_id INTEGER NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
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
        CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON public.organization_members(organization_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON public.organization_members(user_id);
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
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.projects (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT,
          schema_name VARCHAR(255) NOT NULL UNIQUE,
          bucket_name VARCHAR(255) NOT NULL UNIQUE,
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
        WHERE table_schema='public' AND table_name='projects' AND column_name='user_id'
      `);
      
      const currentType = (columnCheck.rows[0] as any)?.data_type;
      
      if (currentType === 'integer') {
        // Migrate existing user_id column from INTEGER to VARCHAR
        await this.db.execute(sql`
          DO $$ 
          BEGIN
            -- Drop foreign key constraint if it exists
            ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
            -- Change column type to VARCHAR
            ALTER TABLE public.projects ALTER COLUMN user_id TYPE VARCHAR(255);
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
                        WHERE table_schema='public' AND table_name='projects' AND column_name='organization_id') THEN
            ALTER TABLE public.projects ADD COLUMN organization_id INTEGER;
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
        CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_projects_organization_id ON public.projects(organization_id);
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
   * Initialize email_providers table using Drizzle
   * Always creates in public schema
   */
  async initializeEmailProvidersTable(): Promise<void> {
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.email_providers (
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
        CREATE INDEX IF NOT EXISTS idx_email_providers_project_id ON public.email_providers(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_email_providers_is_active ON public.email_providers(is_active);
      `);
    } catch (err: any) {
      if (err.code !== '42P07') {
        console.error('❌ Email providers index creation error:', err.message);
      }
    }

    console.log('✅ Email providers table initialized');
  }

  /**
   * Initialize project_members table using Drizzle
   * Links users to specific projects they have access to
   */
  async initializeProjectMembersTable(): Promise<void> {
    try {
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.project_members (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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
        CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON public.project_members(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);
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
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.project_invitations (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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
        CREATE INDEX IF NOT EXISTS idx_project_invitations_project_id ON public.project_invitations(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_project_invitations_email ON public.project_invitations(email);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_project_invitations_code ON public.project_invitations(invite_code);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_project_invitations_status ON public.project_invitations(status);
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
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.api_credentials (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
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
        CREATE INDEX IF NOT EXISTS idx_api_credentials_project_id ON public.api_credentials(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_api_credentials_token ON public.api_credentials(token);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_api_credentials_is_active ON public.api_credentials(is_active);
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
      await this.db.execute(sql`
        CREATE TABLE IF NOT EXISTS public.auth_settings (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL UNIQUE REFERENCES public.projects(id) ON DELETE CASCADE,
          allow_duplicate_emails BOOLEAN DEFAULT false,
          require_email_verification BOOLEAN DEFAULT false,
          require_phone_verification BOOLEAN DEFAULT false,
          enable_password_reset BOOLEAN DEFAULT true,
          enable_mfa BOOLEAN DEFAULT false,
          registration_enabled BOOLEAN DEFAULT true,
          auth_enabled BOOLEAN DEFAULT true,
          default_role_id INTEGER,
          email_provider_id INTEGER REFERENCES public.email_providers(id) ON DELETE SET NULL,
          sms_provider_id INTEGER,
          settings_json JSONB DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (err: any) {
      if (err.code !== '23505' && err.code !== '42P07') {
        console.error('❌ Auth settings table creation error:', err.message);
      }
    }

    try {
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_auth_settings_project_id ON public.auth_settings(project_id);
      `);
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_auth_settings_email_provider_id ON public.auth_settings(email_provider_id);
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
   * Creates app_users, app_roles, app_user_roles, and app_user_custom_fields tables
   */
  async initializeProjectAuthTables(schemaName: string, projectId: number): Promise<void> {
    try {
      // Create app_users table in project schema
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.app_users (
          id SERIAL PRIMARY KEY,
          supertokens_user_id VARCHAR(255) UNIQUE,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          password VARCHAR(255),
          phone VARCHAR(50),
          metadata JSONB DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          email_verified BOOLEAN DEFAULT false,
          phone_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `));

      // Create indexes for app_users
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_users_email ON ${schemaName}.app_users(email);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_users_supertokens_user_id ON ${schemaName}.app_users(supertokens_user_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_users_is_active ON ${schemaName}.app_users(is_active);
      `));

      console.log(`✅ app_users table created in schema: ${schemaName}`);

      // Create app_roles table in project schema
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.app_roles (
          id SERIAL PRIMARY KEY,
          role_name VARCHAR(255) NOT NULL,
          role_key VARCHAR(100) NOT NULL UNIQUE,
          description TEXT,
          permissions JSONB DEFAULT '[]',
          session_duration_minutes INTEGER DEFAULT 10080,
          is_system_role BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `));

      // Create index for app_roles
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_roles_role_key ON ${schemaName}.app_roles(role_key);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_roles_is_system_role ON ${schemaName}.app_roles(is_system_role);
      `));

      console.log(`✅ app_roles table created in schema: ${schemaName}`);

      // Insert default roles (Admin and User)
      await this.db.execute(sql.raw(`
        INSERT INTO ${schemaName}.app_roles (role_name, role_key, description, permissions, session_duration_minutes, is_system_role)
        VALUES 
          ('Admin', 'admin', 'Administrator with full access', '["*"]', 60, true),
          ('User', 'user', 'Standard user with limited access', '["read"]', 10080, true)
        ON CONFLICT (role_key) DO NOTHING;
      `));

      console.log(`✅ Default roles seeded in schema: ${schemaName}`);

      // Create app_user_roles junction table
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.app_user_roles (
          id SERIAL PRIMARY KEY,
          app_user_id INTEGER NOT NULL REFERENCES ${schemaName}.app_users(id) ON DELETE CASCADE,
          role_id INTEGER NOT NULL REFERENCES ${schemaName}.app_roles(id) ON DELETE CASCADE,
          assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          assigned_by VARCHAR(255),
          UNIQUE(app_user_id, role_id)
        );
      `));

      // Create indexes for app_user_roles
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_user_roles_app_user_id ON ${schemaName}.app_user_roles(app_user_id);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_user_roles_role_id ON ${schemaName}.app_user_roles(role_id);
      `));

      console.log(`✅ app_user_roles table created in schema: ${schemaName}`);

      // Create app_user_custom_fields table
      await this.db.execute(sql.raw(`
        CREATE TABLE IF NOT EXISTS ${schemaName}.app_user_custom_fields (
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

      // Create index for app_user_custom_fields
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_user_custom_fields_field_name ON ${schemaName}.app_user_custom_fields(field_name);
      `));
      await this.db.execute(sql.raw(`
        CREATE INDEX IF NOT EXISTS idx_app_user_custom_fields_is_active ON ${schemaName}.app_user_custom_fields(is_active);
      `));

      console.log(`✅ app_user_custom_fields table created in schema: ${schemaName}`);

      // Update auth_settings with default role
      const defaultRoleResult = await this.db.execute(sql.raw(`
        SELECT id FROM ${schemaName}.app_roles WHERE role_key = 'user' LIMIT 1;
      `));

      if (defaultRoleResult.rows.length > 0) {
        const defaultRoleId = (defaultRoleResult.rows[0] as any).id;
        await this.db.execute(sql`
          UPDATE public.auth_settings 
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
   * Initialize all database tables
   * Order matters: organizations must be created before organization_members and projects
   */
  async initializeAllTables(): Promise<void> {
    await this.initializeUsersTable();
    await this.initializeOrganizationsTable();
    await this.initializeOrganizationMembersTable();
    await this.initializeProjectsTable();
    await this.initializeEmailProvidersTable();
    await this.initializeProjectMembersTable();
    await this.initializeProjectInvitationsTable();
    await this.initializeApiCredentialsTable();
    await this.initializeAuthSettingsTable();
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


