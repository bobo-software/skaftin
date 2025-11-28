import { Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { HybridAuthRequest } from '../middleware/hybridAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import { deleteUser } from 'supertokens-node';
import { AuthUtils } from '../utils/AuthUtils';

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
  email: string;
  password: string;
  phone?: string;
  metadata?: any;
  role_ids?: number[];
  custom_field_1?: string;
  custom_field_2?: string;
}

interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string;
  metadata?: any;
  is_active?: boolean;
  custom_field_1?: string;
  custom_field_2?: string;
}

class AuthUsersController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    AuthUsersController.pool = pool;
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
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { search, role_id, is_active, page = '1', limit = '50' } = req.query;

      const schemaName = await AuthUsersController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      // Build query with filters
      let whereConditions: string[] = [];
      let queryParams: any[] = [];
      let paramIndex = 1;

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

      if (role_id) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM ${schemaName}.skaftin_system_user_roles ur 
          WHERE ur.app_user_id = u.id AND ur.role_id = $${paramIndex}
        )`);
        queryParams.push(parseInt(role_id as string));
        paramIndex++;
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
      const { name, email, password, phone, metadata, role_ids, custom_field_1, custom_field_2 }: CreateUserRequest = req.body;

      // Enhanced validation
      if (!name || !email || !password) {
        return ResponseUtils.error(res, 'Name, email, and password are required', null, null, 400);
      }

      if (!AuthUtils.isValidEmail(email)) {
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

      // Check if duplicate emails are allowed
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

      console.log(`✅ User created: ${email} (ID: ${result.user.id}, SuperTokens: ${result.superTokensUserId || 'N/A'})`);

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

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
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
        updateFields.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(updates.metadata));
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

      // Assign role
      await AuthUsersController.pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id, assigned_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (app_user_id, role_id) DO NOTHING`,
        [parseInt(userId), role_id, req.user.userId]
      );

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
}

export default AuthUsersController;

