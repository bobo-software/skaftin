import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT as string, 10) || 5432,
  user: process.env.DB_USERNAME || process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'skaftin_db',
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

async function addAccessPolicyColumn() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Adding access_policy column to skaftin_system_project_buckets...');
    
    // Check if column exists
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'skaftin_system_project_buckets' 
      AND column_name = 'access_policy'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✅ access_policy column already exists');
      
      // Update default value to 'public' if needed
      await client.query(`
        ALTER TABLE public.skaftin_system_project_buckets
        ALTER COLUMN access_policy SET DEFAULT 'public'
      `);
      console.log('✅ Updated default value to "public"');
      
      // Update existing NULL or 'private' values to 'public'
      await client.query(`
        UPDATE public.skaftin_system_project_buckets
        SET access_policy = 'public'
        WHERE access_policy IS NULL OR access_policy = 'private'
      `);
      console.log('✅ Updated existing buckets to "public"');
    } else {
      // Add column
      await client.query(`
        ALTER TABLE public.skaftin_system_project_buckets
        ADD COLUMN access_policy VARCHAR(20) NOT NULL DEFAULT 'public'
      `);
      console.log('✅ Added access_policy column with default "public"');
    }
    
    // Drop constraint if exists and recreate
    await client.query(`
      ALTER TABLE public.skaftin_system_project_buckets
      DROP CONSTRAINT IF EXISTS check_access_policy
    `);
    
    await client.query(`
      ALTER TABLE public.skaftin_system_project_buckets
      ADD CONSTRAINT check_access_policy CHECK (access_policy IN ('private', 'public'))
    `);
    console.log('✅ Added check constraint');
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_skaftin_system_project_buckets_access_policy 
      ON public.skaftin_system_project_buckets(access_policy)
    `);
    console.log('✅ Created index on access_policy');
    
    console.log('\n✅ Migration complete!');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === '42701') {
      console.log('   Column already exists, that\'s okay');
    } else {
      throw error;
    }
  } finally {
    client.release();
    await pool.end();
  }
}

addAccessPolicyColumn().catch(console.error);
