import { Pool } from 'pg';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { listUsersByAccountInfo } from 'supertokens-node';
import { initSuperTokens } from '../src/config/supertokens';
import * as dotenv from 'dotenv';

dotenv.config();

// Initialize SuperTokens
initSuperTokens();

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
const ADMIN_PASSWORD = 'BLUcabish#26';
const ADMIN_NAME = 'Bobo Admin';
const ORG_NAME = 'bobo software';

async function createAdminUser() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Finding organization and projects...');
    
    // Find the organization
    const orgResult = await client.query(
      `SELECT id, name, owner_id FROM skaftin_system_organizations WHERE LOWER(name) LIKE $1`,
      [`%${ORG_NAME.toLowerCase()}%`]
    );
    
    if (orgResult.rows.length === 0) {
      console.error(`❌ Organization "${ORG_NAME}" not found`);
      console.log('Available organizations:');
      const allOrgs = await client.query('SELECT id, name FROM skaftin_system_organizations');
      allOrgs.rows.forEach(org => console.log(`  - ${org.name} (ID: ${org.id})`));
      return;
    }
    
    const organization = orgResult.rows[0];
    console.log(`✅ Found organization: ${organization.name} (ID: ${organization.id})`);
    
    // Get all projects in this organization
    const projectsResult = await client.query(
      `SELECT id, name, schema_name FROM skaftin_system_projects WHERE organization_id = $1`,
      [organization.id]
    );
    
    const projects = projectsResult.rows;
    console.log(`✅ Found ${projects.length} project(s) in organization`);
    projects.forEach(p => console.log(`  - ${p.name} (ID: ${p.id}, Schema: ${p.schema_name})`));
    
    if (projects.length === 0) {
      console.log('⚠️  No projects found. Creating platform admin only.');
    }
    
    // Step 1: Create SuperTokens platform admin user
    console.log('\n🔐 Creating SuperTokens platform admin user...');
    try {
      const signUpResponse = await EmailPassword.signUp("public", ADMIN_EMAIL, ADMIN_PASSWORD);
      
      if (signUpResponse.status === "OK") {
        console.log(`✅ SuperTokens platform admin created: ${ADMIN_EMAIL} (ID: ${signUpResponse.user.id})`);
      } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
        console.log(`⚠️  SuperTokens user already exists: ${ADMIN_EMAIL}`);
        // Try to get the user ID
        const users = await listUsersByAccountInfo("public", { email: ADMIN_EMAIL });
        if (users && users.length > 0) {
          console.log(`✅ Found existing SuperTokens user: ${users[0].id}`);
        }
      } else {
        console.error(`❌ Failed to create SuperTokens user:`, signUpResponse);
        return;
      }
    } catch (error: any) {
      if (error.message?.includes('EMAIL_ALREADY_EXISTS')) {
        console.log(`⚠️  SuperTokens user already exists: ${ADMIN_EMAIL}`);
      } else {
        console.error(`❌ Error creating SuperTokens user:`, error);
        return;
      }
    }
    
    // Step 2: Add user to organization as owner/admin if not already
    console.log('\n👥 Adding user to organization...');
    try {
      // Get SuperTokens user ID
      const stUsers = await listUsersByAccountInfo("public", { email: ADMIN_EMAIL });
      if (!stUsers || stUsers.length === 0) {
        console.error('❌ Could not find SuperTokens user');
        return;
      }
      
      const userId = stUsers[0].id;
      
      // Check if user is already a member
      const memberCheck = await client.query(
        `SELECT id, role FROM skaftin_system_organization_members WHERE organization_id = $1 AND user_id = $2`,
        [organization.id, userId]
      );
      
      if (memberCheck.rows.length > 0) {
        console.log(`✅ User already a member of organization (Role: ${memberCheck.rows[0].role})`);
      } else {
        // Add user as owner/admin
        await client.query(
          `INSERT INTO skaftin_system_organization_members (organization_id, user_id, role) VALUES ($1, $2, $3)`,
          [organization.id, userId, 'owner']
        );
        console.log(`✅ Added user to organization as owner`);
      }
    } catch (error: any) {
      if (error.code === '23505') { // Unique constraint violation
        console.log(`✅ User already a member of organization`);
      } else {
        console.error(`❌ Error adding user to organization:`, error.message);
      }
    }
    
    // Step 3: Create app users in each project with admin role
    if (projects.length > 0) {
      console.log('\n👤 Creating app users in projects...');
      
      for (const project of projects) {
        try {
          console.log(`\n  Processing project: ${project.name} (ID: ${project.id})`);
          
          // Get admin role ID from project schema
          const roleResult = await client.query(
            `SELECT id, role_name, role_key FROM ${project.schema_name}.skaftin_system_roles WHERE role_key = 'admin' OR role_name ILIKE '%admin%' ORDER BY CASE WHEN role_key = 'admin' THEN 1 ELSE 2 END LIMIT 1`
          );
          
          let adminRoleId: number | null = null;
          if (roleResult.rows.length > 0) {
            adminRoleId = roleResult.rows[0].id;
            console.log(`    ✅ Found admin role: ${roleResult.rows[0].role_name} (ID: ${adminRoleId})`);
          } else {
            console.log(`    ⚠️  No admin role found in project schema`);
          }
          
          // Check if user already exists in this project
          const userCheck = await client.query(
            `SELECT id FROM ${project.schema_name}.skaftin_system_users WHERE email = $1`,
            [ADMIN_EMAIL]
          );
          
          if (userCheck.rows.length > 0) {
            const existingUserId = userCheck.rows[0].id;
            console.log(`    ✅ User already exists in project (ID: ${existingUserId})`);
            
            // Check if user has admin role
            if (adminRoleId) {
              const roleCheck = await client.query(
                `SELECT id FROM ${project.schema_name}.skaftin_system_user_roles WHERE app_user_id = $1 AND role_id = $2`,
                [existingUserId, adminRoleId]
              );
              
              if (roleCheck.rows.length === 0) {
                // Assign admin role
                try {
                  await client.query(
                    `INSERT INTO ${project.schema_name}.skaftin_system_user_roles (app_user_id, role_id) VALUES ($1, $2)`,
                    [existingUserId, adminRoleId]
                  );
                  console.log(`    ✅ Assigned admin role to existing user`);
                } catch (roleError: any) {
                  if (roleError.code === '23505') { // Unique constraint violation
                    console.log(`    ✅ User already has admin role`);
                  } else {
                    throw roleError;
                  }
                }
              } else {
                console.log(`    ✅ User already has admin role`);
              }
            }
          } else {
            // Create new app user
            // Check if password_hash column exists
            const columnCheck = await client.query(
              `SELECT column_name FROM information_schema.columns 
               WHERE table_schema = $1 AND table_name = 'skaftin_system_users' AND column_name = 'password_hash'`,
              [project.schema_name]
            );
            
            const hasPasswordHash = columnCheck.rows.length > 0;
            
            if (hasPasswordHash) {
              const bcrypt = require('bcrypt');
              const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
              
              const insertResult = await client.query(
                `INSERT INTO ${project.schema_name}.skaftin_system_users (name, email, password_hash, is_active, created_at, updated_at) 
                 VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
                [ADMIN_NAME, ADMIN_EMAIL, hashedPassword, true]
              );
              
              const newUserId = insertResult.rows[0].id;
              console.log(`    ✅ Created app user (ID: ${newUserId})`);
              
              // Assign admin role if available
              if (adminRoleId) {
                await client.query(
                  `INSERT INTO ${project.schema_name}.skaftin_system_user_roles (app_user_id, role_id) VALUES ($1, $2)`,
                  [newUserId, adminRoleId]
                );
                console.log(`    ✅ Assigned admin role`);
              }
            } else {
              // Schema doesn't have password_hash - create user without password
              const insertResult = await client.query(
                `INSERT INTO ${project.schema_name}.skaftin_system_users (name, email, is_active, created_at, updated_at) 
                 VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`,
                [ADMIN_NAME, ADMIN_EMAIL, true]
              );
              
              const newUserId = insertResult.rows[0].id;
              console.log(`    ✅ Created app user without password (ID: ${newUserId}) - schema uses different auth`);
              
              // Assign admin role if available
              if (adminRoleId) {
                await client.query(
                  `INSERT INTO ${project.schema_name}.skaftin_system_user_roles (app_user_id, role_id) VALUES ($1, $2)`,
                  [newUserId, adminRoleId]
                );
                console.log(`    ✅ Assigned admin role`);
              }
            }
          }
        } catch (error: any) {
          console.error(`    ❌ Error processing project ${project.name}:`, error.message);
          // Continue with next project
        }
      }
    }
    
    console.log('\n✅ Admin user setup complete!');
    console.log(`\n📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
    console.log(`\nYou can now login at: ${process.env.FRONTEND_URL || 'http://localhost:3005'}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

createAdminUser().catch(console.error);
