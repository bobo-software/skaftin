import { Response } from 'express';
import { Pool } from 'pg';
import ResponseUtils from '../utils/ResponseUtils';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { AppUserAuthenticatedRequest } from '../middleware/appUserAuthMiddleware';
import { AuthEmailService } from '../services/AuthEmailService';
import { SmsOtpService } from '../services/SmsOtpService';
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Session from "supertokens-node/recipe/session";
import { convertToRecipeUserId, listUsersByAccountInfo } from "supertokens-node";
import { createProjectScopedEmail, extractOriginalEmail } from '../middleware/appUserSuperTokensMiddleware';

/**
 * Authentication controller for application users
 * Separate from platform admin authentication
 */
class AppAuthController {
  private static pool: Pool;
  private static emailService: AuthEmailService;
  private static smsOtpService: SmsOtpService;

  static initialize(pool: Pool) {
    AppAuthController.pool = pool;
    AppAuthController.emailService = new AuthEmailService(pool);
    AppAuthController.smsOtpService = new SmsOtpService(pool);
  }

  /**
   * Get project schema name from project ID
   */
  private static async getProjectSchema(projectId: number): Promise<string | null> {
    try {
      const result = await AppAuthController.pool.query(
        'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );
      return result.rows.length > 0 ? result.rows[0].schema_name : null;
    } catch (error) {
      console.error('Error fetching project schema:', error);
      return null;
    }
  }

  /**
   * Generate OTP code with configurable length (4-6 digits)
   */
  private static generateOTP(length: number = 6): string {
    // Ensure length is between 4 and 6
    const otpLength = Math.min(6, Math.max(4, length));
    const min = Math.pow(10, otpLength - 1);
    const max = Math.pow(10, otpLength) - 1;
    return crypto.randomInt(min, max + 1).toString();
  }

  /**
   * Register a new app user
   * POST /api/app-auth/auth/register (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/register (backward compatibility)
   */
  static async register(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { name, last_name, email, password, phone, metadata, custom_field_1, custom_field_2, role_id, role_key, otp_method } = req.body;

      // Check if registration is enabled and get settings
      const settingsResult = await AppAuthController.pool.query(
        `SELECT registration_enabled, auth_enabled, email_provider_id,
                send_registration_email, send_verification_email, 
                send_welcome_email, require_email_verification,
                require_email, otp_length
         FROM skaftin_system_auth_settings WHERE project_id = $1`,
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auth_enabled) {
        return ResponseUtils.error(res, 'Authentication is not enabled for this project', null, null, 403);
      }

      if (!settingsResult.rows[0].registration_enabled) {
        return ResponseUtils.error(res, 'Registration is disabled for this project', null, null, 403);
      }

      const emailSettings = settingsResult.rows[0];
      const requireEmail = emailSettings.require_email !== false; // Default true for backward compatibility

      // Validate required fields based on settings
      if (!name || !password) {
        return ResponseUtils.error(res, 'Name and password are required', null, null, 400);
      }

      // Email validation based on require_email setting
      if (requireEmail && !email) {
        return ResponseUtils.error(res, 'Email is required', null, null, 400);
      }

      // If email is not required, phone must be provided
      if (!requireEmail && !email && !phone) {
        return ResponseUtils.error(res, 'Either email or phone is required when email is optional', null, null, 400);
      }

      // Validate otp_method if provided
      if (otp_method && !['email', 'sms'].includes(otp_method)) {
        return ResponseUtils.error(res, 'Invalid otp_method. Must be "email", "sms", or null', null, null, 400);
      }

      // If SMS OTP requested, phone number is required
      if (otp_method === 'sms' && !phone) {
        return ResponseUtils.error(res, 'Phone number is required for SMS OTP verification', null, null, 400);
      }

      // If email OTP requested but no email provided
      if (otp_method === 'email' && !email) {
        return ResponseUtils.error(res, 'Email is required for email OTP verification', null, null, 400);
      }

      // Check if email already exists in this project (only if email is provided)
      if (email) {
        const existingUser = await AppAuthController.pool.query(
          `SELECT id FROM ${schemaName}.skaftin_system_users WHERE email = $1`,
          [email]
        );

        if (existingUser.rows.length > 0) {
          return ResponseUtils.error(res, '❌ Email already registered', null, null, 409);
        }
      }

      // Check if phone already exists (if phone is provided and email is not required or not provided)
      if (phone && !email) {
        const existingPhoneUser = await AppAuthController.pool.query(
          `SELECT id FROM ${schemaName}.skaftin_system_users WHERE phone = $1`,
          [phone]
        );

        if (existingPhoneUser.rows.length > 0) {
          return ResponseUtils.error(res, 'Phone number already registered:' , null, 409);
        }
      }

      // Determine if user should be active immediately or wait for OTP verification
      // User is inactive if otp_method is provided (email or sms)
      const isActive = !otp_method; // Active immediately if no OTP method specified

      // Create project-scoped email for SuperTokens (allows same email across projects)
      // For phone-only users (no email), generate a placeholder email using phone number
      let supertokensEmail: string;
      if (email) {
        supertokensEmail = createProjectScopedEmail(email, projectId);
      } else {
        // Generate a placeholder email for phone-only users
        // Format: phone_<phone>@project_<projectId>.skaftin.local
        const sanitizedPhone = phone.replace(/[^0-9]/g, '');
        supertokensEmail = `phone_${sanitizedPhone}@project_${projectId}.skaftin.local`;
      }

      // Create SuperTokens user
      const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, password);

      if (signUpResponse.status !== "OK") {
        if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
          if (email) {
            return ResponseUtils.error(res, 'Email already registered', null, null, 409);
          } else if (phone) {
            return ResponseUtils.error(res, 'Phone number already registered', null, null, 409);
          } else {
            return ResponseUtils.error(res, 'Email and phone number already registered', null, {signUpResponse}, 409);
          }
        }
        console.error('SuperTokens signup failed:', signUpResponse);
        return ResponseUtils.error(res, 'Failed to create user account', null, null, 500);
      }

      const supertokensUserId = signUpResponse.user.id;

      // Create app user in database
      const insertResult = await AppAuthController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_users 
         (supertokens_user_id, name, last_name, email, phone, metadata, custom_field_1, custom_field_2, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false)
         RETURNING id, name, last_name, email, phone, custom_field_1, custom_field_2, is_active, created_at`,
        [supertokensUserId, name, last_name || null, email || null, phone || null, JSON.stringify(metadata || {}), custom_field_1 || null, custom_field_2 || null, isActive]
      );

      const user = insertResult.rows[0];

      // Determine which role to assign
      let roleToAssign: number | null = null;

      // Priority 1: role_id from request body
      if (role_id) {
        roleToAssign = parseInt(role_id);
      }
      // Priority 2: role_key from request body
      else if (role_key) {
        const roleByKeyResult = await AppAuthController.pool.query(
          `SELECT id FROM ${schemaName}.skaftin_system_roles WHERE role_key = $1`,
          [role_key]
        );
        if (roleByKeyResult.rows.length > 0) {
          roleToAssign = roleByKeyResult.rows[0].id;
        } else {
          return ResponseUtils.error(res, `Role with key "${role_key}" not found`, null, null, 404);
        }
      }
      // Priority 3: default role from settings
      else {
        const defaultRoleResult = await AppAuthController.pool.query(
          'SELECT default_role_id FROM skaftin_system_auth_settings WHERE project_id = $1',
          [projectId]
        );
        if (defaultRoleResult.rows.length > 0 && defaultRoleResult.rows[0].default_role_id) {
          roleToAssign = defaultRoleResult.rows[0].default_role_id;
        }
      }

      // Assign role if found
      let userRoles: any[] = [];
      if (roleToAssign) {
        // Verify role exists
        const roleExistsResult = await AppAuthController.pool.query(
          `SELECT id FROM ${schemaName}.skaftin_system_roles WHERE id = $1`,
          [roleToAssign]
        );

        if (roleExistsResult.rows.length === 0) {
          return ResponseUtils.error(res, `Role with ID ${roleToAssign} not found`, null, null, 404);
        }

        // Check if role assignment already exists (shouldn't happen during registration, but handle gracefully)
        const existingAssignment = await AppAuthController.pool.query(
          `SELECT id FROM ${schemaName}.skaftin_system_user_roles 
           WHERE app_user_id = $1 AND role_id = $2`,
          [user.id, roleToAssign]
        );

        if (existingAssignment.rows.length === 0) {
          await AppAuthController.pool.query(
            `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
           VALUES ($1, $2)`,
            [user.id, roleToAssign]
          );
        }

        // Fetch the assigned role with organization fields
        const roleResult = await AppAuthController.pool.query(
          `SELECT id, role_name, role_key, organisation_field_name, organisation_lookup_table, organisation_lookup_field
           FROM ${schemaName}.skaftin_system_roles
           WHERE id = $1`,
          [roleToAssign]
        );
        if (roleResult.rows.length > 0) {
          userRoles = [roleResult.rows[0]];
        }
      }

      console.log(`✅ App user registered: ${email || phone} (Project: ${projectId})`);

      // Resolve organization context based on user's roles
      const { OrganizationContextResolver } = await import('../utils/OrganizationContextResolver');
      const orgContext = await OrganizationContextResolver.resolveOrganisationContext(
        {
          id: user.id,
          organisation_id: null, // New user, no organisation_id yet
        },
        userRoles,
        AppAuthController.pool,
        schemaName
      );

      // Convert to RecipeUserId for session creation
      const recipeUserId = convertToRecipeUserId(supertokensUserId);

      // Create SuperTokens session with project context and organization info
      const session = await Session.createNewSession(req, res, "public", recipeUserId, {
        projectId: projectId,
        appUserId: user.id.toString(),
        email: user.email,
        roles: userRoles,
        organisation_name: orgContext.organisation_name,
        organisation_id: orgContext.organisation_id,
        is_admin: orgContext.is_admin,
      }, {});

      // Get session token (for header-based auth)
      // SuperTokens handles refresh tokens automatically via the refresh endpoint
      const accessToken = session.getAccessToken();

      // ============================================
      // SEND OTP BASED ON METHOD
      // ============================================

      let otpSent = false;
      let otpMethod: string | null = null;

      if (otp_method === 'email') {
        // Send OTP via email
        if (!emailSettings.email_provider_id) {
          return ResponseUtils.error(res, 'Email provider not configured for this project', null, null, 500);
        }

        const otp = AppAuthController.generateOTP(emailSettings.otp_length || 6);
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        console.log(`📧 Sending OTP via email to ${email}...`);

        const registrationResult = await AppAuthController.emailService.sendRegistrationEmail(
          projectId,
          email,
          name,
          otp
        );

        if (registrationResult.success) {
          console.log('   └─ ✅ OTP email sent');

          // Store OTP in database table
          await AppAuthController.pool.query(
            `INSERT INTO ${schemaName}.skaftin_system_otp_verifications 
             (user_id, otp_code, otp_method, destination, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, otp, 'email', email, otpExpiresAt]
          );

          otpSent = true;
          otpMethod = 'email';
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP email:', registrationResult.error);
          // If OTP email fails, activate user immediately (don't block registration)
          await AppAuthController.pool.query(
            `UPDATE ${schemaName}.skaftin_system_users SET is_active = true WHERE id = $1`,
            [user.id]
          );
          user.is_active = true;
        }
      } else if (otp_method === 'sms') {
        // Send OTP via SMS
        const otp = AppAuthController.generateOTP(emailSettings.otp_length || 6);
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        console.log(`📱 Sending OTP via SMS to ${phone}...`);

        const smsResult = await AppAuthController.smsOtpService.sendOTP(
          projectId.toString(),
          phone,
          otp,
          name
        );

        if (smsResult.success) {
          console.log('   └─ ✅ OTP SMS sent');

          // Store OTP in database table
          await AppAuthController.pool.query(
            `INSERT INTO ${schemaName}.skaftin_system_otp_verifications 
             (user_id, otp_code, otp_method, destination, expires_at)
             VALUES ($1, $2, $3, $4, $5)`,
            [user.id, otp, 'sms', phone, otpExpiresAt]
          );

          otpSent = true;
          otpMethod = 'sms';
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP SMS:', smsResult.error);
          // If OTP SMS fails, activate user immediately (don't block registration)
          await AppAuthController.pool.query(
            `UPDATE ${schemaName}.skaftin_system_users SET is_active = true WHERE id = $1`,
            [user.id]
          );
          user.is_active = true;
        }
      }

      // Send welcome email if no OTP required, welcome email is enabled, and user has email
      if (!otp_method && emailSettings.send_welcome_email && emailSettings.email_provider_id && email) {
        console.log(`📧 Sending welcome email to ${email}...`);

        const welcomeResult = await AppAuthController.emailService.sendWelcomeEmail(
          projectId,
          email,
          name
        );

        if (welcomeResult.success) {
          console.log('   └─ ✅ Welcome email sent');
        } else {
          console.warn('   └─ ⚠️ Failed to send welcome email:', welcomeResult.error);
        }
      }

      // Note: Email/SMS sending failures are logged but don't prevent registration
      // User can still log in and use the app

      let responseMessage = 'User registered successfully';
      if (otpSent && otpMethod === 'email') {
        responseMessage = 'User registered successfully. Please check your email for the OTP code to activate your account.';
      } else if (otpSent && otpMethod === 'sms') {
        responseMessage = 'User registered successfully. Please check your phone for the OTP code to activate your account.';
      }

      ResponseUtils.success(res, responseMessage, {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          custom_field_1: user.custom_field_1,
          custom_field_2: user.custom_field_2,
          is_active: user.is_active,
        },
        organisation: {
          name: orgContext.organisation_name,
          id: orgContext.organisation_id,
          is_admin: orgContext.is_admin,
        },
        session: {
          accessToken,
          // Refresh token is handled automatically by SuperTokens via /auth/session/refresh endpoint
        },
        requires_otp_verification: otpSent,
        otp_method: otpMethod,
        message: otpSent
          ? `Check your ${otpMethod} for OTP code. Your account will be activated after verification.`
          : 'Account is active and ready to use.'
      }, 201);
    } catch (error) {
      console.error('Error registering app user:', error);
      ResponseUtils.error(res, 'Failed to register user', error);
    }
  }

  /**
   * Login an app user
   * POST /api/app-auth/auth/login (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/login
   * 
   * Request body: { username: string, password: string, method: 'email' | 'phone' | 'custom_field_1' | 'custom_field_2' }
   */
  static async login(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { username, password, method } = req.body;

      // Validate required fields
      if (!username || !password) {
        return ResponseUtils.error(res, 'Username and password are required', null, null, 400);
      }

      if (!method) {
        return ResponseUtils.error(res, 'Method is required. Use: "email", "phone", "custom_field_1", or "custom_field_2"', null, null, 400);
      }

      // Validate method
      const validMethods = ['email', 'phone', 'custom_field_1', 'custom_field_2'];
      if (!validMethods.includes(method)) {
        return ResponseUtils.error(res, `Invalid method. Must be one of: ${validMethods.join(', ')}`, null, null, 400);
      }

      // Check if auth is enabled
      const settingsResult = await AppAuthController.pool.query(
        'SELECT auth_enabled FROM skaftin_system_auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auth_enabled) {
        return ResponseUtils.error(res, 'Authentication is not enabled for this project', null, null, 403);
      }

      // Build WHERE clause based on method
      let whereClause: string;
      switch (method) {
        case 'email':
          whereClause = 'u.email = $1';
          break;
        case 'phone':
          whereClause = 'u.phone = $1';
          break;
        case 'custom_field_1':
          whereClause = 'u.custom_field_1 = $1';
          break;
        case 'custom_field_2':
          whereClause = 'u.custom_field_2 = $1';
          break;
        default:
          return ResponseUtils.error(res, 'Invalid method', null, null, 400);
      }

      // Find user with full role details including organization fields
      const userResult = await AppAuthController.pool.query(
        `SELECT u.*, 
         COALESCE(
           json_agg(
             json_build_object(
               'id', r.id, 
               'role_name', r.role_name, 
               'role_key', r.role_key,
               'organisation_field_name', r.organisation_field_name,
               'organisation_lookup_table', r.organisation_lookup_table,
               'organisation_lookup_field', r.organisation_lookup_field
             )
           ) FILTER (WHERE r.id IS NOT NULL), 
           '[]'
         ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
         WHERE ${whereClause}
         GROUP BY u.id`,
        [username]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Invalid username or password', null, null, 401);
      }

      const user = userResult.rows[0];

      // Ensure user has either email or phone (for SuperTokens authentication)
      if (!user.email && !user.phone) {
        return ResponseUtils.error(res, 'User account is missing both email and phone', null, null, 500);
      }

      // Check if user is active
      if (!user.is_active) {
        // Check if user has pending OTP verification
        const metadata = user.metadata || {};
        if (metadata.otp) {
          return ResponseUtils.error(
            res,
            'Account pending verification. Please verify your account with the OTP code sent to you.',
            null,
            {
              requires_otp: true,
              user_id: user.id,
              email: user.email,
              phone: user.phone,
            },
            403
          );
        }

        return ResponseUtils.error(res, 'Account is inactive. Please contact support.', null, null, 403);
      }

      // Get SuperTokens email (project-scoped)
      // Note: SuperTokens always uses email, even if user logged in with phone/custom field
      // For phone-only users, generate the same placeholder email used during registration
      let supertokensEmail: string;
      if (user.email) {
        supertokensEmail = createProjectScopedEmail(user.email, projectId);
      } else {
        // Phone-only user - generate placeholder email
        const sanitizedPhone = user.phone.replace(/[^0-9]/g, '');
        supertokensEmail = `phone_${sanitizedPhone}@project_${projectId}.skaftin.local`;
      }

      // Verify credentials with SuperTokens
      let signInResponse = await EmailPassword.signIn("public", supertokensEmail, password);

      // If SuperTokens user doesn't exist but database user exists, create SuperTokens user
      if (signInResponse.status === "WRONG_CREDENTIALS_ERROR") {
        // Check if user has a password stored in database (for users created via admin panel)
        if (user.password) {
          // User was created via admin panel with password in database
          // Verify password against database, then create SuperTokens user
          const isValidPassword = await bcrypt.compare(password, user.password);

          if (!isValidPassword) {
            return ResponseUtils.error(res, 'Invalid username or password', null, null, 401);
          }

          // Password is correct, create SuperTokens user
          try {
            const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, password);

            if (signUpResponse.status === "OK") {
              // SuperTokens user created successfully, now try to sign in again
              signInResponse = await EmailPassword.signIn("public", supertokensEmail, password);

              // Clear the database password since we're now using SuperTokens
              await AppAuthController.pool.query(
                `UPDATE ${schemaName}.skaftin_system_users SET password = NULL WHERE id = $1`,
                [user.id]
              );
            } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
              // Email exists but password is wrong - try sign in again
              signInResponse = await EmailPassword.signIn("public", supertokensEmail, password);
            } else {
              console.error('Failed to create SuperTokens user:', signUpResponse);
              return ResponseUtils.error(res, 'Failed to create authentication account', null, null, 500);
            }
          } catch (error) {
            console.error('Error creating SuperTokens user:', error);
            return ResponseUtils.error(res, 'Failed to create authentication account', null, null, 500);
          }
        } else {
          // No password in database, try to create SuperTokens user with provided password
          try {
            const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, password);

            if (signUpResponse.status === "OK") {
              // SuperTokens user created successfully, now try to sign in again
              signInResponse = await EmailPassword.signIn("public", supertokensEmail, password);
            } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
              // Email exists but password is wrong
              return ResponseUtils.error(res, 'Invalid username or password', null, null, 401);
            } else {
              console.error('Failed to create SuperTokens user:', signUpResponse);
              return ResponseUtils.error(res, 'Failed to create authentication account', null, null, 500);
            }
          } catch (error) {
            console.error('Error creating SuperTokens user:', error);
            return ResponseUtils.error(res, 'Invalid username or password', null, null, 401);
          }
        }
      }

      if (signInResponse.status !== "OK") {
        return ResponseUtils.error(res, 'Invalid username or password', null, null, 401);
      }

      const supertokensUserId = signInResponse.user.id;

      // Sync SuperTokens user ID - always update if it's missing or doesn't match
      // Since we successfully authenticated, the SuperTokens user ID from the response is authoritative
      if (!user.supertokens_user_id || user.supertokens_user_id !== supertokensUserId) {
        if (user.supertokens_user_id && user.supertokens_user_id !== supertokensUserId) {
          // ID exists but doesn't match - this can happen if:
          // - User was created in SuperTokens separately
          // - Password was reset, creating a new SuperTokens user
          // - Multiple SuperTokens users exist (edge case)
          // Since we successfully authenticated, update the database with the correct ID
          console.warn(`⚠️  SuperTokens user ID mismatch detected for user ${user.id} (${user.email}):`);
          console.warn(`   Database: ${user.supertokens_user_id}`);
          console.warn(`   SuperTokens: ${supertokensUserId}`);
          console.warn(`   Updating database with correct SuperTokens user ID...`);
        } else {
          // First time syncing (null in database)
          console.log(`✅ Syncing SuperTokens user ID for user ${user.id} (${user.email}): ${supertokensUserId}`);
        }

        // Always update with the SuperTokens user ID from successful authentication
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_users 
           SET supertokens_user_id = $1 
           WHERE id = $2`,
          [supertokensUserId, user.id]
        );
        user.supertokens_user_id = supertokensUserId;
      }

      // Resolve organization context based on user's roles
      const { OrganizationContextResolver } = await import('../utils/OrganizationContextResolver');
      console.log(`[AppAuthController] Resolving organization context for user ${user.id}`);
      console.log(`[AppAuthController] User roles:`, JSON.stringify(user.roles, null, 2));

      const orgContext = await OrganizationContextResolver.resolveOrganisationContext(
        {
          id: user.id,
          organisation_id: user.organisation_id,
        },
        user.roles || [],
        AppAuthController.pool,
        schemaName
      );

      console.log(`[AppAuthController] Resolved organization context:`, JSON.stringify(orgContext, null, 2));

      // Convert to RecipeUserId for session creation
      const recipeUserId = convertToRecipeUserId(supertokensUserId);

      // Create SuperTokens session with project context and organization info
      const session = await Session.createNewSession(req, res, "public", recipeUserId, {
        projectId: projectId,
        appUserId: user.id.toString(),
        email: user.email,
        roles: user.roles || [],
        organisation_name: orgContext.organisation_name,
        organisation_id: orgContext.organisation_id,
        is_admin: orgContext.is_admin,
      }, {});

      // Get session token (for header-based auth)
      // SuperTokens handles refresh tokens automatically via the refresh endpoint
      const accessToken = session.getAccessToken();

      console.log(`✅ App user logged in: ${user.email} (Method: ${method}, Project: ${projectId})`);

      // Remove password from response (not used anymore, but keep for compatibility)
      delete user.password;
      delete user.supertokens_user_id; // Don't expose SuperTokens user ID

      ResponseUtils.success(res, 'Login successful', {
        user,
        organisation: {
          name: orgContext.organisation_name,
          id: orgContext.organisation_id,
          is_admin: orgContext.is_admin,
        },
        session: {
          accessToken,
          // Refresh token is handled automatically by SuperTokens via /auth/session/refresh endpoint
        },
      });
    } catch (error) {
      console.error('Error logging in app user:', error);
      ResponseUtils.error(res, 'Failed to login', error);
    }
  }

  /**
   * Single credential login (passwordless)
   * POST /api/app-auth/auth/single-credential-login (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/single-credential-login
   * 
   * Request body: { credential: string, method: 'email' | 'phone' | 'custom_field_1' | 'custom_field_2' }
   */
  static async singleCredentialLogin(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { credential, method } = req.body;

      // Validate required fields
      if (!credential) {
        return ResponseUtils.error(res, 'Credential is required', null, null, 400);
      }

      if (!method) {
        return ResponseUtils.error(res, 'Method is required. Use: "email", "phone", "custom_field_1", or "custom_field_2"', null, null, 400);
      }

      // Validate method
      const validMethods = ['email', 'phone', 'custom_field_1', 'custom_field_2'];
      if (!validMethods.includes(method)) {
        return ResponseUtils.error(res, `Invalid method. Must be one of: ${validMethods.join(', ')}`, null, null, 400);
      }

      // Check if auth is enabled
      const settingsResult = await AppAuthController.pool.query(
        'SELECT auth_enabled FROM skaftin_system_auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auth_enabled) {
        return ResponseUtils.error(res, 'Authentication is not enabled for this project', null, null, 403);
      }

      // Build WHERE clause based on method
      let whereClause: string;
      switch (method) {
        case 'email':
          whereClause = 'u.email = $1';
          break;
        case 'phone':
          whereClause = 'u.phone = $1';
          break;
        case 'custom_field_1':
          whereClause = 'u.custom_field_1 = $1';
          break;
        case 'custom_field_2':
          whereClause = 'u.custom_field_2 = $1';
          break;
        default:
          return ResponseUtils.error(res, 'Invalid method', null, null, 400);
      }

      // Find user with full role details including organization fields
      const userResult = await AppAuthController.pool.query(
        `SELECT u.*, 
         COALESCE(
           json_agg(
             json_build_object(
               'id', r.id, 
               'role_name', r.role_name, 
               'role_key', r.role_key,
               'organisation_field_name', r.organisation_field_name,
               'organisation_lookup_table', r.organisation_lookup_table,
               'organisation_lookup_field', r.organisation_lookup_field
             )
           ) FILTER (WHERE r.id IS NOT NULL), 
           '[]'
         ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
         WHERE ${whereClause}
         GROUP BY u.id`,
        [credential]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 401);
      }

      const user = userResult.rows[0];

      // Ensure user has either email or phone (for SuperTokens authentication)
      if (!user.email && !user.phone) {
        return ResponseUtils.error(res, 'User account is missing both email and phone', null, null, 500);
      }

      // Check if user is active
      if (!user.is_active) {
        // Check if user has pending OTP verification
        const metadata = user.metadata || {};
        if (metadata.otp) {
          return ResponseUtils.error(
            res,
            'Account pending verification. Please verify your account with the OTP code sent to you.',
            null,
            {
              requires_otp: true,
              user_id: user.id,
              email: user.email,
              phone: user.phone,
            },
            403
          );
        }

        return ResponseUtils.error(res, 'Account is inactive. Please contact support.', null, null, 403);
      }

      // Get SuperTokens email (project-scoped)
      // For phone-only users, generate the same placeholder email used during registration
      let supertokensEmail: string;
      if (user.email) {
        supertokensEmail = createProjectScopedEmail(user.email, projectId);
      } else {
        // Phone-only user - generate placeholder email
        const sanitizedPhone = user.phone.replace(/[^0-9]/g, '');
        supertokensEmail = `phone_${sanitizedPhone}@project_${projectId}.skaftin.local`;
      }

      // Get or create SuperTokens user
      let supertokensUserId: string;

      // First, check if we have supertokens_user_id in database
      if (user.supertokens_user_id) {
        supertokensUserId = user.supertokens_user_id;
        console.log(`✅ Using existing SuperTokens user ID from database: ${supertokensUserId}`);
      } else {
        // Check if SuperTokens user exists by email
        try {
          const users = await listUsersByAccountInfo("public", {
            email: supertokensEmail,
          });

          if (users.length > 0) {
            supertokensUserId = users[0].id;
            console.log(`✅ Found existing SuperTokens user: ${supertokensUserId}`);

            // Sync the ID to database
            await AppAuthController.pool.query(
              `UPDATE ${schemaName}.skaftin_system_users 
               SET supertokens_user_id = $1 
               WHERE id = $2`,
              [supertokensUserId, user.id]
            );
          } else {
            // SuperTokens user doesn't exist - create one with a random password
            // Note: SuperTokens EmailPassword recipe requires a password, but we won't verify it for passwordless login
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, randomPassword);

            if (signUpResponse.status === "OK") {
              supertokensUserId = signUpResponse.user.id;
              console.log(`✅ Created new SuperTokens user: ${supertokensUserId}`);

              // Store the SuperTokens user ID in database
              await AppAuthController.pool.query(
                `UPDATE ${schemaName}.skaftin_system_users 
                 SET supertokens_user_id = $1 
                 WHERE id = $2`,
                [supertokensUserId, user.id]
              );
            } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
              // Email exists but we didn't find it - try to get it again
              const usersRetry = await listUsersByAccountInfo("public", {
                email: supertokensEmail,
              });
              if (usersRetry.length > 0) {
                supertokensUserId = usersRetry[0].id;
                await AppAuthController.pool.query(
                  `UPDATE ${schemaName}.skaftin_system_users 
                   SET supertokens_user_id = $1 
                   WHERE id = $2`,
                  [supertokensUserId, user.id]
                );
              } else {
                console.error('Failed to create or find SuperTokens user:', signUpResponse);
                return ResponseUtils.error(res, 'Failed to create authentication account', null, null, 500);
              }
            } else {
              console.error('Failed to create SuperTokens user:', signUpResponse);
              return ResponseUtils.error(res, 'Failed to create authentication account', null, null, 500);
            }
          }
        } catch (error) {
          console.error('Error checking/creating SuperTokens user:', error);
          return ResponseUtils.error(res, 'Failed to authenticate user', null, null, 500);
        }
      }

      // Resolve organization context based on user's roles
      const { OrganizationContextResolver } = await import('../utils/OrganizationContextResolver');
      console.log(`[AppAuthController] Resolving organization context for user ${user.id}`);
      console.log(`[AppAuthController] User roles:`, JSON.stringify(user.roles, null, 2));

      const orgContext = await OrganizationContextResolver.resolveOrganisationContext(
        {
          id: user.id,
          organisation_id: user.organisation_id,
        },
        user.roles || [],
        AppAuthController.pool,
        schemaName
      );

      console.log(`[AppAuthController] Resolved organization context:`, JSON.stringify(orgContext, null, 2));

      // Convert to RecipeUserId for session creation
      const recipeUserId = convertToRecipeUserId(supertokensUserId);

      // Create SuperTokens session with project context and organization info
      const session = await Session.createNewSession(req, res, "public", recipeUserId, {
        projectId: projectId,
        appUserId: user.id.toString(),
        email: user.email,
        roles: user.roles || [],
        organisation_name: orgContext.organisation_name,
        organisation_id: orgContext.organisation_id,
        is_admin: orgContext.is_admin,
      }, {});

      // Get session token (for header-based auth)
      // SuperTokens handles refresh tokens automatically via the refresh endpoint
      const accessToken = session.getAccessToken();

      console.log(`✅ App user logged in with single credential: ${user.email} (Method: ${method}, Project: ${projectId})`);

      // Remove password from response (not used anymore, but keep for compatibility)
      delete user.password;
      delete user.supertokens_user_id; // Don't expose SuperTokens user ID

      ResponseUtils.success(res, 'Login successful', {
        user,
        organisation: {
          name: orgContext.organisation_name,
          id: orgContext.organisation_id,
          is_admin: orgContext.is_admin,
        },
        session: {
          accessToken,
          // Refresh token is handled automatically by SuperTokens via /auth/session/refresh endpoint
        },
      });
    } catch (error) {
      console.error('Error in single credential login:', error);
      ResponseUtils.error(res, 'Failed to login', error);
    }
  }

  /**
   * Request OTP for passwordless login
   * 
   * Sends an OTP code to the user's email or phone for passwordless authentication.
   * The user can then verify the OTP to receive their login session.
   * 
   * POST /app-api/auth/otp-login (with x-api-key or x-access-token)
   * POST /app-api/:projectId/auth/otp-login (backward compatibility)
   * 
   * Request body: { email?: string, phone?: string }
   * - At least one of email or phone is required
   * - If email provided, OTP sent via email
   * - If phone provided (and no email), OTP sent via SMS
   */
  static async requestOTPLogin(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { email, phone, otp: customOtp } = req.body;

      // Validate: at least one identifier is required
      if (!email && !phone) {
        return ResponseUtils.error(res, 'Either email or phone is required', null, null, 400);
      }

      // Determine OTP method based on provided identifier
      const otpMethod: 'email' | 'sms' = email ? 'email' : 'sms';
      const identifier = email || phone;
      const identifierType = email ? 'email' : 'phone';
      console.log(`🔐 [requestOTPLogin] Processing OTP login request for: ${identifier} (${identifierType})${customOtp ? ' [custom OTP provided]' : ''}`);

      // Check if auth is enabled and get settings
      const settingsResult = await AppAuthController.pool.query(
        `SELECT auth_enabled, email_provider_id, otp_length
         FROM skaftin_system_auth_settings WHERE project_id = $1`,
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auth_enabled) {
        return ResponseUtils.error(res, 'Authentication is not enabled for this project', null, null, 403);
      }

      const authSettings = settingsResult.rows[0];

      // Look up user by email or phone
      let userResult;
      if (email) {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone, is_active FROM ${schemaName}.skaftin_system_users WHERE email = $1`,
          [email]
        );
      } else {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone, is_active FROM ${schemaName}.skaftin_system_users WHERE phone = $1`,
          [phone]
        );
      }

      if (userResult.rows.length === 0) {
        const identifierName = email ? 'email' : 'phone number';
        return ResponseUtils.error(res, `No account found with the provided ${identifierName}`, null, null, 404);
      }

      const user = userResult.rows[0];

      console.log(`   └─ User found: ${user.email || user.phone}`);

      // Check if user is active
      if (!user.is_active) {
        return ResponseUtils.error(res, 'Account is inactive. Please contact support.', null, null, 403);
      }

      // Validate that the delivery method can be used
      if (otpMethod === 'sms' && !user.phone) {
        return ResponseUtils.error(res, 'Phone number not available for this account. Please use email.', null, null, 400);
      }
      if (otpMethod === 'email' && !user.email) {
        return ResponseUtils.error(res, 'Email not available for this account. Please use phone.', null, null, 400);
      }

      // Use the caller-provided OTP or generate one with configurable length
      const otp = customOtp ? String(customOtp) : AppAuthController.generateOTP(authSettings.otp_length || 6);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any existing pending OTP login codes for this user
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND purpose = 'otp_login' AND status = 'pending'`,
        [user.id]
      );

      // Store OTP in database
      await AppAuthController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_otp_verifications 
         (user_id, otp_code, otp_method, destination, expires_at, purpose)
         VALUES ($1, $2, $3, $4, $5, 'otp_login')`,
        [user.id, otp, otpMethod, otpMethod === 'email' ? user.email : user.phone, otpExpiresAt]
      );

      console.log(`   └─ OTP ${customOtp ? 'accepted from caller' : 'generated'} and stored for OTP login`);

      // Send OTP based on method
      let otpSent = false;
      let errorMessage: string | undefined;

      if (otpMethod === 'email') {
        if (!authSettings.email_provider_id) {
          return ResponseUtils.error(res, 'Email provider not configured for this project', null, null, 500);
        }

        console.log(`📧 Sending OTP login code via email to ${user.email}...`);

        // Send via email
        const emailResult = await AppAuthController.emailService.sendRegistrationEmail(
          projectId,
          user.email,
          user.name,
          otp
        );

        if (emailResult.success) {
          console.log('   └─ ✅ OTP email sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP email:', emailResult.error);
          errorMessage = emailResult.error;
        }
      } else if (otpMethod === 'sms') {
        console.log(`📱 Sending OTP login code via SMS to ${user.phone}...`);

        const smsResult = await AppAuthController.smsOtpService.sendOTP(
          projectId.toString(),
          user.phone,
          otp,
          user.name
        );

        if (smsResult.success) {
          console.log('   └─ ✅ OTP SMS sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP SMS:', smsResult.error);
          errorMessage = smsResult.error;
        }
      }

      if (!otpSent) {
        return ResponseUtils.error(
          res,
          `Failed to send OTP via ${otpMethod}`,
          null,
          errorMessage,
          500
        );
      }

      ResponseUtils.success(res, `OTP sent successfully via ${otpMethod}`, {
        message: `A verification code has been sent to your ${otpMethod}. Please check and enter the code.`,
        method: otpMethod,
        destination: otpMethod === 'email'
          ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email
          : user.phone.replace(/(\d{3})(\d*)(\d{2})/, '$1***$3'), // Mask phone
      });
    } catch (error) {
      console.error('Error requesting OTP login:', error);
      ResponseUtils.error(res, 'Failed to send OTP', error);
    }
  }

  /**
   * Verify OTP and complete passwordless login
   * 
   * Verifies the OTP code and returns the user's login session if valid.
   * 
   * POST /app-api/auth/verify-otp-login (with x-api-key or x-access-token)
   * POST /app-api/:projectId/auth/verify-otp-login (backward compatibility)
   * 
   * Request body: { email?: string, phone?: string, code: string }
   * - At least one of email or phone is required (same as used in requestOTPLogin)
   * - code: The OTP code received
   */
  static async verifyOTPLogin(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { email, phone, code } = req.body;

      // Validate: at least one identifier is required
      if (!email && !phone) {
        return ResponseUtils.error(res, 'Either email or phone is required', null, null, 400);
      }

      if (!code) {
        return ResponseUtils.error(res, 'OTP code is required', null, null, 400);
      }

      const identifier = email || phone;
      const identifierType = email ? 'email' : 'phone';
      console.log(`🔐 [verifyOTPLogin] Verifying OTP login for: ${identifier} (${identifierType})`);

      // Get user with full role details by email or phone
      let userResult;
      if (email) {
        userResult = await AppAuthController.pool.query(
          `SELECT u.*, 
           COALESCE(
             json_agg(
               json_build_object(
                 'id', r.id, 
                 'role_name', r.role_name, 
                 'role_key', r.role_key,
                 'organisation_field_name', r.organisation_field_name,
                 'organisation_lookup_table', r.organisation_lookup_table,
                 'organisation_lookup_field', r.organisation_lookup_field
               )
             ) FILTER (WHERE r.id IS NOT NULL), 
             '[]'
           ) as roles
          FROM ${schemaName}.skaftin_system_users u
          LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
          LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
           WHERE u.email = $1
           GROUP BY u.id`,
          [email]
        );
      } else {
        userResult = await AppAuthController.pool.query(
          `SELECT u.*, 
           COALESCE(
             json_agg(
               json_build_object(
                 'id', r.id, 
                 'role_name', r.role_name, 
                 'role_key', r.role_key,
                 'organisation_field_name', r.organisation_field_name,
                 'organisation_lookup_table', r.organisation_lookup_table,
                 'organisation_lookup_field', r.organisation_lookup_field
               )
             ) FILTER (WHERE r.id IS NOT NULL), 
             '[]'
           ) as roles
          FROM ${schemaName}.skaftin_system_users u
          LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
          LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
           WHERE u.phone = $1
           GROUP BY u.id`,
          [phone]
        );
      }

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      console.log('   └─ User found:', user.email || user.phone);

      // Get pending OTP login record
      const otpResult = await AppAuthController.pool.query(
        `SELECT id, otp_code, otp_method, expires_at, attempts 
         FROM ${schemaName}.skaftin_system_otp_verifications 
         WHERE user_id = $1 AND purpose = 'otp_login' AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id]
      );

      if (otpResult.rows.length === 0) {
        return ResponseUtils.error(
          res,
          'No pending OTP found. Please request a new login code.',
          null,
          null,
          400
        );
      }

      const otpRecord = otpResult.rows[0];

      // Check if OTP is expired
      const expiresAt = new Date(otpRecord.expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'OTP code has expired. Please request a new login code.',
          null,
          null,
          400
        );
      }

      // Check if max attempts reached
      if (otpRecord.attempts >= 3) {
        // Mark as failed
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'Maximum verification attempts exceeded. Please request a new login code.',
          null,
          null,
          400
        );
      }

      // Verify OTP code
      if (otpRecord.otp_code !== code) {
        // Increment attempts
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        const remainingAttempts = 3 - (otpRecord.attempts + 1);
        return ResponseUtils.error(
          res,
          `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
          null,
          null,
          400
        );
      }

      console.log('   └─ ✅ OTP verified successfully');

      // Mark OTP as verified
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [otpRecord.id]
      );

      // Check if user is active
      if (!user.is_active) {
        return ResponseUtils.error(res, 'Account is inactive. Please contact support.', null, null, 403);
      }

      // Ensure user has either email or phone (for SuperTokens authentication)
      if (!user.email && !user.phone) {
        return ResponseUtils.error(res, 'User account is missing both email and phone', null, null, 500);
      }

      // Get SuperTokens email (project-scoped)
      // For phone-only users, generate the same placeholder email used during registration
      let supertokensEmail: string;
      if (user.email) {
        supertokensEmail = createProjectScopedEmail(user.email, projectId);
      } else {
        // Phone-only user - generate placeholder email
        const sanitizedPhone = user.phone.replace(/[^0-9]/g, '');
        supertokensEmail = `phone_${sanitizedPhone}@project_${projectId}.skaftin.local`;
      }

      // Get or create SuperTokens user
      let supertokensUserId: string;

      // First, check if we have supertokens_user_id in database
      if (user.supertokens_user_id) {
        supertokensUserId = user.supertokens_user_id;
        console.log(`✅ Using existing SuperTokens user ID from database: ${supertokensUserId}`);
      } else {
        // Check if SuperTokens user exists by email
        try {
          const users = await listUsersByAccountInfo("public", {
            email: supertokensEmail,
          });

          if (users.length > 0) {
            supertokensUserId = users[0].id;
            console.log(`✅ Found existing SuperTokens user: ${supertokensUserId}`);

            // Sync the ID to database
            await AppAuthController.pool.query(
              `UPDATE ${schemaName}.skaftin_system_users 
               SET supertokens_user_id = $1 
               WHERE id = $2`,
              [supertokensUserId, user.id]
            );
          } else {
            // SuperTokens user doesn't exist - create one with a random password
            const randomPassword = crypto.randomBytes(32).toString('hex');
            const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, randomPassword);

            if (signUpResponse.status === "OK") {
              supertokensUserId = signUpResponse.user.id;
              console.log(`✅ Created new SuperTokens user: ${supertokensUserId}`);

              // Store the SuperTokens user ID in database
              await AppAuthController.pool.query(
                `UPDATE ${schemaName}.skaftin_system_users 
                 SET supertokens_user_id = $1 
                 WHERE id = $2`,
                [supertokensUserId, user.id]
              );
            } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
              // Email exists but we didn't find it - try to get it again
              const usersRetry = await listUsersByAccountInfo("public", {
                email: supertokensEmail,
              });
              if (usersRetry.length > 0) {
                supertokensUserId = usersRetry[0].id;
                await AppAuthController.pool.query(
                  `UPDATE ${schemaName}.skaftin_system_users 
                   SET supertokens_user_id = $1 
                   WHERE id = $2`,
                  [supertokensUserId, user.id]
                );
              } else {
                console.error('Failed to create or find SuperTokens user:', signUpResponse);
                return ResponseUtils.error(res, 'Failed to create authentication account', null, null, 500);
              }
            } else {
              console.error('Failed to create SuperTokens user:', signUpResponse);
              return ResponseUtils.error(res, 'Failed to create authentication account', null, null, 500);
            }
          }
        } catch (error) {
          console.error('Error checking/creating SuperTokens user:', error);
          return ResponseUtils.error(res, 'Failed to authenticate user', null, null, 500);
        }
      }

      // Resolve organization context based on user's roles
      const { OrganizationContextResolver } = await import('../utils/OrganizationContextResolver');
      console.log(`[verifyOTPLogin] Resolving organization context for user ${user.id}`);

      const orgContext = await OrganizationContextResolver.resolveOrganisationContext(
        {
          id: user.id,
          organisation_id: user.organisation_id,
        },
        user.roles || [],
        AppAuthController.pool,
        schemaName
      );

      console.log(`[verifyOTPLogin] Resolved organization context:`, JSON.stringify(orgContext, null, 2));

      // Convert to RecipeUserId for session creation
      const recipeUserId = convertToRecipeUserId(supertokensUserId);

      // Create SuperTokens session with project context and organization info
      const session = await Session.createNewSession(req, res, "public", recipeUserId, {
        projectId: projectId,
        appUserId: user.id.toString(),
        email: user.email,
        roles: user.roles || [],
        organisation_name: orgContext.organisation_name,
        organisation_id: orgContext.organisation_id,
        is_admin: orgContext.is_admin,
      }, {});

      // Get session token
      const accessToken = session.getAccessToken();

      console.log(`✅ App user logged in via OTP: ${user.email} (Project: ${projectId})`);

      // Remove sensitive data from response
      delete user.password;
      delete user.supertokens_user_id;

      ResponseUtils.success(res, 'Login successful', {
        user,
        organisation: {
          name: orgContext.organisation_name,
          id: orgContext.organisation_id,
          is_admin: orgContext.is_admin,
        },
        session: {
          accessToken,
        },
      });
    } catch (error) {
      console.error('Error verifying OTP login:', error);
      ResponseUtils.error(res, 'Failed to verify OTP', error);
    }
  }

  /**
   * Verify app user session
   * POST /api/app-auth/auth/verify (with SuperTokens session token)
   * POST /api/app-auth/:projectId/auth/verify (backward compatibility)
   */
  static async verify(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Use SuperTokens session verification middleware
      // This will be handled by the route middleware, but we need to get user info
      const sessionToken = req.headers.authorization?.replace('Bearer ', '');

      if (!sessionToken) {
        return ResponseUtils.error(res, 'No session token provided', null, null, 401);
      }

      // Verify session using SuperTokens
      const session = await Session.getSession(req, res, {
        sessionRequired: true,
        antiCsrfCheck: false,
      });

      if (!session) {
        return ResponseUtils.error(res, 'Invalid or expired session', null, null, 401);
      }

      const supertokensUserId = session.getUserId();
      const sessionData = session.getAccessTokenPayload();

      // Verify project matches
      if (sessionData.projectId !== projectId) {
        return ResponseUtils.error(res, 'Session does not match project context', null, null, 403);
      }

      // Get fresh user data
      const userResult = await AppAuthController.pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.is_active,
         COALESCE(
           json_agg(
             json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
           ) FILTER (WHERE r.id IS NOT NULL), 
           '[]'
         ) as roles
         FROM ${schemaName}.skaftin_system_users u
         LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
         LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
         WHERE u.supertokens_user_id = $1
         GROUP BY u.id`,
        [supertokensUserId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      if (!user.is_active) {
        return ResponseUtils.error(res, 'Account is inactive', null, null, 403);
      }

      ResponseUtils.success(res, 'Token is valid', { user });
    } catch (error: any) {
      console.error('Error verifying app user session:', error);
      return ResponseUtils.error(res, 'Failed to verify session', error, null, 401);
    }
  }

  /**
   * Logout app user (SuperTokens session revocation)
   * POST /api/app-auth/auth/logout
   * POST /api/app-auth/:projectId/auth/logout (backward compatibility)
   */
  static async logout(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Revoke SuperTokens session
      const session = await Session.getSession(req, res, {
        sessionRequired: false,
        antiCsrfCheck: false,
      });

      if (session) {
        await session.revokeSession();
        console.log('✅ App user session revoked');
      }

      ResponseUtils.success(res, 'Logged out successfully');
    } catch (error) {
      console.error('Error logging out app user:', error);
      // Still return success even if session revoke fails
      ResponseUtils.success(res, 'Logged out successfully');
    }
  }

  /**
   * Verify OTP code (public endpoint for user self-verification)
   * POST /api/app-auth/auth/verify-otp (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/verify-otp (backward compatibility)
   */
  static async verifyOTP(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { user_id, email, code } = req.body;

      if ((!user_id && !email) || !code) {
        return ResponseUtils.error(res, 'User ID (or email) and OTP code are required', null, null, 400);
      }

      console.log('🔐 [verifyOTP] Verifying OTP for user registration...');

      // Get user
      let userQuery = '';
      let queryParams: any[] = [];

      if (user_id) {
        userQuery = `SELECT id, name, last_name, email, phone, is_active FROM ${schemaName}.skaftin_system_users WHERE id = $1`;
        queryParams = [parseInt(user_id)];
      } else {
        userQuery = `SELECT id, name, last_name, email, phone, is_active FROM ${schemaName}.skaftin_system_users WHERE email = $1`;
        queryParams = [email];
      }

      const userResult = await AppAuthController.pool.query(userQuery, queryParams);

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      console.log('   └─ User found:', user.email);
      console.log('   └─ User active status:', user.is_active);

      // Get pending OTP record
      const otpResult = await AppAuthController.pool.query(
        `SELECT id, otp_code, otp_method, expires_at, attempts 
         FROM ${schemaName}.skaftin_system_otp_verifications 
         WHERE user_id = $1 AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id]
      );

      if (otpResult.rows.length === 0) {
        return ResponseUtils.error(
          res,
          'No pending OTP found for this user. OTP may have already been verified or expired.',
          null,
          null,
          400
        );
      }

      const otpRecord = otpResult.rows[0];

      // Check if OTP is expired
      const expiresAt = new Date(otpRecord.expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'OTP code has expired. Please request a new OTP code.',
          null,
          null,
          400
        );
      }

      // Check if max attempts reached
      if (otpRecord.attempts >= 3) {
        // Mark as failed
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'Maximum verification attempts exceeded. Please request a new OTP code.',
          null,
          null,
          400
        );
      }

      // Verify OTP code
      if (otpRecord.otp_code !== code) {
        // Increment attempts
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        const remainingAttempts = 3 - (otpRecord.attempts + 1);
        return ResponseUtils.error(
          res,
          `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
          null,
          null,
          400
        );
      }

      console.log('   └─ ✅ OTP verified successfully');

      // Mark OTP as verified
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [otpRecord.id]
      );

      // Activate user and mark as verified based on OTP method
      const verificationField = otpRecord.otp_method === 'email' ? 'email_verified' : 'phone_verified';
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users 
         SET is_active = true,
             ${verificationField} = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id]
      );

      console.log('   └─ ✅ User activated and email verified');

      // Check if welcome email should be sent
      const settingsResult = await AppAuthController.pool.query(
        'SELECT send_welcome_email, email_provider_id FROM skaftin_system_auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (settingsResult.rows.length > 0) {
        const emailSettings = settingsResult.rows[0];

        if (emailSettings.send_welcome_email && emailSettings.email_provider_id) {
          console.log('📧 Sending welcome email...');

          const welcomeResult = await AppAuthController.emailService.sendWelcomeEmail(
            projectId,
            user.email,
            user.name
          );

          if (welcomeResult.success) {
            console.log('   └─ ✅ Welcome email sent');
          } else {
            console.warn('   └─ ⚠️ Failed to send welcome email:', welcomeResult.error);
          }
        }
      }

      ResponseUtils.success(res, 'OTP verified successfully', {
        message: 'Your account has been activated. You can now log in.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_active: true,
          email_verified: true,
        },
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      ResponseUtils.error(res, 'Failed to verify OTP', error);
    }
  }

  /**
   * Send forgot password OTP
   * 
   * Sends a one-time password to the user's email or phone for password reset.
   * This endpoint is for APP USERS only (not platform admins).
   * 
   * Security Features:
   * - No user enumeration (same response for non-existent emails)
   * - OTP expires in 10 minutes
   * - Invalidates previous password reset OTPs
   * - Masked email/phone in response
   * 
   * POST /api/app-auth/auth/forgot-password (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/forgot-password (backward compatibility)
   * 
   * Request body: { email?: string, phone?: string, method: 'email' | 'sms' }
   * - At least one of email or phone is required
   * - If only phone provided, method must be 'sms'
   * - If only email provided, method defaults to 'email'
   */
  static async sendForgotPasswordOTP(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { email, phone, method } = req.body;

      // Validate: at least one identifier is required
      if (!email && !phone) {
        return ResponseUtils.error(res, 'Either email or phone is required', null, null, 400);
      }

      // Determine OTP method and validate
      let otpMethod: 'email' | 'sms';
      if (phone && !email) {
        // If only phone provided, method must be 'sms'
        if (method && method !== 'sms') {
          return ResponseUtils.error(res, 'When using phone number, method must be "sms"', null, null, 400);
        }
        otpMethod = 'sms';
      } else if (email && !phone) {
        // If only email provided, method defaults to 'email'
        otpMethod = method || 'email';
      } else {
        // Both provided, use method or default to 'email'
        otpMethod = method || 'email';
      }

      // Validate method value
      if (!['email', 'sms'].includes(otpMethod)) {
        return ResponseUtils.error(res, 'Invalid method. Must be "email" or "sms"', null, null, 400);
      }

      const identifier = email || phone;
      const identifierType = email ? 'email' : 'phone';
      console.log(`🔐 [sendForgotPasswordOTP] Processing forgot password request for: ${identifier} (${identifierType})`);

      // Check if password reset is enabled
      const settingsResult = await AppAuthController.pool.query(
        `SELECT auth_enabled, enable_password_reset, email_provider_id, otp_length
         FROM skaftin_system_auth_settings WHERE project_id = $1`,
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].auth_enabled) {
        return ResponseUtils.error(res, 'Authentication is not enabled for this project', null, null, 403);
      }

      if (!settingsResult.rows[0].enable_password_reset) {
        return ResponseUtils.error(res, 'Password reset is disabled for this project', null, null, 403);
      }

      const authSettings = settingsResult.rows[0];

      // Check if user exists - look up by email or phone
      let userResult;
      if (email) {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone FROM ${schemaName}.skaftin_system_users WHERE email = $1`,
          [email]
        );
      } else {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone FROM ${schemaName}.skaftin_system_users WHERE phone = $1`,
          [phone]
        );
      }

      if (userResult.rows.length === 0) {
        // For security, don't reveal if user exists or not
        const identifierName = email ? 'email' : 'phone number';
        return ResponseUtils.success(res, `If the ${identifierName} exists, an OTP code has been sent`, {
          message: `If the ${identifierName} exists in our system, you will receive an OTP code shortly.`,
        });
      }

      const user = userResult.rows[0];

      console.log(`   └─ User found: ${user.email || user.phone}`);

      // Validate that the delivery method can be used
      if (otpMethod === 'sms' && !user.phone) {
        return ResponseUtils.error(res, 'Phone number not available for this account. Please use email method.', null, null, 400);
      }
      if (otpMethod === 'email' && !user.email) {
        return ResponseUtils.error(res, 'Email not available for this account. Please use SMS method.', null, null, 400);
      }

      // Generate OTP code with configurable length
      const otp = AppAuthController.generateOTP(authSettings.otp_length || 6);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Invalidate any existing pending password reset OTPs for this user
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND purpose = 'password_reset' AND status = 'pending'`,
        [user.id]
      );

      // Store OTP in database
      await AppAuthController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_otp_verifications 
         (user_id, otp_code, otp_method, destination, expires_at, purpose)
         VALUES ($1, $2, $3, $4, $5, 'password_reset')`,
        [user.id, otp, otpMethod, otpMethod === 'email' ? user.email : user.phone, otpExpiresAt]
      );

      console.log(`   └─ OTP generated and stored`);

      // Send OTP based on method
      let otpSent = false;
      let errorMessage: string | undefined;

      if (otpMethod === 'email') {
        if (!authSettings.email_provider_id) {
          return ResponseUtils.error(res, 'Email provider not configured for this project', null, null, 500);
        }

        console.log(`📧 Sending password reset OTP via email to ${user.email}...`);

        // Send via email using custom message
        const emailResult = await AppAuthController.emailService.sendPasswordResetOTP(
          projectId,
          user.email,
          user.name,
          otp
        );

        if (emailResult.success) {
          console.log('   └─ ✅ OTP email sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP email:', emailResult.error);
          errorMessage = emailResult.error;
        }
      } else if (otpMethod === 'sms') {
        console.log(`📱 Sending password reset OTP via SMS to ${user.phone}...`);

        const smsResult = await AppAuthController.smsOtpService.sendPasswordResetOTP(
          projectId.toString(),
          user.phone,
          otp,
          user.name
        );

        if (smsResult.success) {
          console.log('   └─ ✅ OTP SMS sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP SMS:', smsResult.error);
          errorMessage = smsResult.error;
        }
      }

      if (!otpSent) {
        return ResponseUtils.error(
          res,
          `Failed to send OTP via ${otpMethod}`,
          null,
          errorMessage,
          500
        );
      }

      ResponseUtils.success(res, `OTP sent successfully via ${otpMethod}`, {
        message: `A verification code has been sent to your ${otpMethod}. Please check and enter the code.`,
        method: otpMethod,
        destination: otpMethod === 'email'
          ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email
          : user.phone.replace(/(\d{3})(\d*)(\d{2})/, '$1***$3'), // Mask phone
      });
    } catch (error) {
      console.error('Error sending forgot password OTP:', error);
      ResponseUtils.error(res, 'Failed to send OTP', error);
    }
  }

  /**
   * Verify forgot password OTP
   * 
   * Verifies the OTP code sent to the user and returns a short-lived reset token.
   * 
   * Security Features:
   * - Max 3 verification attempts
   * - OTP expires in 10 minutes
   * - Reset token expires in 15 minutes
   * - One-time use OTP (marked as verified after success)
   * 
   * POST /api/app-auth/auth/verify-forgot-password-otp (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/verify-forgot-password-otp (backward compatibility)
   * 
   * Request body: { email?: string, phone?: string, code: string }
   * - At least one of email or phone is required
   * Response: { reset_token: string, expires_in_minutes: 15 }
   */
  static async verifyForgotPasswordOTP(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { email, phone, code } = req.body;

      // Validate: at least one identifier is required
      if (!email && !phone) {
        return ResponseUtils.error(res, 'Either email or phone is required', null, null, 400);
      }

      if (!code) {
        return ResponseUtils.error(res, 'OTP code is required', null, null, 400);
      }

      const identifier = email || phone;
      const identifierType = email ? 'email' : 'phone';
      console.log(`🔐 [verifyForgotPasswordOTP] Verifying password reset OTP for: ${identifier} (${identifierType})`);

      // Get user by email or phone
      let userResult;
      if (email) {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone FROM ${schemaName}.skaftin_system_users WHERE email = $1`,
          [email]
        );
      } else {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone FROM ${schemaName}.skaftin_system_users WHERE phone = $1`,
          [phone]
        );
      }

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      console.log('   └─ User found:', user.email || user.phone);

      // Get pending password reset OTP record
      const otpResult = await AppAuthController.pool.query(
        `SELECT id, otp_code, otp_method, expires_at, attempts 
         FROM ${schemaName}.skaftin_system_otp_verifications 
         WHERE user_id = $1 AND purpose = 'password_reset' AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id]
      );

      if (otpResult.rows.length === 0) {
        return ResponseUtils.error(
          res,
          'No pending OTP found. Please request a new password reset code.',
          null,
          null,
          400
        );
      }

      const otpRecord = otpResult.rows[0];

      // Check if OTP is expired
      const expiresAt = new Date(otpRecord.expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'OTP code has expired. Please request a new password reset code.',
          null,
          null,
          400
        );
      }

      // Check if max attempts reached
      if (otpRecord.attempts >= 3) {
        // Mark as failed
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'Maximum verification attempts exceeded. Please request a new password reset code.',
          null,
          null,
          400
        );
      }

      // Verify OTP code
      if (otpRecord.otp_code !== code) {
        // Increment attempts
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        const remainingAttempts = 3 - (otpRecord.attempts + 1);
        return ResponseUtils.error(
          res,
          `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
          null,
          null,
          400
        );
      }

      console.log('   └─ ✅ OTP verified successfully');

      // Mark OTP as verified
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [otpRecord.id]
      );

      // Generate a short-lived reset token for the password reset step
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      // Store reset token in user metadata
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users 
         SET metadata = jsonb_set(
               jsonb_set(COALESCE(metadata, '{}'), '{password_reset_token}', $1::jsonb),
               '{password_reset_expires_at}', $2::jsonb
             ),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [JSON.stringify(resetToken), JSON.stringify(resetTokenExpiresAt.toISOString()), user.id]
      );

      console.log('   └─ ✅ Reset token generated');

      ResponseUtils.success(res, 'OTP verified successfully', {
        message: 'OTP verified. You can now reset your password.',
        reset_token: resetToken,
        expires_in_minutes: 15,
      });
    } catch (error) {
      console.error('Error verifying forgot password OTP:', error);
      ResponseUtils.error(res, 'Failed to verify OTP', error);
    }
  }

  /**
   * Reset password after OTP verification
   * 
   * Updates the user's password in SuperTokens after verifying the reset token.
   * Handles SuperTokens user sync automatically to prevent ID mismatches.
   * 
   * Process:
   * 1. Validates reset token (15-minute expiry)
   * 2. Deletes old SuperTokens user (cleanup)
   * 3. Creates fresh SuperTokens user with new password
   * 4. Syncs database with new SuperTokens user ID
   * 5. Clears reset token and invalidates OTPs
   * 
   * Security Features:
   * - Minimum 8-character password
   * - Reset token expires in 15 minutes
   * - One-time use token
   * - Automatic SuperTokens user cleanup
   * - Project-scoped (app users isolated from platform admins)
   * 
   * POST /api/app-auth/auth/reset-password (with x-api-key or x-access-token)
   * POST /api/app-auth/:projectId/auth/reset-password (backward compatibility)
   * 
   * Request body: { email?: string, phone?: string, reset_token: string, new_password: string }
   * - At least one of email or phone is required
   */
  static async resetPassword(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware (extracted from API key/token) or URL param
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found. Provide x-api-key, x-access-token, or projectId in URL.', null, null, 404);
      }

      const { email, phone, reset_token, new_password } = req.body;

      // Validate: at least one identifier is required
      if (!email && !phone) {
        return ResponseUtils.error(res, 'Either email or phone is required', null, null, 400);
      }

      if (!reset_token || !new_password) {
        return ResponseUtils.error(res, 'Reset token and new password are required', null, null, 400);
      }

      // Validate password strength (minimum 8 characters)
      if (new_password.length < 8) {
        return ResponseUtils.error(res, 'Password must be at least 8 characters long', null, null, 400);
      }

      const identifier = email || phone;
      const identifierType = email ? 'email' : 'phone';
      console.log(`🔐 [resetPassword] Processing password reset for: ${identifier} (${identifierType})`);

      // Get user with metadata by email or phone
      let userResult;
      if (email) {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone, metadata, supertokens_user_id FROM ${schemaName}.skaftin_system_users WHERE email = $1`,
          [email]
        );
      } else {
        userResult = await AppAuthController.pool.query(
          `SELECT id, name, last_name, email, phone, metadata, supertokens_user_id FROM ${schemaName}.skaftin_system_users WHERE phone = $1`,
          [phone]
        );
      }

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      const metadata = user.metadata || {};

      console.log('   └─ User found:', user.email || user.phone);

      // Verify reset token
      if (!metadata.password_reset_token || metadata.password_reset_token !== reset_token) {
        return ResponseUtils.error(res, 'Invalid or expired reset token', null, null, 400);
      }

      // Check if token is expired
      const expiresAt = new Date(metadata.password_reset_expires_at);
      if (!metadata.password_reset_expires_at || expiresAt < new Date()) {
        return ResponseUtils.error(res, 'Reset token has expired. Please request a new password reset.', null, null, 400);
      }

      console.log('   └─ Reset token verified');

      // Update password in SuperTokens
      const supertokensEmail = createProjectScopedEmail(user.email, projectId);
      let supertokensUserId = user.supertokens_user_id;

      try {
        // Check if user has a SuperTokens account
        if (!supertokensUserId) {
          console.log('   └─ No SuperTokens user ID found, creating SuperTokens user...');

          // Create SuperTokens user with the new password
          const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, new_password);

          if (signUpResponse.status === "OK") {
            supertokensUserId = signUpResponse.user.id;
            console.log('   └─ ✅ SuperTokens user created:', supertokensUserId);

            // Update database with SuperTokens user ID
            await AppAuthController.pool.query(
              `UPDATE ${schemaName}.skaftin_system_users 
               SET supertokens_user_id = $1 
               WHERE id = $2`,
              [supertokensUserId, user.id]
            );
          } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
            console.log('   └─ SuperTokens user already exists, updating password...');
            // User exists in SuperTokens but ID not in our database - fetch and update
            const signInResponse = await EmailPassword.signIn("public", supertokensEmail, new_password);
            if (signInResponse.status === "OK") {
              supertokensUserId = signInResponse.user.id;

              // Update password
              const updateResponse = await EmailPassword.updateEmailOrPassword({
                recipeUserId: convertToRecipeUserId(supertokensUserId),
                password: new_password,
              });

              if (updateResponse.status !== 'OK') {
                console.error('Failed to update password in SuperTokens:', updateResponse);
                return ResponseUtils.error(res, 'Failed to update password', null, null, 500);
              }

              // Update database with SuperTokens user ID
              await AppAuthController.pool.query(
                `UPDATE ${schemaName}.skaftin_system_users 
                 SET supertokens_user_id = $1 
                 WHERE id = $2`,
                [supertokensUserId, user.id]
              );
            } else {
              console.error('Failed to sign in to SuperTokens:', signInResponse);
              return ResponseUtils.error(res, 'Failed to update password', null, null, 500);
            }
          } else {
            console.error('Failed to create SuperTokens user:', signUpResponse);
            return ResponseUtils.error(res, 'Failed to update password', null, null, 500);
          }
        } else {
          console.log('   └─ Found existing SuperTokens user ID in database:', supertokensUserId);
          console.log('   └─ Cleaning up and recreating SuperTokens user to ensure consistency...');

          try {
            // Clean up approach: Delete old SuperTokens user and create fresh one
            // This ensures no duplicate users exist and fixes any ID mismatches

            // Step 1: Try to delete the old SuperTokens user
            try {
              const { deleteUser } = await import('supertokens-node');
              await deleteUser(supertokensUserId);
              console.log('   └─ ✅ Old SuperTokens user deleted:', supertokensUserId);
            } catch (deleteError) {
              console.log('   └─ Could not delete old user (may not exist):', deleteError);
            }


            // Step 3: Create fresh SuperTokens user with new password
            console.log('   └─ Creating fresh SuperTokens user...');
            const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, new_password);

            if (signUpResponse.status === "OK") {
              const newSupertokensUserId = signUpResponse.user.id;
              console.log('   └─ ✅ Fresh SuperTokens user created:', newSupertokensUserId);

              // Update database with new SuperTokens user ID
              await AppAuthController.pool.query(
                `UPDATE ${schemaName}.skaftin_system_users 
                 SET supertokens_user_id = $1 
                 WHERE id = $2`,
                [newSupertokensUserId, user.id]
              );

              console.log('   └─ ✅ Database updated with new SuperTokens user ID');
            } else if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
              // Email still exists - try to get the user and update password
              console.log('   └─ Email already exists, attempting to update password...');

              // Try to sign in with new password (maybe it was already set?)
              let actualUserId: string | null = null;
              const signInResponse = await EmailPassword.signIn("public", supertokensEmail, new_password);

              if (signInResponse.status === "OK") {
                actualUserId = signInResponse.user.id;
                console.log('   └─ Password already correct, user ID:', actualUserId);
              } else {
                // Password not set yet - we need to find and update the user
                // This is a tricky situation - we'll need to use a different approach
                console.error('   └─ Unable to authenticate or create user. Manual intervention may be required.');
                return ResponseUtils.error(
                  res,
                  'Failed to reset password. Please contact support.',
                  null,
                  null,
                  500
                );
              }

              // Update database with correct user ID
              if (actualUserId) {
                await AppAuthController.pool.query(
                  `UPDATE ${schemaName}.skaftin_system_users 
                   SET supertokens_user_id = $1 
                   WHERE id = $2`,
                  [actualUserId, user.id]
                );
                console.log('   └─ ✅ Database updated with correct user ID');
              }
            } else {
              console.error('Failed to create SuperTokens user:', signUpResponse);
              return ResponseUtils.error(res, 'Failed to update password', null, null, 500);
            }
          } catch (updateError: any) {
            console.error('   └─ Error during password reset:', updateError);
            return ResponseUtils.error(res, 'Failed to update password', updateError, null, 500);
          }
        }

        console.log('   └─ ✅ Password updated in SuperTokens');
      } catch (error) {
        console.error('Error updating password in SuperTokens:', error);
        return ResponseUtils.error(res, 'Failed to update password', error, null, 500);
      }

      // Clear reset token from metadata
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users 
         SET metadata = metadata - 'password_reset_token' - 'password_reset_expires_at',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id]
      );

      console.log('   └─ ✅ Reset token cleared');

      // Invalidate all password reset OTPs for this user
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND purpose = 'password_reset' AND status IN ('pending', 'verified')`,
        [user.id]
      );

      console.log('✅ Password reset successfully for:', user.email);

      ResponseUtils.success(res, 'Password reset successfully', {
        message: 'Your password has been reset successfully. You can now log in with your new password.',
      });
    } catch (error) {
      console.error('Error resetting password:', error);
      ResponseUtils.error(res, 'Failed to reset password', error);
    }
  }

  /**
   * Request password change for logged-in user
   * 
   * Allows authenticated users to change their password with optional OTP verification.
   * If OTP is required (based on project settings), sends OTP via email/SMS and stores
   * the new password temporarily. If not required, changes password immediately.
   * 
   * Security Features:
   * - Requires old password verification (prevents unauthorized changes)
   * - Optional OTP verification (configurable per project)
   * - Minimum 8-character new password
   * - Session remains valid after password change
   * 
   * POST /api/app-auth/auth/change-password-request
   * 
   * Request body: { old_password: string, new_password: string, otp_method?: 'email' | 'sms' }
   */
  static async changePasswordRequest(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // This endpoint requires authentication - user must be logged in
      // The appUserAuthMiddleware should have already populated req.appUser
      if (!req.appUser || !req.appUser.userId) {
        return ResponseUtils.error(res, 'Authentication required', null, null, 401);
      }

      const { old_password, new_password, otp_method } = req.body;

      if (!old_password || !new_password) {
        return ResponseUtils.error(res, 'Old password and new password are required', null, null, 400);
      }

      // Validate new password strength
      if (new_password.length < 8) {
        return ResponseUtils.error(res, 'New password must be at least 8 characters long', null, null, 400);
      }

      // Prevent using the same password
      if (old_password === new_password) {
        return ResponseUtils.error(res, 'New password must be different from old password', null, null, 400);
      }

      // Validate otp_method if provided
      if (otp_method && !['email', 'sms'].includes(otp_method)) {
        return ResponseUtils.error(res, 'Invalid otp_method. Must be "email" or "sms"', null, null, 400);
      }

      console.log('🔐 [changePasswordRequest] Processing password change request...');

      // Get user details
      const userResult = await AppAuthController.pool.query(
        `SELECT id, name, last_name, email, phone, supertokens_user_id FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [req.appUser.userId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      console.log('   └─ User found:', user.email);

      // Get auth settings to check if OTP is required
      const settingsResult = await AppAuthController.pool.query(
        `SELECT require_otp_for_password_change, email_provider_id, sms_provider_id, otp_length
         FROM skaftin_system_auth_settings WHERE project_id = $1`,
        [projectId]
      );

      if (settingsResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Auth settings not found', null, null, 404);
      }

      const settings = settingsResult.rows[0];
      const requireOTP = settings.require_otp_for_password_change || false;

      console.log('   └─ OTP required:', requireOTP);

      // Verify old password with SuperTokens
      const supertokensEmail = createProjectScopedEmail(user.email, projectId);
      const signInResponse = await EmailPassword.signIn("public", supertokensEmail, old_password);

      if (signInResponse.status !== "OK") {
        return ResponseUtils.error(res, 'Invalid old password', null, null, 401);
      }

      console.log('   └─ Old password verified');

      // If OTP is not required, change password immediately
      if (!requireOTP) {
        console.log('   └─ OTP not required, changing password immediately...');

        // Update password in SuperTokens
        const supertokensUserId = user.supertokens_user_id;
        if (!supertokensUserId) {
          return ResponseUtils.error(res, 'User authentication setup incomplete', null, null, 500);
        }

        const recipeUserId = convertToRecipeUserId(supertokensUserId);
        const updateResponse = await EmailPassword.updateEmailOrPassword({
          recipeUserId: recipeUserId,
          password: new_password,
        });

        if (updateResponse.status !== 'OK') {
          console.error('Failed to update password in SuperTokens:', updateResponse);
          return ResponseUtils.error(res, 'Failed to update password', null, null, 500);
        }

        console.log('   └─ ✅ Password changed successfully');

        return ResponseUtils.success(res, 'Password changed successfully', {
          message: 'Your password has been changed successfully.',
        });
      }

      // OTP is required - send OTP and store password change request
      const selectedOtpMethod = otp_method || 'email'; // Default to email

      // Validate that user has the required contact method
      if (selectedOtpMethod === 'sms' && !user.phone) {
        return ResponseUtils.error(res, 'Phone number not available. Please use email method.', null, null, 400);
      }

      if (selectedOtpMethod === 'email' && !settings.email_provider_id) {
        return ResponseUtils.error(res, 'Email provider not configured for this project', null, null, 500);
      }

      if (selectedOtpMethod === 'sms' && !settings.sms_provider_id) {
        return ResponseUtils.error(res, 'SMS provider not configured for this project', null, null, 500);
      }

      // Generate OTP with configurable length
      const otp = AppAuthController.generateOTP(settings.otp_length || 6);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      console.log(`   └─ Sending OTP via ${selectedOtpMethod}...`);

      // Invalidate any existing pending password change OTPs for this user
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND purpose = 'password_change' AND status = 'pending'`,
        [user.id]
      );

      // Store new password temporarily in OTP record metadata
      await AppAuthController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_otp_verifications 
         (user_id, otp_code, otp_method, destination, expires_at, purpose, metadata)
         VALUES ($1, $2, $3, $4, $5, 'password_change', $6)`,
        [
          user.id,
          otp,
          selectedOtpMethod,
          selectedOtpMethod === 'email' ? user.email : user.phone,
          otpExpiresAt,
          JSON.stringify({ new_password })
        ]
      );

      // Send OTP based on method
      let otpSent = false;
      let errorMessage: string | undefined;

      if (selectedOtpMethod === 'email') {
        console.log(`📧 Sending password change OTP via email to ${user.email}...`);

        const emailResult = await AppAuthController.emailService.sendPasswordChangeOTP(
          projectId,
          user.email,
          user.name,
          otp
        );

        if (emailResult.success) {
          console.log('   └─ ✅ OTP email sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP email:', emailResult.error);
          errorMessage = emailResult.error;
        }
      } else if (selectedOtpMethod === 'sms') {
        console.log(`📱 Sending password change OTP via SMS to ${user.phone}...`);

        const smsResult = await AppAuthController.smsOtpService.sendPasswordChangeOTP(
          projectId.toString(),
          user.phone,
          otp,
          user.name
        );

        if (smsResult.success) {
          console.log('   └─ ✅ OTP SMS sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP SMS:', smsResult.error);
          errorMessage = smsResult.error;
        }
      }

      if (!otpSent) {
        return ResponseUtils.error(
          res,
          `Failed to send OTP via ${selectedOtpMethod}`,
          null,
          errorMessage,
          500
        );
      }

      ResponseUtils.success(res, `OTP sent successfully via ${selectedOtpMethod}`, {
        message: `A verification code has been sent to your ${selectedOtpMethod}. Please enter the code to complete password change.`,
        requires_otp: true,
        otp_method: selectedOtpMethod,
        destination: selectedOtpMethod === 'email'
          ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
          : user.phone.replace(/(\d{3})(\d*)(\d{2})/, '$1***$3'),
      });
    } catch (error) {
      console.error('Error in changePasswordRequest:', error);
      ResponseUtils.error(res, 'Failed to process password change request', error);
    }
  }

  /**
   * Verify OTP and complete password change
   * 
   * Verifies the OTP code sent to the user and completes the password change.
   * The new password was stored temporarily when the OTP was sent.
   * 
   * Security Features:
   * - Max 3 verification attempts
   * - OTP expires in 10 minutes
   * - One-time use OTP
   * 
   * POST /api/app-auth/auth/verify-password-change-otp
   * 
   * Request body: { code: string }
   */
  static async verifyPasswordChangeOTP(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // This endpoint requires authentication
      if (!req.appUser || !req.appUser.userId) {
        return ResponseUtils.error(res, 'Authentication required', null, null, 401);
      }

      const { code } = req.body;

      if (!code) {
        return ResponseUtils.error(res, 'OTP code is required', null, null, 400);
      }

      console.log('🔐 [verifyPasswordChangeOTP] Verifying password change OTP...');

      // Get user
      const userResult = await AppAuthController.pool.query(
        `SELECT id, name, last_name, email, supertokens_user_id FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [req.appUser.userId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      console.log('   └─ User found:', user.email);

      // Get pending password change OTP record
      const otpResult = await AppAuthController.pool.query(
        `SELECT id, otp_code, otp_method, expires_at, attempts, metadata 
         FROM ${schemaName}.skaftin_system_otp_verifications 
         WHERE user_id = $1 AND purpose = 'password_change' AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id]
      );

      if (otpResult.rows.length === 0) {
        return ResponseUtils.error(
          res,
          'No pending password change OTP found. Please request a new password change.',
          null,
          null,
          400
        );
      }

      const otpRecord = otpResult.rows[0];

      // Check if OTP is expired
      const expiresAt = new Date(otpRecord.expires_at);
      if (expiresAt < new Date()) {
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'OTP code has expired. Please request a new password change.',
          null,
          null,
          400
        );
      }

      // Check if max attempts reached
      if (otpRecord.attempts >= 3) {
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'Maximum verification attempts exceeded. Please request a new password change.',
          null,
          null,
          400
        );
      }

      // Verify OTP code
      if (otpRecord.otp_code !== code) {
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        const remainingAttempts = 3 - (otpRecord.attempts + 1);
        return ResponseUtils.error(
          res,
          `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
          null,
          null,
          400
        );
      }

      console.log('   └─ ✅ OTP verified successfully');

      // Get new password from metadata
      const metadata = otpRecord.metadata || {};
      const newPassword = metadata.new_password;

      if (!newPassword) {
        return ResponseUtils.error(
          res,
          'Password change request invalid. Please try again.',
          null,
          null,
          400
        );
      }

      // Update password in SuperTokens
      const supertokensUserId = user.supertokens_user_id;
      if (!supertokensUserId) {
        return ResponseUtils.error(res, 'User authentication setup incomplete', null, null, 500);
      }

      const recipeUserId = convertToRecipeUserId(supertokensUserId);
      const updateResponse = await EmailPassword.updateEmailOrPassword({
        recipeUserId: recipeUserId,
        password: newPassword,
      });

      if (updateResponse.status !== 'OK') {
        console.error('Failed to update password in SuperTokens:', updateResponse);
        return ResponseUtils.error(res, 'Failed to update password', null, null, 500);
      }

      console.log('   └─ ✅ Password updated in SuperTokens');

      // Mark OTP as verified
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [otpRecord.id]
      );

      // Invalidate all other password change OTPs for this user
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND purpose = 'password_change' AND status = 'pending' AND id != $2`,
        [user.id, otpRecord.id]
      );

      console.log('✅ Password changed successfully for:', user.email);

      ResponseUtils.success(res, 'Password changed successfully', {
        message: 'Your password has been changed successfully. You can continue using your current session.',
      });
    } catch (error) {
      console.error('Error verifying password change OTP:', error);
      ResponseUtils.error(res, 'Failed to verify OTP', error);
    }
  }

  /**
   * Request account deletion for logged-in user
   * 
   * Allows authenticated users to request deletion of their account with optional OTP verification.
   * Account will be scheduled for deletion 7 days from the request.
   * 
   * Security Features:
   * - Requires password verification
   * - Optional OTP verification (configurable per project)
   * - 7-day grace period before final deletion
   * - Email notification sent
   * 
   * POST /api/app-auth/auth/request-account-deletion
   * 
   * Request body: { password: string, reason?: string, otp_method?: 'email' | 'sms' }
   */
  static async requestAccountDeletion(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // This endpoint requires authentication
      if (!req.appUser || !req.appUser.userId) {
        return ResponseUtils.error(res, 'Authentication required', null, null, 401);
      }

      const { password, reason, otp_method } = req.body;

      if (!password) {
        return ResponseUtils.error(res, 'Password is required', null, null, 400);
      }

      // Validate otp_method if provided
      if (otp_method && !['email', 'sms'].includes(otp_method)) {
        return ResponseUtils.error(res, 'Invalid otp_method. Must be "email" or "sms"', null, null, 400);
      }

      console.log('🗑️ [requestAccountDeletion] Processing account deletion request...');

      // Get user details
      const userResult = await AppAuthController.pool.query(
        `SELECT id, name, last_name, email, phone, supertokens_user_id, deletion_scheduled_at FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [req.appUser.userId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      console.log('   └─ User found:', user.email);

      // Check if deletion already scheduled
      if (user.deletion_scheduled_at) {
        const scheduledDate = new Date(user.deletion_scheduled_at);
        return ResponseUtils.error(
          res,
          `Account deletion already scheduled for ${scheduledDate.toISOString()}. You can cancel it before that date.`,
          null,
          null,
          409
        );
      }

      // Get auth settings to check if OTP is required
      const settingsResult = await AppAuthController.pool.query(
        `SELECT require_otp_for_account_deletion, email_provider_id, sms_provider_id, otp_length
         FROM skaftin_system_auth_settings WHERE project_id = $1`,
        [projectId]
      );

      if (settingsResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Auth settings not found', null, null, 404);
      }

      const settings = settingsResult.rows[0];
      const requireOTP = settings.require_otp_for_account_deletion || false;

      console.log('   └─ OTP required:', requireOTP);

      // Verify password with SuperTokens
      const supertokensEmail = createProjectScopedEmail(user.email, projectId);
      const signInResponse = await EmailPassword.signIn("public", supertokensEmail, password);

      if (signInResponse.status !== "OK") {
        return ResponseUtils.error(res, 'Invalid password', null, null, 401);
      }

      console.log('   └─ Password verified');

      // Calculate deletion date (7 days from now)
      const deletionDate = new Date();
      deletionDate.setDate(deletionDate.getDate() + 7);

      // If OTP is not required, schedule deletion immediately
      if (!requireOTP) {
        console.log('   └─ OTP not required, scheduling deletion immediately...');

        const now = new Date();
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_users 
           SET deletion_requested_at = $1,
               deletion_scheduled_at = $2,
               deletion_reason = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [now, deletionDate, reason || null, user.id]
        );

        // Send confirmation email
        console.log('📧 Sending account deletion scheduled email...');
        const emailResult = await AppAuthController.emailService.sendAccountDeletionScheduled(
          projectId,
          user.email,
          user.name,
          deletionDate
        );

        if (emailResult.success) {
          console.log('   └─ ✅ Confirmation email sent');
        } else {
          console.warn('   └─ ⚠️ Failed to send confirmation email:', emailResult.error);
        }

        return ResponseUtils.success(res, 'Account deletion scheduled', {
          message: `Your account will be deleted on ${deletionDate.toISOString()}. You can cancel this at any time before that date.`,
          scheduled_at: deletionDate.toISOString(),
        });
      }

      // OTP is required - send OTP
      const selectedOtpMethod = otp_method || 'email'; // Default to email

      // Validate that user has the required contact method
      if (selectedOtpMethod === 'sms' && !user.phone) {
        return ResponseUtils.error(res, 'Phone number not available. Please use email method.', null, null, 400);
      }

      if (selectedOtpMethod === 'email' && !settings.email_provider_id) {
        return ResponseUtils.error(res, 'Email provider not configured for this project', null, null, 500);
      }

      if (selectedOtpMethod === 'sms' && !settings.sms_provider_id) {
        return ResponseUtils.error(res, 'SMS provider not configured for this project', null, null, 500);
      }

      // Generate OTP with configurable length
      const otp = AppAuthController.generateOTP(settings.otp_length || 6);
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      console.log(`   └─ Sending OTP via ${selectedOtpMethod}...`);

      // Invalidate any existing pending account deletion OTPs for this user
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND purpose = 'account_deletion' AND status = 'pending'`,
        [user.id]
      );

      // Store deletion request temporarily in OTP metadata
      await AppAuthController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_otp_verifications 
         (user_id, otp_code, otp_method, destination, expires_at, purpose, metadata)
         VALUES ($1, $2, $3, $4, $5, 'account_deletion', $6)`,
        [
          user.id,
          otp,
          selectedOtpMethod,
          selectedOtpMethod === 'email' ? user.email : user.phone,
          otpExpiresAt,
          JSON.stringify({ reason, deletion_date: deletionDate.toISOString() })
        ]
      );

      // Send OTP based on method
      let otpSent = false;
      let errorMessage: string | undefined;

      if (selectedOtpMethod === 'email') {
        console.log(`📧 Sending account deletion OTP via email to ${user.email}...`);

        const emailResult = await AppAuthController.emailService.sendAccountDeletionOTP(
          projectId,
          user.email,
          user.name,
          otp
        );

        if (emailResult.success) {
          console.log('   └─ ✅ OTP email sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP email:', emailResult.error);
          errorMessage = emailResult.error;
        }
      } else if (selectedOtpMethod === 'sms') {
        console.log(`📱 Sending account deletion OTP via SMS to ${user.phone}...`);

        const smsResult = await AppAuthController.smsOtpService.sendAccountDeletionOTP(
          projectId.toString(),
          user.phone,
          otp,
          user.name
        );

        if (smsResult.success) {
          console.log('   └─ ✅ OTP SMS sent');
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send OTP SMS:', smsResult.error);
          errorMessage = smsResult.error;
        }
      }

      if (!otpSent) {
        return ResponseUtils.error(
          res,
          `Failed to send OTP via ${selectedOtpMethod}`,
          null,
          errorMessage,
          500
        );
      }

      ResponseUtils.success(res, `OTP sent successfully via ${selectedOtpMethod}`, {
        message: `A verification code has been sent to your ${selectedOtpMethod}. Please enter the code to confirm account deletion.`,
        requires_otp: true,
        otp_method: selectedOtpMethod,
        destination: selectedOtpMethod === 'email'
          ? user.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')
          : user.phone.replace(/(\d{3})(\d*)(\d{2})/, '$1***$3'),
      });
    } catch (error) {
      console.error('Error in requestAccountDeletion:', error);
      ResponseUtils.error(res, 'Failed to process account deletion request', error);
    }
  }

  /**
   * Verify OTP and complete account deletion scheduling
   * 
   * Verifies the OTP code sent to the user and schedules account deletion for 7 days later.
   * 
   * Security Features:
   * - Max 3 verification attempts
   * - OTP expires in 10 minutes
   * - One-time use OTP
   * 
   * POST /api/app-auth/auth/verify-account-deletion-otp
   * 
   * Request body: { code: string }
   */
  static async verifyAccountDeletionOTP(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // This endpoint requires authentication
      if (!req.appUser || !req.appUser.userId) {
        return ResponseUtils.error(res, 'Authentication required', null, null, 401);
      }

      const { code } = req.body;

      if (!code) {
        return ResponseUtils.error(res, 'OTP code is required', null, null, 400);
      }

      console.log('🔐 [verifyAccountDeletionOTP] Verifying account deletion OTP...');

      // Get user
      const userResult = await AppAuthController.pool.query(
        `SELECT id, name, email FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [req.appUser.userId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      console.log('   └─ User found:', user.email);

      // Get pending account deletion OTP record
      const otpResult = await AppAuthController.pool.query(
        `SELECT id, otp_code, otp_method, expires_at, attempts, metadata 
         FROM ${schemaName}.skaftin_system_otp_verifications 
         WHERE user_id = $1 AND purpose = 'account_deletion' AND status = 'pending'
         ORDER BY created_at DESC
         LIMIT 1`,
        [user.id]
      );

      if (otpResult.rows.length === 0) {
        return ResponseUtils.error(
          res,
          'No pending account deletion OTP found. Please request account deletion again.',
          null,
          null,
          400
        );
      }

      const otpRecord = otpResult.rows[0];

      // Check if OTP is expired
      const expiresAt = new Date(otpRecord.expires_at);
      if (expiresAt < new Date()) {
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'expired', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'OTP code has expired. Please request account deletion again.',
          null,
          null,
          400
        );
      }

      // Check if max attempts reached
      if (otpRecord.attempts >= 3) {
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET status = 'failed', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        return ResponseUtils.error(
          res,
          'Maximum verification attempts exceeded. Please request account deletion again.',
          null,
          null,
          400
        );
      }

      // Verify OTP code
      if (otpRecord.otp_code !== code) {
        await AppAuthController.pool.query(
          `UPDATE ${schemaName}.skaftin_system_otp_verifications 
           SET attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [otpRecord.id]
        );

        const remainingAttempts = 3 - (otpRecord.attempts + 1);
        return ResponseUtils.error(
          res,
          `Invalid OTP code. ${remainingAttempts} attempt(s) remaining.`,
          null,
          null,
          400
        );
      }

      console.log('   └─ ✅ OTP verified successfully');

      // Mark OTP as verified
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'verified', verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [otpRecord.id]
      );

      // Get deletion details from metadata
      const metadata = otpRecord.metadata || {};
      const reason = metadata.reason;
      const deletionDate = new Date(metadata.deletion_date || Date.now() + 7 * 24 * 60 * 60 * 1000);

      // Schedule deletion
      const now = new Date();
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users 
         SET deletion_requested_at = $1,
             deletion_scheduled_at = $2,
             deletion_reason = $3,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [now, deletionDate, reason || null, user.id]
      );

      console.log('   └─ ✅ Account deletion scheduled');

      // Send confirmation email
      console.log('📧 Sending account deletion scheduled email...');
      const emailResult = await AppAuthController.emailService.sendAccountDeletionScheduled(
        projectId,
        user.email,
        user.name,
        deletionDate
      );

      if (emailResult.success) {
        console.log('   └─ ✅ Confirmation email sent');
      } else {
        console.warn('   └─ ⚠️ Failed to send confirmation email:', emailResult.error);
      }

      // Invalidate all other account deletion OTPs for this user
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications 
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND purpose = 'account_deletion' AND status = 'pending' AND id != $2`,
        [user.id, otpRecord.id]
      );

      console.log('✅ Account deletion scheduled for:', user.email);

      ResponseUtils.success(res, 'Account deletion scheduled', {
        message: `Your account will be deleted on ${deletionDate.toISOString()}. You can cancel this at any time before that date.`,
        scheduled_at: deletionDate.toISOString(),
      });
    } catch (error) {
      console.error('Error verifying account deletion OTP:', error);
      ResponseUtils.error(res, 'Failed to verify OTP', error);
    }
  }

  /**
   * Cancel account deletion
   * 
   * Allows user to cancel a scheduled account deletion before the scheduled date.
   * 
   * Security Features:
   * - Requires password verification
   * - Can only cancel before deletion_scheduled_at
   * - Email confirmation sent
   * 
   * POST /api/app-auth/auth/cancel-account-deletion
   * 
   * Request body: { password: string }
   */
  static async cancelAccountDeletion(req: AppUserAuthenticatedRequest, res: Response) {
    try {
      // Get projectId from middleware
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const schemaName = req.schemaName || (projectId ? await AppAuthController.getProjectSchema(projectId) : null);

      if (!projectId || !schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // This endpoint requires authentication
      if (!req.appUser || !req.appUser.userId) {
        return ResponseUtils.error(res, 'Authentication required', null, null, 401);
      }

      const { password } = req.body;

      if (!password) {
        return ResponseUtils.error(res, 'Password is required', null, null, 400);
      }

      console.log('↩️ [cancelAccountDeletion] Processing account deletion cancellation...');

      // Get user details
      const userResult = await AppAuthController.pool.query(
        `SELECT id, name, last_name, email, supertokens_user_id, deletion_scheduled_at, deleted_at FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [req.appUser.userId]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      console.log('   └─ User found:', user.email);

      // Check if account already deleted
      if (user.deleted_at) {
        return ResponseUtils.error(res, 'Account has already been deleted', null, null, 410);
      }

      // Check if deletion is scheduled
      if (!user.deletion_scheduled_at) {
        return ResponseUtils.error(res, 'No account deletion scheduled', null, null, 404);
      }

      // Check if scheduled date has passed
      const scheduledDate = new Date(user.deletion_scheduled_at);
      if (scheduledDate <= new Date()) {
        return ResponseUtils.error(
          res,
          'Account deletion date has passed. Cannot cancel at this time.',
          null,
          null,
          400
        );
      }

      // Verify password with SuperTokens
      const supertokensEmail = createProjectScopedEmail(user.email, projectId);
      const signInResponse = await EmailPassword.signIn("public", supertokensEmail, password);

      if (signInResponse.status !== "OK") {
        return ResponseUtils.error(res, 'Invalid password', null, null, 401);
      }

      console.log('   └─ Password verified');

      // Cancel deletion
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users 
         SET deletion_requested_at = NULL,
             deletion_scheduled_at = NULL,
             deletion_reason = NULL,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id]
      );

      console.log('   └─ ✅ Account deletion cancelled');

      // Send cancellation confirmation email
      console.log('📧 Sending account deletion cancelled email...');
      const emailResult = await AppAuthController.emailService.sendAccountDeletionCancelled(
        projectId,
        user.email,
        user.name
      );

      if (emailResult.success) {
        console.log('   └─ ✅ Confirmation email sent');
      } else {
        console.warn('   └─ ⚠️ Failed to send confirmation email:', emailResult.error);
      }

      console.log('✅ Account deletion cancelled for:', user.email);

      ResponseUtils.success(res, 'Account deletion cancelled', {
        message: 'Your account deletion has been cancelled. Your account will remain active.',
      });
    } catch (error) {
      console.error('Error cancelling account deletion:', error);
      ResponseUtils.error(res, 'Failed to cancel account deletion', error);
    }
  }
}

export default AppAuthController;

