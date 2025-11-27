import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';

// Legacy export for backward compatibility during migration
export interface ProjectToolsConfig {
  pool: Pool;
}

export function createProjectTools(config: ProjectToolsConfig): Tool[] {
  return [
    {
      name: 'get_project_info',
      description: 'Retrieve project metadata',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (optional if using MCP key - will be auto-detected)',
          },
        },
        required: [],
      },
    },
    {
      name: 'update_project_settings',
      description: 'Modify project configurations',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          settings: {
            type: 'object',
            description: 'Project settings to update',
            properties: {
              name: { type: 'string' },
              description: { type: 'string' },
            },
          },
        },
        required: ['projectId', 'settings'],
      },
    },
    {
      name: 'list_projects',
      description: 'List all projects for the authenticated user',
      inputSchema: {
        type: 'object',
        properties: {
          userId: {
            type: 'string',
            description: 'User ID (optional, will use authenticated user)',
          },
        },
      },
    },
  ];
}

// Legacy export for backward compatibility during migration
export async function handleProjectTool(
  toolName: string,
  args: any,
  config: ProjectToolsConfig,
  userId?: string
): Promise<any> {
  const { pool } = config;

  switch (toolName) {
    case 'get_project_info': {
      const { projectId } = args;
      
      const client = await pool.connect();
      
      try {
        const projectIdInt = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
        
        if (isNaN(projectIdInt)) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Invalid project ID',
                hint: `The provided project ID "${projectId}" is not a valid number.`
              }, null, 2) 
            }],
            isError: true
          };
        }
        
        const result = await client.query(
          `SELECT 
            id,
            user_id,
            name,
            description,
            schema_name,
            created_at,
            updated_at
          FROM skaftin_system_projects 
          WHERE id = $1`,
          [projectIdInt]
        );
        
        if (result.rows.length === 0) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Project not found',
                hint: `No project exists with ID ${projectIdInt}. Verify the project ID or check if you have access to this project.`
              }, null, 2) 
            }],
            isError: true
          };
        }
        
        const project = result.rows[0];
        
        // Get schema information
        let schemaInfo = null;
        try {
          const schemaResult = await client.query(`
            SELECT 
              COUNT(*) as table_count
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'skaftin_system_%'
          `, [project.schema_name]);
          schemaInfo = {
            tableCount: parseInt(schemaResult.rows[0].table_count),
          };
        } catch (error) {
          // Schema might not exist yet
          schemaInfo = { tableCount: 0 };
        }
        
        // Get buckets for this project
        let buckets: any[] = [];
        try {
          const bucketsResult = await client.query(
            `SELECT id, bucket_name, description, created_at, updated_at
             FROM skaftin_system_project_buckets
             WHERE project_id = $1
             ORDER BY created_at`,
            [projectIdInt]
          );
          buckets = bucketsResult.rows.map((row: any) => ({
            id: row.id,
            name: row.bucket_name,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        } catch (error) {
          // Buckets might not exist yet
          buckets = [];
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: project.id.toString(),
              userId: project.user_id.toString(),
              name: project.name,
              description: project.description,
              schemaName: project.schema_name,
              buckets: buckets,
              createdAt: project.created_at,
              updatedAt: project.updated_at,
              schema: schemaInfo,
            }, null, 2)
          }]
        };
      } finally {
        client.release();
      }
    }

    case 'update_project_settings': {
      const { projectId, settings } = args;
      const client = await pool.connect();
      
      try {
        // Verify project exists and belongs to user if userId is provided
        if (userId) {
          const checkResult = await client.query(
            'SELECT id FROM skaftin_system_projects WHERE id = $1 AND user_id = $2',
            [projectId, userId]
          );
          
          if (checkResult.rows.length === 0) {
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ error: 'Project not found or access denied' }, null, 2) 
              }],
              isError: true
            };
          }
        }
        
        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;
        
        if (settings.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(settings.name);
        }
        
        if (settings.description !== undefined) {
          updates.push(`description = $${paramIndex++}`);
          values.push(settings.description);
        }
        
        if (updates.length === 0) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'No settings provided to update' }, null, 2) 
            }],
            isError: true
          };
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(projectId);
        
        const query = `
          UPDATE skaftin_system_projects 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING id, name, description, schema_name, bucket_name, created_at, updated_at
        `;
        
        const result = await client.query(query, values);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Project settings updated successfully',
              project: result.rows[0],
            }, null, 2)
          }]
        };
      } finally {
        client.release();
      }
    }

    case 'list_projects': {
      const { userId: providedUserId } = args;
      const targetUserId = providedUserId || userId;
      
      if (!targetUserId) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'User ID required' }, null, 2) 
          }],
          isError: true
        };
      }
      
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT 
            id,
            user_id,
            name,
            description,
            schema_name,
            created_at,
            updated_at
          FROM skaftin_system_projects 
          WHERE user_id = $1
          ORDER BY created_at DESC`,
          [targetUserId]
        );
        
        const projects = result.rows.map((row: any) => ({
          id: row.id.toString(),
          userId: row.user_id.toString(),
          name: row.name,
          description: row.description,
          schemaName: row.schema_name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ projects }, null, 2)
          }]
        };
      } finally {
        client.release();
      }
    }

    default:
      throw new Error(`Unknown project tool: ${toolName}`);
  }
}

/**
 * Internal handler that works with MCPToolsConfig
 */
async function handleProjectToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  const { pool } = config;
  const userId = context?.userId || context?.authenticatedUserId;

  switch (toolName) {
    case 'get_project_info': {
      const { projectId } = args;
      
      const client = await pool.connect();
      
      try {
        const projectIdInt = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
        
        if (isNaN(projectIdInt)) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Invalid project ID',
                hint: `The provided project ID "${projectId}" is not a valid number.`
              }, null, 2) 
            }],
            isError: true
          };
        }
        
        const result = await client.query(
          `SELECT 
            id,
            user_id,
            name,
            description,
            schema_name,
            created_at,
            updated_at
          FROM skaftin_system_projects 
          WHERE id = $1`,
          [projectIdInt]
        );
        
        if (result.rows.length === 0) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Project not found',
                hint: `No project exists with ID ${projectIdInt}. Verify the project ID or check if you have access to this project.`
              }, null, 2) 
            }],
            isError: true
          };
        }
        
        const project = result.rows[0];
        
        // Get schema information
        let schemaInfo = null;
        try {
          const schemaResult = await client.query(`
            SELECT 
              COUNT(*) as table_count
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type = 'BASE TABLE'
              AND table_name NOT LIKE 'skaftin_system_%'
          `, [project.schema_name]);
          schemaInfo = {
            tableCount: parseInt(schemaResult.rows[0].table_count),
          };
        } catch (error) {
          // Schema might not exist yet
          schemaInfo = { tableCount: 0 };
        }
        
        // Get buckets for this project
        let buckets: any[] = [];
        try {
          const bucketsResult = await client.query(
            `SELECT id, bucket_name, description, created_at, updated_at
             FROM skaftin_system_project_buckets
             WHERE project_id = $1
             ORDER BY created_at`,
            [projectIdInt]
          );
          buckets = bucketsResult.rows.map((row: any) => ({
            id: row.id,
            name: row.bucket_name,
            description: row.description,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
          }));
        } catch (error) {
          // Buckets might not exist yet
          buckets = [];
        }
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              id: project.id.toString(),
              userId: project.user_id.toString(),
              name: project.name,
              description: project.description,
              schemaName: project.schema_name,
              buckets: buckets,
              createdAt: project.created_at,
              updatedAt: project.updated_at,
              schema: schemaInfo,
            }, null, 2)
          }]
        };
      } finally {
        client.release();
      }
    }

    case 'update_project_settings': {
      const { projectId, settings } = args;
      const client = await pool.connect();
      
      try {
        // Verify project exists and belongs to user if userId is provided
        if (userId) {
          const checkResult = await client.query(
            'SELECT id FROM skaftin_system_projects WHERE id = $1 AND user_id = $2',
            [projectId, userId]
          );
          
          if (checkResult.rows.length === 0) {
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ error: 'Project not found or access denied' }, null, 2) 
              }],
              isError: true
            };
          }
        }
        
        // Build update query dynamically
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;
        
        if (settings.name !== undefined) {
          updates.push(`name = $${paramIndex++}`);
          values.push(settings.name);
        }
        
        if (settings.description !== undefined) {
          updates.push(`description = $${paramIndex++}`);
          values.push(settings.description);
        }
        
        if (updates.length === 0) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'No settings provided to update' }, null, 2) 
            }],
            isError: true
          };
        }
        
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(projectId);
        
        const query = `
          UPDATE skaftin_system_projects 
          SET ${updates.join(', ')}
          WHERE id = $${paramIndex}
          RETURNING id, name, description, schema_name, bucket_name, created_at, updated_at
        `;
        
        const result = await client.query(query, values);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Project settings updated successfully',
              project: result.rows[0],
            }, null, 2)
          }]
        };
      } finally {
        client.release();
      }
    }

    case 'list_projects': {
      const { userId: providedUserId } = args;
      const targetUserId = providedUserId || userId;
      
      if (!targetUserId) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'User ID required' }, null, 2) 
          }],
          isError: true
        };
      }
      
      const client = await pool.connect();
      
      try {
        const result = await client.query(
          `SELECT 
            id,
            user_id,
            name,
            description,
            schema_name,
            created_at,
            updated_at
          FROM skaftin_system_projects 
          WHERE user_id = $1
          ORDER BY created_at DESC`,
          [targetUserId]
        );
        
        const projects = result.rows.map((row: any) => ({
          id: row.id.toString(),
          userId: row.user_id.toString(),
          name: row.name,
          description: row.description,
          schemaName: row.schema_name,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }));
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ projects }, null, 2)
          }]
        };
      } finally {
        client.release();
      }
    }

    default:
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Unknown project tool: ${toolName}` }, null, 2)
        }],
        isError: true
      };
  }
}

/**
 * Project tools module
 */
export const projectToolModule: ToolModule = {
  category: ToolCategory.PROJECT,
  metadata: {
    name: 'project',
    description: 'Project management tools',
    category: ToolCategory.PROJECT,
  },
  createTools: (config: MCPToolsConfig): Tool[] => {
    return [
      {
        name: 'get_project_info',
        description: 'Retrieve project metadata',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID (optional if using MCP key - will be auto-detected)',
            },
          },
          required: [],
        },
      },
      {
        name: 'update_project_settings',
        description: 'Modify project configurations',
        inputSchema: {
          type: 'object',
          properties: {
            projectId: {
              type: 'string',
              description: 'Project ID',
            },
            settings: {
              type: 'object',
              description: 'Project settings to update',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
              },
            },
          },
          required: ['projectId', 'settings'],
        },
      },
      {
        name: 'list_projects',
        description: 'List all projects for the authenticated user',
        inputSchema: {
          type: 'object',
          properties: {
            userId: {
              type: 'string',
              description: 'User ID (optional, will use authenticated user)',
            },
          },
        },
      },
    ];
  },
  handleTool: handleProjectToolInternal,
  getToolNames: (): string[] => {
    return ['get_project_info', 'update_project_settings', 'list_projects'];
  },
  getClientSafeTools: (): string[] => {
    // Only get_project_info is safe for client endpoints
    return ['get_project_info'];
  },
};

