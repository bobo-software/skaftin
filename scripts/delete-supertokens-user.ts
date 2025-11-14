import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import { deleteUser } from 'supertokens-node';
import { initSuperTokens } from '../src/config/supertokens';

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

async function deleteSuperTokensUser(email: string) {
  try {
    console.log(`\n🗑️  Deleting SuperTokens user: ${email}\n`);

    // Find user in SuperTokens
    const superTokensResult = await pool.query(
      `SELECT user_id, email FROM supertokens_emailpassword_users WHERE email = $1`,
      [email]
    );

    if (superTokensResult.rows.length === 0) {
      console.log('❌ User not found in SuperTokens');
      await pool.end();
      return;
    }

    const userId = superTokensResult.rows[0].user_id;
    console.log(`✅ Found user: ${email}`);
    console.log(`   User ID: ${userId}`);

    // Delete using SuperTokens SDK
    try {
      await deleteUser(userId);
      console.log('✅ Successfully deleted from SuperTokens');
    } catch (stError) {
      console.error('❌ Error deleting from SuperTokens:', stError);
    }

    // Also check and delete from app_users tables
    console.log('\n🔍 Checking app_users tables...');
    const schemasResult = await pool.query(
      `SELECT schema_name FROM information_schema.schemata 
       WHERE schema_name LIKE 'project_%'`
    );

    for (const schema of schemasResult.rows) {
      const schemaName = schema.schema_name;
      
      try {
        const appUsersResult = await pool.query(
          `SELECT id FROM ${schemaName}.app_users WHERE email = $1`,
          [email]
        );

        if (appUsersResult.rows.length > 0) {
          console.log(`\n✅ Found in ${schemaName}, deleting...`);
          await pool.query(
            `DELETE FROM ${schemaName}.app_users WHERE email = $1`,
            [email]
          );
          console.log(`   ✅ Deleted from ${schemaName}.app_users`);
        }
      } catch (error) {
        // Table might not exist, skip
      }
    }

    console.log('\n✅ Cleanup complete!\n');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

// Get email from command line
const email = process.argv[2];
if (!email) {
  console.error('Usage: ts-node delete-supertokens-user.ts <email>');
  process.exit(1);
}

const confirm = process.argv[3];
if (confirm !== '--confirm') {
  console.error('\n⚠️  This will permanently delete the user from SuperTokens!');
  console.error('Usage: ts-node delete-supertokens-user.ts <email> --confirm\n');
  process.exit(1);
}

deleteSuperTokensUser(email);

