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
   * Initialize all database tables
   * Order matters: organizations must be created before organization_members and projects
   */
  async initializeAllTables(): Promise<void> {
    await this.initializeUsersTable();
    await this.initializeOrganizationsTable();
    await this.initializeOrganizationMembersTable();
    await this.initializeProjectsTable();
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


