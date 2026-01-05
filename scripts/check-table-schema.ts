import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function checkTableSchema() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'skaftin',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
  });

  try {
    // Get project ID from command line args or use first project
    const projectId = process.argv[2] ? parseInt(process.argv[2]) : null;
    
    if (!projectId) {
      // Get first project
      const projectsResult = await pool.query(
        'SELECT id, name, schema_name FROM skaftin_system_projects ORDER BY id LIMIT 1'
      );
      
      if (projectsResult.rows.length === 0) {
        console.error('No projects found');
        process.exit(1);
      }
      
      const project = projectsResult.rows[0];
      console.log(`Using project: ${project.name} (ID: ${project.id}, Schema: ${project.schema_name})`);
      
      const schemaName = project.schema_name;
      
      // Check skaftin_system_users table structure
      const result = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'skaftin_system_users'
        ORDER BY ordinal_position
      `, [schemaName]);
      
      console.log('\n📋 Table: skaftin_system_users');
      console.log('Schema:', schemaName);
      console.log('\nColumns:');
      console.table(result.rows.map(row => ({
        column: row.column_name,
        type: row.data_type + (row.character_maximum_length ? `(${row.character_maximum_length})` : ''),
        nullable: row.is_nullable === 'YES' ? '✅ YES' : '❌ NO',
        default: row.column_default || '-'
      })));
      
      // Specifically check email column
      const emailColumn = result.rows.find((r: any) => r.column_name === 'email');
      if (emailColumn) {
        console.log('\n📧 Email Column Details:');
        console.log('  - Column Name:', emailColumn.column_name);
        console.log('  - Data Type:', emailColumn.data_type);
        console.log('  - Is Nullable:', emailColumn.is_nullable === 'YES' ? '✅ YES (can be null)' : '❌ NO (NOT NULL constraint)');
        console.log('  - Default:', emailColumn.column_default || 'None');
        
        if (emailColumn.is_nullable === 'NO') {
          console.log('\n⚠️  WARNING: Email column has NOT NULL constraint!');
          console.log('   This needs to be changed to allow users without email.');
        } else {
          console.log('\n✅ Email column is nullable - users can be created without email!');
        }
      }
    } else {
      // Get project schema
      const projectResult = await pool.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );
      
      if (projectResult.rows.length === 0) {
        console.error(`Project ${projectId} not found`);
        process.exit(1);
      }
      
      const schemaName = projectResult.rows[0].schema_name;
      console.log(`Checking table in schema: ${schemaName}`);
      
      // Check skaftin_system_users table structure
      const result = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = $1
          AND table_name = 'skaftin_system_users'
        ORDER BY ordinal_position
      `, [schemaName]);
      
      console.log('\n📋 Table: skaftin_system_users');
      console.log('Schema:', schemaName);
      console.log('\nColumns:');
      console.table(result.rows.map(row => ({
        column: row.column_name,
        type: row.data_type + (row.character_maximum_length ? `(${row.character_maximum_length})` : ''),
        nullable: row.is_nullable === 'YES' ? '✅ YES' : '❌ NO',
        default: row.column_default || '-'
      })));
      
      // Specifically check email column
      const emailColumn = result.rows.find((r: any) => r.column_name === 'email');
      if (emailColumn) {
        console.log('\n📧 Email Column Details:');
        console.log('  - Column Name:', emailColumn.column_name);
        console.log('  - Data Type:', emailColumn.data_type);
        console.log('  - Is Nullable:', emailColumn.is_nullable === 'YES' ? '✅ YES (can be null)' : '❌ NO (NOT NULL constraint)');
        console.log('  - Default:', emailColumn.column_default || 'None');
        
        if (emailColumn.is_nullable === 'NO') {
          console.log('\n⚠️  WARNING: Email column has NOT NULL constraint!');
          console.log('   This needs to be changed to allow users without email.');
        } else {
          console.log('\n✅ Email column is nullable - users can be created without email!');
        }
      }
    }
    
    // Also check auth_settings table for allow_users_without_email
    console.log('\n\n📋 Checking auth_settings table...');
    const authSettingsResult = await pool.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'skaftin_system_auth_settings'
        AND column_name = 'allow_users_without_email'
    `);
    
    if (authSettingsResult.rows.length > 0) {
      const column = authSettingsResult.rows[0];
      console.log('✅ allow_users_without_email column exists:');
      console.log('  - Data Type:', column.data_type);
      console.log('  - Is Nullable:', column.is_nullable === 'YES' ? 'YES' : 'NO');
      console.log('  - Default:', column.column_default || 'None');
    } else {
      console.log('❌ allow_users_without_email column does NOT exist in auth_settings table!');
      console.log('   Run the migration: migrations/0019_add_allow_users_without_email.sql');
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkTableSchema();

