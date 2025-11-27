import { Response } from 'express';
import { Pool } from 'pg';
import ResponseUtils from '../utils/ResponseUtils';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { AppUserAuthenticatedRequest } from '../middleware/appUserAuthMiddleware';
import { AuthEmailService } from '../services/AuthEmailService';
import EmailPassword from "supertokens-node/recipe/emailpassword";
import Session from "supertokens-node/recipe/session";
import { convertToRecipeUserId } from "supertokens-node";
import { createProjectScopedEmail, extractOriginalEmail } from '../middleware/appUserSuperTokensMiddleware';

/**
 * Authentication controller for application users
 * Separate from platform admin authentication
 */
class AppAuthController {
  private static pool: Pool;
  private static emailService: AuthEmailService;

  static initialize(pool: Pool) {
    AppAuthController.pool = pool;
    AppAuthController.emailService = new AuthEmailService(pool);
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

      const { name, email, password, phone, metadata, custom_field_1, custom_field_2, role_id, role_key } = req.body;

      if (!name || !email || !password) {
        return ResponseUtils.error(res, 'Name, email, and password are required', null, null, 400);
      }

      // Check if registration is enabled and get email settings
      const settingsResult = await AppAuthController.pool.query(
        `SELECT registration_enabled, auth_enabled, email_provider_id,
                send_registration_email, send_verification_email, 
                send_welcome_email, require_email_verification
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

      // Check if email already exists in this project
      const existingUser = await AppAuthController.pool.query(
        `SELECT id FROM ${schemaName}.skaftin_system_users WHERE email = $1`,
        [email]
      );

      if (existingUser.rows.length > 0) {
        return ResponseUtils.error(res, 'Email already registered', null, null, 409);
      }

      // Determine if user should be active immediately or wait for OTP verification
      const requiresOTP = emailSettings.send_registration_email && emailSettings.email_provider_id;
      const isActive = !requiresOTP; // Active immediately if OTP not required

      // Create project-scoped email for SuperTokens (allows same email across projects)
      const supertokensEmail = createProjectScopedEmail(email, projectId);

      // Create SuperTokens user
      const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, password);

      if (signUpResponse.status !== "OK") {
        if (signUpResponse.status === "EMAIL_ALREADY_EXISTS_ERROR") {
          return ResponseUtils.error(res, 'Email already registered', null, null, 409);
        }
        console.error('SuperTokens signup failed:', signUpResponse);
        return ResponseUtils.error(res, 'Failed to create user account', null, null, 500);
      }

      const supertokensUserId = signUpResponse.user.id;

      // Create app user in database
      const insertResult = await AppAuthController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_users 
         (supertokens_user_id, name, email, phone, metadata, custom_field_1, custom_field_2, is_active, email_verified)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false)
         RETURNING id, name, email, phone, custom_field_1, custom_field_2, is_active, created_at`,
        [supertokensUserId, name, email, phone || null, JSON.stringify(metadata || {}), custom_field_1 || null, custom_field_2 || null, isActive]
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

        await AppAuthController.pool.query(
          `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
           VALUES ($1, $2)`,
          [user.id, roleToAssign]
        );

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

      console.log(`✅ App user registered: ${email} (Project: ${projectId})`);
      
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
      // SEND EMAILS BASED ON SETTINGS
      // ============================================

      let otpSent = false;

      // Send registration email (with OTP if configured)
      if (emailSettings.send_registration_email && emailSettings.email_provider_id) {
        const otp = crypto.randomInt(100000, 999999).toString();
        const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        
        console.log(`📧 Sending registration email with OTP to ${email}...`);
        
        const registrationResult = await AppAuthController.emailService.sendRegistrationEmail(
          projectId,
          email,
          name,
          otp
        );
        
        if (registrationResult.success) {
          console.log('   └─ ✅ Registration email sent with OTP');
          
          // Store OTP in user metadata
          await AppAuthController.pool.query(
            `UPDATE ${schemaName}.skaftin_system_users 
             SET metadata = jsonb_set(
               jsonb_set(COALESCE(metadata, '{}'), '{otp}', $1::jsonb),
               '{otp_expires_at}', $2::jsonb
             )
             WHERE id = $3`,
            [JSON.stringify(otp), JSON.stringify(otpExpiresAt.toISOString()), user.id]
          );
          
          otpSent = true;
        } else {
          console.warn('   └─ ⚠️ Failed to send registration email:', registrationResult.error);
          // If OTP email fails, activate user immediately (don't block registration)
          if (!user.is_active) {
            await AppAuthController.pool.query(
              `UPDATE ${schemaName}.skaftin_system_users SET is_active = true WHERE id = $1`,
              [user.id]
            );
            user.is_active = true;
          }
        }
      }

      // Send welcome email ONLY if OTP is not required
      // (If OTP required, welcome email is sent after OTP verification)
      if (!requiresOTP && emailSettings.send_welcome_email && emailSettings.email_provider_id) {
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

      // Note: Email sending failures are logged but don't prevent registration
      // User can still log in and use the app

      const responseMessage = otpSent 
        ? 'User registered successfully. Please check your email for the OTP code to activate your account.'
        : 'User registered successfully';

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
        session: {
          accessToken,
          // Refresh token is handled automatically by SuperTokens via /auth/session/refresh endpoint
        },
        requires_otp_verification: otpSent,
        message: otpSent 
          ? 'Check your email for OTP code. Your account will be activated after verification.'
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

      // Ensure user has an email (required for SuperTokens)
      if (!user.email) {
        return ResponseUtils.error(res, 'User account is missing email address', null, null, 500);
      }

      // Check if user is active
      if (!user.is_active) {
        // Check if user has pending OTP verification
        const metadata = user.metadata || {};
        if (metadata.otp) {
          return ResponseUtils.error(
            res,
            'Account pending verification. Please verify your email with the OTP code sent to you.',
            null,
            {
              requires_otp: true,
              user_id: user.id,
              email: user.email,
            },
            403
          );
        }
        
        return ResponseUtils.error(res, 'Account is inactive. Please contact support.', null, null, 403);
      }

      // Get SuperTokens email (project-scoped)
      // Note: SuperTokens always uses email, even if user logged in with phone/custom field
      const supertokensEmail = createProjectScopedEmail(user.email, projectId);

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

      // Sync SuperTokens user ID if it's missing or doesn't match
      if (!user.supertokens_user_id || user.supertokens_user_id !== supertokensUserId) {
        if (user.supertokens_user_id && user.supertokens_user_id !== supertokensUserId) {
          // If it exists but doesn't match, this is a real error (user might have been created differently)
          console.error(`SuperTokens user ID mismatch: ${user.supertokens_user_id} vs ${supertokensUserId}`);
          return ResponseUtils.error(res, 'User authentication mismatch', null, null, 500);
        }
        
        // If it's null, sync it (first time login or user was created before SuperTokens integration)
        console.log(`Syncing SuperTokens user ID for user ${user.id}: ${supertokensUserId}`);
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

      // Get user with OTP data
      let userQuery = '';
      let queryParams: any[] = [];

      if (user_id) {
        userQuery = `SELECT id, name, email, metadata, is_active FROM ${schemaName}.skaftin_system_users WHERE id = $1`;
        queryParams = [parseInt(user_id)];
      } else {
        userQuery = `SELECT id, name, email, metadata, is_active FROM ${schemaName}.skaftin_system_users WHERE email = $1`;
        queryParams = [email];
      }

      const userResult = await AppAuthController.pool.query(userQuery, queryParams);

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      const metadata = user.metadata || {};

      console.log('   └─ User found:', user.email);
      console.log('   └─ User active status:', user.is_active);

      // Check if OTP exists
      if (!metadata.otp) {
        return ResponseUtils.error(
          res,
          'No OTP found for this user. OTP may have already been verified or expired.',
          null,
          null,
          400
        );
      }

      // Check if OTP is expired
      if (metadata.otp_expires_at) {
        const expiresAt = new Date(metadata.otp_expires_at);
        if (expiresAt < new Date()) {
          return ResponseUtils.error(
            res,
            'OTP code has expired. Please request a new registration or contact support.',
            null,
            null,
            400
          );
        }
      }

      // Verify OTP code
      if (metadata.otp !== code) {
        return ResponseUtils.error(
          res,
          'Invalid OTP code. Please check the code and try again.',
          null,
          null,
          400
        );
      }

      console.log('   └─ ✅ OTP verified successfully');

      // Activate user and mark email as verified
      await AppAuthController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users 
         SET is_active = true,
             email_verified = true,
             metadata = metadata - 'otp' - 'otp_expires_at',
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
}

export default AppAuthController;

