import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { initSuperTokens } from '../src/config/supertokens';
import EmailPassword from 'supertokens-node/recipe/emailpassword';

dotenv.config();

// Initialize SuperTokens
initSuperTokens();

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'skaftin_db',
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'skaftin_user',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'skaftin_password',
});

async function checkUser(email: string) {
  try {
    console.log(`\n🔍 Checking for user: ${email}\n`);

    // Check SuperTokens (Platform users) using SDK
    console.log('📧 SuperTokens (Platform) Users:');
    try {
      const user = await EmailPassword.getUserByEmail("public", email);
      if (user) {
        console.log('✅ Found in SuperTokens:');
        console.log(`  - User ID: ${user.id}`);
        console.log(`  - Email: ${user.emails[0]}`);
        console.log(`  - Tenant: public`);
        console.log(`  - Time joined: ${new Date(user.timeJoined).toISOString()}`);
      } else {
        console.log('❌ Not found in SuperTokens');
      }
    } catch (stError: any) {
      console.log('❌ Not found in SuperTokens (or error checking)');
      console.log(`   Error: ${stError.message}`);
    }

    // Check all app_users tables (Application users)
    console.log('\n👥 App Users (in projects):');
    const schemasResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name LIKE 'project_%'`
    );

    let foundInAnyProject = false;
    for (const schema of schemasResult.rows) {
      const schemaName = schema.schema_name;
      
      try {
        const appUsersResult = await pool.query(
          `SELECT id, name, email, supertokens_user_id, is_active, created_at 
           FROM ${schemaName}.app_users 
           WHERE email = $1`,
          [email]
        );

        if (appUsersResult.rows.length > 0) {
          foundInAnyProject = true;
          console.log(`\n✅ Found in ${schemaName}:`);
          appUsersResult.rows.forEach(row => {
            console.log(`  - ID: ${row.id}`);
            console.log(`  - Name: ${row.name}`);
            console.log(`  - Email: ${row.email}`);
            console.log(`  - SuperTokens ID: ${row.supertokens_user_id || 'N/A'}`);
            console.log(`  - Active: ${row.is_active}`);
            console.log(`  - Created: ${new Date(row.created_at).toISOString()}`);
          });
        }
      } catch (error) {
        // Table might not exist, skip
      }
    }

    if (!foundInAnyProject) {
      console.log('❌ Not found in any project app_users tables');
    }

    console.log('\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: ts-node check-supertokens-user.ts <email>');
  process.exit(1);
}

checkUser(email);

