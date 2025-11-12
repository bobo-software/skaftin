import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'skaftin_db',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'skaftin_user',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'skaftin_password',
});

async function addPasswordColumn() {
  try {
    console.log('\n🔧 Adding password column to app_users tables...\n');

    // Get all project schemas
    const schemasResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name LIKE 'project_%'`
    );

    if (schemasResult.rows.length === 0) {
      console.log('📭 No project schemas found.');
      await pool.end();
      return;
    }

    console.log(`Found ${schemasResult.rows.length} project schema(s)\n`);

    for (const row of schemasResult.rows) {
      const schemaName = row.schema_name;
      
      try {
        // Check if column already exists
        const columnCheck = await pool.query(
          `SELECT column_name FROM information_schema.columns 
           WHERE table_schema = $1 AND table_name = 'app_users' AND column_name = 'password'`,
          [schemaName]
        );

        if (columnCheck.rows.length > 0) {
          console.log(`⏭️  ${schemaName}: password column already exists, skipping`);
          continue;
        }

        // Add password column
        await pool.query(`
          ALTER TABLE ${schemaName}.app_users 
          ADD COLUMN IF NOT EXISTS password VARCHAR(255)
        `);

        console.log(`✅ ${schemaName}: Added password column`);
      } catch (error: any) {
        console.error(`❌ ${schemaName}: Error - ${error.message}`);
      }
    }

    console.log('\n✅ Migration complete!\n');
    console.log('📝 Note: Existing users without passwords will need to use password reset');
    console.log('   or be manually updated by platform admins.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

addPasswordColumn();

