/**
 * Script to add a user to an organization via MCP
 * This gives them access to all projects in that organization
 */

import * as dotenv from 'dotenv';
dotenv.config();

// Configuration
const ORG_ID = 1; // "bobo software" organization
const USER_EMAIL = process.env.NEW_USER_EMAIL || 'newuser@example.com';
const USER_PASSWORD = process.env.NEW_USER_PASSWORD || 'SecurePass123!';
const USER_NAME = process.env.NEW_USER_NAME || 'New User';
const USER_ROLE = process.env.NEW_USER_ROLE || 'admin'; // 'admin', 'dev', 'member', 'viewer'
const PRODUCTION_API_URL = 'https://skaftinplatform.bobosoftware.co.za';

async function addUserToOrganization() {
  try {
    console.log('🚀 Adding user to organization via MCP...');
    console.log(`📧 Email: ${USER_EMAIL}`);
    console.log(`🏢 Organization ID: ${ORG_ID}`);
    console.log(`👑 Role: ${USER_ROLE}\n`);

    // Step 1: Create SuperTokens user if it doesn't exist
    console.log('📝 Step 1: Creating/verifying SuperTokens user...');
    let supertokensUserId: string;

    try {
      const registerResponse = await fetch(`${PRODUCTION_API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: USER_EMAIL,
          password: USER_PASSWORD,
          full_name: USER_NAME,
        }),
      });

      const registerData = await registerResponse.json();

      if (registerResponse.ok) {
        supertokensUserId = registerData.data?.user?.id;
        console.log(`✅ User created: ${supertokensUserId}`);
      } else if (registerData.message?.includes('already registered')) {
        // User exists, get ID by logging in
        const loginResponse = await fetch(`${PRODUCTION_API_URL}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: USER_EMAIL,
            password: USER_PASSWORD,
          }),
        });

        const loginData = await loginResponse.json();
        if (loginResponse.ok) {
          supertokensUserId = loginData.data?.user?.id;
          console.log(`✅ User already exists: ${supertokensUserId}`);
        } else {
          throw new Error(`Failed to login: ${loginData.message}`);
        }
      } else {
        throw new Error(`Failed to register: ${registerData.message}`);
      }
    } catch (error: any) {
      console.error('❌ Error creating/verifying user:', error.message);
      return;
    }

    // Step 2: Add user to organization via MCP (execute_sql)
    console.log('\n📝 Step 2: Adding user to organization via MCP...');
    
    // Note: This would require calling the MCP tool, but we can't do that directly from a script
    // Instead, we'll output the SQL and instructions
    console.log('\n💡 To add the user to the organization, run this SQL via MCP:');
    console.log('\nSQL Query:');
    console.log(`INSERT INTO skaftin_system_organization_members (organization_id, user_id, role)`);
    console.log(`VALUES (${ORG_ID}, '${supertokensUserId}', '${USER_ROLE}')`);
    console.log(`ON CONFLICT (organization_id, user_id) DO UPDATE SET role = '${USER_ROLE}';`);
    
    console.log('\nOr use this MCP tool call:');
    console.log(JSON.stringify({
      tool: 'execute_sql',
      query: `INSERT INTO skaftin_system_organization_members (organization_id, user_id, role) VALUES (${ORG_ID}, '${supertokensUserId}', '${USER_ROLE}') ON CONFLICT (organization_id, user_id) DO UPDATE SET role = '${USER_ROLE}'`,
      readonly: false
    }, null, 2));

    console.log('\n✅ Setup instructions generated!');
    console.log(`\n📧 Email: ${USER_EMAIL}`);
    console.log(`🔑 Password: ${USER_PASSWORD}`);
    console.log(`🆔 SuperTokens User ID: ${supertokensUserId}`);
    console.log(`🏢 Organization ID: ${ORG_ID}`);
    console.log(`👑 Role: ${USER_ROLE}`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  if (process.argv.length < 4) {
    console.log('Usage: NEW_USER_EMAIL=email NEW_USER_PASSWORD=pass NEW_USER_NAME="Name" npx tsx scripts/add-user-to-org-via-mcp.ts');
    console.log('\nOr set environment variables:');
    console.log('  NEW_USER_EMAIL=user@example.com');
    console.log('  NEW_USER_PASSWORD=SecurePass123!');
    console.log('  NEW_USER_NAME="User Name"');
    console.log('  NEW_USER_ROLE=admin (optional, default: admin)');
    process.exit(1);
  }
  addUserToOrganization();
}

export { addUserToOrganization };
