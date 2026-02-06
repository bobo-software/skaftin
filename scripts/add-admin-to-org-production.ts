import { Pool } from 'pg';
import { listUsersByAccountInfo } from 'supertokens-node';
import { initSuperTokens } from '../src/config/supertokens';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize SuperTokens with production config
// Override to use production SuperTokens
process.env.SUPERTOKENS_CONNECTION_URI = process.env.SUPERTOKENS_CONNECTION_URI || 'http://supertokens:3567';
initSuperTokens();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT as string, 10) || 5440,
  user: process.env.DB_USER || 'skaftin_user',
  password: process.env.DB_PASSWORD || 'skaftin_password',
  database: process.env.DB_NAME || 'skaftin_db',
  ssl: process.env.DB_SSL === 'true' ? {
    rejectUnauthorized: false
  } : false
});

const ADMIN_EMAIL = 'sibiya.bobo@gmail.com';
const ORG_NAME = 'bobo software';

async function addAdminToOrganization() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Finding organization and user...');
    
    // Find the organization
    const orgResult = await client.query(
      `SELECT id, name, owner_id FROM skaftin_system_organizations WHERE LOWER(name) LIKE $1`,
      [`%${ORG_NAME.toLowerCase()}%`]
    );
    
    if (orgResult.rows.length === 0) {
      console.error(`❌ Organization "${ORG_NAME}" not found`);
      const allOrgs = await client.query('SELECT id, name FROM skaftin_system_organizations');
      console.log('Available organizations:');
      allOrgs.rows.forEach(org => console.log(`  - ${org.name} (ID: ${org.id})`));
      return;
    }
    
    const organization = orgResult.rows[0];
    console.log(`✅ Found organization: ${organization.name} (ID: ${organization.id})`);
    
    // Get SuperTokens user ID
    console.log(`\n👤 Finding SuperTokens user...`);
    const stUsers = await listUsersByAccountInfo("public", { email: ADMIN_EMAIL });
    
    if (!stUsers || stUsers.length === 0) {
      console.error(`❌ SuperTokens user not found: ${ADMIN_EMAIL}`);
      console.log('💡 Make sure the user exists in production SuperTokens first.');
      return;
    }
    
    const userId = stUsers[0].id;
    console.log(`✅ Found SuperTokens user: ${userId}`);
    
    // Check if user is already a member
    const memberCheck = await client.query(
      `SELECT id, role FROM skaftin_system_organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organization.id, userId]
    );
    
    if (memberCheck.rows.length > 0) {
      console.log(`\n✅ User already a member of organization`);
      console.log(`   Role: ${memberCheck.rows[0].role}`);
      console.log(`   Member ID: ${memberCheck.rows[0].id}`);
    } else {
      // Add user as owner/admin
      console.log(`\n➕ Adding user to organization as owner...`);
      await client.query(
        `INSERT INTO skaftin_system_organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)`,
        [organization.id, userId, 'owner']
      );
      console.log(`✅ User added to organization as owner`);
    }
    
    // Get all projects in the organization
    const projectsResult = await client.query(
      `SELECT id, name FROM skaftin_system_projects WHERE organization_id = $1`,
      [organization.id]
    );
    
    console.log(`\n📁 Projects in organization: ${projectsResult.rows.length}`);
    projectsResult.rows.forEach(p => console.log(`   - ${p.name} (ID: ${p.id})`));
    
    console.log('\n✅ Setup complete!');
    console.log(`\n📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🏢 Organization: ${organization.name}`);
    console.log(`👑 Role: Owner`);
    console.log(`\n🌐 Login at: https://skaftin.bobosoftware.co.za`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.code === '23505') {
      console.log('✅ User already a member (unique constraint)');
    } else {
      console.error('Full error:', error);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

addAdminToOrganization().catch(console.error);
