import supertokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import EmailPassword from "supertokens-node/recipe/emailpassword";
import EmailVerification from "supertokens-node/recipe/emailverification";
import ThirdParty from "supertokens-node/recipe/thirdparty";
import UserRoles from "supertokens-node/recipe/userroles";
import Dashboard from "supertokens-node/recipe/dashboard";
import { TypeInput } from "supertokens-node/types";
import { db } from "../db/drizzle.config";
import { projects } from "../db/schemas/ProjectsSchema";
import { organization_members } from "../db/schemas/OrganizationsSchema";
import { eq, sql, inArray } from "drizzle-orm";
import nodemailer from "nodemailer";

/**
 * Migrate database records from stale SuperTokens user IDs to the current user ID.
 * 
 * This handles the case where the same person has multiple SuperTokens user IDs
 * (e.g., from email/password + OAuth, or after a SuperTokens Core reset).
 * Database records (orgs, projects, memberships) may be stored under an old user ID.
 * This function finds those records and migrates them to the current session's user ID.
 * 
 * @param currentUserId - The SuperTokens user ID from the current session
 * @returns true if any records were migrated
 */
export async function migrateStaleUserRecords(currentUserId: string): Promise<boolean> {
  try {
    // Get the current user's info from SuperTokens
    const stUser = await supertokens.getUser(currentUserId);
    if (!stUser || !stUser.emails || stUser.emails.length === 0) {
      return false;
    }

    const email = stUser.emails[0];

    // Find all SuperTokens users with the same email (different login methods, old accounts, etc.)
    const allUsersWithEmail = await supertokens.listUsersByAccountInfo("public", { email });
    const otherUserIds = allUsersWithEmail
      .map(u => u.id)
      .filter(id => id !== currentUserId);

    if (otherUserIds.length === 0) {
      return false;
    }

    let migrated = false;

    for (const oldUserId of otherUserIds) {
      // Check if this old user ID has any organization memberships
      const oldMemberships = await db
        .select({ id: organization_members.id })
        .from(organization_members)
        .where(eq(organization_members.user_id, oldUserId));

      // Also check for owned projects under the old ID
      const oldProjects = await db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.user_id, oldUserId));

      if (oldMemberships.length > 0 || oldProjects.length > 0) {
        console.log(`🔄 Migrating records from stale user ID ${oldUserId} to current user ID ${currentUserId} (email: ${email})`);

        // Migrate organization memberships (skip if current user already has membership in that org)
        await db.execute(sql`
          UPDATE skaftin_system_organization_members 
          SET user_id = ${currentUserId} 
          WHERE user_id = ${oldUserId}
          AND organization_id NOT IN (
            SELECT organization_id FROM skaftin_system_organization_members WHERE user_id = ${currentUserId}
          )
        `);
        // Remove any remaining duplicate old memberships
        await db.execute(sql`
          DELETE FROM skaftin_system_organization_members 
          WHERE user_id = ${oldUserId}
        `);

        // Migrate organization ownership
        await db.execute(sql`
          UPDATE skaftin_system_organizations 
          SET owner_id = ${currentUserId} 
          WHERE owner_id = ${oldUserId}
        `);

        // Migrate project creator/owner
        await db.execute(sql`
          UPDATE skaftin_system_projects 
          SET user_id = ${currentUserId} 
          WHERE user_id = ${oldUserId}
        `);

        // Migrate project memberships (skip duplicates)
        await db.execute(sql`
          UPDATE skaftin_system_project_members 
          SET user_id = ${currentUserId} 
          WHERE user_id = ${oldUserId}
          AND project_id NOT IN (
            SELECT project_id FROM skaftin_system_project_members WHERE user_id = ${currentUserId}
          )
        `);
        // Remove any remaining duplicate old project memberships
        await db.execute(sql`
          DELETE FROM skaftin_system_project_members 
          WHERE user_id = ${oldUserId}
        `);

        migrated = true;
        console.log(`✅ Successfully migrated records from ${oldUserId} to ${currentUserId}`);
      }
    }

    return migrated;
  } catch (error) {
    console.error('Error migrating stale user records:', error);
    return false;
  }
}

/**
 * Fetch project IDs for a user from the database
 * Used during session creation to populate the access token payload
 */
async function getProjectIdsForUser(userId: string): Promise<number[]> {
  try {
    // 1. Projects owned by user
    const ownedProjectsQuery = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.user_id, userId));
    
    // 2. Projects user is a direct member of (via project_members table)
    const memberProjectsQuery = await db.execute(sql`
      SELECT DISTINCT project_id as id 
      FROM skaftin_system_project_members 
      WHERE user_id = ${userId}
    `);
    
    // 3. Projects from organizations user belongs to
    const userOrganizations = await db
      .select({ 
        organization_id: organization_members.organization_id,
        role: organization_members.role
      })
      .from(organization_members)
      .where(eq(organization_members.user_id, userId));
    
    let orgProjectIds: number[] = [];
    if (userOrganizations.length > 0) {
      const orgIds = userOrganizations.map(org => org.organization_id);
      const orgProjectsQuery = await db
        .select({ id: projects.id })
        .from(projects)
        .where(inArray(projects.organization_id, orgIds));
      orgProjectIds = orgProjectsQuery.map(p => p.id);
    }
    
    const ownedProjectIds = ownedProjectsQuery.map(p => p.id);
    const memberProjectIds = (memberProjectsQuery.rows as any[]).map(p => p.id);
    
    // Combine all lists and remove duplicates
    return [...new Set([...ownedProjectIds, ...memberProjectIds, ...orgProjectIds])];
  } catch (error) {
    console.error("Error fetching project IDs for user:", error);
    return [];
  }
}

/**
 * Determine user role based on organization membership
 */
async function getUserRole(userId: string): Promise<string> {
  try {
    const userOrganizations = await db
      .select({ role: organization_members.role })
      .from(organization_members)
      .where(eq(organization_members.user_id, userId));
    
    // Check if user is owner or admin of any organization
    const isOrgOwnerOrAdmin = userOrganizations.some(org => 
      org.role === 'owner' || org.role === 'admin'
    );
    
    return isOrgOwnerOrAdmin ? 'admin' : 'user';
  } catch (error) {
    console.error("Error determining user role:", error);
    return 'user';
  }
}

/**
 * Send email for platform authentication (email verification, password reset)
 * Uses environment variables for SMTP configuration
 */
async function sendPlatformEmail(
  to: string,
  subject: string,
  textContent: string,
  htmlContent: string
): Promise<boolean> {
  try {
    // Check if SMTP is configured
    const smtpHost = process.env.PLATFORM_SMTP_HOST;
    const smtpUser = process.env.PLATFORM_SMTP_USER;
    const smtpPass = process.env.PLATFORM_SMTP_PASSWORD;
    const fromEmail = process.env.PLATFORM_FROM_EMAIL || 'noreply@skaftin.com';
    const fromName = process.env.PLATFORM_FROM_NAME || 'Skaftin';

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.warn('Platform SMTP not configured. Set PLATFORM_SMTP_HOST, PLATFORM_SMTP_USER, PLATFORM_SMTP_PASSWORD env vars.');
      console.log(`Would send email to ${to}: ${subject}`);
      console.log(`Verification link would be in the email content`);
      return true; // Return true to not block verification flow in development
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.PLATFORM_SMTP_PORT || '587'),
      secure: process.env.PLATFORM_SMTP_SECURE === 'true',
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
    });

    await transporter.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to,
      subject,
      text: textContent,
      html: htmlContent,
    });

    console.log(`✅ Platform email sent to ${to}: ${subject}`);
    return true;
  } catch (error) {
    console.error('❌ Error sending platform email:', error);
    return false;
  }
}

export function initSuperTokens() {
  // Detect if we're in production
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Determine cookie settings based on environment
  const cookieSettings = {
    // For production with subdomains (skaftin.bobosoftware.co.za & skaftinplatform.bobosoftware.co.za)
    cookieSameSite: isProduction ? "none" as const : "lax" as const,
    cookieSecure: isProduction, // true in production (HTTPS required)
    cookieDomain: process.env.COOKIE_DOMAIN || undefined, // .bobosoftware.co.za in production
    olderCookieDomain: process.env.OLDER_COOKIE_DOMAIN || undefined, // Clear old cookies if domain changed
  };

  const config: TypeInput = {
    framework: "express",
    supertokens: {
      connectionURI: process.env.SUPERTOKENS_CONNECTION_URI || "http://localhost:3567",
      apiKey: process.env.SUPERTOKENS_API_KEY,
    },
    appInfo: {
      appName: process.env.SUPERTOKENS_APP_NAME || "Skaftin",
      apiDomain: process.env.SUPERTOKENS_API_DOMAIN || "http://localhost:4006",
      websiteDomain: process.env.SUPERTOKENS_WEBSITE_DOMAIN || "http://localhost:3005",
      apiBasePath: "/auth",
      websiteBasePath: "/auth",
    },
    recipeList: [
      EmailPassword.init({
        signUpFeature: {
          formFields: [
            {
              id: "name",
              optional: true,
            },
          ],
        },
        emailDelivery: {
          override: (originalImplementation) => {
            return {
              ...originalImplementation,
              sendEmail: async function (input) {
                if (input.type === "PASSWORD_RESET") {
                  const { user, passwordResetLink } = input;
                  const appName = process.env.SUPERTOKENS_APP_NAME || "Skaftin";

                  // Embed issued-at timestamp so the frontend can detect expiry on page load
                  const issuedAt = Math.floor(Date.now() / 1000);
                  const resetLink = `${passwordResetLink}&iat=${issuedAt}`;

                  const subject = `Reset your password - ${appName}`;
                  const textContent = `
Hello,

We received a request to reset your password for your ${appName} account.

Click the link below to reset your password:

${resetLink}

This link will expire in 15 minutes.

If you didn't request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The ${appName} Team
                  `.trim();

                  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #32A956; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background-color: #32A956; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    .warning { background-color: #fff3cd; border: 1px solid #ffc107; padding: 10px; border-radius: 4px; margin-top: 15px; font-size: 13px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>We received a request to reset your password for your ${appName} account.</p>
      <p>Click the button below to set a new password:</p>
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666; font-size: 12px;">${resetLink}</p>
      <p>This link will expire in <strong>15 minutes</strong>.</p>
      <div class="warning">
        If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
      </div>
      <div class="footer">
        <p>Best regards,<br>The ${appName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
                  `.trim();

                  await sendPlatformEmail(user.email, subject, textContent, htmlContent);
                } else {
                  return originalImplementation.sendEmail(input);
                }
              },
            };
          },
        },
        override: {
          apis: (originalImplementation) => {
            return {
              ...originalImplementation,
              signUpPOST: async function (input) {
                if (originalImplementation.signUpPOST === undefined) {
                  throw Error("Should never come here");
                }

                // Call the original implementation
                let response = await originalImplementation.signUpPOST(input);

                // If sign up was successful
                if (response.status === "OK") {
                  console.log("New user signed up:", response.user.id);
                  
                  // You can add custom logic here, like:
                  // - Send welcome email
                  // - Create user profile in your database
                  // - Set up initial user data
                }

                return response;
              },
              signInPOST: async function (input) {
                if (originalImplementation.signInPOST === undefined) {
                  throw Error("Should never come here");
                }

                // Call the original implementation
                let response = await originalImplementation.signInPOST(input);

                // If sign in was successful
                if (response.status === "OK") {
                  console.log("User signed in:", response.user.id);
                }

                return response;
              },
            };
          },
        },
      }),
      // Email Verification Recipe
      // Mode: OPTIONAL - allows login without verification, but shows reminder
      // Change to "REQUIRED" to block login until email is verified
      EmailVerification.init({
        mode: "OPTIONAL", // or "REQUIRED"
        emailDelivery: {
          override: (originalImplementation) => {
            return {
              ...originalImplementation,
              sendEmail: async function (input) {
                const { user, emailVerifyLink } = input;
                const appName = process.env.SUPERTOKENS_APP_NAME || "Skaftin";
                const websiteDomain = process.env.SUPERTOKENS_WEBSITE_DOMAIN || "http://localhost:3005";
                
                const subject = `Verify your email - ${appName}`;
                const textContent = `
Hello,

Please verify your email address by clicking the link below:

${emailVerifyLink}

This link will expire in 24 hours.

If you didn't create an account with ${appName}, please ignore this email.

Best regards,
The ${appName} Team
                `.trim();

                const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #32A956; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background-color: #32A956; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email</h1>
    </div>
    <div class="content">
      <p>Hello,</p>
      <p>Please verify your email address by clicking the button below:</p>
      <div style="text-align: center;">
        <a href="${emailVerifyLink}" class="button">Verify Email</a>
      </div>
      <p>Or copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #666; font-size: 12px;">${emailVerifyLink}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account with ${appName}, please ignore this email.</p>
      <div class="footer">
        <p>Best regards,<br>The ${appName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
                `.trim();

                await sendPlatformEmail(user.email, subject, textContent, htmlContent);
              },
            };
          },
        },
      }),
      // Third-Party OAuth Recipe
      // Enables Google, GitHub, and other OAuth providers
      // Configure by setting environment variables:
      // - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
      // - GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
      ThirdParty.init({
        signInAndUpFeature: {
          providers: [
            // Google OAuth
            ...(process.env.GOOGLE_CLIENT_ID ? [{
              config: {
                thirdPartyId: "google",
                clients: [{
                  clientId: process.env.GOOGLE_CLIENT_ID,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
                }],
              },
            }] : []),
            // GitHub OAuth
            ...(process.env.GITHUB_CLIENT_ID ? [{
              config: {
                thirdPartyId: "github",
                clients: [{
                  clientId: process.env.GITHUB_CLIENT_ID,
                  clientSecret: process.env.GITHUB_CLIENT_SECRET || "",
                }],
              },
            }] : []),
            // Apple Sign In (optional)
            ...(process.env.APPLE_CLIENT_ID ? [{
              config: {
                thirdPartyId: "apple",
                clients: [{
                  clientId: process.env.APPLE_CLIENT_ID,
                  additionalConfig: {
                    keyId: process.env.APPLE_KEY_ID || "",
                    privateKey: process.env.APPLE_PRIVATE_KEY || "",
                    teamId: process.env.APPLE_TEAM_ID || "",
                  },
                }],
              },
            }] : []),
          ],
        },
        override: {
          apis: (originalImplementation) => {
            return {
              ...originalImplementation,
              signInUpPOST: async function (input) {
                if (originalImplementation.signInUpPOST === undefined) {
                  throw Error("Should never come here");
                }

                const response = await originalImplementation.signInUpPOST(input);

                if (response.status === "OK") {
                  const { createdNewRecipeUser, user } = response;
                  const providerId = input.provider.id;
                  if (createdNewRecipeUser) {
                    console.log(`New user signed up via ${providerId}:`, user.id);
                    // You can add custom logic here for new OAuth users
                  } else {
                    console.log(`User signed in via ${providerId}:`, user.id);
                  }
                }

                return response;
              },
            };
          },
        },
      }),
      Session.init({
        ...cookieSettings,
        sessionExpiredStatusCode: 401,
        // Note: Token lifetimes are configured via SuperTokens Core environment variables:
        // - ACCESS_TOKEN_VALIDITY_SECONDS (default: 3600 = 1 hour)
        // - REFRESH_TOKEN_VALIDITY_SECONDS (default: 8640000 = 100 days)
        // Set these in your SuperTokens Core container/service environment
        // Support both cookie and header-based token transfer
        // App users can use header tokens, platform users use cookies
        getTokenTransferMethod: (input) => {
          // Check if this is an app-auth request (use header tokens)
          // BaseRequest may not have originalUrl, so check path or use a header
          const req = input.req as any;
          if (req?.originalUrl?.includes('/api/app-auth') || req?.path?.includes('/api/app-auth')) {
            return "header";
          }
          // Platform auth uses cookies
          return "cookie";
        },
        override: {
          functions: (originalImplementation) => {
            return {
              ...originalImplementation,
              createNewSession: async function (input) {
                // Add custom claims to session
                const userId = input.userId;

                // Migrate any records from stale SuperTokens user IDs (e.g., if user
                // previously signed in via a different method like OAuth vs email/password,
                // or if SuperTokens Core was reset and the user got a new ID)
                await migrateStaleUserRecords(userId);
                
                // Fetch user's projects and role from database
                const [projectIds, role] = await Promise.all([
                  getProjectIdsForUser(userId),
                  getUserRole(userId)
                ]);
                
                input.accessTokenPayload = {
                  ...input.accessTokenPayload,
                  projectIds,
                  role,
                };

                console.log(`Session created for user ${userId} with ${projectIds.length} projects and role: ${role}`);
                return originalImplementation.createNewSession(input);
              },
            };
          },
        },
      }),
      // User Roles Recipe
      // Provides built-in role and permission management
      // Can be used alongside or instead of custom RBAC
      // 
      // Usage examples:
      // await UserRoles.createNewRoleOrAddPermissions("admin", ["read", "write", "delete"]);
      // await UserRoles.addRoleToUser("public", userId, "admin");
      // const roles = await session.getClaimValue(UserRoles.UserRoleClaim);
      UserRoles.init(),
      Dashboard.init({
        apiKey: process.env.SUPERTOKENS_API_KEY,
      }),
    ],
  };

  supertokens.init(config);
}

// Export UserRoles for use in other files
export { UserRoles };

