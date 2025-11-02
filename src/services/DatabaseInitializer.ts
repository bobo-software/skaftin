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
   * Initialize projects table using Drizzle
   * NOTE: user_id is now VARCHAR to support SuperTokens UUIDs (not an integer foreign key)
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
      // Migrate existing user_id column from INTEGER to VARCHAR if needed
      await this.db.execute(sql`
        DO $$ 
        BEGIN
          -- Check if user_id is INTEGER and convert to VARCHAR
          IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema='public' AND table_name='projects' 
            AND column_name='user_id' 
            AND data_type='integer'
          ) THEN
            -- Drop foreign key constraint if it exists
            ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_user_id_fkey;
            -- Change column type to VARCHAR
            ALTER TABLE public.projects ALTER COLUMN user_id TYPE VARCHAR(255);
          END IF;
        END $$;
      `);
    } catch (err: any) {
      if (err.code !== '42710') {
        console.error('❌ Projects user_id migration error:', err.message);
      }
    }

    try {
      // Create index on user_id
      await this.db.execute(sql`
        CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
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
   */
  async initializeAllTables(): Promise<void> {
    await this.initializeUsersTable();
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


