#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

// Database connection
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'postgres',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

// API Key validation
async function validateApiKey(apiKey: string): Promise<{ userId: string; projectId: string } | null> {
  try {
    const result = await pool.query(
      `SELECT user_id, project_id FROM api_keys WHERE is_active = true`
    );
    
    for (const key of result.rows) {
      try {
        if (bcrypt.compareSync(apiKey, key.key_hash)) {
          // Check if expired
          if (key.expires_at && new Date(key.expires_at) < new Date()) {
            return null;
          }
          
          // Update last used timestamp
          await pool.query(
            `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
            [key.id]
          );
          
          return {
            userId: key.user_id,
            projectId: key.project_id
          };
        }
      } catch (error) {
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error validating API key:', error);
    return null;
  }
}

// MCP Server setup
const server = new Server(
  {
    name: 'skaftin-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'execute_sql',
        description: 'Execute SQL queries on the project database',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'SQL query to execute',
            },
            parameters: {
              type: 'array',
              description: 'Query parameters',
              items: { type: 'string' },
            },
          },
          required: ['query'],
        },
      },
      {
        name: 'list_tables',
        description: 'List all tables in the project schema',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'create_table',
        description: 'Create a new table in the project schema',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Name of the table',
            },
            columns: {
              type: 'array',
              description: 'Table column definitions',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string' },
                  nullable: { type: 'boolean' },
                  defaultValue: { type: 'string' },
                },
                required: ['name', 'type'],
              },
            },
          },
          required: ['tableName', 'columns'],
        },
      },
      {
        name: 'insert_data',
        description: 'Insert data into a table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Name of the table',
            },
            data: {
              type: 'object',
              description: 'Data to insert',
            },
          },
          required: ['tableName', 'data'],
        },
      },
      {
        name: 'select_data',
        description: 'Select data from a table',
        inputSchema: {
          type: 'object',
          properties: {
            tableName: {
              type: 'string',
              description: 'Name of the table',
            },
            where: {
              type: 'object',
              description: 'WHERE conditions',
            },
            limit: {
              type: 'number',
              description: 'Limit number of rows',
            },
          },
          required: ['tableName'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  // Extract API key from environment or args
  const apiKey = process.env.SKAFTIN_API_KEY || args?.apiKey;
  
  if (!apiKey) {
    throw new Error('API key is required. Set SKAFTIN_API_KEY environment variable or pass apiKey in arguments.');
  }
  
  // Validate API key
  const keyInfo = await validateApiKey(apiKey);
  if (!keyInfo) {
    throw new Error('Invalid or expired API key');
  }
  
  const { userId, projectId } = keyInfo;
  
  try {
    switch (name) {
      case 'execute_sql':
        const { query, parameters = [] } = args;
        const result = await pool.query(query, parameters);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                rows: result.rows,
                rowCount: result.rowCount,
                command: result.command,
              }, null, 2),
            },
          ],
        };
        
      case 'list_tables':
        const tablesResult = await pool.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = 'public' 
          ORDER BY table_name
        `);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(tablesResult.rows.map(row => row.table_name), null, 2),
            },
          ],
        };
        
      case 'create_table':
        const { tableName, columns } = args;
        const columnDefs = columns.map((col: any) => {
          let def = `${col.name} ${col.type}`;
          if (!col.nullable) def += ' NOT NULL';
          if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
          return def;
        }).join(', ');
        
        await pool.query(`CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs})`);
        return {
          content: [
            {
              type: 'text',
              text: `Table '${tableName}' created successfully`,
            },
          ],
        };
        
      case 'insert_data':
        const { tableName: insertTable, data: insertData } = args;
        const insertColumns = Object.keys(insertData);
        const insertValues = Object.values(insertData);
        const insertPlaceholders = insertColumns.map((_, i) => `$${i + 1}`).join(', ');
        
        const insertResult = await pool.query(
          `INSERT INTO ${insertTable} (${insertColumns.join(', ')}) VALUES (${insertPlaceholders}) RETURNING *`,
          insertValues
        );
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(insertResult.rows[0], null, 2),
            },
          ],
        };
        
      case 'select_data':
        const { tableName: selectTable, where = {}, limit } = args;
        let selectQuery = `SELECT * FROM ${selectTable}`;
        const selectParams: any[] = [];
        
        if (Object.keys(where).length > 0) {
          const whereClause = Object.keys(where).map((key, i) => {
            selectParams.push(where[key]);
            return `${key} = $${i + 1}`;
          }).join(' AND ');
          selectQuery += ` WHERE ${whereClause}`;
        }
        
        if (limit) {
          selectQuery += ` LIMIT ${limit}`;
        }
        
        const selectResult = await pool.query(selectQuery, selectParams);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(selectResult.rows, null, 2),
            },
          ],
        };
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new Error(`Database error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Skaftin MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
