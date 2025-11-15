import { Pool, PoolClient } from 'pg';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export interface DatabaseToolsConfig {
  pool: Pool;
}

/**
 * Get project database connection for a specific project schema
 */
async function getProjectClient(pool: Pool, projectId: string): Promise<PoolClient | null> {
  try {
    const client = await pool.connect();
    
    // Get project schema name - convert projectId to integer if it's a string
    const projectIdInt = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
    
    if (isNaN(projectIdInt)) {
      client.release();
      return null;
    }
    
    const projectResult = await client.query(
      'SELECT schema_name FROM projects WHERE id = $1',
      [projectIdInt]
    );
    
    if (projectResult.rows.length === 0) {
      client.release();
      return null;
    }
    
    const schemaName = projectResult.rows[0].schema_name;
    
    // Set search path to project schema
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    return client;
  } catch (error) {
    console.error('Error getting project client:', error);
    return null;
  }
}

export function createDatabaseTools(config: DatabaseToolsConfig): Tool[] {
  return [
    {
      name: 'search_docs',
      description: 'Search through database documentation and help content',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query string',
          },
          category: {
            type: 'string',
            enum: ['tables', 'functions', 'migrations', 'general'],
            description: 'Category to search within',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return',
            default: 10,
          },
        },
        required: ['query'],
      },
    },
    {
      name: 'list_tables',
      description: 'List all tables in a project schema',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (optional if using MCP key - will be auto-detected)',
          },
          schema: {
            type: 'string',
            description: 'Schema name (optional, defaults to project schema)',
          },
          includeMetadata: {
            type: 'boolean',
            description: 'Include column information and indexes',
            default: false,
          },
        },
        required: [],
      },
    },
    {
      name: 'list_extensions',
      description: 'Show available PostgreSQL extensions',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          installed: {
            type: 'boolean',
            description: 'Filter to show only installed extensions',
            default: false,
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'list_migrations',
      description: 'Display migration history',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of migrations to return',
            default: 50,
          },
          status: {
            type: 'string',
            enum: ['applied', 'pending', 'failed'],
            description: 'Filter by migration status',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'apply_migration',
      description: 'Execute database migrations',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          migrationFile: {
            type: 'string',
            description: 'Migration file path or SQL content',
          },
          rollback: {
            type: 'boolean',
            description: 'Rollback the migration instead of applying it',
            default: false,
          },
        },
        required: ['projectId', 'migrationFile'],
      },
    },
    {
      name: 'execute_sql',
      description: 'Run SQL queries safely',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          query: {
            type: 'string',
            description: 'SQL query to execute',
          },
          parameters: {
            type: 'array',
            description: 'Query parameters for prepared statements',
            items: {
              type: ['string', 'number', 'boolean', 'null'],
            },
          },
          readonly: {
            type: 'boolean',
            description: 'If true, only SELECT queries are allowed',
            default: true,
          },
        },
        required: ['projectId', 'query'],
      },
    },
    {
      name: 'get_logs',
      description: 'Retrieve database operation logs',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          level: {
            type: 'string',
            enum: ['error', 'warn', 'info', 'debug'],
            description: 'Log level filter',
          },
          timeRange: {
            type: 'object',
            properties: {
              start: { type: 'string', format: 'date-time' },
              end: { type: 'string', format: 'date-time' },
            },
            description: 'Time range for logs',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of log entries',
            default: 100,
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_advisors',
      description: 'Get performance and security recommendations',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          type: {
            type: 'string',
            enum: ['performance', 'security', 'maintenance'],
            description: 'Type of recommendations',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'generate_typescript_types',
      description: 'Auto-generate TypeScript types from database schema',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          schema: {
            type: 'string',
            description: 'Schema name (optional, defaults to project schema)',
          },
          outputFormat: {
            type: 'string',
            enum: ['interface', 'class', 'type'],
            description: 'TypeScript output format',
            default: 'interface',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'create_schema',
      description: 'Create new database schema',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          schemaName: {
            type: 'string',
            description: 'Name of the schema to create',
          },
          description: {
            type: 'string',
            description: 'Description of the schema',
          },
        },
        required: ['projectId', 'schemaName'],
      },
    },
    {
      name: 'create_table',
      description: 'Create a new database table with specified columns',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (optional if using MCP key - will be auto-detected)',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table to create',
          },
          columns: {
            type: 'array',
            description: 'Array of column definitions',
            items: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Column name',
                },
                type: {
                  type: 'string',
                  description: 'Column data type (e.g., INTEGER, VARCHAR, TEXT, SERIAL)',
                },
                nullable: {
                  type: 'boolean',
                  description: 'Whether the column can be NULL',
                  default: true,
                },
                primaryKey: {
                  type: 'boolean',
                  description: 'Whether this column is a primary key',
                  default: false,
                },
                defaultValue: {
                  type: 'string',
                  description: 'Default value for the column (optional)',
                },
              },
              required: ['name', 'type'],
            },
          },
        },
        required: ['tableName', 'columns'],
      },
    },
    {
      name: 'get_table_schema',
      description: 'Get the schema (column definitions) for a specific table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID (optional if using MCP key - will be auto-detected)',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
        },
        required: ['tableName'],
      },
    },
    {
      name: 'delete_schema',
      description: 'Remove database schema',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          schemaName: {
            type: 'string',
            description: 'Name of the schema to delete',
          },
          force: {
            type: 'boolean',
            description: 'Force deletion even if schema has dependencies',
            default: false,
          },
        },
        required: ['projectId', 'schemaName'],
      },
    },
    {
      name: 'insert_data',
      description: 'Insert data into a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
          data: { type: 'object', description: 'Data to insert as key-value pairs' },
        },
        required: ['projectId', 'tableName', 'data'],
      },
    },
    {
      name: 'bulk_insert_data',
      description: 'Insert multiple rows into a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
          dataArray: { type: 'array', description: 'Array of data objects to insert' },
        },
        required: ['projectId', 'tableName', 'dataArray'],
      },
    },
    {
      name: 'update_data',
      description: 'Update data in a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
          data: { type: 'object', description: 'Data to update as key-value pairs' },
          where: { type: 'object', description: 'WHERE condition as key-value pairs' },
        },
        required: ['projectId', 'tableName', 'data', 'where'],
      },
    },
    {
      name: 'delete_data',
      description: 'Delete data from a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
          where: { type: 'object', description: 'WHERE condition as key-value pairs' },
        },
        required: ['projectId', 'tableName', 'where'],
      },
    },
    {
      name: 'select_data',
      description: 'Select data from a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
          columns: { type: 'array', description: 'Columns to select (optional)' },
          where: { type: 'object', description: 'WHERE condition as key-value pairs (optional)' },
          limit: { type: 'number', description: 'Maximum number of rows to return (optional)' },
          offset: { type: 'number', description: 'Number of rows to skip (optional)' },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'drop_table',
      description: 'Drop a table from the database',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table to drop' },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'create_foreign_key',
      description: 'Create a foreign key constraint on a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID (optional if using MCP key - will be auto-detected)' },
          tableName: { type: 'string', description: 'Name of the table' },
          columnName: { type: 'string', description: 'Name of the column' },
          referencedTable: { type: 'string', description: 'Referenced table name' },
          referencedColumn: { type: 'string', description: 'Referenced column name' },
          onDelete: { type: 'string', description: 'ON DELETE action (RESTRICT, CASCADE, SET NULL, SET DEFAULT, NO ACTION)', default: 'RESTRICT' },
          onUpdate: { type: 'string', description: 'ON UPDATE action (RESTRICT, CASCADE, SET NULL, SET DEFAULT, NO ACTION)', default: 'RESTRICT' },
        },
        required: ['tableName', 'columnName', 'referencedTable', 'referencedColumn'],
      },
    },
    {
      name: 'list_all_constraints',
      description: 'List all constraints (foreign keys, primary keys, unique, check) for a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'drop_constraint',
      description: 'Drop a constraint from a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
          constraintName: { type: 'string', description: 'Name of the constraint to drop' },
        },
        required: ['projectId', 'tableName', 'constraintName'],
      },
    },
    {
      name: 'list_foreign_keys',
      description: 'List all foreign keys for a table',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          tableName: { type: 'string', description: 'Name of the table' },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'list_cron_jobs',
      description: 'List all scheduled cron jobs in the database',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'create_cron_job',
      description: 'Create a new cron job to schedule automated tasks',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          jobName: { type: 'string', description: 'Name for the cron job' },
          schedule: { type: 'string', description: 'Cron schedule expression (e.g., "*/5 * * * *" for every 5 minutes)' },
          command: { type: 'string', description: 'SQL command to execute' },
        },
        required: ['projectId', 'jobName', 'schedule', 'command'],
      },
    },
    {
      name: 'update_cron_job',
      description: 'Update an existing cron job',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          jobId: { type: 'string', description: 'Job ID' },
          jobName: { type: 'string', description: 'New job name (optional)' },
          schedule: { type: 'string', description: 'New cron schedule expression (optional)' },
          command: { type: 'string', description: 'New SQL command (optional)' },
        },
        required: ['projectId', 'jobId'],
      },
    },
    {
      name: 'delete_cron_job',
      description: 'Delete a cron job',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          jobId: { type: 'string', description: 'Job ID to delete' },
        },
        required: ['projectId', 'jobId'],
      },
    },
    {
      name: 'toggle_cron_job',
      description: 'Enable or disable a cron job',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          jobId: { type: 'string', description: 'Job ID' },
          active: { type: 'boolean', description: 'Set to true to activate, false to deactivate' },
        },
        required: ['projectId', 'jobId', 'active'],
      },
    },
    {
      name: 'get_cron_job_history',
      description: 'Get execution history for a cron job',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          jobId: { type: 'string', description: 'Job ID' },
          limit: { type: 'number', description: 'Maximum number of history entries to return', default: 50 },
        },
        required: ['projectId', 'jobId'],
      },
    },
  ];
}

export async function handleDatabaseTool(
  toolName: string,
  args: any,
  config: DatabaseToolsConfig
): Promise<any> {
  const { pool } = config;

  switch (toolName) {
    case 'search_docs': {
      // Basic implementation - search in pg_catalog and information_schema
      const { query, category, limit = 10 } = args;
      const client = await pool.connect();
      
      try {
        let searchQuery = '';
        if (category === 'tables') {
          searchQuery = `
            SELECT 
              table_schema,
              table_name,
              table_type
            FROM information_schema.tables
            WHERE table_name ILIKE $1
            ORDER BY table_schema, table_name
            LIMIT $2
          `;
        } else if (category === 'functions') {
          searchQuery = `
            SELECT 
              routine_schema,
              routine_name,
              routine_type
            FROM information_schema.routines
            WHERE routine_name ILIKE $1
            ORDER BY routine_schema, routine_name
            LIMIT $2
          `;
        } else {
          searchQuery = `
            SELECT 
              'table' as type,
              table_schema as schema,
              table_name as name
            FROM information_schema.tables
            WHERE table_name ILIKE $1
            UNION ALL
            SELECT 
              'function' as type,
              routine_schema as schema,
              routine_name as name
            FROM information_schema.routines
            WHERE routine_name ILIKE $1
            ORDER BY schema, name
            LIMIT $2
          `;
        }
        
        const result = await client.query(searchQuery, [`%${query}%`, limit]);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      } finally {
        client.release();
      }
    }

    case 'list_tables': {
      const { projectId, schema, includeMetadata = false } = args;
      
      if (!projectId) {
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Project ID is required',
              hint: 'Project ID must be provided as a parameter or auto-detected from MCP key. Ensure you are using a valid MCP key in the x-access-token header.'
            }, null, 2) 
          }],
          isError: true 
        };
      }
      
      const client = await pool.connect();
      
      try {
        // Get project info - convert projectId to integer if it's a string
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
        
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectIdInt]
        );
        
        if (projectResult.rows.length === 0) {
          console.error(`Project not found for ID: ${projectIdInt} (original: ${projectId})`);
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
        
        const schemaName = schema || projectResult.rows[0].schema_name;
        
        if (includeMetadata) {
          // Get detailed table information
          const result = await client.query(`
            SELECT 
              t.table_name,
              t.table_schema,
              json_agg(
                json_build_object(
                  'column_name', c.column_name,
                  'data_type', c.data_type,
                  'is_nullable', c.is_nullable,
                  'column_default', c.column_default
                ) ORDER BY c.ordinal_position
              ) as columns
            FROM information_schema.tables t
            LEFT JOIN information_schema.columns c 
              ON t.table_name = c.table_name 
              AND t.table_schema = c.table_schema
            WHERE t.table_schema = $1
              AND t.table_type = 'BASE TABLE'
            GROUP BY t.table_name, t.table_schema
            ORDER BY t.table_name
          `, [schemaName]);
          
          return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
        } else {
          const result = await client.query(`
            SELECT table_name, table_schema
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
          `, [schemaName]);
          
          return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
        }
      } finally {
        client.release();
      }
    }

    case 'list_extensions': {
      const { projectId, installed = false } = args;
      const client = await pool.connect();
      
      try {
        let query = '';
        if (installed) {
          query = `
            SELECT extname, extversion, extrelocatable
            FROM pg_extension
            ORDER BY extname
          `;
        } else {
          query = `
            SELECT name, default_version, comment
            FROM pg_available_extensions
            ORDER BY name
          `;
        }
        
        const result = await client.query(query);
        return { content: [{ type: 'text', text: JSON.stringify(result.rows, null, 2) }] };
      } finally {
        client.release();
      }
    }

    case 'list_migrations': {
      // This would need a migrations table - for now return placeholder
      const { projectId, limit = 50, status } = args;
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            message: 'Migration system not yet implemented',
            projectId,
            limit,
            status 
          }, null, 2) 
        }] 
      };
    }

    case 'apply_migration': {
      const { projectId, migrationFile, rollback = false } = args;
      const client = await pool.connect();
      
      try {
        // Get project schema
        const projectIdInt = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
        
        if (isNaN(projectIdInt)) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'Invalid project ID' }, null, 2) 
            }],
            isError: true 
          };
        }
        
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectIdInt]
        );
        
        if (projectResult.rows.length === 0) {
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'Project not found' }, null, 2) 
            }],
            isError: true 
          };
        }
        
        const schemaName = projectResult.rows[0].schema_name;
        
        // Set search path
        await client.query(`SET search_path TO ${schemaName}, public`);
        
        // Read migration file or use provided SQL
        let sql = migrationFile;
        if (migrationFile.includes('\n') || migrationFile.startsWith('CREATE') || migrationFile.startsWith('ALTER')) {
          sql = migrationFile;
        } else {
          // Assume it's a file path - read it (would need fs module)
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'File path migrations not yet supported. Please provide SQL directly.' 
              }, null, 2) 
            }],
            isError: true
          };
        }
        
        // Execute in transaction
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('COMMIT');
          
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                success: true, 
                message: rollback ? 'Migration rolled back' : 'Migration applied' 
              }, null, 2) 
            }] 
          };
        } catch (error: any) {
          await client.query('ROLLBACK');
          throw error;
        }
      } finally {
        client.release();
      }
    }

    case 'execute_sql': {
      const { projectId, query, parameters = [], readonly = true } = args;
      
      // Validate query for readonly mode
      if (readonly) {
        const trimmedQuery = query.trim().toUpperCase();
        if (!trimmedQuery.startsWith('SELECT') && !trimmedQuery.startsWith('WITH')) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Only SELECT queries are allowed in readonly mode' 
              }, null, 2) 
            }],
            isError: true
          };
        }
      }
      
      const client = await pool.connect();
      
      try {
        // Get project schema if provided
        if (projectId) {
          const projectIdInt = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
          
          if (!isNaN(projectIdInt)) {
            const projectResult = await client.query(
              'SELECT schema_name FROM projects WHERE id = $1',
              [projectIdInt]
            );
            
            if (projectResult.rows.length > 0) {
              const schemaName = projectResult.rows[0].schema_name;
              await client.query(`SET search_path TO ${schemaName}, public`);
            }
          }
        }
        
        const result = await client.query(query, parameters);
        
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({
              rows: result.rows,
              rowCount: result.rowCount,
              fields: result.fields?.map(f => ({
                name: f.name,
                dataTypeID: f.dataTypeID,
              })),
            }, null, 2) 
          }] 
        };
      } finally {
        client.release();
      }
    }

    case 'get_logs': {
      // Placeholder - would need logging table
      return { 
        content: [{ 
          type: 'text', 
          text: JSON.stringify({ 
            message: 'Logging system not yet implemented' 
          }, null, 2) 
        }] 
      };
    }

    case 'get_advisors': {
      const { projectId, type } = args;
      const client = await pool.connect();
      
      try {
        const projectIdInt = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
        
        if (isNaN(projectIdInt)) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'Invalid project ID' }, null, 2) 
            }],
            isError: true
          };
        }
        
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectIdInt]
        );
        
        if (projectResult.rows.length === 0) {
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'Project not found' }, null, 2) 
            }],
            isError: true 
          };
        }
        
        const schemaName = projectResult.rows[0].schema_name;
        const recommendations: any[] = [];
        
        if (type === 'performance' || !type) {
          // Check for missing indexes on foreign keys
          const indexCheck = await client.query(`
            SELECT 
              tc.table_schema, 
              tc.table_name, 
              kcu.column_name
            FROM information_schema.table_constraints AS tc 
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            LEFT JOIN pg_indexes pi 
              ON pi.schemaname = tc.table_schema
              AND pi.tablename = tc.table_name
              AND pi.indexdef LIKE '%' || kcu.column_name || '%'
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_schema = $1
              AND pi.indexname IS NULL
          `, [schemaName]);
          
          if (indexCheck.rows.length > 0) {
            recommendations.push({
              type: 'performance',
              severity: 'medium',
              message: 'Missing indexes on foreign key columns',
              details: indexCheck.rows,
            });
          }
        }
        
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ recommendations }, null, 2) 
          }] 
        };
      } finally {
        client.release();
      }
    }

    case 'generate_typescript_types': {
      const { projectId, schema, outputFormat = 'interface' } = args;
      const client = await pool.connect();
      
      try {
        const projectIdInt = typeof projectId === 'string' ? parseInt(projectId, 10) : projectId;
        
        if (isNaN(projectIdInt)) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'Invalid project ID' }, null, 2) 
            }],
            isError: true
          };
        }
        
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectIdInt]
        );
        
        if (projectResult.rows.length === 0) {
          return { 
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'Project not found' }, null, 2) 
            }],
            isError: true 
          };
        }
        
        const schemaName = schema || projectResult.rows[0].schema_name;
        
        // Get all tables with columns
        const result = await client.query(`
          SELECT 
            t.table_name,
            json_agg(
              json_build_object(
                'name', c.column_name,
                'type', c.data_type,
                'nullable', c.is_nullable === 'YES'
              ) ORDER BY c.ordinal_position
            ) as columns
          FROM information_schema.tables t
          JOIN information_schema.columns c 
            ON t.table_name = c.table_name 
            AND t.table_schema = c.table_schema
          WHERE t.table_schema = $1
            AND t.table_type = 'BASE TABLE'
          GROUP BY t.table_name
          ORDER BY t.table_name
        `, [schemaName]);
        
        // Generate TypeScript types
        const typeMap: Record<string, string> = {
          'integer': 'number',
          'bigint': 'number',
          'smallint': 'number',
          'decimal': 'number',
          'numeric': 'number',
          'real': 'number',
          'double precision': 'number',
          'boolean': 'boolean',
          'text': 'string',
          'varchar': 'string',
          'character varying': 'string',
          'char': 'string',
          'timestamp': 'Date',
          'timestamp with time zone': 'Date',
          'date': 'Date',
          'json': 'any',
          'jsonb': 'any',
        };
        
        const types = result.rows.map((table: any) => {
          const interfaceName = table.table_name.charAt(0).toUpperCase() + 
                               table.table_name.slice(1).replace(/_([a-z])/g, (_match: string, c: string) => c.toUpperCase());
          
          const props = table.columns.map((col: any) => {
            const tsType = typeMap[col.type] || 'string';
            const nullable = col.nullable ? ' | null' : '';
            return `  ${col.name}: ${tsType}${nullable};`;
          }).join('\n');
          
          if (outputFormat === 'type') {
            return `type ${interfaceName} = {\n${props}\n};`;
          } else if (outputFormat === 'class') {
            return `class ${interfaceName} {\n${props.replace(/:/g, '')}\n}`;
          } else {
            return `interface ${interfaceName} {\n${props}\n}`;
          }
        }).join('\n\n');
        
        return { 
          content: [{ 
            type: 'text', 
            text: types 
          }] 
        };
      } finally {
        client.release();
      }
    }

    case 'create_schema': {
      const { projectId, schemaName, description } = args;
      const client = await pool.connect();
      
      try {
        await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        
        if (description) {
          await client.query(
            `COMMENT ON SCHEMA ${schemaName} IS $1`,
            [description]
          );
        }
        
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: `Schema ${schemaName} created successfully` 
            }, null, 2) 
          }] 
        };
      } finally {
        client.release();
      }
    }

    case 'get_table_schema': {
      const { projectId, tableName } = args;
      
      if (!projectId) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Project ID is required',
              hint: 'Project ID must be provided as a parameter or auto-detected from MCP key. Ensure you are using a valid MCP key in the x-access-token header.'
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      if (!tableName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Table name is required' }, null, 2) 
          }],
          isError: true
        };
      }
      
      const client = await getProjectClient(pool, projectId);
      
      if (!client) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Project not found or failed to get client',
              hint: `No project exists with ID ${projectId} or failed to establish database connection. Verify the project ID or check if you have access to this project.`
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      try {
        // Get column information
        const result = await client.query(`
          SELECT 
            column_name,
            data_type,
            character_maximum_length,
            is_nullable,
            column_default,
            ordinal_position
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        if (result.rows.length === 0) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: `Table ${tableName} not found` }, null, 2) 
            }],
            isError: true
          };
        }
        
        // Get primary key information
        const pkResult = await client.query(`
          SELECT 
            a.attname as column_name
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass
            AND i.indisprimary = true
        `, [tableName]);
        
        const primaryKeys = new Set(pkResult.rows.map((row: any) => row.column_name));
        
        // Format columns
        const columns = result.rows.map((row: any) => ({
          column_name: row.column_name,
          data_type: row.data_type,
          character_maximum_length: row.character_maximum_length,
          is_nullable: row.is_nullable === 'YES',
          column_default: row.column_default,
          ordinal_position: row.ordinal_position,
          is_primary_key: primaryKeys.has(row.column_name)
        }));
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify(columns, null, 2) 
          }] 
        };
      } catch (error: any) {
        console.error('Error getting table schema:', error);
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: error.message || 'Failed to get table schema',
              details: error.code || 'UNKNOWN_ERROR'
            }, null, 2) 
          }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'create_table': {
      const { projectId, tableName, columns } = args;
      
      if (!projectId) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Project ID is required',
              hint: 'Project ID must be provided as a parameter or auto-detected from MCP key. Ensure you are using a valid MCP key in the x-access-token header.'
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      if (!tableName) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Table name is required' }, null, 2) 
          }],
          isError: true
        };
      }
      
      if (!columns || !Array.isArray(columns) || columns.length === 0) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ error: 'Columns array is required and must not be empty' }, null, 2) 
          }],
          isError: true
        };
      }
      
      const client = await getProjectClient(pool, projectId);
      
      if (!client) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Project not found or failed to get client',
              hint: `No project exists with ID ${projectId} or failed to establish database connection. Verify the project ID or check if you have access to this project.`
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      try {
        // Build CREATE TABLE statement

        // Validate table name (PostgreSQL identifier rules)
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ error: 'Invalid table name. Must start with a letter or underscore and contain only alphanumeric characters and underscores' }, null, 2) 
            }],
            isError: true
          };
        }

        // Build column definitions
        const columnDefinitions: string[] = [];
        const primaryKeyColumns: string[] = [];

        for (const column of columns) {
          if (!column.name || !column.type) {
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ error: 'Each column must have a name and type' }, null, 2) 
              }],
              isError: true
            };
          }

          // Validate column name
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(column.name)) {
            return {
              content: [{ 
                type: 'text', 
                text: JSON.stringify({ error: `Invalid column name: ${column.name}` }, null, 2) 
              }],
              isError: true
            };
          }

          // Build column definition
          let colDef = `"${column.name}" ${column.type}`;

          // Add NOT NULL constraint
          if (column.primaryKey || (!column.nullable && column.type !== 'SERIAL' && column.type !== 'BIGSERIAL')) {
            colDef += ' NOT NULL';
          }

          // Add DEFAULT value
          if (column.defaultValue !== undefined && column.defaultValue !== null && column.defaultValue !== '') {
            // For SERIAL types, don't add default
            if (column.type !== 'SERIAL' && column.type !== 'BIGSERIAL') {
              // Try to determine if it's a number or string
              const defaultValue = column.defaultValue;
              if (column.type.includes('INT') || column.type === 'DECIMAL' || column.type === 'NUMERIC' || 
                  column.type === 'REAL' || column.type === 'DOUBLE PRECISION' || column.type === 'BOOLEAN') {
                // For numeric types, use value as-is (but validate it's a number for boolean/int)
                if (column.type === 'BOOLEAN') {
                  colDef += ` DEFAULT ${defaultValue === 'true' || defaultValue === true ? 'TRUE' : 'FALSE'}`;
                } else {
                  colDef += ` DEFAULT ${defaultValue}`;
                }
              } else {
                // For string types, wrap in quotes and escape single quotes
                const escapedValue = String(defaultValue).replace(/'/g, "''");
                colDef += ` DEFAULT '${escapedValue}'`;
              }
            }
          }

          columnDefinitions.push(colDef);

          // Track primary key columns
          if (column.primaryKey) {
            primaryKeyColumns.push(`"${column.name}"`);
          }
        }

        // Build CREATE TABLE statement
        let createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefinitions.join(',\n  ')}`;
        
        // Add primary key constraint if any columns are marked as primary key
        if (primaryKeyColumns.length > 0) {
          createTableSQL += `,\n  PRIMARY KEY (${primaryKeyColumns.join(', ')})`;
        }
        
        createTableSQL += '\n)';

        // Execute CREATE TABLE statement
        await client.query(createTableSQL);

        // Emit WebSocket event
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        emitDatabaseChange(projectId, tableName, 'create_table', { tableName, columns: columns.length });

        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true,
              message: `Table ${tableName} created successfully`,
              tableName,
              columns: columns.length
            }, null, 2) 
          }] 
        };
      } catch (error: any) {
        console.error('Error creating table:', error);
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: error.message || 'Failed to create table',
              details: error.code || 'UNKNOWN_ERROR'
            }, null, 2) 
          }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'delete_schema': {
      const { projectId, schemaName, force = false } = args;
      const client = await pool.connect();
      
      try {
        if (force) {
          await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
        } else {
          await client.query(`DROP SCHEMA IF EXISTS ${schemaName} RESTRICT`);
        }
        
        return { 
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: `Schema ${schemaName} deleted successfully` 
            }, null, 2) 
          }] 
        };
      } catch (error: any) {
        if (error.code === '2BP01') {
          return {
            content: [{ 
              type: 'text', 
              text: JSON.stringify({ 
                error: 'Schema has dependencies. Use force=true to delete anyway.' 
              }, null, 2) 
            }],
            isError: true
          };
        }
        throw error;
      } finally {
        client.release();
      }
    }

    case 'insert_data': {
      const { projectId, tableName, data } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
        
        const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await client.query(query, values);
        
        // Emit WebSocket event
        emitDatabaseChange(projectId, tableName, 'insert', result.rows[0]);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ success: true, message: 'Data inserted successfully', data: result.rows[0] }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error inserting data:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'bulk_insert_data': {
      const { projectId, tableName, dataArray } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        const insertedRows = [];
        
        for (const data of dataArray) {
          const columns = Object.keys(data);
          const values = Object.values(data);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');
          
          const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
          const result = await client.query(query, values);
          insertedRows.push(result.rows[0]);
        }
        
        // Emit WebSocket event
        emitDatabaseChange(projectId, tableName, 'insert', { count: insertedRows.length });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ success: true, message: `${insertedRows.length} rows inserted successfully`, data: insertedRows }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error bulk inserting data:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'update_data': {
      const { projectId, tableName, data, where } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        const setColumns = Object.keys(data);
        const setValues = Object.values(data);
        const setClause = setColumns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
        
        const whereColumns = Object.keys(where);
        const whereValues = Object.values(where);
        const whereClause = whereColumns.map((col, i) => `"${col}" = $${setValues.length + i + 1}`).join(' AND ');
        
        const query = `UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause} RETURNING *`;
        const result = await client.query(query, [...setValues, ...whereValues]);
        
        // Emit WebSocket event
        emitDatabaseChange(projectId, tableName, 'update', result.rows);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ success: true, message: `${result.rowCount} row(s) updated successfully`, data: result.rows }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error updating data:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'delete_data': {
      const { projectId, tableName, where } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        const whereColumns = Object.keys(where);
        const whereValues = Object.values(where);
        const whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');
        
        const query = `DELETE FROM "${tableName}" WHERE ${whereClause} RETURNING *`;
        const result = await client.query(query, whereValues);
        
        // Emit WebSocket event
        emitDatabaseChange(projectId, tableName, 'delete', { count: result.rowCount, deletedRows: result.rows });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ success: true, message: `${result.rowCount} row(s) deleted successfully` }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error deleting data:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'select_data': {
      const { projectId, tableName, columns, where, limit, offset } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        let selectClause = '*';
        if (columns && columns.length > 0) {
          selectClause = columns.map((col: string) => `"${col}"`).join(', ');
        }
        
        let query = `SELECT ${selectClause} FROM "${tableName}"`;
        const values: any[] = [];
        
        if (where && Object.keys(where).length > 0) {
          const whereColumns = Object.keys(where);
          const whereValues = Object.values(where);
          const whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');
          query += ` WHERE ${whereClause}`;
          values.push(...whereValues);
        }
        
        if (limit) {
          query += ` LIMIT $${values.length + 1}`;
          values.push(limit);
        }
        
        if (offset) {
          query += ` OFFSET $${values.length + 1}`;
          values.push(offset);
        }
        
        const result = await client.query(query, values);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify(result.rows, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error selecting data:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'drop_table': {
      const { projectId, tableName } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
        
        // Emit WebSocket event
        emitDatabaseChange(projectId, tableName, 'drop_table', { tableName });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ success: true, message: `Table ${tableName} dropped successfully` }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error dropping table:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'create_foreign_key': {
      const { projectId, tableName, columnName, referencedTable, referencedColumn, onDelete = 'RESTRICT', onUpdate = 'RESTRICT' } = args;
      
      if (!projectId) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Project ID is required',
              hint: 'Project ID must be provided as a parameter or auto-detected from MCP key. Ensure you are using a valid MCP key in the x-access-token header.'
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      if (!tableName || !columnName || !referencedTable || !referencedColumn) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Missing required parameters',
              hint: 'tableName, columnName, referencedTable, and referencedColumn are all required.'
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              error: 'Project not found',
              hint: `No project exists with ID ${projectId} or failed to establish database connection. Verify the project ID or check if you have access to this project.`
            }, null, 2) 
          }],
          isError: true
        };
      }
      
      try {
        // Generate constraint name
        const constraintName = `fk_${tableName}_${columnName}_${referencedTable}_${referencedColumn}`.toLowerCase();
        
        // Create foreign key constraint
        const sql = `
          ALTER TABLE "${tableName}"
          ADD CONSTRAINT "${constraintName}"
          FOREIGN KEY ("${columnName}")
          REFERENCES "${referencedTable}" ("${referencedColumn}")
          ON DELETE ${onDelete}
          ON UPDATE ${onUpdate}
        `;
        
        await client.query(sql);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: `Foreign key constraint created successfully`,
              constraintName,
              details: {
                table: tableName,
                column: columnName,
                references: `${referencedTable}.${referencedColumn}`,
                onDelete,
                onUpdate
              }
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error creating foreign key:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'list_all_constraints': {
      const { projectId, tableName } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const result = await client.query(`
          SELECT
            tc.constraint_name,
            tc.constraint_type,
            kcu.column_name,
            ccu.table_name AS referenced_table_name,
            ccu.column_name AS referenced_column_name,
            rc.update_rule,
            rc.delete_rule,
            cc.check_clause
          FROM information_schema.table_constraints AS tc
          LEFT JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          LEFT JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          LEFT JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
          LEFT JOIN information_schema.check_constraints AS cc
            ON tc.constraint_name = cc.constraint_name
            AND tc.table_schema = cc.constraint_schema
          WHERE tc.table_schema = current_schema()
            AND tc.table_name = $1
          ORDER BY tc.constraint_type, tc.constraint_name
        `, [tableName]);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              data: result.rows 
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error listing constraints:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'drop_constraint': {
      const { projectId, tableName, constraintName } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        await client.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: `Constraint ${constraintName} dropped successfully` 
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error dropping constraint:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'list_foreign_keys': {
      const { projectId, tableName } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const result = await client.query(`
          SELECT
            tc.constraint_name,
            kcu.column_name,
            ccu.table_name AS referenced_table_name,
            ccu.column_name AS referenced_column_name,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON ccu.constraint_name = tc.constraint_name
            AND ccu.table_schema = tc.table_schema
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
            AND tc.table_schema = rc.constraint_schema
          WHERE tc.table_schema = current_schema()
            AND tc.table_name = $1
            AND tc.constraint_type = 'FOREIGN KEY'
          ORDER BY tc.constraint_name
        `, [tableName]);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              data: result.rows 
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error listing foreign keys:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'list_cron_jobs': {
      const { projectId } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const result = await client.query(`
          SELECT 
            jobid,
            schedule,
            command,
            nodename,
            nodeport,
            database,
            username,
            active,
            jobname
          FROM cron.job
          ORDER BY jobid DESC
        `);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: 'Cron jobs fetched successfully',
              data: result.rows 
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error listing cron jobs:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'create_cron_job': {
      const { projectId, jobName, schedule, command } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        // Get current schema to set search path in cron job
        const schemaResult = await client.query('SELECT current_schema()');
        const currentSchema = schemaResult.rows[0].current_schema;
        
        // Prefix command with search path
        const fullCommand = `SET search_path TO ${currentSchema}, public; ${command}`;
        
        const result = await client.query(`
          SELECT cron.schedule($1, $2, $3) as jobid
        `, [jobName, schedule, fullCommand]);
        
        // Emit WebSocket event
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        emitDatabaseChange(projectId, 'cron', 'create_cron_job', { jobName, schedule });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: 'Cron job created successfully',
              data: {
                jobid: result.rows[0].jobid,
                jobName,
                schedule,
                command: fullCommand
              }
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error creating cron job:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'update_cron_job': {
      const { projectId, jobId, jobName, schedule, command } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        // Get current schema for command update
        const schemaResult = await client.query('SELECT current_schema()');
        const currentSchema = schemaResult.rows[0].current_schema;
        
        // Update schedule if provided
        if (schedule) {
          await client.query(`
            UPDATE cron.job SET schedule = $1 WHERE jobid = $2
          `, [schedule, jobId]);
        }
        
        // Update command if provided
        if (command) {
          const fullCommand = `SET search_path TO ${currentSchema}, public; ${command}`;
          await client.query(`
            UPDATE cron.job SET command = $1 WHERE jobid = $2
          `, [fullCommand, jobId]);
        }
        
        // Update job name if provided
        if (jobName) {
          await client.query(`
            UPDATE cron.job SET jobname = $1 WHERE jobid = $2
          `, [jobName, jobId]);
        }
        
        // Emit WebSocket event
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        emitDatabaseChange(projectId, 'cron', 'update_cron_job', { jobId, schedule, command, jobName });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: 'Cron job updated successfully',
              data: { jobId, schedule, command, jobName }
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error updating cron job:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'delete_cron_job': {
      const { projectId, jobId } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        await client.query(`SELECT cron.unschedule($1)`, [jobId]);
        
        // Emit WebSocket event
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        emitDatabaseChange(projectId, 'cron', 'delete_cron_job', { jobId });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: 'Cron job deleted successfully',
              data: { jobId }
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error deleting cron job:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'toggle_cron_job': {
      const { projectId, jobId, active } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        await client.query(`
          UPDATE cron.job SET active = $1 WHERE jobid = $2
        `, [active, jobId]);
        
        // Emit WebSocket event
        const { emitDatabaseChange } = await import('../../utils/websocketEmitter');
        emitDatabaseChange(projectId, 'cron', 'toggle_cron_job', { jobId, active });
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: `Cron job ${active ? 'activated' : 'deactivated'} successfully`,
              data: { jobId, active }
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error toggling cron job:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    case 'get_cron_job_history': {
      const { projectId, jobId, limit = 50 } = args;
      const client = await getProjectClient(pool, projectId);
      if (!client) {
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: 'Project not found' }, null, 2) }],
          isError: true
        };
      }
      
      try {
        const result = await client.query(`
          SELECT 
            runid,
            jobid,
            job_pid,
            database,
            username,
            command,
            status,
            return_message,
            start_time,
            end_time
          FROM cron.job_run_details
          WHERE jobid = $1
          ORDER BY start_time DESC
          LIMIT $2
        `, [jobId, limit]);
        
        return {
          content: [{ 
            type: 'text', 
            text: JSON.stringify({ 
              success: true, 
              message: 'Cron job history fetched successfully',
              data: result.rows 
            }, null, 2) 
          }]
        };
      } catch (error: any) {
        console.error('Error fetching cron job history:', error);
        return {
          content: [{ type: 'text', text: JSON.stringify({ error: error.message }, null, 2) }],
          isError: true
        };
      } finally {
        client.release();
      }
    }

    default:
      throw new Error(`Unknown database tool: ${toolName}`);
  }
}

