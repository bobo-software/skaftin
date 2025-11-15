import { Pool } from 'pg';
import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { GraphQLError, graphql, print, parse } from 'graphql';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { typeDefs } from '../../graphql/typeDefs';
import { createResolvers } from '../../graphql/resolvers';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';

// Legacy export for backward compatibility during migration
export interface GraphQLToolsConfig {
  pool: Pool;
}

/**
 * Create executable GraphQL schema
 */
function createGraphQLSchema(pool: Pool) {
  const resolvers = createResolvers(pool);
  return makeExecutableSchema({
    typeDefs,
    resolvers,
  });
}

export function createGraphQLTools(config: GraphQLToolsConfig): Tool[] {
  return [
    {
      name: 'graphql_query',
      description: 'Execute a GraphQL query against the database. Use this for SELECT operations, listing tables, getting schema information, etc.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID to query',
          },
          query: {
            type: 'string',
            description: 'GraphQL query string (e.g., "query { tables(projectId: 1) { table_name } }")',
          },
          variables: {
            type: 'object',
            description: 'Variables for the GraphQL query (optional)',
          },
        },
        required: ['projectId', 'query'],
      },
    },
    {
      name: 'graphql_mutation',
      description: 'Execute a GraphQL mutation against the database. Use this for INSERT, UPDATE, DELETE, CREATE TABLE, DROP TABLE, and other data modification operations.',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID to mutate',
          },
          mutation: {
            type: 'string',
            description: 'GraphQL mutation string (e.g., "mutation { insertData(projectId: 1, tableName: \\"users\\", data: {...}) { success } }")',
          },
          variables: {
            type: 'object',
            description: 'Variables for the GraphQL mutation (optional)',
          },
        },
        required: ['projectId', 'mutation'],
      },
    },
    {
      name: 'graphql_list_tables',
      description: 'List all tables in a project using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'graphql_get_table_schema',
      description: 'Get detailed schema information for a specific table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'graphql_query_table',
      description: 'Query data from a table with optional filtering, ordering, and pagination using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table to query',
          },
          columns: {
            type: 'array',
            items: { type: 'string' },
            description: 'Specific columns to select (optional, defaults to all)',
          },
          where: {
            type: 'object',
            description: 'WHERE clause as key-value pairs (optional)',
          },
          orderBy: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                field: { type: 'string' },
                direction: { type: 'string', enum: ['ASC', 'DESC'] },
              },
            },
            description: 'Order by clause (optional)',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of rows to return (default: 100)',
          },
          offset: {
            type: 'number',
            description: 'Number of rows to skip (default: 0)',
          },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'graphql_insert_data',
      description: 'Insert a single row into a table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
          data: {
            type: 'object',
            description: 'Data to insert as key-value pairs',
          },
        },
        required: ['projectId', 'tableName', 'data'],
      },
    },
    {
      name: 'graphql_bulk_insert',
      description: 'Insert multiple rows into a table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
          dataArray: {
            type: 'array',
            items: { type: 'object' },
            description: 'Array of data objects to insert',
          },
        },
        required: ['projectId', 'tableName', 'dataArray'],
      },
    },
    {
      name: 'graphql_update_data',
      description: 'Update data in a table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
          data: {
            type: 'object',
            description: 'Data to update as key-value pairs',
          },
          where: {
            type: 'object',
            description: 'WHERE condition as key-value pairs',
          },
        },
        required: ['projectId', 'tableName', 'data', 'where'],
      },
    },
    {
      name: 'graphql_delete_data',
      description: 'Delete data from a table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
          where: {
            type: 'object',
            description: 'WHERE condition as key-value pairs',
          },
        },
        required: ['projectId', 'tableName', 'where'],
      },
    },
    {
      name: 'graphql_create_table',
      description: 'Create a new table with columns using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table to create',
          },
          columns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                nullable: { type: 'boolean' },
                defaultValue: { type: 'string' },
                primaryKey: { type: 'boolean' },
              },
              required: ['name', 'type'],
            },
            description: 'Array of column definitions',
          },
        },
        required: ['projectId', 'tableName', 'columns'],
      },
    },
    {
      name: 'graphql_drop_table',
      description: 'Drop a table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table to drop',
          },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'graphql_add_column',
      description: 'Add a column to an existing table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
          columnName: {
            type: 'string',
            description: 'Name of the column to add',
          },
          columnType: {
            type: 'string',
            description: 'Data type of the column (e.g., VARCHAR(255), INTEGER, TEXT)',
          },
          nullable: {
            type: 'boolean',
            description: 'Whether the column can be NULL',
            default: true,
          },
          defaultValue: {
            type: 'string',
            description: 'Default value for the column (optional)',
          },
        },
        required: ['projectId', 'tableName', 'columnName', 'columnType'],
      },
    },
    {
      name: 'graphql_create_foreign_key',
      description: 'Create a foreign key constraint using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
          columnName: {
            type: 'string',
            description: 'Name of the column',
          },
          referencedTable: {
            type: 'string',
            description: 'Name of the referenced table',
          },
          referencedColumn: {
            type: 'string',
            description: 'Name of the referenced column',
          },
          onDelete: {
            type: 'string',
            enum: ['CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'NO ACTION'],
            description: 'ON DELETE action',
            default: 'RESTRICT',
          },
          onUpdate: {
            type: 'string',
            enum: ['CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT', 'NO ACTION'],
            description: 'ON UPDATE action',
            default: 'RESTRICT',
          },
        },
        required: ['projectId', 'tableName', 'columnName', 'referencedTable', 'referencedColumn'],
      },
    },
    {
      name: 'graphql_get_constraints',
      description: 'Get all constraints for a table using GraphQL',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'number',
            description: 'Project ID',
          },
          tableName: {
            type: 'string',
            description: 'Name of the table',
          },
        },
        required: ['projectId', 'tableName'],
      },
    },
    {
      name: 'graphql_introspect_schema',
      description: 'Get the complete GraphQL schema definition for introspection',
      inputSchema: {
        type: 'object',
        properties: {
          includeDescriptions: {
            type: 'boolean',
            description: 'Include field descriptions',
            default: true,
          },
        },
      },
    },
  ];
}

// Legacy export for backward compatibility during migration
export async function handleGraphQLTool(
  name: string,
  args: any,
  config: GraphQLToolsConfig
): Promise<any> {
  const schema = createGraphQLSchema(config.pool);

  try {
    switch (name) {
      case 'graphql_query':
      case 'graphql_mutation': {
        const { query, mutation, variables } = args;
        const queryString = query || mutation;

        const result = await graphql({
          schema,
          source: queryString,
          variableValues: variables || {},
        });

        if (result.errors) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(
                  {
                    errors: result.errors.map((e: GraphQLError) => ({
                      message: e.message,
                      locations: e.locations,
                      path: e.path,
                      extensions: e.extensions,
                    })),
                  },
                  null,
                  2
                ),
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_list_tables': {
        const { projectId } = args;
        const query = `
          query {
            tables(projectId: ${projectId}) {
              table_name
              table_schema
              table_type
            }
          }
        `;

        const result = await graphql({ schema, source: query });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_get_table_schema': {
        const { projectId, tableName } = args;
        const query = `
          query {
            tableSchema(projectId: ${projectId}, tableName: "${tableName}") {
              column_name
              data_type
              character_maximum_length
              is_nullable
              column_default
              ordinal_position
              is_primary_key
            }
          }
        `;

        const result = await graphql({ schema, source: query });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_query_table': {
        const { projectId, tableName, columns, where, orderBy, limit, offset } = args;
        
        // Build the query dynamically
        let queryFields = 'rows { data } rowCount executionTime';
        
        const columnsArg = columns ? `columns: ${JSON.stringify(columns)}` : '';
        const whereArg = where ? `where: ${JSON.stringify(where).replace(/"([^"]+)":/g, '$1:')}` : '';
        const orderByArg = orderBy ? `orderBy: ${JSON.stringify(orderBy).replace(/"([^"]+)":/g, '$1:')}` : '';
        const limitArg = limit ? `limit: ${limit}` : '';
        const offsetArg = offset ? `offset: ${offset}` : '';
        
        const allArgs = [
          `projectId: ${projectId}`,
          `tableName: "${tableName}"`,
          columnsArg,
          whereArg,
          orderByArg,
          limitArg,
          offsetArg,
        ].filter(Boolean).join(', ');

        const query = `
          query {
            queryTable(${allArgs}) {
              ${queryFields}
            }
          }
        `;

        const result = await graphql({ schema, source: query });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_insert_data': {
        const { projectId, tableName, data } = args;
        
        const dataStr = JSON.stringify(data).replace(/"([^"]+)":/g, '$1:');
        
        const mutation = `
          mutation {
            insertData(
              projectId: ${projectId}
              tableName: "${tableName}"
              data: ${dataStr}
            ) {
              success
              message
              data
              rowCount
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_bulk_insert': {
        const { projectId, tableName, dataArray } = args;
        
        const dataArrayStr = JSON.stringify(dataArray).replace(/"([^"]+)":/g, '$1:');
        
        const mutation = `
          mutation {
            bulkInsertData(
              projectId: ${projectId}
              tableName: "${tableName}"
              dataArray: ${dataArrayStr}
            ) {
              success
              message
              data
              rowCount
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_update_data': {
        const { projectId, tableName, data, where } = args;
        
        const dataStr = JSON.stringify(data).replace(/"([^"]+)":/g, '$1:');
        const whereStr = JSON.stringify(where).replace(/"([^"]+)":/g, '$1:');
        
        const mutation = `
          mutation {
            updateData(
              projectId: ${projectId}
              tableName: "${tableName}"
              data: ${dataStr}
              where: ${whereStr}
            ) {
              success
              message
              data
              rowCount
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_delete_data': {
        const { projectId, tableName, where } = args;
        
        const whereStr = JSON.stringify(where).replace(/"([^"]+)":/g, '$1:');
        
        const mutation = `
          mutation {
            deleteData(
              projectId: ${projectId}
              tableName: "${tableName}"
              where: ${whereStr}
            ) {
              success
              message
              rowCount
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_create_table': {
        const { projectId, tableName, columns } = args;
        
        const columnsStr = JSON.stringify(columns).replace(/"([^"]+)":/g, '$1:');
        
        const mutation = `
          mutation {
            createTable(
              projectId: ${projectId}
              input: {
                tableName: "${tableName}"
                columns: ${columnsStr}
              }
            ) {
              success
              message
              data
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_drop_table': {
        const { projectId, tableName } = args;
        
        const mutation = `
          mutation {
            dropTable(
              projectId: ${projectId}
              tableName: "${tableName}"
            ) {
              success
              message
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_add_column': {
        const { projectId, tableName, columnName, columnType, nullable, defaultValue } = args;
        
        const inputStr = `{
          columnName: "${columnName}"
          columnType: "${columnType}"
          ${nullable !== undefined ? `nullable: ${nullable}` : ''}
          ${defaultValue !== undefined ? `defaultValue: "${defaultValue}"` : ''}
        }`;
        
        const mutation = `
          mutation {
            addColumn(
              projectId: ${projectId}
              tableName: "${tableName}"
              input: ${inputStr}
            ) {
              success
              message
              data
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_create_foreign_key': {
        const { projectId, tableName, columnName, referencedTable, referencedColumn, onDelete, onUpdate } = args;
        
        const inputStr = `{
          columnName: "${columnName}"
          referencedTable: "${referencedTable}"
          referencedColumn: "${referencedColumn}"
          ${onDelete ? `onDelete: "${onDelete}"` : ''}
          ${onUpdate ? `onUpdate: "${onUpdate}"` : ''}
        }`;
        
        const mutation = `
          mutation {
            createForeignKey(
              projectId: ${projectId}
              tableName: "${tableName}"
              input: ${inputStr}
            ) {
              success
              message
              data
            }
          }
        `;

        const result = await graphql({ schema, source: mutation });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_get_constraints': {
        const { projectId, tableName } = args;
        
        const query = `
          query {
            tableConstraints(projectId: ${projectId}, tableName: "${tableName}") {
              constraint_name
              constraint_type
              column_name
              referenced_table_name
              referenced_column_name
              update_rule
              delete_rule
              check_clause
            }
          }
        `;

        const result = await graphql({ schema, source: query });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      case 'graphql_introspect_schema': {
        const introspectionQuery = `
          query {
            __schema {
              types {
                name
                kind
                description
                fields {
                  name
                  description
                  type {
                    name
                    kind
                  }
                }
              }
              queryType {
                name
                fields {
                  name
                  description
                }
              }
              mutationType {
                name
                fields {
                  name
                  description
                }
              }
            }
          }
        `;

        const result = await graphql({ schema, source: introspectionQuery });
        
        if (result.errors) {
          throw new Error(result.errors[0].message);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result.data, null, 2),
            },
          ],
        };
      }

      default:
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Unknown GraphQL tool: ${name}` }, null, 2),
            },
          ],
          isError: true,
        };
    }
  } catch (error: any) {
    console.error(`Error in GraphQL tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: error.message || 'Unknown error',
              stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

/**
 * Internal handler that works with MCPToolsConfig
 */
async function handleGraphQLToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  return handleGraphQLTool(toolName, args, config);
}

/**
 * GraphQL tools module
 */
export const graphqlToolModule: ToolModule = {
  category: ToolCategory.GRAPHQL,
  metadata: {
    name: 'graphql',
    description: 'GraphQL query and mutation tools',
    category: ToolCategory.GRAPHQL,
  },
  createTools: (config: MCPToolsConfig): Tool[] => createGraphQLTools(config),
  handleTool: handleGraphQLToolInternal,
  getToolNames: (): string[] => {
    return [
      'graphql_query',
      'graphql_mutation',
      'graphql_list_tables',
      'graphql_get_table_schema',
      'graphql_query_table',
      'graphql_insert_data',
      'graphql_bulk_insert',
      'graphql_update_data',
      'graphql_delete_data',
      'graphql_create_table',
      'graphql_drop_table',
      'graphql_add_column',
      'graphql_create_foreign_key',
      'graphql_get_constraints',
      'graphql_introspect_schema',
    ];
  },
  getClientSafeTools: (): string[] => {
    // No GraphQL tools are client-safe (admin only)
    return [];
  },
};

