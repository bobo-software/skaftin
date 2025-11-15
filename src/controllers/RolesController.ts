import { Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';

interface Role {
  id: number;
  role_name: string;
  role_key: string;
  description?: string;
  permissions: any[];
  session_duration_minutes: number;
  is_system_role: boolean;
  created_at: Date;
  updated_at: Date;
}

interface CreateRoleRequest {
  role_name: string;
  role_key: string;
  description?: string;
  permissions?: any[];
  session_duration_minutes?: number;
}

interface UpdateRoleRequest {
  role_name?: string;
  description?: string;
  permissions?: any[];
  session_duration_minutes?: number;
}

class RolesController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    RolesController.pool = pool;
  }

  /**
   * Get project schema name from project ID
   */
  private static async getProjectSchema(projectId: number): Promise<string | null> {
    try {
      const result = await RolesController.pool.query(
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
   * List all roles for a project
   * GET /api/auth/:projectId/roles
   */
  static async listRoles(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { include_user_count = 'false' } = req.query;

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      let rolesQuery: string;
      
      if (include_user_count === 'true') {
        rolesQuery = `
          SELECT 
            r.*,
            COUNT(DISTINCT ur.app_user_id) as user_count
          FROM ${schemaName}.app_roles r
          LEFT JOIN ${schemaName}.app_user_roles ur ON r.id = ur.role_id
          GROUP BY r.id
          ORDER BY r.is_system_role DESC, r.created_at ASC
        `;
      } else {
        rolesQuery = `
          SELECT *
          FROM ${schemaName}.app_roles
          ORDER BY is_system_role DESC, created_at ASC
        `;
      }

      const result = await RolesController.pool.query(rolesQuery);

      ResponseUtils.success(res, 'Roles fetched successfully', result.rows);
    } catch (error) {
      console.error('Error fetching roles:', error);
      ResponseUtils.error(res, 'Failed to fetch roles', error);
    }
  }

  /**
   * Get a single role by ID
   * GET /api/auth/:projectId/roles/:roleId
   */
  static async getRole(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { roleId } = req.params;

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const roleQuery = `
        SELECT 
          r.*,
          COUNT(DISTINCT ur.app_user_id) as user_count
        FROM ${schemaName}.app_roles r
        LEFT JOIN ${schemaName}.app_user_roles ur ON r.id = ur.role_id
        WHERE r.id = $1
        GROUP BY r.id
      `;

      const result = await RolesController.pool.query(roleQuery, [parseInt(roleId)]);

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Role fetched successfully', result.rows[0]);
    } catch (error) {
      console.error('Error fetching role:', error);
      ResponseUtils.error(res, 'Failed to fetch role', error);
    }
  }

  /**
   * Create a new role
   * POST /api/auth/:projectId/roles
   */
  static async createRole(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const {
        role_name,
        role_key,
        description,
        permissions = [],
        session_duration_minutes = 10080, // Default 7 days
      }: CreateRoleRequest = req.body;

      // Validation
      if (!role_name || !role_key) {
        return ResponseUtils.error(res, 'Role name and role key are required', null, null, 400);
      }

      // Validate role_key format (lowercase, alphanumeric with underscores)
      if (!/^[a-z0-9_]+$/.test(role_key)) {
        return ResponseUtils.error(
          res,
          'Role key must contain only lowercase letters, numbers, and underscores',
          null,
          null,
          400
        );
      }

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if role_key already exists
      const existingRole = await RolesController.pool.query(
        `SELECT id FROM ${schemaName}.app_roles WHERE role_key = $1`,
        [role_key]
      );

      if (existingRole.rows.length > 0) {
        return ResponseUtils.error(res, 'Role with this key already exists', null, null, 400);
      }

      // Create role
      const insertQuery = `
        INSERT INTO ${schemaName}.app_roles 
        (role_name, role_key, description, permissions, session_duration_minutes, is_system_role)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING *
      `;

      const result = await RolesController.pool.query(insertQuery, [
        role_name,
        role_key,
        description || null,
        JSON.stringify(permissions),
        session_duration_minutes,
      ]);

      ResponseUtils.success(res, 'Role created successfully', result.rows[0], 201);
    } catch (error) {
      console.error('Error creating role:', error);
      ResponseUtils.error(res, 'Failed to create role', error);
    }
  }

  /**
   * Update a role
   * PUT /api/auth/:projectId/roles/:roleId
   */
  static async updateRole(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { roleId } = req.params;
      const updates: UpdateRoleRequest = req.body;

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if role exists and is not a system role
      const roleCheck = await RolesController.pool.query(
        `SELECT * FROM ${schemaName}.app_roles WHERE id = $1`,
        [parseInt(roleId)]
      );

      if (roleCheck.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      const role = roleCheck.rows[0];

      if (role.is_system_role) {
        return ResponseUtils.error(
          res,
          'System roles cannot be modified. Only permissions and session duration can be updated.',
          null,
          null,
          403
        );
      }

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.role_name !== undefined) {
        updateFields.push(`role_name = $${paramIndex++}`);
        values.push(updates.role_name);
      }

      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.permissions !== undefined) {
        updateFields.push(`permissions = $${paramIndex++}`);
        values.push(JSON.stringify(updates.permissions));
      }

      if (updates.session_duration_minutes !== undefined) {
        updateFields.push(`session_duration_minutes = $${paramIndex++}`);
        values.push(updates.session_duration_minutes);
      }

      if (updateFields.length === 0) {
        return ResponseUtils.error(res, 'No fields to update', null, null, 400);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(roleId));

      const updateQuery = `
        UPDATE ${schemaName}.app_roles
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await RolesController.pool.query(updateQuery, values);

      ResponseUtils.success(res, 'Role updated successfully', result.rows[0]);
    } catch (error) {
      console.error('Error updating role:', error);
      ResponseUtils.error(res, 'Failed to update role', error);
    }
  }

  /**
   * Delete a role
   * DELETE /api/auth/:projectId/roles/:roleId
   */
  static async deleteRole(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { roleId } = req.params;

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if role exists and is not a system role
      const roleCheck = await RolesController.pool.query(
        `SELECT * FROM ${schemaName}.app_roles WHERE id = $1`,
        [parseInt(roleId)]
      );

      if (roleCheck.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      const role = roleCheck.rows[0];

      if (role.is_system_role) {
        return ResponseUtils.error(res, 'System roles cannot be deleted', null, null, 403);
      }

      // Check if role has users assigned
      const userCount = await RolesController.pool.query(
        `SELECT COUNT(*) as count FROM ${schemaName}.app_user_roles WHERE role_id = $1`,
        [parseInt(roleId)]
      );

      const count = parseInt(userCount.rows[0].count);

      if (count > 0) {
        return ResponseUtils.error(
          res,
          `Cannot delete role. ${count} user(s) are assigned to this role. Please reassign users first.`,
          null,
          null,
          400
        );
      }

      // Delete role
      await RolesController.pool.query(
        `DELETE FROM ${schemaName}.app_roles WHERE id = $1`,
        [parseInt(roleId)]
      );

      ResponseUtils.success(res, 'Role deleted successfully');
    } catch (error) {
      console.error('Error deleting role:', error);
      ResponseUtils.error(res, 'Failed to delete role', error);
    }
  }

  /**
   * Get role permissions
   * GET /api/auth/:projectId/roles/:roleId/permissions
   */
  static async getRolePermissions(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { roleId } = req.params;

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const result = await RolesController.pool.query(
        `SELECT permissions FROM ${schemaName}.app_roles WHERE id = $1`,
        [parseInt(roleId)]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Permissions fetched successfully', {
        permissions: result.rows[0].permissions,
      });
    } catch (error) {
      console.error('Error fetching permissions:', error);
      ResponseUtils.error(res, 'Failed to fetch permissions', error);
    }
  }

  /**
   * Update role permissions
   * PUT /api/auth/:projectId/roles/:roleId/permissions
   */
  static async updateRolePermissions(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { roleId } = req.params;
      const { permissions } = req.body;

      if (!Array.isArray(permissions)) {
        return ResponseUtils.error(res, 'Permissions must be an array', null, null, 400);
      }

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Update permissions
      const result = await RolesController.pool.query(
        `UPDATE ${schemaName}.app_roles
         SET permissions = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [JSON.stringify(permissions), parseInt(roleId)]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Permissions updated successfully', result.rows[0]);
    } catch (error) {
      console.error('Error updating permissions:', error);
      ResponseUtils.error(res, 'Failed to update permissions', error);
    }
  }

  /**
   * Update session duration for a role
   * PUT /api/auth/:projectId/roles/:roleId/session-duration
   */
  static async updateSessionDuration(req: SuperTokensAuthenticatedRequest & { projectId?: number; schemaName?: string }, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = req.projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
      }
      const { roleId } = req.params;
      const { session_duration_minutes } = req.body;

      if (typeof session_duration_minutes !== 'number' || session_duration_minutes <= 0) {
        return ResponseUtils.error(
          res,
          'Session duration must be a positive number',
          null,
          null,
          400
        );
      }

      const schemaName = await RolesController.getProjectSchema(projectId);
      if (!schemaName) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Update session duration
      const result = await RolesController.pool.query(
        `UPDATE ${schemaName}.app_roles
         SET session_duration_minutes = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [session_duration_minutes, parseInt(roleId)]
      );

      if (result.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Session duration updated successfully', result.rows[0]);
    } catch (error) {
      console.error('Error updating session duration:', error);
      ResponseUtils.error(res, 'Failed to update session duration', error);
    }
  }
}

export default RolesController;

