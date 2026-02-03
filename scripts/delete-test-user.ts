import { deleteUser, listUsersByAccountInfo } from 'supertokens-node';
import { initSuperTokens } from '../src/config/supertokens';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize SuperTokens
initSuperTokens();

const USER_EMAIL = 'testuser@example.com';
const USER_ID = '3090aecd-49f8-40ac-a764-fa3229321cf7';

async function deleteTestUser() {
  try {
    console.log(`🗑️  Deleting user: ${USER_EMAIL}`);
    
    // Try to find user by email first
    const users = await listUsersByAccountInfo("public", { email: USER_EMAIL });
    
    if (users.length > 0) {
      console.log(`✅ Found ${users.length} user(s) with email ${USER_EMAIL}`);
      
      for (const user of users) {
        try {
          await deleteUser(user.id);
          console.log(`✅ Deleted SuperTokens user: ${user.id}`);
        } catch (error: any) {
          console.error(`❌ Failed to delete user ${user.id}:`, error.message);
        }
      }
    } else {
      // Try deleting by known user ID
      console.log(`⚠️  User not found by email, trying to delete by ID: ${USER_ID}`);
      try {
        await deleteUser(USER_ID);
        console.log(`✅ Deleted SuperTokens user by ID: ${USER_ID}`);
      } catch (error: any) {
        console.error(`❌ Failed to delete user by ID:`, error.message);
      }
    }
    
    console.log('\n✅ User deletion complete!');
    console.log('   Note: User was already removed from organization via MCP');
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

deleteTestUser();
