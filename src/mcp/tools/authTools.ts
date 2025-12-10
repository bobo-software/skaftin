import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';

// Legacy export for backward compatibility during migration
export interface AuthToolsConfig {
  pool: Pool;
}

export function createAuthTools(config: AuthToolsConfig): Tool[] {
  return [
    // ============================================
    // USER MANAGEMENT TOOLS
    // ============================================
    {
      name: 'list_app_users',
      description: 'List application users for a project with optional filters. Supports dynamic filtering by any column or metadata field (e.g., association_id, metadata.association_id, metadata.department, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          search: {
            type: 'string',
            description: 'Search by name or email (optional)',
          },
          role_id: {
            type: 'string',
            description: 'Filter by role ID (optional)',
          },
          is_active: {
            type: 'boolean',
            description: 'Filter by active status (optional)',
          },
          page: {
            type: 'number',
            description: 'Page number for pagination (default: 1)',
          },
          limit: {
            type: 'number',
            description: 'Number of users per page (default: 50)',
          },
        },
        required: ['projectId'],
        additionalProperties: true, // Allow dynamic filter properties
      },
    },
    {
      name: 'get_app_user',
      description: 'Get a specific application user by ID',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          userId: {
            type: 'string',
            description: 'User ID',
          },
        },
        required: ['projectId', 'userId'],
      },
    },
    {
      name: 'create_app_user',
      description: 'Create a new application user',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          name: {
            type: 'string',
            description: 'User full name',
          },
          email: {
            type: 'string',
            description: 'User email address',
          },
          password: {
            type: 'string',
            description: 'User password (will be hashed)',
          },
          phone: {
            type: 'string',
            description: 'User phone number (optional)',
          },
          metadata: {
            type: 'object',
            description: 'Custom field values (optional)',
          },
          role_ids: {
            type: 'array',
            items: { type: 'number' },
            description: 'Role IDs to assign (optional)',
          },
        },
        required: ['projectId', 'name', 'email', 'password'],
      },
    },
    {
      name: 'update_app_user',
      description: 'Update an existing application user',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          userId: {
            type: 'string',
            description: 'User ID',
          },
          name: {
            type: 'string',
            description: 'Updated name (optional)',
          },
          email: {
            type: 'string',
            description: 'Updated email (optional)',
          },
          phone: {
            type: 'string',
            description: 'Updated phone (optional)',
          },
          metadata: {
            type: 'object',
            description: 'Updated metadata (optional)',
          },
          is_active: {
            type: 'boolean',
            description: 'Active status (optional)',
          },
        },
        required: ['projectId', 'userId'],
      },
    },
    {
      name: 'delete_app_user',
      description: 'Delete (deactivate or permanently remove) an application user',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          userId: {
            type: 'string',
            description: 'User ID',
          },
          permanent: {
            type: 'boolean',
            description: 'Permanently delete (true) or deactivate (false, default)',
          },
        },
        required: ['projectId', 'userId'],
      },
    },
    {
      name: 'assign_user_role',
      description: 'Assign a role to an application user',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          userId: {
            type: 'string',
            description: 'User ID',
          },
          roleId: {
            type: 'number',
            description: 'Role ID to assign',
          },
        },
        required: ['projectId', 'userId', 'roleId'],
      },
    },

    // ============================================
    // ROLE MANAGEMENT TOOLS
    // ============================================
    {
      name: 'list_app_roles',
      description: 'List all roles for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          include_user_count: {
            type: 'boolean',
            description: 'Include count of users per role (default: false)',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_app_role',
      description: 'Get a specific role by ID',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          roleId: {
            type: 'string',
            description: 'Role ID',
          },
        },
        required: ['projectId', 'roleId'],
      },
    },
    {
      name: 'create_app_role',
      description: 'Create a new role with permissions and session duration',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          role_name: {
            type: 'string',
            description: 'Role display name (e.g., "Manager")',
          },
          role_key: {
            type: 'string',
            description: 'Role key (lowercase, alphanumeric + underscore, e.g., "manager")',
          },
          description: {
            type: 'string',
            description: 'Role description (optional)',
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Permission array (optional, e.g., ["read", "write"])',
          },
          session_duration_minutes: {
            type: 'number',
            description: 'Session duration in minutes (default: 10080 = 7 days)',
          },
        },
        required: ['projectId', 'role_name', 'role_key'],
      },
    },
    {
      name: 'update_app_role',
      description: 'Update an existing role (system roles have restrictions)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          roleId: {
            type: 'string',
            description: 'Role ID',
          },
          role_name: {
            type: 'string',
            description: 'Updated role name (optional)',
          },
          description: {
            type: 'string',
            description: 'Updated description (optional)',
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Updated permissions (optional)',
          },
          session_duration_minutes: {
            type: 'number',
            description: 'Updated session duration (optional)',
          },
        },
        required: ['projectId', 'roleId'],
      },
    },
    {
      name: 'delete_app_role',
      description: 'Delete a custom role (system roles cannot be deleted)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          roleId: {
            type: 'string',
            description: 'Role ID',
          },
        },
        required: ['projectId', 'roleId'],
      },
    },

    // ============================================
    // CUSTOM FIELDS TOOLS
    // ============================================
    {
      name: 'list_custom_fields',
      description: 'List custom user fields for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive fields (default: false)',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'create_custom_field',
      description: 'Create a custom user field (text, number, boolean, date, select, multi_select, or reference)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          field_name: {
            type: 'string',
            description: 'Field name (lowercase, alphanumeric + underscore)',
          },
          field_label: {
            type: 'string',
            description: 'Field display label',
          },
          field_type: {
            type: 'string',
            enum: ['text', 'number', 'boolean', 'date', 'select', 'multi_select', 'reference'],
            description: 'Field type',
          },
          is_required: {
            type: 'boolean',
            description: 'Is field required (default: false)',
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            description: 'Options for select/multi_select fields',
          },
          reference_table: {
            type: 'string',
            description: 'Table name for reference fields',
          },
          reference_column: {
            type: 'string',
            description: 'Column name for reference fields',
          },
        },
        required: ['projectId', 'field_name', 'field_label', 'field_type'],
      },
    },
    {
      name: 'apply_custom_field',
      description: 'Apply a custom field (add column to skaftin_system_users table)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          fieldId: {
            type: 'string',
            description: 'Field ID',
          },
        },
        required: ['projectId', 'fieldId'],
      },
    },

    // ============================================
    // AUTH SETTINGS TOOLS
    // ============================================
    {
      name: 'get_skaftin_system_auth_settings',
      description: 'Get authentication settings for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'update_skaftin_system_auth_settings',
      description: 'Update authentication settings for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          allow_duplicate_emails: {
            type: 'boolean',
            description: 'Allow users with same email (multi-tenant)',
          },
          require_email_verification: {
            type: 'boolean',
            description: 'Require email verification',
          },
          enable_password_reset: {
            type: 'boolean',
            description: 'Enable password reset feature',
          },
          registration_enabled: {
            type: 'boolean',
            description: 'Enable user registration',
          },
          auth_enabled: {
            type: 'boolean',
            description: 'Enable/disable entire auth system',
          },
          default_role_id: {
            type: 'number',
            description: 'Default role ID for new users',
          },
          email_provider_id: {
            type: 'number',
            description: 'Email provider ID for auth emails',
          },
          send_registration_email: {
            type: 'boolean',
            description: 'Send registration email with OTP on signup',
          },
          send_verification_email: {
            type: 'boolean',
            description: 'Send email verification link after registration',
          },
          send_password_reset_email: {
            type: 'boolean',
            description: 'Send password reset email when requested',
          },
          send_welcome_email: {
            type: 'boolean',
            description: 'Send welcome email after registration',
          },
        },
        required: ['projectId'],
      },
    },
  ];
}

// Legacy export for backward compatibility during migration
export async function handleAuthTool(
  name: string,
  args: any,
  config: AuthToolsConfig
): Promise<MCPToolResult> {
  const { pool } = config;
  const { projectId } = args;

  try {
    // Get project schema
    const getProjectSchema = async (projectId: string): Promise<string | null> => {
      const result = await pool.query('SELECT schema_name FROM skaftin_system_projects WHERE id = $1', [parseInt(projectId)]);
      return result.rows.length > 0 ? result.rows[0].schema_name : null;
    };

    // ============================================
    // USER MANAGEMENT HANDLERS
    // ============================================

    if (name === 'list_app_users') {
      const { search, role_id, is_active, page = 1, limit = 50, ...dynamicFilters } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // Get available columns in the users table for dynamic filtering
      const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = $1 
          AND table_name = 'skaftin_system_users'
      `, [schemaName]);
      
      const availableColumns = new Set(columnsResult.rows.map((row: any) => row.column_name));

      const offset = (page - 1) * limit;
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
        queryParams.push(is_active);
        paramIndex++;
      }

      if (role_id) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM ${schemaName}.skaftin_system_user_roles ur 
          WHERE ur.app_user_id = u.id AND ur.role_id = $${paramIndex}
        )`);
        queryParams.push(parseInt(role_id));
        paramIndex++;
      }

      // Dynamic filters: handle any parameter that's not a reserved one
      // Supports both direct columns and metadata fields
      for (const [key, value] of Object.entries(dynamicFilters)) {
        if (value === null || value === undefined || value === '') continue; // Skip empty values
        
        const filterValue = String(value);
        const isMetadataField = key.startsWith('metadata.') || key.includes('.');
        
        if (isMetadataField) {
          // Metadata field: metadata.field_name or metadata.field.subfield
          const metadataPath = key.replace(/^metadata\./, ''); // Remove 'metadata.' prefix if present
          const pathParts = metadataPath.split('.');
          
          // Build JSONB path: metadata->>'field'->>'subfield' etc.
          let jsonbPath = 'u.metadata';
          for (let i = 0; i < pathParts.length - 1; i++) {
            jsonbPath += `->'${pathParts[i]}'`;
          }
          jsonbPath += `->>'${pathParts[pathParts.length - 1]}'`;
          
          // Use text comparison
          whereConditions.push(`(${jsonbPath})::text = $${paramIndex}`);
          queryParams.push(filterValue);
          paramIndex++;
        } else if (availableColumns.has(key)) {
          // Direct column exists - use it directly
          whereConditions.push(`u."${key}" = $${paramIndex}`);
          queryParams.push(filterValue);
          paramIndex++;
        } else {
          // Column doesn't exist - assume it's a metadata field
          // Check metadata.field_name
          whereConditions.push(`(
            u.metadata IS NOT NULL AND 
            (u.metadata->>'${key}')::text = $${paramIndex}
          )`);
          queryParams.push(filterValue);
          paramIndex++;
        }
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      const usersQuery = `
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
        ${whereClause}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      queryParams.push(limit, offset);
      const result = await pool.query(usersQuery, queryParams);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, users: result.rows, count: result.rows.length }, null, 2) }],
      };
    }

    if (name === 'get_app_user') {
      const { userId } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const userQuery = `
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
      `;

      const result = await pool.query(userQuery, [parseInt(userId)]);

      if (result.rows.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'User not found' }, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, user: result.rows[0] }, null, 2) }],
      };
    }

    if (name === 'create_app_user') {
      const { name, email, password, phone, metadata, role_ids } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // For MCP tools, we'll create users directly without SuperTokens integration
      // SuperTokens integration is handled by the controller when called via HTTP
      const insertQuery = `
        INSERT INTO ${schemaName}.skaftin_system_users (name, email, phone, metadata, is_active)
        VALUES ($1, $2, $3, $4, true)
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [name, email, phone || null, JSON.stringify(metadata || {})]);
      const newUser = result.rows[0];

      // Assign roles if provided
      if (role_ids && Array.isArray(role_ids) && role_ids.length > 0) {
        for (const roleId of role_ids) {
          await pool.query(
            `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
             VALUES ($1, $2)
             ON CONFLICT (app_user_id, role_id) DO NOTHING`,
            [newUser.id, roleId]
          );
        }
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'User created successfully (Note: Password not set via MCP - use HTTP API for password)',
            user: newUser,
          }, null, 2),
        }],
      };
    }

    if (name === 'update_app_user') {
      const { userId, name, email, phone, metadata, is_active } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (email !== undefined) {
        updateFields.push(`email = $${paramIndex++}`);
        values.push(email);
      }
      if (phone !== undefined) {
        updateFields.push(`phone = $${paramIndex++}`);
        values.push(phone);
      }
      if (metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(metadata));
      }
      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updateFields.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No fields to update' }, null, 2) }],
        };
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(userId));

      const updateQuery = `
        UPDATE ${schemaName}.skaftin_system_users
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'User not found' }, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, user: result.rows[0] }, null, 2) }],
      };
    }

    if (name === 'delete_app_user') {
      const { userId, permanent = false } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      if (permanent) {
        await pool.query(`DELETE FROM ${schemaName}.skaftin_system_users WHERE id = $1`, [parseInt(userId)]);
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'User permanently deleted' }, null, 2) }],
        };
      } else {
        await pool.query(
          `UPDATE ${schemaName}.skaftin_system_users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [parseInt(userId)]
        );
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'User deactivated' }, null, 2) }],
        };
      }
    }

    if (name === 'assign_user_role') {
      const { userId, roleId } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // Check if role assignment already exists
      const existingAssignment = await pool.query(
        `SELECT id FROM ${schemaName}.skaftin_system_user_roles 
         WHERE app_user_id = $1 AND role_id = $2`,
        [parseInt(userId), roleId]
      );

      if (existingAssignment.rows.length > 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Role already assigned to user' }, null, 2) }],
        };
      }

      // Assign role with error handling for sequence sync issues
      try {
      await pool.query(
        `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
           VALUES ($1, $2)`,
        [parseInt(userId), roleId]
      );
      } catch (insertError: any) {
        // Handle primary key sequence out-of-sync error
        if (insertError.code === '23505' && insertError.constraint === 'skaftin_system_user_roles_pkey') {
          console.warn(`⚠️ Sequence out of sync for ${schemaName}.skaftin_system_user_roles, fixing...`);
          
          // Reset the sequence to the max ID + 1
          await pool.query(`
            SELECT setval(
              pg_get_serial_sequence('${schemaName}.skaftin_system_user_roles', 'id'),
              COALESCE((SELECT MAX(id) FROM ${schemaName}.skaftin_system_user_roles), 0) + 1,
              false
            )
          `);
          
          // Check again if assignment exists (might have been created by another process)
          const recheckAssignment = await pool.query(
            `SELECT id FROM ${schemaName}.skaftin_system_user_roles 
             WHERE app_user_id = $1 AND role_id = $2`,
            [parseInt(userId), roleId]
          );
          
          if (recheckAssignment.rows.length > 0) {
            return {
              content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Role already assigned to user' }, null, 2) }],
            };
          }
          
          // Retry the insert after fixing the sequence
          await pool.query(
            `INSERT INTO ${schemaName}.skaftin_system_user_roles (app_user_id, role_id)
             VALUES ($1, $2)`,
            [parseInt(userId), roleId]
          );
        } else {
          // Re-throw if it's a different error
          throw insertError;
        }
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Role assigned successfully' }, null, 2) }],
      };
    }

    // ============================================
    // ROLE MANAGEMENT HANDLERS
    // ============================================

    if (name === 'list_app_roles') {
      const { include_user_count = false } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      let rolesQuery: string;

      if (include_user_count) {
        rolesQuery = `
          SELECT 
            r.*,
            COUNT(DISTINCT ur.app_user_id) as user_count
          FROM ${schemaName}.skaftin_system_roles r
          LEFT JOIN ${schemaName}.skaftin_system_user_roles ur ON r.id = ur.role_id
          GROUP BY r.id
          ORDER BY r.is_system_role DESC, r.created_at ASC
        `;
      } else {
        rolesQuery = `
          SELECT * FROM ${schemaName}.skaftin_system_roles
          ORDER BY is_system_role DESC, created_at ASC
        `;
      }

      const result = await pool.query(rolesQuery);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, roles: result.rows }, null, 2) }],
      };
    }

    if (name === 'get_app_role') {
      const { roleId } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const result = await pool.query(`SELECT * FROM ${schemaName}.app_roles WHERE id = $1`, [parseInt(roleId)]);

      if (result.rows.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Role not found' }, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, role: result.rows[0] }, null, 2) }],
      };
    }

    if (name === 'create_app_role') {
      const { role_name, role_key, description, permissions = [], session_duration_minutes = 10080 } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const insertQuery = `
        INSERT INTO ${schemaName}.app_roles 
        (role_name, role_key, description, permissions, session_duration_minutes, is_system_role)
        VALUES ($1, $2, $3, $4, $5, false)
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        role_name,
        role_key,
        description || null,
        JSON.stringify(permissions),
        session_duration_minutes,
      ]);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, role: result.rows[0] }, null, 2) }],
      };
    }

    if (name === 'update_app_role') {
      const { roleId, role_name, description, permissions, session_duration_minutes } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (role_name !== undefined) {
        updateFields.push(`role_name = $${paramIndex++}`);
        values.push(role_name);
      }
      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (permissions !== undefined) {
        updateFields.push(`permissions = $${paramIndex++}`);
        values.push(JSON.stringify(permissions));
      }
      if (session_duration_minutes !== undefined) {
        updateFields.push(`session_duration_minutes = $${paramIndex++}`);
        values.push(session_duration_minutes);
      }

      if (updateFields.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No fields to update' }, null, 2) }],
        };
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(roleId));

      const updateQuery = `
        UPDATE ${schemaName}.app_roles
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Role not found' }, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, role: result.rows[0] }, null, 2) }],
      };
    }

    if (name === 'delete_app_role') {
      const { roleId } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      // Check if role is system role
      const roleCheck = await pool.query(`SELECT is_system_role FROM ${schemaName}.app_roles WHERE id = $1`, [parseInt(roleId)]);

      if (roleCheck.rows.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Role not found' }, null, 2) }],
        };
      }

      if (roleCheck.rows[0].is_system_role) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Cannot delete system roles' }, null, 2) }],
        };
      }

      await pool.query(`DELETE FROM ${schemaName}.app_roles WHERE id = $1`, [parseInt(roleId)]);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Role deleted successfully' }, null, 2) }],
      };
    }

    // ============================================
    // CUSTOM FIELDS HANDLERS
    // ============================================

    if (name === 'list_custom_fields') {
      const { include_inactive = false } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      let fieldsQuery = `SELECT * FROM ${schemaName}.app_user_custom_fields`;
      if (!include_inactive) {
        fieldsQuery += ' WHERE is_active = true';
      }
      fieldsQuery += ' ORDER BY display_order ASC, created_at ASC';

      const result = await pool.query(fieldsQuery);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, fields: result.rows }, null, 2) }],
      };
    }

    if (name === 'create_custom_field') {
      const { field_name, field_label, field_type, is_required = false, options, reference_table, reference_column } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const insertQuery = `
        INSERT INTO ${schemaName}.app_user_custom_fields 
        (field_name, field_label, field_type, is_required, options, reference_table, reference_column, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, true)
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        field_name,
        field_label,
        field_type,
        is_required,
        JSON.stringify(options || null),
        reference_table || null,
        reference_column || null,
      ]);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, field: result.rows[0] }, null, 2) }],
      };
    }

    if (name === 'apply_custom_field') {
      const { fieldId } = args;
      const schemaName = await getProjectSchema(projectId);

      if (!schemaName) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Project not found' }, null, 2) }],
        };
      }

      const fieldResult = await pool.query(
        `SELECT * FROM ${schemaName}.app_user_custom_fields WHERE id = $1`,
        [parseInt(fieldId)]
      );

      if (fieldResult.rows.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Field not found' }, null, 2) }],
        };
      }

      const field = fieldResult.rows[0];

      // Map field types to PostgreSQL types
      let columnType: string;
      switch (field.field_type) {
        case 'text': columnType = 'TEXT'; break;
        case 'number': columnType = 'NUMERIC'; break;
        case 'boolean': columnType = 'BOOLEAN'; break;
        case 'date': columnType = 'TIMESTAMP'; break;
        case 'select':
        case 'multi_select': columnType = 'TEXT'; break;
        case 'reference': columnType = 'INTEGER'; break;
        default: columnType = 'TEXT';
      }

      const notNullClause = field.is_required ? 'NOT NULL' : '';
      const alterTableQuery = `ALTER TABLE ${schemaName}.app_users ADD COLUMN ${field.field_name} ${columnType} ${notNullClause}`;

      await pool.query(alterTableQuery);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, message: `Column '${field.field_name}' added to app_users table` }, null, 2),
        }],
      };
    }

    // ============================================
    // AUTH SETTINGS HANDLERS
    // ============================================

    if (name === 'get_skaftin_system_auth_settings') {
      const result = await pool.query('SELECT * FROM skaftin_system_auth_settings WHERE project_id = $1', [parseInt(projectId)]);

      if (result.rows.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Auth settings not found' }, null, 2) }],
        };
      }

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, settings: result.rows[0] }, null, 2) }],
      };
    }

    if (name === 'update_skaftin_system_auth_settings') {
      const {
        allow_duplicate_emails,
        require_email_verification,
        enable_password_reset,
        registration_enabled,
        auth_enabled,
        default_role_id,
        email_provider_id,
        send_registration_email,
        send_verification_email,
        send_password_reset_email,
        send_welcome_email,
      } = args;

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (allow_duplicate_emails !== undefined) {
        updateFields.push(`allow_duplicate_emails = $${paramIndex++}`);
        values.push(allow_duplicate_emails);
      }
      if (require_email_verification !== undefined) {
        updateFields.push(`require_email_verification = $${paramIndex++}`);
        values.push(require_email_verification);
      }
      if (enable_password_reset !== undefined) {
        updateFields.push(`enable_password_reset = $${paramIndex++}`);
        values.push(enable_password_reset);
      }
      if (registration_enabled !== undefined) {
        updateFields.push(`registration_enabled = $${paramIndex++}`);
        values.push(registration_enabled);
      }
      if (auth_enabled !== undefined) {
        updateFields.push(`auth_enabled = $${paramIndex++}`);
        values.push(auth_enabled);
      }
      if (default_role_id !== undefined) {
        updateFields.push(`default_role_id = $${paramIndex++}`);
        values.push(default_role_id);
      }
      if (email_provider_id !== undefined) {
        updateFields.push(`email_provider_id = $${paramIndex++}`);
        values.push(email_provider_id);
      }
      if (send_registration_email !== undefined) {
        updateFields.push(`send_registration_email = $${paramIndex++}`);
        values.push(send_registration_email);
      }
      if (send_verification_email !== undefined) {
        updateFields.push(`send_verification_email = $${paramIndex++}`);
        values.push(send_verification_email);
      }
      if (send_password_reset_email !== undefined) {
        updateFields.push(`send_password_reset_email = $${paramIndex++}`);
        values.push(send_password_reset_email);
      }
      if (send_welcome_email !== undefined) {
        updateFields.push(`send_welcome_email = $${paramIndex++}`);
        values.push(send_welcome_email);
      }

      if (updateFields.length === 0) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No fields to update' }, null, 2) }],
        };
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(projectId));

      const updateQuery = `
        UPDATE skaftin_system_auth_settings
        SET ${updateFields.join(', ')}
        WHERE project_id = $${paramIndex}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, values);

      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, settings: result.rows[0] }, null, 2) }],
      };
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: `Unknown tool: ${name}` }, null, 2) }],
    };
  } catch (error: any) {
    console.error(`MCP Auth Tool Error (${name}):`, error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: error.message, tool: name }, null, 2),
      }],
    };
  }
}

/**
 * Internal handler that works with MCPToolsConfig
 */
async function handleAuthToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  // Use the legacy handler which uses 'name' parameter
  return handleAuthTool(toolName, args, config);
}

/**
 * Auth tools module
 */
export const authToolModule: ToolModule = {
  category: ToolCategory.AUTH,
  metadata: {
    name: 'auth',
    description: 'Authentication and user management tools',
    category: ToolCategory.AUTH,
  },
  createTools: (config: MCPToolsConfig): Tool[] => createAuthTools(config),
  handleTool: handleAuthToolInternal,
  getToolNames: (): string[] => {
    return [
      'list_app_users',
      'get_app_user',
      'create_app_user',
      'update_app_user',
      'delete_app_user',
      'assign_user_role',
      'list_app_roles',
      'get_app_role',
      'create_app_role',
      'update_app_role',
      'delete_app_role',
      'list_custom_fields',
      'create_custom_field',
      'apply_custom_field',
      'get_skaftin_system_auth_settings',
      'update_skaftin_system_auth_settings',
    ];
  },
  getClientSafeTools: (): string[] => {
    // Client-safe auth tools (basic user management only)
    return [
      'list_app_users',
      'get_app_user',
      'create_app_user',
      'update_app_user',
      'delete_app_user',
    ];
  },
};

