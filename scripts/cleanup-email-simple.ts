import * as dotenv from 'dotenv';
import { deleteUser, listUsersByAccountInfo } from 'supertokens-node';
import { initSuperTokens } from '../src/config/supertokens';

dotenv.config();
initSuperTokens();

async function cleanup() {
  try {
    const email = process.argv[2];
    if (!email) {
      console.error('Usage: ts-node cleanup-email-simple.ts <email>');
      process.exit(1);
    }

    console.log(`\n🧹 Cleaning up: ${email}\n`);

    // Delete from SuperTokens
    const users = await listUsersByAccountInfo('public', { email });
    
    if (users.length === 0) {
      console.log('❌ User not found in SuperTokens');
    } else {
      console.log(`Found ${users.length} user(s) in SuperTokens`);
      
      for (const user of users) {
        await deleteUser(user.id);
        console.log(`✅ Deleted from SuperTokens: ${user.id}`);
      }
    }

    console.log('\n✅ Cleanup complete!\n');
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

cleanup();

