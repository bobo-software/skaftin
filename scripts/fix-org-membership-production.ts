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

const ADMIN_EMAIL = 'sibiya.bobo@gmail.com';
const PRODUCTION_USER_ID = '06f9567d-8981-456a-be45-e857186c9411'; // From production registration
const ORG_NAME = 'bobo software';

async function fixOrganizationMembership() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Finding organization...');
    
    // Find the organization
    const orgResult = await client.query(
      `SELECT id, name FROM skaftin_system_organizations WHERE LOWER(name) LIKE $1`,
      [`%${ORG_NAME.toLowerCase()}%`]
    );
    
    if (orgResult.rows.length === 0) {
      console.error(`❌ Organization "${ORG_NAME}" not found`);
      return;
    }
    
    const organization = orgResult.rows[0];
    console.log(`✅ Found organization: ${organization.name} (ID: ${organization.id})`);
    
    // Check existing membership
    const memberCheck = await client.query(
      `SELECT id, user_id, role FROM skaftin_system_organization_members WHERE organization_id = $1`,
      [organization.id]
    );
    
    console.log(`\n👥 Current members: ${memberCheck.rows.length}`);
    memberCheck.rows.forEach(m => {
      console.log(`   - User ID: ${m.user_id}, Role: ${m.role}`);
    });
    
    // Check if production user ID exists
    const prodUserCheck = await client.query(
      `SELECT id, user_id, role FROM skaftin_system_organization_members WHERE organization_id = $1 AND user_id = $2`,
      [organization.id, PRODUCTION_USER_ID]
    );
    
    if (prodUserCheck.rows.length > 0) {
      console.log(`\n✅ Production user already a member`);
      console.log(`   Role: ${prodUserCheck.rows[0].role}`);
    } else {
      console.log(`\n➕ Adding production user to organization...`);
      await client.query(
        `INSERT INTO skaftin_system_organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)`,
        [organization.id, PRODUCTION_USER_ID, 'owner']
      );
      console.log(`✅ Production user added as owner`);
    }
    
    console.log('\n✅ Setup complete!');
    console.log(`\n📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🆔 Production SuperTokens User ID: ${PRODUCTION_USER_ID}`);
    console.log(`🏢 Organization: ${organization.name}`);
    console.log(`👑 Role: Owner`);
    
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

fixOrganizationMembership().catch(console.error);
