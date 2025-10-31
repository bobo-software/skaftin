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
    
    // Get project schema name
    const projectResult = await client.query(
      'SELECT schema_name FROM projects WHERE id = $1',
      [projectId]
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
            description: 'Project ID',
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
        required: ['projectId'],
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
      const client = await pool.connect();
      
      try {
        // Get project info
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectId]
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
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectId]
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
          const projectResult = await client.query(
            'SELECT schema_name FROM projects WHERE id = $1',
            [projectId]
          );
          
          if (projectResult.rows.length > 0) {
            const schemaName = projectResult.rows[0].schema_name;
            await client.query(`SET search_path TO ${schemaName}, public`);
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
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectId]
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
        const projectResult = await client.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectId]
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

    default:
      throw new Error(`Unknown database tool: ${toolName}`);
  }
}

