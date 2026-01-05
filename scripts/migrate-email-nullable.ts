import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrateEmailNullable() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'skaftin',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    // Get all project schemas
    const projectsResult = await pool.query(
      'SELECT id, name, schema_name FROM skaftin_system_projects WHERE schema_name IS NOT NULL'
    );
    
    console.log(`Found ${projectsResult.rows.length} projects to migrate\n`);
    
    for (const project of projectsResult.rows) {
      const schemaName = project.schema_name;
      console.log(`Processing project: ${project.name} (ID: ${project.id}, Schema: ${schemaName})`);
      
      try {
        // Check if email column exists and is NOT NULL
        const checkResult = await pool.query(`
          SELECT 
            column_name,
            is_nullable
          FROM information_schema.columns
          WHERE table_schema = $1
            AND table_name = 'skaftin_system_users'
            AND column_name = 'email'
        `, [schemaName]);
        
        if (checkResult.rows.length === 0) {
          console.log(`  ⚠️  Table skaftin_system_users not found in schema ${schemaName}`);
          continue;
        }
        
        const emailColumn = checkResult.rows[0];
        
        if (emailColumn.is_nullable === 'YES') {
          console.log(`  ✅ Email column is already nullable`);
        } else {
          console.log(`  🔧 Making email column nullable...`);
          
          // Drop NOT NULL constraint
          await pool.query(`
            ALTER TABLE ${schemaName}.skaftin_system_users 
            ALTER COLUMN email DROP NOT NULL
          `);
          
          console.log(`  ✅ Email column is now nullable`);
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing ${schemaName}:`, error.message);
      }
    }
    
    console.log('\n✅ Migration complete!');
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrateEmailNullable();

