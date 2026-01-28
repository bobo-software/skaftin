import { Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { HybridAuthRequest } from '../middleware/hybridAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { deleteUser, convertToRecipeUserId, listUsersByAccountInfo } from 'supertokens-node';
import { createProjectScopedEmail } from '../middleware/appUserSuperTokensMiddleware';
import { AuthUtils } from '../utils/AuthUtils';
import { AuthEmailService } from '../services/AuthEmailService';
import { SmsOtpService } from '../services/SmsOtpService';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

interface AppUser {
  id: number;
  supertokens_user_id?: string;
  name: string;
  email: string;
  phone?: string;
  metadata?: any;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: Date;
  updated_at: Date;
  roles?: any[];
}

interface CreateUserRequest {
  name: string;
  last_name?: string;
  email?: string;
  password: string;
  phone?: string;
  metadata?: any;
  role_ids?: number[];
  custom_field_1?: string;
  custom_field_2?: string;
}

interface UpdateUserRequest {
  name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  metadata?: any;
  is_active?: boolean;
  custom_field_1?: string;
  custom_field_2?: string;
}

class AuthUsersController {
  private static pool: Pool;
  private static emailService: AuthEmailService;
  private static smsOtpService: SmsOtpService;

  static initialize(pool: Pool) {
    AuthUsersController.pool = pool;
    AuthUsersController.emailService = new AuthEmailService(pool);
    AuthUsersController.smsOtpService = new SmsOtpService(pool);
  }

  /**
   * Get project schema name from project ID
   */
  private static async getProjectSchema(projectId: number): Promise<string | null> {
    try {
      const result = await AuthUsersController.pool.query(
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
   * Check if duplicate emails are allowed for this project
   */
  private static async checkDuplicateEmailPolicy(projectId: number): Promise<boolean> {
    try {
      const result = await AuthUsersController.pool.query(
        'SELECT allow_duplicate_emails FROM skaftin_system_auth_settings WHERE project_id = $1',
        [projectId]
      );
      return result.rows.length > 0 ? result.rows[0].allow_duplicate_emails : false;
    } catch (error) {
      console.error('Error checking duplicate email policy:', error);
      return false;
    }
  }

  /**
   * List all users for a project with filtering and pagination
   * GET /api/auth/:projectId/users (SuperTokens)
   * GET /app-api/auth/users (API key)
   */
  static async listUsers(req: (SuperTokensAuthenticatedRequest | HybridAuthRequest) & { projectId?: number; schemaName?: string }, res: Response) {
    // Support both SuperTokens (req.user) and API key (req.credential) authentication
    const isSuperTokensAuth = 'user' in req && req.user && req.user.userId;
    const isApiKeyAuth = 'credential' in req && req.credential && req.projectId;

    if (!isSuperTokensAuth && !isApiKeyAuth) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { search, role_id, is_active, page = '1', limit = '50', ...dynamicFilters } = req.query;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Flatten nested query parameters (Express parses metadata.association_id as nested object)
      // Convert { metadata: { association_id: '1' } } to { 'metadata.association_id': '1' }
      const flattenQueryParams = (obj: any, prefix = ''): Record<string, string> => {
        const flattened: Record<string, string> = {};
        for (const [key, value] of Object.entries(obj)) {
          const newKey = prefix ? `${prefix}.${key}` : key;
          if (value && typeof value === 'object' && !Array.isArray(value) && value.constructor === Object) {
            // Nested object - recurse
            Object.assign(flattened, flattenQueryParams(value, newKey));
          } else if (value !== undefined && value !== null) {
            // Leaf value
            flattened[newKey] = String(value);
          }
        }
        return flattened;
      };

      const flattenedFilters = flattenQueryParams(dynamicFilters);

      // Debug logging for dynamic filters
      if (Object.keys(flattenedFilters).length > 0) {
        console.log(`🔍 Dynamic filters detected:`, flattenedFilters);
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Get available columns in the users table for dynamic filtering
      const columnsResult = await AuthUsersController.pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 
          AND table_name = 'skaftin_system_users'
      `, [schemaName]);

      const availableColumns = new Set(columnsResult.rows.map((row: any) => row.column_name));

      // Build query with filters
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

      // Standard filters
      if (search) {
        whereConditions.push(`(u.name ILIKE $${paramIndex} OR u.email ILIKE $${paramIndex})`);
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      if (is_active !== undefined) {
        whereConditions.push(`u.is_active = $${paramIndex}`);
        queryParams.push(is_active === 'true');
        paramIndex++;
      }

      // Get role information if role_id is provided (to check for organization lookup)
      let roleOrgLookup: { fieldName?: string; lookupTable?: string; lookupField?: string } | null = null;
      if (role_id) {
        const roleResult = await AuthUsersController.pool.query(`
          SELECT organisation_field_name, organisation_lookup_table, organisation_lookup_field
          FROM ${schemaName}.skaftin_system_roles
          WHERE id = $1
        `, [parseInt(role_id as string)]);

        if (roleResult.rows.length > 0 && roleResult.rows[0].organisation_lookup_table) {
          roleOrgLookup = {
            fieldName: roleResult.rows[0].organisation_field_name,
            lookupTable: roleResult.rows[0].organisation_lookup_table,
            lookupField: roleResult.rows[0].organisation_lookup_field || roleResult.rows[0].organisation_field_name
          };
        }

        whereConditions.push(`EXISTS (
          SELECT 1 FROM ${schemaName}.skaftin_system_user_roles ur 
          WHERE ur.app_user_id = u.id AND ur.role_id = $${paramIndex}
        )`);
        queryParams.push(parseInt(role_id as string));
        paramIndex++;
      }

      // Dynamic filters: handle any query parameter that's not a reserved one
      // Supports both direct columns, metadata fields, and organization lookup tables
      for (const [key, value] of Object.entries(flattenedFilters)) {
        if (!value || value === '') continue; // Skip empty values

        const filterValue = value as string;
        const isMetadataField = key.startsWith('metadata.') || key.includes('.');

        // Check if this filter matches the role's organization field and use lookup table if configured
        const isOrgField = roleOrgLookup && key === roleOrgLookup.fieldName;
        const isOrgMetadataField = roleOrgLookup && key === `metadata.${roleOrgLookup.fieldName}`;

        if (isOrgField || isOrgMetadataField) {
          // Use organization lookup table instead of metadata
          const lookupTable = roleOrgLookup!.lookupTable;
          const lookupField = roleOrgLookup!.lookupField || roleOrgLookup!.fieldName;
          const numericValue = isNaN(Number(filterValue)) ? null : Number(filterValue);

          if (numericValue !== null && !isNaN(numericValue)) {
            // Numeric comparison for lookup table
            whereConditions.push(`EXISTS (
              SELECT 1 FROM ${schemaName}."${lookupTable}" ua
              WHERE ua.user_id = u.id 
                AND (
                  ua."${lookupField}"::text = $${paramIndex} OR
                  (ua."${lookupField}"::numeric = $${paramIndex + 1})
                )
            )`);
            queryParams.push(filterValue, numericValue);
            paramIndex += 2;
          } else {
            // String comparison for lookup table
            whereConditions.push(`EXISTS (
              SELECT 1 FROM ${schemaName}."${lookupTable}" ua
              WHERE ua.user_id = u.id 
                AND ua."${lookupField}"::text = $${paramIndex}
            )`);
            queryParams.push(filterValue);
            paramIndex++;
          }
        } else if (isMetadataField) {
          // Metadata field: metadata.field_name or metadata.field.subfield
          const metadataPath = key.replace(/^metadata\./, ''); // Remove 'metadata.' prefix if present
          const pathParts = metadataPath.split('.');

          // Build JSONB path: metadata->>'field'->>'subfield' etc.
          let jsonbPath = 'u.metadata';
          for (let i = 0; i < pathParts.length - 1; i++) {
            jsonbPath += `->'${pathParts[i]}'`;
          }
          jsonbPath += `->>'${pathParts[pathParts.length - 1]}'`;

          // JSONB comparison - handle both numeric and string values
          // JSONB can store numbers as numbers or as strings, so we need to handle both
          const numericValue = isNaN(Number(filterValue)) ? null : Number(filterValue);

          if (numericValue !== null && !isNaN(numericValue)) {
            // For numeric values, compare as text first (handles string storage)
            // Then try numeric comparison - use ->> to get text, then cast to numeric
            // This works for both JSONB number and string types
            whereConditions.push(`(
              u.metadata IS NOT NULL AND 
              (
                ${jsonbPath} = $${paramIndex} OR
                (
                  ${jsonbPath} ~ '^[0-9]+(\\.[0-9]+)?$' AND
                  (${jsonbPath})::numeric = $${paramIndex + 1}
                )
              )
            )`);
            queryParams.push(filterValue, numericValue);
            paramIndex += 2;
          } else {
            // String comparison only
            whereConditions.push(`(
              u.metadata IS NOT NULL AND 
              ${jsonbPath} = $${paramIndex}
            )`);
            queryParams.push(filterValue);
            paramIndex++;
          }
        } else if (availableColumns.has(key)) {
          // Direct column exists - use it directly
          whereConditions.push(`u."${key}" = $${paramIndex}`);
          queryParams.push(filterValue);
          paramIndex++;
        } else {
          // Column doesn't exist - assume it's a metadata field
          // Check metadata.field_name
          const numericValue = isNaN(Number(filterValue)) ? null : Number(filterValue);

          if (numericValue !== null && !isNaN(numericValue)) {
            // Numeric comparison - JSONB can store numbers as numbers or strings
            // Use ->> to get text, then cast to numeric (works for both types)
            whereConditions.push(`(
              u.metadata IS NOT NULL AND 
              (
                u.metadata->>'${key}' = $${paramIndex} OR
                (
                  u.metadata->>'${key}' ~ '^[0-9]+(\\.[0-9]+)?$' AND
                  (u.metadata->>'${key}')::numeric = $${paramIndex + 1}
                )
              )
            )`);
            queryParams.push(filterValue, numericValue);
            paramIndex += 2;
          } else {
            // String comparison
            whereConditions.push(`(
              u.metadata IS NOT NULL AND 
              u.metadata->>'${key}' = $${paramIndex}
            )`);
            queryParams.push(filterValue);
            paramIndex++;
          }
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Get users with roles
      const usersQuery = `
        SELECT 
          u.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'role_name', r.role_name,
                'role_key', r.role_key
              )
            ) FILTER (WHERE r.id IS NOT NULL), 
            '[]'
          ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
        ${whereClause}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(parseInt(limit as string), offset);

      // Debug logging for query
      if (whereConditions.length > 0) {
        console.log(`📊 SQL WHERE conditions:`, whereConditions);
        console.log(`📊 Query params:`, queryParams.slice(0, -2)); // Exclude limit/offset for logging
      }

      const usersResult = await AuthUsersController.pool.query(usersQuery, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT u.id) as total
        FROM ${schemaName}.skaftin_system_users u
        ${whereClause}
      `;

      const countResult = await AuthUsersController.pool.query(
        countQuery,
        queryParams.slice(0, -2) // Remove limit and offset params
      );

      const total = parseInt(countResult.rows[0].total);

      ResponseUtils.success(res, 'Users fetched successfully', {
        users: usersResult.rows,
        pagination: {
          page: parseInt(page as string),
          limit: parseInt(limit as string),
          total,
          totalPages: Math.ceil(total / parseInt(limit as string)),
        },
      });
    } catch (error) {
      console.error('Error fetching users:', error);
      ResponseUtils.error(res, 'Failed to fetch users', error);
    }
  }

  /**
   * Get a single user by ID
   * GET /api/auth/:projectId/users/:userId
   */
  static async getUser(req: (SuperTokensAuthenticatedRequest | HybridAuthRequest) & { projectId?: number; schemaName?: string }, res: Response) {
    // Support both SuperTokens (req.user) and API key (req.credential) authentication
    const isSuperTokensAuth = 'user' in req && req.user && req.user.userId;
    const isApiKeyAuth = 'credential' in req && req.credential && req.projectId;

    if (!isSuperTokensAuth && !isApiKeyAuth) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const userQuery = `
        SELECT 
          u.*,
          COALESCE(
            json_agg(
              json_build_object(
                'id', r.id,
                'role_name', r.role_name,
                'role_key', r.role_key,
                'assigned_at', ur.assigned_at
              )
            ) FILTER (WHERE r.id IS NOT NULL), 
            '[]'
          ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
      `;

      const result = await AuthUsersController.pool.query(userQuery, [parseInt(userId)]);

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      // Remove sensitive fields from response
      const user = result.rows[0];
      delete user.supertokens_user_id;
      delete user.password;

      ResponseUtils.success(res, 'User fetched successfully', user);
    } catch (error) {
      console.error('Error fetching user:', error);
      ResponseUtils.error(res, 'Failed to fetch user', error);
    }
  }

  /**
   * Get user password (admin only - hidden feature)
   * GET /api/auth/:projectId/users/:userId/password
   */
  static async getUserPassword(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get user password (only for admin users)
      const result = await AuthUsersController.pool.query(
        `SELECT password FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [parseInt(userId)]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const password = result.rows[0].password;

      if (!password) {
        return ResponseUtils.error(res, 'User does not have a password set', null, null, 404);
      }

      ResponseUtils.success(res, 'Password retrieved successfully', { password });
    } catch (error) {
      console.error('Error fetching user password:', error);
      ResponseUtils.error(res, 'Failed to fetch user password', error);
    }
  }

  /**
   * Set/Create user password (admin only - hidden feature)
   * POST /api/auth/:projectId/users/:userId/password
   */
  static async setUserPassword(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;
      const { password } = req.body;

      if (!password) {
        return ResponseUtils.error(res, 'Password is required', null, null, 400);
      }

      const passwordValidation = AuthUtils.isValidPassword(password);
      if (!passwordValidation.valid) {
        return ResponseUtils.error(res, passwordValidation.message || 'Invalid password', null, null, 400);
      }

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if user exists
      const userResult = await AuthUsersController.pool.query(
        `SELECT id, email, supertokens_user_id FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [parseInt(userId)]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      // if (!user.email) {
      //   return ResponseUtils.error(res, 'User email is required for password reset', null, null, 400);
      // }

      // Hash the password for database storage
      const hashedPassword = await bcrypt.hash(password, 10);

      // Update user password in database
      await AuthUsersController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users SET password = $1 WHERE id = $2`,
        [hashedPassword, parseInt(userId)]
      );

      // Also update SuperTokens password if user exists in SuperTokens
      const supertokensEmail = createProjectScopedEmail(user.email, projectId);

      if (user.supertokens_user_id) {
        // User exists in SuperTokens - update password
        try {
          const recipeUserId = convertToRecipeUserId(user.supertokens_user_id);
          const updateResponse = await EmailPassword.updateEmailOrPassword({
            recipeUserId: recipeUserId,
            password: password,
          });

          if (updateResponse.status !== 'OK') {
            console.error('Failed to update password in SuperTokens:', updateResponse);
            // Don't fail the request - database password is updated, user can still login
            console.warn(`⚠️  Password updated in database but SuperTokens update failed for user ${user.email}`);
          } else {
            console.log(`✅ Password updated in SuperTokens for user ${user.email}`);
          }
        } catch (error) {
          console.error('Error updating password in SuperTokens:', error);
          // Don't fail the request - database password is updated
          console.warn(`⚠️  Password updated in database but SuperTokens update failed for user ${user.email}`);
        }
      } else {
        // User doesn't exist in SuperTokens yet - try to create or find existing user
        try {
          // First, check if user already exists in SuperTokens (by email)
          let supertokensUserId: string | null = null;
          try {
            const users = await listUsersByAccountInfo("public", {
              email: supertokensEmail,
            });
            if (users.length > 0) {
              supertokensUserId = users[0].id;
              console.log(`✅ Found existing SuperTokens user for ${user.email}`);
            }
          } catch (error) {
            // User doesn't exist, will create new one
            console.log(`User ${user.email} doesn't exist in SuperTokens, creating new user...`);
          }

          if (supertokensUserId) {
            // User exists in SuperTokens but ID not in database - update password and sync ID
            const recipeUserId = convertToRecipeUserId(supertokensUserId);
            const updateResponse = await EmailPassword.updateEmailOrPassword({
              recipeUserId: recipeUserId,
              password: password,
            });

            if (updateResponse.status === 'OK') {
              // Update database with SuperTokens user ID
              await AuthUsersController.pool.query(
                `UPDATE ${schemaName}.skaftin_system_users SET supertokens_user_id = $1 WHERE id = $2`,
                [supertokensUserId, parseInt(userId)]
              );
              console.log(`✅ Updated SuperTokens password and synced user ID for ${user.email}`);
            } else {
              console.error('Failed to update password in SuperTokens:', updateResponse);
            }
          } else {
            // User doesn't exist - create SuperTokens user
            const signUpResponse = await EmailPassword.signUp("public", supertokensEmail, password);

            if (signUpResponse.status === "OK") {
              supertokensUserId = signUpResponse.user.id;
              // Update database with SuperTokens user ID
              await AuthUsersController.pool.query(
                `UPDATE ${schemaName}.skaftin_system_users SET supertokens_user_id = $1 WHERE id = $2`,
                [supertokensUserId, parseInt(userId)]
              );
              console.log(`✅ Created SuperTokens user and set password for user ${user.email}`);
            } else {
              console.error('Failed to create SuperTokens user:', signUpResponse);
              // Don't fail - database password is updated
            }
          }
        } catch (error) {
          console.error('Error syncing SuperTokens user:', error);
          // Don't fail - database password is updated
        }
      }

      console.log(`✅ Password set for user ${user.email} (ID: ${userId})`);

      ResponseUtils.success(res, 'Password set successfully', { message: 'Password has been set for the user' });
    } catch (error) {
      console.error('Error setting user password:', error);
      ResponseUtils.error(res, 'Failed to set user password', error);
    }
  }

  /**
   * Create a new user
   * POST /api/auth/:projectId/users (SuperTokens)
   * POST /app-api/auth/users (API key)
   */
  static async createUser(req: (SuperTokensAuthenticatedRequest | HybridAuthRequest) & { projectId?: number; schemaName?: string }, res: Response) {
    // Support both SuperTokens (req.user or req.session) and API key (req.credential) authentication
    const hybridReq = req as HybridAuthRequest;
    const superTokensReq = req as SuperTokensAuthenticatedRequest;

    const isSuperTokensAuth = (superTokensReq.user && superTokensReq.user.userId) ||
      (hybridReq.session && hybridReq.authType === 'supertokens');
    const isApiKeyAuth = hybridReq.credential && hybridReq.credential.projectId && hybridReq.projectId;

    console.log('🔐 [CreateUser] Authentication check:');
    console.log('  └─ Has req.user:', !!superTokensReq.user);
    console.log('  └─ Has req.credential:', !!hybridReq.credential);
    console.log('  └─ Has req.session:', !!hybridReq.session);
    console.log('  └─ authType:', hybridReq.authType);
    console.log('  └─ projectId:', hybridReq.projectId);
    console.log('  └─ isSuperTokensAuth:', isSuperTokensAuth);
    console.log('  └─ isApiKeyAuth:', isApiKeyAuth);

    if (!isSuperTokensAuth && !isApiKeyAuth) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { name, last_name, email, password, phone, metadata, role_ids, custom_field_1, custom_field_2 }: CreateUserRequest = req.body;

      // Enhanced validation
      if (!name || !password) {
        return ResponseUtils.error(res, 'Name and password are required', null, null, 400);
      }

      // Email is optional - if provided, validate it
      if (email && !AuthUtils.isValidEmail(email)) {
        return ResponseUtils.error(res, 'Invalid email format', null, null, 400);
      }

      const passwordValidation = AuthUtils.isValidPassword(password);
      if (!passwordValidation.valid) {
        return ResponseUtils.error(res, passwordValidation.message || 'Invalid password', null, null, 400);
      }

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if duplicate emails are allowed (only if email is provided)
      if (email) {
        const allowDuplicates = await AuthUsersController.checkDuplicateEmailPolicy(projectId);

        if (!allowDuplicates) {
          // Check if email already exists in this project
          const emailExists = await AuthUtils.emailExistsInProject(
            AuthUsersController.pool,
            schemaName,
            email
          );

          if (emailExists) {
            return ResponseUtils.error(res, 'User with this email already exists in this project', null, null, 400);
          }
        }
      }

      // Sanitize metadata
      const sanitizedMetadata = AuthUtils.sanitizeMetadata(metadata);

      // Get default role if no roles specified
      let finalRoleIds = role_ids || [];
      if (!finalRoleIds || finalRoleIds.length === 0) {
        const defaultRoleResult = await AuthUsersController.pool.query(
          `SELECT default_role_id FROM skaftin_system_auth_settings WHERE project_id = $1`,
          [projectId]
        );
        if (defaultRoleResult.rows.length > 0 && defaultRoleResult.rows[0].default_role_id) {
          finalRoleIds = [defaultRoleResult.rows[0].default_role_id];
        }
      }

      // Use transaction-safe user creation
      // NOTE: App users are NOT created in SuperTokens (they use separate JWT auth)
      // Only platform admins use SuperTokens authentication
      const result = await AuthUtils.createUserWithTransaction(
        AuthUsersController.pool,
        schemaName,
        {
          name,
          last_name,
          email,
          password,
          phone,
          metadata: sanitizedMetadata,
          role_ids: finalRoleIds,
          custom_field_1,
          custom_field_2,
        },
        false // Do NOT create in SuperTokens - app users use JWT auth
      );

      if (!result.success) {
        return ResponseUtils.error(res, result.error || 'Failed to create user', null, null, 500);
      }

      // Fetch the user with roles
      const userWithRoles = await AuthUsersController.pool.query(
        `
        SELECT 
          u.*,
          COALESCE(
            json_agg(
              json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
            ) FILTER (WHERE r.id IS NOT NULL), 
            '[]'
          ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        `,
        [result.user.id]
      );

      console.log(`✅ User created: ${email || 'no email'} (ID: ${result.user.id}, SuperTokens: ${result.superTokensUserId || 'N/A'})`);

      ResponseUtils.success(res, 'User created successfully', userWithRoles.rows[0], 201);
    } catch (error) {
      console.error('Error creating user:', error);
      ResponseUtils.error(res, 'Failed to create user', error);
    }
  }

  /**
   * Update a user
   * PUT /api/auth/:projectId/users/:userId
   * PUT /app-api/auth/users/:userId
   */
  static async updateUser(req: (SuperTokensAuthenticatedRequest | HybridAuthRequest) & { projectId?: number; schemaName?: string }, res: Response) {
    // Support both SuperTokens (req.user) and API key (req.credential) authentication
    const isSuperTokensAuth = 'user' in req && req.user && req.user.userId;
    const isApiKeyAuth = 'credential' in req && req.credential && req.projectId;

    if (!isSuperTokensAuth && !isApiKeyAuth) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;
      const updates: UpdateUserRequest = req.body;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check available columns in the users table
      const columnsResult = await AuthUsersController.pool.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_schema = $1 
           AND table_name = 'skaftin_system_users'`,
        [schemaName]
      );
      const availableColumns = new Set(columnsResult.rows.map((row: any) => row.column_name));

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.last_name !== undefined) {
        // Only update last_name if the column exists
        if (availableColumns.has('last_name')) {
          updateFields.push(`last_name = $${paramIndex++}`);
          values.push(updates.last_name);
        } else {
          // Silently skip if column doesn't exist (migration may not have run)
          console.warn(`last_name column does not exist in ${schemaName}.skaftin_system_users, skipping update`);
        }
      }

      if (updates.email !== undefined) {
        // Check duplicate email policy if email is being changed
        const allowDuplicates = await AuthUsersController.checkDuplicateEmailPolicy(projectId);

        if (!allowDuplicates) {
          const existingUser = await AuthUsersController.pool.query(
            `SELECT id FROM ${schemaName}.skaftin_system_users WHERE email = $1 AND id != $2`,
            [updates.email, parseInt(userId)]
          );

          if (existingUser.rows.length > 0) {
            return ResponseUtils.error(res, 'User with this email already exists', null, null, 400);
          }
        }

        updateFields.push(`email = $${paramIndex++}`);
        values.push(updates.email);
      }

      if (updates.phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        values.push(updates.phone);
      }

      if (updates.metadata !== undefined) {
        // Sanitize metadata
        const sanitizedMetadata = AuthUtils.sanitizeMetadata(updates.metadata);

        // Merge with existing metadata instead of replacing it entirely (deep merge for nested objects)
        const currentUserResult = await AuthUsersController.pool.query(
          `SELECT metadata FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
          [parseInt(userId)]
        );

        let mergedMetadata = sanitizedMetadata;
        if (currentUserResult.rows.length > 0 && currentUserResult.rows[0].metadata) {
          // Deep merge existing metadata with new metadata (new values override existing ones)
          mergedMetadata = AuthUtils.deepMerge(
            currentUserResult.rows[0].metadata,
            sanitizedMetadata
          );
        }

        updateFields.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      if (updates.custom_field_1 !== undefined) {
        updateFields.push(`custom_field_1 = $${paramIndex++}`);
        values.push(updates.custom_field_1);
      }

      if (updates.custom_field_2 !== undefined) {
        updateFields.push(`custom_field_2 = $${paramIndex++}`);
        values.push(updates.custom_field_2);
      }

      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        values.push(updates.is_active);
      }

      if (updateFields.length === 0) {
        return ResponseUtils.error(res, 'No fields to update', null, null, 400);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(userId));

      const updateQuery = `
        UPDATE ${schemaName}.skaftin_system_users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await AuthUsersController.pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      // Fetch user with roles
      const userWithRoles = await AuthUsersController.pool.query(
        `
        SELECT 
          u.*,
          COALESCE(
            json_agg(
              json_build_object('id', r.id, 'role_name', r.role_name, 'role_key', r.role_key)
            ) FILTER (WHERE r.id IS NOT NULL), 
            '[]'
          ) as roles
        FROM ${schemaName}.skaftin_system_users u
        LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.skaftin_system_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        `,
        [parseInt(userId)]
      );

      // Remove sensitive fields from response
      const user = userWithRoles.rows[0];
      delete user.supertokens_user_id;
      delete user.password;

      ResponseUtils.success(res, 'User updated successfully', user);
    } catch (error) {
      console.error('Error updating user:', error);
      ResponseUtils.error(res, 'Failed to update user', error);
    }
  }

  /**
   * Delete a user
   * DELETE /api/auth/:projectId/users/:userId
   */
  static async deleteUser(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;
      const { permanent = 'false' } = req.query;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const isPermanent = permanent === 'true';

      // Use transaction-safe deletion
      const result = await AuthUtils.deleteUserWithTransaction(
        AuthUsersController.pool,
        schemaName,
        parseInt(userId),
        isPermanent
      );

      if (!result.success) {
        return ResponseUtils.error(res, result.error || 'Failed to delete user', null, null, 500);
      }

      const message = isPermanent
        ? `User permanently deleted${result.deletedFromSuperTokens ? ' (including SuperTokens account)' : ''}`
        : 'User deactivated successfully';

      console.log(`✅ ${message} - User ID: ${userId}`);

      ResponseUtils.success(res, message);
    } catch (error) {
      console.error('Error deleting user:', error);
      ResponseUtils.error(res, 'Failed to delete user', error);
    }
  }

  /**
   * Assign a role to a user
   * POST /api/auth/:projectId/users/:userId/roles
   */
  static async assignRole(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;
      const { role_id } = req.body;

      if (!role_id) {
        return ResponseUtils.error(res, 'Role ID is required', null, null, 400);
      }

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if role exists
      const roleCheck = await AuthUsersController.pool.query(
        `SELECT id FROM ${schemaName}.skaftin_system_roles WHERE id = $1`,
        [role_id]
      );

      if (roleCheck.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      // Check if role assignment already exists
      const existingAssignment = await AuthUsersController.pool.query(
        `SELECT id FROM ${schemaName}.skaftin_system_user_roles 
         WHERE app_user_id = $1 AND role_id = $2`,
        [parseInt(userId), role_id]
      );

      if (existingAssignment.rows.length > 0) {
        return ResponseUtils.success(res, 'Role already assigned to user');
      }

      // Assign role with error handling for sequence sync issues
      try {
        await AuthUsersController.pool.query(
          `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id, assigned_by)
           VALUES ($1, $2, $3)`,
          [parseInt(userId), role_id, req.user.userId]
        );
      } catch (insertError: any) {
        // Handle primary key sequence out-of-sync error
        if (insertError.code === '23505' && insertError.constraint === 'skaftin_system_user_roles_pkey') {
          console.warn(`⚠️ Sequence out of sync for ${schemaName}.skaftin_system_user_roles, fixing...`);

          // Reset the sequence to the max ID + 1
          await AuthUsersController.pool.query(`
            SELECT setval(
              pg_get_serial_sequence('${schemaName}.skaftin_system_user_roles', 'id'),
              COALESCE((SELECT MAX(id) FROM ${schemaName}.skaftin_system_user_roles), 0) + 1,
              false
            )
          `);

          // Check again if assignment exists (might have been created by another process)
          const recheckAssignment = await AuthUsersController.pool.query(
            `SELECT id FROM ${schemaName}.skaftin_system_user_roles 
             WHERE app_user_id = $1 AND role_id = $2`,
            [parseInt(userId), role_id]
          );

          if (recheckAssignment.rows.length > 0) {
            return ResponseUtils.success(res, 'Role already assigned to user');
          }

          // Retry the insert after fixing the sequence
          await AuthUsersController.pool.query(
            `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id, assigned_by)
             VALUES ($1, $2, $3)`,
            [parseInt(userId), role_id, req.user.userId]
          );
        } else {
          // Re-throw if it's a different error
          throw insertError;
        }
      }

      ResponseUtils.success(res, 'Role assigned successfully');
    } catch (error) {
      console.error('Error assigning role:', error);
      ResponseUtils.error(res, 'Failed to assign role', error);
    }
  }

  /**
   * Remove a role from a user
   * DELETE /api/auth/:projectId/users/:userId/roles/:roleId
   */
  static async removeRole(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId, roleId } = req.params;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Remove role
      const result = await AuthUsersController.pool.query(
        `DELETE FROM ${schemaName}.skaftin_system_user_roles 
         WHERE app_user_id = $1 AND role_id = $2`,
        [parseInt(userId), parseInt(roleId)]
      );

      if (result.rowCount === 0) {
        return ResponseUtils.error(res, 'Role assignment not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Role removed successfully');
    } catch (error) {
      console.error('Error removing role:', error);
      ResponseUtils.error(res, 'Failed to remove role', error);
    }
  }

  /**
   * Get users by role
   * GET /api/auth/:projectId/users/by-role/:roleId
   */
  static async getUsersByRole(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { roleId } = req.params;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const usersQuery = `
        SELECT u.*
        FROM ${schemaName}.skaftin_system_users u
        INNER JOIN ${schemaName}.skaftin_system_user_roles ur ON u.id = ur.app_user_id
        WHERE ur.role_id = $1
        ORDER BY u.created_at DESC
      `;

      const result = await AuthUsersController.pool.query(usersQuery, [parseInt(roleId)]);

      ResponseUtils.success(res, 'Users fetched successfully', result.rows);
    } catch (error) {
      console.error('Error fetching users by role:', error);
      ResponseUtils.error(res, 'Failed to fetch users by role', error);
    }
  }

  /**
   * Get OTP verification status for a user
   * GET /api/auth/:projectId/users/:userId/otp-status
   */
  static async getUserOTPStatus(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;

      const schemaName = req.schemaName || await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get all OTP records for the user
      const otpRecords = await AuthUsersController.pool.query(
        `SELECT id, otp_method, destination, status, expires_at, verified_at, attempts, created_at
         FROM ${schemaName}.skaftin_system_otp_verifications
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [parseInt(userId)]
      );

      ResponseUtils.success(res, 'OTP status fetched successfully', otpRecords.rows);
    } catch (error) {
      console.error('Error fetching OTP status:', error);
      ResponseUtils.error(res, 'Failed to fetch OTP status', error);
    }
  }

  /**
   * Resend OTP to a user
   * POST /api/auth/:projectId/users/:userId/resend-otp
   */
  static async resendOTP(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;

      const schemaName = req.schemaName || await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get user details
      const userResult = await AuthUsersController.pool.query(
        `SELECT id, name, last_name, email, phone FROM ${schemaName}.skaftin_system_users WHERE id = $1`,
        [parseInt(userId)]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      // Get the last OTP record to determine method
      const lastOtpResult = await AuthUsersController.pool.query(
        `SELECT otp_method, destination FROM ${schemaName}.skaftin_system_otp_verifications
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [parseInt(userId)]
      );

      if (lastOtpResult.rows.length === 0) {
        return ResponseUtils.error(res, 'No previous OTP found for this user', null, null, 404);
      }

      const lastOtp = lastOtpResult.rows[0];
      const otpMethod = lastOtp.otp_method;

      // Get auth settings for OTP length
      const settingsResult = await AuthUsersController.pool.query(
        `SELECT otp_length FROM skaftin_system_auth_settings WHERE project_id = $1`,
        [projectId]
      );
      const otpLength = settingsResult.rows.length > 0 ? (settingsResult.rows[0].otp_length || 6) : 6;

      // Mark all pending OTPs as expired
      await AuthUsersController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'pending'`,
        [parseInt(userId)]
      );

      // Generate new OTP with configurable length
      const min = Math.pow(10, otpLength - 1);
      const max = Math.pow(10, otpLength) - 1;
      const otp = crypto.randomInt(min, max + 1).toString();
      const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Send OTP based on method
      let sendSuccess = false;
      let destination = '';

      if (otpMethod === 'email') {
        destination = user.email;
        console.log(`📧 Resending OTP via email to ${destination}...`);

        const emailResult = await AuthUsersController.emailService.sendRegistrationEmail(
          projectId,
          destination,
          user.name,
          otp
        );

        sendSuccess = emailResult.success;
      } else if (otpMethod === 'sms') {
        destination = user.phone || lastOtp.destination;
        console.log(`📱 Resending OTP via SMS to ${destination}...`);

        const smsResult = await AuthUsersController.smsOtpService.sendOTP(
          projectId.toString(),
          destination,
          otp,
          user.name
        );

        sendSuccess = smsResult.success;
      }

      if (!sendSuccess) {
        return ResponseUtils.error(res, `Failed to send OTP via ${otpMethod}`, null, null, 500);
      }

      // Store new OTP record
      await AuthUsersController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_otp_verifications 
         (user_id, otp_code, otp_method, destination, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [parseInt(userId), otp, otpMethod, destination, otpExpiresAt]
      );

      console.log(`   └─ ✅ OTP resent successfully via ${otpMethod}`);

      ResponseUtils.success(res, `OTP resent successfully via ${otpMethod}`, {
        method: otpMethod,
        destination: destination,
      });
    } catch (error) {
      console.error('Error resending OTP:', error);
      ResponseUtils.error(res, 'Failed to resend OTP', error);
    }
  }

  /**
   * Manually verify a user without OTP
   * POST /api/auth/:projectId/users/:userId/manual-verify
   */
  static async manuallyVerifyUser(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { userId } = req.params;

      const schemaName = req.schemaName || await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Mark all pending OTPs as expired
      await AuthUsersController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_otp_verifications
         SET status = 'expired', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'pending'`,
        [parseInt(userId)]
      );

      // Activate user and mark both email and phone as verified
      await AuthUsersController.pool.query(
        `UPDATE ${schemaName}.skaftin_system_users
         SET is_active = true,
             email_verified = true,
             phone_verified = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [parseInt(userId)]
      );

      console.log(`✅ User ${userId} manually verified by admin`);

      ResponseUtils.success(res, 'User manually verified successfully');
    } catch (error) {
      console.error('Error manually verifying user:', error);
      ResponseUtils.error(res, 'Failed to manually verify user', error);
    }
  }

  /**
   * Export users as SQL dump
   * POST /api/auth/:projectId/users/export
   */
  static async exportUsers(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const client = await AuthUsersController.pool.connect();

      try {
        await client.query(`SET search_path TO ${schemaName}, public`);

        let sqlContent = '';

        // Add header
        sqlContent += `-- PostgreSQL User Data Export\n`;
        sqlContent += `-- Exported from schema: ${schemaName}\n`;
        sqlContent += `-- Exported at: ${new Date().toISOString()}\n`;
        sqlContent += `-- Note: This export contains users, roles, and authentication data\n\n`;

        const systemTables = [
          'skaftin_system_users',
          'skaftin_system_roles',
          'skaftin_system_user_roles',
          'skaftin_system_user_custom_fields',
          'skaftin_system_otp_verifications',
        ];

        for (const tableName of systemTables) {
          try {
            // Check if table exists
            const tableExistsQuery = `
              SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = $1 AND table_name = $2
              )
            `;
            const tableExists = await client.query(tableExistsQuery, [schemaName, tableName]);

            if (!tableExists.rows[0].exists) {
              sqlContent += `-- Table ${tableName} does not exist, skipping\n\n`;
              continue;
            }

            const dataResult = await client.query(`SELECT * FROM "${schemaName}"."${tableName}"`);

            if (dataResult.rows.length > 0) {
              sqlContent += `-- Data for ${tableName}\n`;
              sqlContent += `DELETE FROM "${tableName}";\n`;

              const columns = dataResult.fields.map(f => f.name);

              for (const row of dataResult.rows) {
                const values = columns.map(col => {
                  const value = row[col];
                  if (value === null) return 'NULL';
                  if (typeof value === 'string') {
                    const hasSpecialChars = /[\n\r\t\\]/.test(value);

                    if (hasSpecialChars) {
                      const escaped = value
                        .replace(/\\/g, '\\\\')
                        .replace(/'/g, "\\'")
                        .replace(/\n/g, '\\n')
                        .replace(/\r/g, '\\r')
                        .replace(/\t/g, '\\t');
                      return `E'${escaped}'`;
                    } else {
                      return `'${value.replace(/'/g, "''")}'`;
                    }
                  }
                  if (typeof value === 'boolean') {
                    return value ? 'TRUE' : 'FALSE';
                  }
                  if (value instanceof Date) {
                    return `'${value.toISOString()}'`;
                  }
                  if (typeof value === 'object') {
                    const jsonStr = JSON.stringify(value)
                      .replace(/\\/g, '\\\\')
                      .replace(/'/g, "''");
                    return `'${jsonStr}'::jsonb`;
                  }
                  return String(value);
                });

                sqlContent += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
              }
              sqlContent += '\n';
            } else {
              sqlContent += `-- No data in ${tableName}\n\n`;
            }
          } catch (tableError: any) {
            console.warn(`Warning: Could not export ${tableName}:`, tableError.message);
            sqlContent += `-- Warning: Could not export ${tableName}: ${tableError.message}\n\n`;
          }
        }

        client.release();

        // Generate filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
        const fileName = `users-export-${timestamp}.sql`;

        // Set headers for file download
        res.setHeader('Content-Type', 'application/sql');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        res.setHeader('Content-Length', Buffer.byteLength(sqlContent, 'utf8'));

        // Send the SQL content
        res.send(sqlContent);

        console.log(`✅ Users exported successfully: ${fileName}`);
      } catch (error: any) {
        client.release();
        console.error('Error exporting users:', error);
        throw error;
      }
    } catch (error: any) {
      console.error('Error in exportUsers:', error);
      ResponseUtils.error(res, 'Failed to export users', error);
    }
  }

  /**
   * Import users from SQL dump
   * POST /api/auth/:projectId/users/import
   */
  static async importUsers(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const projectId = parseInt(req.params.projectId);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }

      const { sqlContent, clearExisting = false } = req.body;

      if (!sqlContent || typeof sqlContent !== 'string') {
        return ResponseUtils.error(res, 'SQL content is required', null, null, 400);
      }

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const client = await AuthUsersController.pool.connect();

      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      try {
        await client.query(`SET search_path TO ${schemaName}, public`);
        await client.query('BEGIN');

        // If clearExisting, delete all user data first
        if (clearExisting) {
          console.log('🗑️  Clearing existing user data...');
          await client.query(`DELETE FROM "${schemaName}"."skaftin_system_user_roles"`);
          await client.query(`DELETE FROM "${schemaName}"."skaftin_system_otp_verifications"`);
          await client.query(`DELETE FROM "${schemaName}"."skaftin_system_users"`);
          console.log('✅ Existing user data cleared');
        }

        // Clean and parse SQL content
        // Remove SQL comments (--) but only if not inside quoted strings
        let cleanedSql = sqlContent
          .split('\n')
          .map(line => {
            // Remove inline comments (--) but only if not inside quotes
            let inSingleQuote = false;
            let inDoubleQuote = false;
            let commentIndex = -1;

            for (let i = 0; i < line.length - 1; i++) {
              const char = line[i];
              const nextChar = line[i + 1];

              // Handle single quotes
              if (char === "'" && !inDoubleQuote) {
                // Check for escaped single quote ('')
                if (inSingleQuote && nextChar === "'") {
                  i++; // Skip the escaped quote
                  continue;
                }
                inSingleQuote = !inSingleQuote;
              }

              // Handle double quotes
              if (char === '"' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
              }

              // Found -- comment delimiter, but only if not inside quotes
              if (char === '-' && nextChar === '-' && !inSingleQuote && !inDoubleQuote) {
                commentIndex = i;
                break;
              }
            }

            if (commentIndex !== -1) {
              return line.substring(0, commentIndex);
            }
            return line;
          })
          .join('\n');

        cleanedSql = cleanedSql.replace(/\/\*[\s\S]*?\*\//g, '');

        // Split SQL statements by semicolons, respecting quoted strings
        const statements: string[] = [];
        let currentStatement = '';
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let inEscapeString = false; // E'' syntax
        let i = 0;

        while (i < cleanedSql.length) {
          const char = cleanedSql[i];
          const nextChar = i + 1 < cleanedSql.length ? cleanedSql[i + 1] : '';

          // Handle escape sequences in E'' strings
          if (inEscapeString && char === '\\') {
            currentStatement += char;
            if (nextChar) {
              currentStatement += nextChar;
              i += 2;
              continue;
            }
            i++;
            continue;
          }

          // Handle E'' escape string syntax
          if (!inSingleQuote && !inDoubleQuote && char === 'E' && nextChar === "'") {
            inEscapeString = true;
            inSingleQuote = true;
            currentStatement += char + nextChar;
            i += 2;
            continue;
          }

          // Handle single quotes (for strings and E'' escape strings)
          if (char === "'" && !inDoubleQuote) {
            if (inEscapeString && nextChar === "'") {
              // End of E'' string
              inEscapeString = false;
              inSingleQuote = false;
              currentStatement += char + nextChar;
              i += 2;
              continue;
            } else if (!inEscapeString) {
              // Regular single-quoted string
              if (inSingleQuote && nextChar === "'") {
                // Escaped single quote ('')
                currentStatement += char + nextChar;
                i += 2;
                continue;
              } else {
                // Toggle single quote state
                inSingleQuote = !inSingleQuote;
              }
            }
          }

          // Handle double quotes (for identifiers)
          if (char === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
          }

          // Handle semicolons (only split if not inside quotes)
          if (char === ';' && !inSingleQuote && !inDoubleQuote) {
            const trimmed = currentStatement.trim();
            if (trimmed.length > 0 && /\S/.test(trimmed)) {
              statements.push(trimmed);
            }
            currentStatement = '';
            i++;
            continue;
          }

          currentStatement += char;
          i++;
        }

        // Add the last statement if any
        const trimmed = currentStatement.trim();
        if (trimmed.length > 0 && /\S/.test(trimmed)) {
          statements.push(trimmed);
        }

        console.log(`📝 Found ${statements.length} SQL statements to execute`);

        for (let i = 0; i < statements.length; i++) {
          const statement = statements[i];
          try {
            await client.query(statement);
            successCount++;

            if ((i + 1) % 10 === 0) {
              console.log(`✅ Executed ${i + 1}/${statements.length} statements`);
            }
          } catch (err: any) {
            errorCount++;
            const errorMsg = `Statement ${i + 1}: ${statement.substring(0, 100)}... Error: ${err.message}`;
            errors.push(errorMsg);
            console.error('❌ SQL execution error:', errorMsg);
          }
        }

        await client.query('COMMIT');
        client.release();

        const responseData: any = {
          successCount,
          errorCount,
        };

        if (errorCount === 0) {
          responseData.message = `Successfully imported ${successCount} SQL statements`;
          ResponseUtils.success(res, 'Users imported successfully', responseData);
        } else {
          responseData.errors = errors.slice(0, 10);
          responseData.message = `Executed ${successCount} statements, ${errorCount} failed`;
          ResponseUtils.success(res, 'Users imported with warnings', responseData);
        }
      } catch (error: any) {
        await client.query('ROLLBACK');
        client.release();
        throw error;
      }
    } catch (error: any) {
      console.error('Error in importUsers:', error);
      ResponseUtils.error(res, 'Failed to import users', error);
    }
  }
}

export default AuthUsersController;

