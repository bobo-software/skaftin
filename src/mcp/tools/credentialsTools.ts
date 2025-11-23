import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import crypto from 'crypto';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';

// Legacy export for backward compatibility during migration
export interface CredentialsToolsConfig {
  pool: Pool;
}

export function createCredentialsTools(config: CredentialsToolsConfig): Tool[] {
  return [
    // ============================================
    // API CREDENTIALS MANAGEMENT TOOLS
    // ============================================
    {
      name: 'list_skaftin_system_api_credentials',
      description: 'List all API credentials (API keys, access tokens, MCP keys) for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          type: {
            type: 'string',
            enum: ['api_key', 'access_token', 'mcp_key'],
            description: 'Filter by credential type (optional)',
          },
          include_inactive: {
            type: 'boolean',
            description: 'Include inactive credentials (default: false)',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_api_credential',
      description: 'Get details of a specific API credential by ID',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          credentialId: {
            type: 'string',
            description: 'Credential ID',
          },
        },
        required: ['projectId', 'credentialId'],
      },
    },
    {
      name: 'create_api_credential',
      description: 'Create a new API credential (API key or access token)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          name: {
            type: 'string',
            description: 'Credential name/description',
          },
          type: {
            type: 'string',
            enum: ['api_key', 'access_token'],
            description: 'Credential type (MCP keys use regenerate_mcp_key)',
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Permission strings (e.g., ["database:read", "database:write"])',
          },
          expires_in_days: {
            type: 'number',
            description: 'Expiration in days (optional, null = never expires)',
          },
        },
        required: ['projectId', 'name', 'type'],
      },
    },
    {
      name: 'update_api_credential',
      description: 'Update an API credential (name, permissions, status)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          credentialId: {
            type: 'string',
            description: 'Credential ID',
          },
          name: {
            type: 'string',
            description: 'Updated credential name (optional)',
          },
          permissions: {
            type: 'array',
            items: { type: 'string' },
            description: 'Updated permissions (optional)',
          },
          is_active: {
            type: 'boolean',
            description: 'Active status (optional)',
          },
        },
        required: ['projectId', 'credentialId'],
      },
    },
    {
      name: 'delete_api_credential',
      description: 'Delete an API credential',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          credentialId: {
            type: 'string',
            description: 'Credential ID',
          },
        },
        required: ['projectId', 'credentialId'],
      },
    },
    {
      name: 'get_mcp_key',
      description: 'Get the MCP key for a project (one per project)',
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
      name: 'regenerate_mcp_key',
      description: 'Create or regenerate the MCP key for a project',
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
      name: 'get_credential_permissions',
      description: 'Get list of available permissions for API credentials',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

// Helper functions
function generateApiKey(): string {
  return 'sk_' + crypto.randomBytes(32).toString('hex');
}

function generateAccessToken(): string {
  return 'sat_' + crypto.randomBytes(32).toString('hex');
}

function generateMcpKey(): string {
  return 'mcp_' + crypto.randomBytes(32).toString('hex');
}

// Legacy export for backward compatibility during migration
export async function handleCredentialsTool(
  name: string,
  args: any,
  config: CredentialsToolsConfig
): Promise<MCPToolResult> {
  const { pool } = config;
  const { projectId } = args;

  try {
    // ============================================
    // LIST API CREDENTIALS
    // ============================================
    if (name === 'list_skaftin_system_api_credentials') {
      const { type, include_inactive = false } = args;

      let query = 'SELECT * FROM skaftin_system_api_credentials WHERE project_id = $1';
      const params: any[] = [parseInt(projectId)];
      let paramIndex = 2;

      if (type) {
        query += ` AND credential_type = $${paramIndex}`;
        params.push(type);
        paramIndex++;
      }

      if (!include_inactive) {
        query += ' AND is_active = true';
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);

      // Don't expose full tokens in list view
      const credentials = result.rows.map(cred => ({
        ...cred,
        token: cred.token ? `${cred.token.substring(0, 10)}...` : null,
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            credentials,
            count: credentials.length,
          }, null, 2),
        }],
      };
    }

    // ============================================
    // GET API CREDENTIAL
    // ============================================
    if (name === 'get_api_credential') {
      const { credentialId } = args;

      const result = await pool.query(
        'SELECT * FROM skaftin_system_api_credentials WHERE id = $1 AND project_id = $2',
        [parseInt(credentialId), parseInt(projectId)]
      );

      if (result.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Credential not found',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            credential: result.rows[0],
          }, null, 2),
        }],
      };
    }

    // ============================================
    // CREATE API CREDENTIAL
    // ============================================
    if (name === 'create_api_credential') {
      const { name: credName, type, permissions = [], expires_in_days } = args;

      // Validate credential type
      if (!['api_key', 'access_token'].includes(type)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Invalid credential type. Must be api_key or access_token. Use regenerate_mcp_key for MCP keys.',
            }, null, 2),
          }],
        };
      }

      // Generate token
      const token = type === 'api_key' ? generateApiKey() : generateAccessToken();

      // Calculate expiration
      let expiresAt = null;
      if (expires_in_days) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expires_in_days);
      }

      // Insert credential
      const insertQuery = `
        INSERT INTO skaftin_system_api_credentials 
        (project_id, name, credential_type, token, permissions, expires_at, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING *
      `;

      const result = await pool.query(insertQuery, [
        parseInt(projectId),
        credName,
        type,
        token,
        JSON.stringify(permissions),
        expiresAt,
      ]);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'API credential created successfully',
            credential: result.rows[0],
            warning: '⚠️  IMPORTANT: Save the token now! You won\'t be able to see it again.',
          }, null, 2),
        }],
      };
    }

    // ============================================
    // UPDATE API CREDENTIAL
    // ============================================
    if (name === 'update_api_credential') {
      const { credentialId, name: credName, permissions, is_active } = args;

      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (credName !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        values.push(credName);
      }

      if (permissions !== undefined) {
        updateFields.push(`permissions = $${paramIndex++}`);
        values.push(JSON.stringify(permissions));
      }

      if (is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updateFields.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'No fields to update',
            }, null, 2),
          }],
        };
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(credentialId), parseInt(projectId));

      const updateQuery = `
        UPDATE skaftin_system_api_credentials
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex} AND project_id = $${paramIndex + 1}
        RETURNING *
      `;

      const result = await pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Credential not found',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Credential updated successfully',
            credential: result.rows[0],
          }, null, 2),
        }],
      };
    }

    // ============================================
    // DELETE API CREDENTIAL
    // ============================================
    if (name === 'delete_api_credential') {
      const { credentialId } = args;

      const result = await pool.query(
        'DELETE FROM skaftin_system_api_credentials WHERE id = $1 AND project_id = $2 RETURNING *',
        [parseInt(credentialId), parseInt(projectId)]
      );

      if (result.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'Credential not found',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Credential deleted successfully',
          }, null, 2),
        }],
      };
    }

    // ============================================
    // GET MCP KEY
    // ============================================
    if (name === 'get_mcp_key') {
      const result = await pool.query(
        'SELECT * FROM skaftin_system_api_credentials WHERE project_id = $1 AND credential_type = $2',
        [parseInt(projectId), 'mcp_key']
      );

      if (result.rows.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: 'No MCP key found for this project. Use regenerate_mcp_key to create one.',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            credential: result.rows[0],
          }, null, 2),
        }],
      };
    }

    // ============================================
    // REGENERATE MCP KEY
    // ============================================
    if (name === 'regenerate_mcp_key') {
      // Check if MCP key exists
      const existingKey = await pool.query(
        'SELECT id FROM skaftin_system_api_credentials WHERE project_id = $1 AND credential_type = $2',
        [parseInt(projectId), 'mcp_key']
      );

      const newToken = generateMcpKey();

      let result;
      if (existingKey.rows.length > 0) {
        // Update existing MCP key
        result = await pool.query(
          `UPDATE skaftin_system_api_credentials 
           SET token = $1, last_used_at = NULL, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2 AND project_id = $3
           RETURNING *`,
          [newToken, existingKey.rows[0].id, parseInt(projectId)]
        );
      } else {
        // Create new MCP key
        result = await pool.query(
          `INSERT INTO skaftin_system_api_credentials 
           (project_id, name, credential_type, token, permissions, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING *`,
          [
            parseInt(projectId),
            'MCP Integration Key',
            'mcp_key',
            newToken,
            JSON.stringify(['mcp:full_access']),
          ]
        );
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: existingKey.rows.length > 0 
              ? 'MCP key regenerated successfully' 
              : 'MCP key created successfully',
            credential: result.rows[0],
            warning: '⚠️  IMPORTANT: Save the token now! You won\'t be able to see it again.',
          }, null, 2),
        }],
      };
    }

    // ============================================
    // GET CREDENTIAL PERMISSIONS
    // ============================================
    if (name === 'get_credential_permissions') {
      const permissions = {
        database: [
          'database:read',
          'database:write',
          'database:delete',
          'database:schema',
        ],
        storage: [
          'storage:read',
          'storage:write',
          'storage:delete',
        ],
        auth: [
          'auth:read',
          'auth:write',
        ],
        graphql: [
          'graphql:query',
          'graphql:mutate',
        ],
        communications: [
          'communications:read',
          'communications:write',
        ],
        mcp: [
          'mcp:full_access',
        ],
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            permissions,
            description: 'Available permissions for API credentials (grouped by category)',
          }, null, 2),
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: `Unknown credentials tool: ${name}`,
        }, null, 2),
      }],
    };
  } catch (error: any) {
    console.error(`MCP Credentials Tool Error (${name}):`, error);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: error.message,
          tool: name,
        }, null, 2),
      }],
    };
  }
}

/**
 * Internal handler that works with MCPToolsConfig
 */
async function handleCredentialsToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  return handleCredentialsTool(toolName, args, config);
}

/**
 * Credentials tools module
 */
export const credentialsToolModule: ToolModule = {
  category: ToolCategory.CREDENTIALS,
  metadata: {
    name: 'credentials',
    description: 'API credentials and authentication management tools',
    category: ToolCategory.CREDENTIALS,
  },
  createTools: (config: MCPToolsConfig): Tool[] => createCredentialsTools(config),
  handleTool: handleCredentialsToolInternal,
  getToolNames: (): string[] => {
    return [
      'list_skaftin_system_api_credentials',
      'get_api_credential',
      'create_api_credential',
      'update_api_credential',
      'delete_api_credential',
      'get_mcp_key',
      'regenerate_mcp_key',
      'get_credential_permissions',
    ];
  },
  getClientSafeTools: (): string[] => {
    // No credentials tools are client-safe (admin only)
    return [];
  },
};

