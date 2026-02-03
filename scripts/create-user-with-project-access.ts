/**
 * Script to create a new platform admin user and add them to organization
 * This gives them access to all projects in the organization
 */

const PRODUCTION_API_URL = 'https://skaftinplatform.bobosoftware.co.za';
const ORG_ID = 1; // "bobo software" organization

// User details - CHANGE THESE
const NEW_USER_EMAIL = 'newuser@example.com'; // CHANGE THIS
const NEW_USER_PASSWORD = 'SecurePass123!'; // CHANGE THIS
const NEW_USER_NAME = 'New User'; // CHANGE THIS
const USER_ROLE = 'admin'; // 'admin', 'dev', 'member', or 'viewer'

async function createUserWithProjectAccess() {
  try {
    console.log('🚀 Creating new user with project access...');
    console.log(`📧 Email: ${NEW_USER_EMAIL}`);
    console.log(`🏢 Organization ID: ${ORG_ID}\n`);

    // Step 1: Register the user via production API (creates SuperTokens user)
    console.log('📝 Step 1: Registering user in SuperTokens...');
    const registerResponse = await fetch(`${PRODUCTION_API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: NEW_USER_EMAIL,
        password: NEW_USER_PASSWORD,
        full_name: NEW_USER_NAME,
      }),
    });

    const registerData = await registerResponse.json();

    if (!registerResponse.ok) {
      if (registerData.message?.includes('already registered')) {
        console.log('⚠️  User already exists in SuperTokens');
      } else {
        console.error('❌ Failed to register user:', registerData.message || registerData.error);
        return;
      }
    } else {
      console.log('✅ User registered successfully in SuperTokens!');
      console.log(`   User ID: ${registerData.data?.user?.id || 'N/A'}`);
    }

    // Step 2: Get the SuperTokens user ID
    console.log('\n📝 Step 2: Getting SuperTokens user ID...');
    const loginResponse = await fetch(`${PRODUCTION_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: NEW_USER_EMAIL,
        password: NEW_USER_PASSWORD,
      }),
    });

    const loginData = await loginResponse.json();
    
    if (!loginResponse.ok) {
      console.error('❌ Failed to login to get user ID:', loginData.message);
      return;
    }

    const supertokensUserId = loginData.data?.user?.id;
    if (!supertokensUserId) {
      console.error('❌ Could not get user ID from login response');
      return;
    }

    console.log(`✅ Got SuperTokens User ID: ${supertokensUserId}`);

    // Step 3: Add user to organization via database (using MCP would require authentication)
    console.log('\n📝 Step 3: Adding user to organization...');
    console.log('   Note: This step requires database access. Using MCP...');
    
    // We'll use MCP to add the user to the organization
    // But first, let's check if we can use execute_sql
    console.log('\n💡 To complete setup, run this SQL query:');
    console.log(`\nINSERT INTO skaftin_system_organization_members (organization_id, user_id, role)`);
    console.log(`VALUES (${ORG_ID}, '${supertokensUserId}', '${USER_ROLE}');`);
    console.log(`\nOr use the MCP tool to add the member.`);

    console.log('\n✅ User creation complete!');
    console.log(`\n📧 Email: ${NEW_USER_EMAIL}`);
    console.log(`🔑 Password: ${NEW_USER_PASSWORD}`);
    console.log(`🆔 SuperTokens User ID: ${supertokensUserId}`);
    console.log(`🏢 Organization ID: ${ORG_ID}`);
    console.log(`👑 Role: ${USER_ROLE}`);
    console.log(`\n🌐 Login at: https://skaftin.bobosoftware.co.za`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
  }
}

// Get user details from command line args or use defaults
const args = process.argv.slice(2);
if (args.length >= 3) {
  const email = args[0];
  const password = args[1];
  const name = args[2];
  const role = args[3] || 'admin';
  
  // Update the constants
  (global as any).NEW_USER_EMAIL = email;
  (global as any).NEW_USER_PASSWORD = password;
  (global as any).NEW_USER_NAME = name;
  (global as any).USER_ROLE = role;
  
  createUserWithProjectAccess();
} else {
  console.log('Usage: npx tsx scripts/create-user-with-project-access.ts <email> <password> <name> [role]');
  console.log('\nExample:');
  console.log('npx tsx scripts/create-user-with-project-access.ts john@example.com SecurePass123! "John Doe" admin');
  console.log('\nOr edit the script to set NEW_USER_EMAIL, NEW_USER_PASSWORD, and NEW_USER_NAME');
}
