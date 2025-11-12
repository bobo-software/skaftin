import { Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';
import EmailPassword from 'supertokens-node/recipe/emailpassword';

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
}

interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string;
  metadata?: any;
  is_active?: boolean;
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
        'SELECT schema_name FROM projects WHERE id = $1',
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
        'SELECT allow_duplicate_emails FROM auth_settings WHERE project_id = $1',
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
   * GET /api/auth/:projectId/users
   */
  static async listUsers(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;
      const { search, role_id, is_active, page = '1', limit = '50' } = req.query;

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
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
          SELECT 1 FROM ${schemaName}.app_user_roles ur 
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
        FROM ${schemaName}.app_users u
        LEFT JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.app_roles r ON ur.role_id = r.id
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
        FROM ${schemaName}.app_users u
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
  static async getUser(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId, userId } = req.params;

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
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
        FROM ${schemaName}.app_users u
        LEFT JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.app_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
      `;

      const result = await AuthUsersController.pool.query(userQuery, [parseInt(userId)]);

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      ResponseUtils.success(res, 'User fetched successfully', result.rows[0]);
    } catch (error) {
      console.error('Error fetching user:', error);
      ResponseUtils.error(res, 'Failed to fetch user', error);
    }
  }

  /**
   * Create a new user
   * POST /api/auth/:projectId/users
   */
  static async createUser(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;
      const { name, email, password, phone, metadata, role_ids }: CreateUserRequest = req.body;

      // Validation
      if (!name || !email || !password) {
        return ResponseUtils.error(res, 'Name, email, and password are required', null, null, 400);
      }

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if duplicate emails are allowed
      const allowDuplicates = await AuthUsersController.checkDuplicateEmailPolicy(parseInt(projectId));
      
      if (!allowDuplicates) {
        // Check if email already exists in this project
        const existingUser = await AuthUsersController.pool.query(
          `SELECT id FROM ${schemaName}.app_users WHERE email = $1`,
          [email]
        );

        if (existingUser.rows.length > 0) {
          return ResponseUtils.error(res, 'User with this email already exists', null, null, 400);
        }
      }

      // Create user in SuperTokens
      let superTokensUserId: string | undefined;
      try {
        const signUpResponse = await EmailPassword.signUp('public', email, password);

        if (signUpResponse.status === 'OK') {
          superTokensUserId = signUpResponse.user.id;
          console.log(`✅ Created SuperTokens user: ${superTokensUserId}`);
        } else if (signUpResponse.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
          // User exists in SuperTokens, try to get their ID
          const existingUsers = await EmailPassword.getUserByEmail('public', email);
          if (existingUsers) {
            superTokensUserId = existingUsers.id;
            console.log(`ℹ️  Using existing SuperTokens user: ${superTokensUserId}`);
          }
        }
      } catch (stError) {
        console.error('SuperTokens user creation error:', stError);
        // Continue without SuperTokens ID if it fails
      }

      // Create user in app_users table
      const insertQuery = `
        INSERT INTO ${schemaName}.app_users (supertokens_user_id, name, email, phone, metadata, is_active)
        VALUES ($1, $2, $3, $4, $5, true)
        RETURNING *
      `;

      const result = await AuthUsersController.pool.query(insertQuery, [
        superTokensUserId || null,
        name,
        email,
        phone || null,
        JSON.stringify(metadata || {}),
      ]);

      const newUser = result.rows[0];

      // Assign roles if provided
      if (role_ids && role_ids.length > 0) {
        for (const roleId of role_ids) {
          await AuthUsersController.pool.query(
            `INSERT INTO ${schemaName}.app_user_roles (app_user_id, role_id, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (app_user_id, role_id) DO NOTHING`,
            [newUser.id, roleId, req.user.userId]
          );
        }
      } else {
        // Assign default role if no roles specified
        const defaultRoleResult = await AuthUsersController.pool.query(
          `SELECT default_role_id FROM auth_settings WHERE project_id = $1`,
          [parseInt(projectId)]
        );

        if (defaultRoleResult.rows.length > 0 && defaultRoleResult.rows[0].default_role_id) {
          await AuthUsersController.pool.query(
            `INSERT INTO ${schemaName}.app_user_roles (app_user_id, role_id, assigned_by)
             VALUES ($1, $2, $3)
             ON CONFLICT (app_user_id, role_id) DO NOTHING`,
            [newUser.id, defaultRoleResult.rows[0].default_role_id, req.user.userId]
          );
        }
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
        FROM ${schemaName}.app_users u
        LEFT JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.app_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        `,
        [newUser.id]
      );

      ResponseUtils.success(res, 'User created successfully', userWithRoles.rows[0], 201);
    } catch (error) {
      console.error('Error creating user:', error);
      ResponseUtils.error(res, 'Failed to create user', error);
    }
  }

  /**
   * Update a user
   * PUT /api/auth/:projectId/users/:userId
   */
  static async updateUser(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId, userId } = req.params;
      const updates: UpdateUserRequest = req.body;

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
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
        const allowDuplicates = await AuthUsersController.checkDuplicateEmailPolicy(parseInt(projectId));
        
        if (!allowDuplicates) {
          const existingUser = await AuthUsersController.pool.query(
            `SELECT id FROM ${schemaName}.app_users WHERE email = $1 AND id != $2`,
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
        UPDATE ${schemaName}.app_users
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
        FROM ${schemaName}.app_users u
        LEFT JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
        LEFT JOIN ${schemaName}.app_roles r ON ur.role_id = r.id
        WHERE u.id = $1
        GROUP BY u.id
        `,
        [parseInt(userId)]
      );

      ResponseUtils.success(res, 'User updated successfully', userWithRoles.rows[0]);
    } catch (error) {
      console.error('Error updating user:', error);
      ResponseUtils.error(res, 'Failed to update user', error);
    }
  }

  /**
   * Delete a user
   * DELETE /api/auth/:projectId/users/:userId
   */
  static async deleteUser(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId, userId } = req.params;
      const { permanent = 'false' } = req.query;

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Get user to check if they exist and get SuperTokens ID
      const userResult = await AuthUsersController.pool.query(
        `SELECT * FROM ${schemaName}.app_users WHERE id = $1`,
        [parseInt(userId)]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      if (permanent === 'true') {
        // Permanent deletion
        await AuthUsersController.pool.query(
          `DELETE FROM ${schemaName}.app_users WHERE id = $1`,
          [parseInt(userId)]
        );

        // Delete from SuperTokens if they have a SuperTokens ID
        if (user.supertokens_user_id) {
          try {
            await EmailPassword.deleteUser(user.supertokens_user_id);
            console.log(`✅ Deleted SuperTokens user: ${user.supertokens_user_id}`);
          } catch (stError) {
            console.error('Error deleting SuperTokens user:', stError);
            // Continue even if SuperTokens deletion fails
          }
        }

        ResponseUtils.success(res, 'User permanently deleted');
      } else {
        // Soft delete (deactivate)
        await AuthUsersController.pool.query(
          `UPDATE ${schemaName}.app_users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [parseInt(userId)]
        );

        ResponseUtils.success(res, 'User deactivated successfully');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      ResponseUtils.error(res, 'Failed to delete user', error);
    }
  }

  /**
   * Assign a role to a user
   * POST /api/auth/:projectId/users/:userId/roles
   */
  static async assignRole(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId, userId } = req.params;
      const { role_id } = req.body;

      if (!role_id) {
        return ResponseUtils.error(res, 'Role ID is required', null, null, 400);
      }

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if role exists
      const roleCheck = await AuthUsersController.pool.query(
        `SELECT id FROM ${schemaName}.app_roles WHERE id = $1`,
        [role_id]
      );

      if (roleCheck.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      // Assign role
      await AuthUsersController.pool.query(
        `INSERT INTO ${schemaName}.app_user_roles (app_user_id, role_id, assigned_by)
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
  static async removeRole(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId, userId, roleId } = req.params;

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Remove role
      const result = await AuthUsersController.pool.query(
        `DELETE FROM ${schemaName}.app_user_roles 
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
  static async getUsersByRole(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId, roleId } = req.params;

      const schemaName = await AuthUsersController.getProjectSchema(parseInt(projectId));
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const usersQuery = `
        SELECT u.*
        FROM ${schemaName}.app_users u
        INNER JOIN ${schemaName}.app_user_roles ur ON u.id = ur.app_user_id
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

