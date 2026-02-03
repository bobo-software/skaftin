/**
 * Script to create admin user in production via API
 * This registers the user in the production SuperTokens instance
 */

const PRODUCTION_API_URL = 'https://skaftinplatform.bobosoftware.co.za';
const ADMIN_EMAIL = 'sibiya.bobo@gmail.com';
const ADMIN_PASSWORD = 'BLUcabish#26';
const ADMIN_NAME = 'Bobo Admin';

async function createAdminUserInProduction() {
  try {
    console.log('🚀 Creating admin user in production...');
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🌐 API: ${PRODUCTION_API_URL}\n`);

    // Step 1: Register the user via production API
    console.log('📝 Registering user via production API...');
    const registerResponse = await fetch(`${PRODUCTION_API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        full_name: ADMIN_NAME,
      }),
    });

    const registerData = await registerResponse.json();

    if (registerResponse.ok && registerData.success) {
      console.log('✅ User registered successfully in production SuperTokens!');
      console.log(`   User ID: ${registerData.data?.user?.id || 'N/A'}`);
      console.log(`   Email: ${registerData.data?.user?.email || ADMIN_EMAIL}`);
    } else if (registerResponse.status === 409 || registerData.message?.includes('already registered')) {
      console.log('⚠️  User already exists in production SuperTokens');
      console.log('   Attempting to verify login...');
      
      // Try to login to verify credentials
      const loginResponse = await fetch(`${PRODUCTION_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: ADMIN_EMAIL,
          password: ADMIN_PASSWORD,
        }),
      });

      const loginData = await loginResponse.json();

      if (loginResponse.ok && loginData.success) {
        console.log('✅ Login successful! User credentials are correct.');
        console.log(`   User ID: ${loginData.data?.user?.id || 'N/A'}`);
      } else {
        console.log('❌ Login failed. The password might be incorrect.');
        console.log(`   Error: ${loginData.message || 'Unknown error'}`);
        console.log('\n💡 You may need to reset the password or create the user manually.');
      }
    } else {
      console.error('❌ Failed to register user:', registerData.message || registerData.error);
      console.error('   Response:', JSON.stringify(registerData, null, 2));
      return;
    }

    console.log('\n✅ Setup complete!');
    console.log(`\n📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log(`\n🌐 Login at: https://skaftin.bobosoftware.co.za`);

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.cause) {
      console.error('   Cause:', error.cause);
    }
    console.error('\n💡 Make sure:');
    console.error('   1. The production API is accessible');
    console.error('   2. SuperTokens is properly configured in production');
    console.error('   3. CORS is enabled for your origin');
  }
}

createAdminUserInProduction();
