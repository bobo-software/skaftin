import { Pool } from 'pg';
import { GraphQLError } from 'graphql';
import { GraphQLScalarType, Kind, ValueNode } from 'graphql';
import { emitDatabaseChange } from '../utils/websocketEmitter';
import { normalizeQuery } from '../utils/SqlUtils';

// Custom JSON scalar
const JSONScalar: GraphQLScalarType = new GraphQLScalarType({
  name: 'JSON',
  description: 'JSON custom scalar type',
  serialize(value: any): any {
    return value;
  },
  parseValue(value: any): any {
    return value;
  },
  parseLiteral(ast: ValueNode): any {
    if (ast.kind === Kind.STRING || ast.kind === Kind.INT || ast.kind === Kind.FLOAT || ast.kind === Kind.BOOLEAN) {
      return ast.value;
    }
    if (ast.kind === Kind.NULL) {
      return null;
    }
    if (ast.kind === Kind.OBJECT) {
      const value: any = Object.create(null);
      ast.fields.forEach(field => {
        value[field.name.value] = JSONScalar.parseLiteral(field.value);
      });
      return value;
    }
    if (ast.kind === Kind.LIST) {
      return ast.values.map(n => JSONScalar.parseLiteral(n));
    }
    return null;
  },
});

// Custom DateTime scalar
const DateTimeScalar: GraphQLScalarType = new GraphQLScalarType({
  name: 'DateTime',
  description: 'DateTime custom scalar type',
  serialize(value: any): any {
    if (value instanceof Date) {
      return value.toISOString();
    }
    return value;
  },
  parseValue(value: any): Date {
    return new Date(value as string);
  },
  parseLiteral(ast: ValueNode): Date | null {
    if (ast.kind === Kind.STRING) {
      return new Date(ast.value);
    }
    return null;
  },
});

/**
 * Get project-specific database client
 */
async function getProjectClient(pool: Pool, projectId: number) {
  const client = await pool.connect();
  
  try {
    const result = await client.query(
      'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
      [projectId]
    );
    
    if (result.rows.length === 0) {
      client.release();
      throw new GraphQLError('Project not found', {
        extensions: { code: 'PROJECT_NOT_FOUND' }
      });
    }
    
    const schemaName = result.rows[0].schema_name;
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    return client;
  } catch (error) {
    client.release();
    throw error;
  }
}

/**
 * Create GraphQL resolvers with database pool
 */
export const createResolvers = (pool: Pool) => ({
  // Custom scalars
  JSON: JSONScalar,
  DateTime: DateTimeScalar,

  Query: {
    /**
     * Get all tables in a project
     */
    tables: async (_: any, { projectId }: { projectId: number }) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        const result = await client.query(`
          SELECT 
            table_name,
            table_schema,
            table_type
          FROM information_schema.tables
          WHERE table_schema = current_schema()
            AND table_type = 'BASE TABLE'
            AND table_name NOT LIKE 'skaftin_system_%'
          ORDER BY table_name
        `);

        client.release();
        return result.rows;
      } catch (error) {
        client.release();
        console.error('Error fetching tables:', error);
        throw new GraphQLError('Failed to fetch tables', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Get table schema (columns)
     */
    tableSchema: async (_: any, { projectId, tableName }: { projectId: number; tableName: string }) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
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
          client.release();
          throw new GraphQLError('Table not found', {
            extensions: { code: 'TABLE_NOT_FOUND' }
          });
        }

        // Get primary keys
        const pkResult = await client.query(`
          SELECT a.attname as column_name
          FROM pg_index i
          JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
          WHERE i.indrelid = $1::regclass AND i.indisprimary = true
        `, [tableName]);

        const primaryKeys = new Set(pkResult.rows.map((row: any) => row.column_name));

        const columns = result.rows.map((row: any) => ({
          column_name: row.column_name,
          data_type: row.data_type,
          character_maximum_length: row.character_maximum_length,
          is_nullable: row.is_nullable === 'YES',
          column_default: row.column_default,
          ordinal_position: row.ordinal_position,
          is_primary_key: primaryKeys.has(row.column_name),
        }));

        client.release();
        return columns;
      } catch (error) {
        client.release();
        console.error('Error fetching table schema:', error);
        throw new GraphQLError('Failed to fetch table schema', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Query data from a table
     */
    queryTable: async (
      _: any,
      { 
        projectId, 
        tableName, 
        columns, 
        where, 
        limit = 100, 
        offset = 0,
        orderBy 
      }: { 
        projectId: number; 
        tableName: string; 
        columns?: string[]; 
        where?: any; 
        limit?: number; 
        offset?: number;
        orderBy?: Array<{ field: string; direction: string }>;
      }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
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

        if (orderBy && orderBy.length > 0) {
          const orderClauses = orderBy.map(o => `"${o.field}" ${o.direction}`).join(', ');
          query += ` ORDER BY ${orderClauses}`;
        }

        if (limit) {
          query += ` LIMIT $${values.length + 1}`;
          values.push(limit);
        }

        if (offset) {
          query += ` OFFSET $${values.length + 1}`;
          values.push(offset);
        }

        const startTime = Date.now();
        const result = await client.query(query, values);
        const executionTime = Date.now() - startTime;

        client.release();

        return {
          rows: result.rows.map(row => ({ data: row })),
          rowCount: result.rowCount || 0,
          columns: result.fields?.map(f => f.name) || [],
          executionTime,
        };
      } catch (error) {
        client.release();
        console.error('Error querying table:', error);
        throw new GraphQLError('Failed to query table', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Execute raw SQL query
     */
    executeQuery: async (
      _: any,
      { projectId, query, parameters = [] }: { projectId: number; query: string; parameters?: any[] }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        // Normalize query from MySQL to PostgreSQL syntax
        const normalizedQuery = normalizeQuery(query);
        
        const startTime = Date.now();
        const result = await client.query(normalizedQuery, parameters);
        const executionTime = Date.now() - startTime;

        client.release();

        return {
          rows: result.rows.map(row => ({ data: row })),
          rowCount: result.rowCount || 0,
          columns: result.fields?.map(f => f.name) || [],
          executionTime,
        };
      } catch (error) {
        client.release();
        console.error('Error executing query:', error);
        throw new GraphQLError('Failed to execute query', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Get constraints for a table
     */
    tableConstraints: async (_: any, { projectId, tableName }: { projectId: number; tableName: string }) => {
      const client = await getProjectClient(pool, projectId);
      
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

        client.release();
        return result.rows;
      } catch (error) {
        client.release();
        console.error('Error fetching constraints:', error);
        throw new GraphQLError('Failed to fetch constraints', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Get foreign keys for a table
     */
    tableForeignKeys: async (_: any, { projectId, tableName }: { projectId: number; tableName: string }) => {
      const client = await getProjectClient(pool, projectId);
      
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

        client.release();
        return result.rows;
      } catch (error) {
        client.release();
        console.error('Error fetching foreign keys:', error);
        throw new GraphQLError('Failed to fetch foreign keys', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },
  },

  Mutation: {
    /**
     * Create a new table
     */
    createTable: async (
      _: any,
      { projectId, input }: { projectId: number; input: any }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        const { tableName, columns } = input;

        if (!tableName || !columns || columns.length === 0) {
          throw new GraphQLError('Table name and columns are required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Build CREATE TABLE SQL
        const columnDefinitions: string[] = [];
        const primaryKeyColumns: string[] = [];

        for (const column of columns) {
          let colDef = `"${column.name}" ${column.type}`;
          
          if (column.primaryKey || (!column.nullable && column.type !== 'SERIAL' && column.type !== 'BIGSERIAL')) {
            colDef += ' NOT NULL';
          }
          
          if (column.defaultValue !== undefined && column.defaultValue !== null && column.defaultValue !== '') {
            if (column.type !== 'SERIAL' && column.type !== 'BIGSERIAL') {
              const postgresqlFunctions = ['CURRENT_TIMESTAMP', 'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'LOCALTIMESTAMP', 'LOCALTIME'];
              const isFunction = postgresqlFunctions.some(func => String(column.defaultValue).toUpperCase().includes(func));
              
              if (column.type.includes('INT') || column.type === 'BOOLEAN' || isFunction) {
                colDef += ` DEFAULT ${column.defaultValue}`;
              } else {
                const escapedValue = String(column.defaultValue).replace(/'/g, "''");
                colDef += ` DEFAULT '${escapedValue}'`;
              }
            }
          }
          
          columnDefinitions.push(colDef);
          
          if (column.primaryKey) {
            primaryKeyColumns.push(`"${column.name}"`);
          }
        }

        let createTableSQL = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${columnDefinitions.join(',\n  ')}`;
        
        if (primaryKeyColumns.length > 0) {
          createTableSQL += `,\n  PRIMARY KEY (${primaryKeyColumns.join(', ')})`;
        }
        
        createTableSQL += '\n)';

        await client.query(createTableSQL);
        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'create_table', { tableName, columns: columns.length });

        return {
          success: true,
          message: `Table ${tableName} created successfully`,
          data: { tableName, columns: columns.length },
        };
      } catch (error) {
        client.release();
        console.error('Error creating table:', error);
        throw new GraphQLError('Failed to create table', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Insert data into a table
     */
    insertData: async (
      _: any,
      { projectId, tableName, data }: { projectId: number; tableName: string; data: any }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        if (!data) {
          throw new GraphQLError('Data is required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        const columns = Object.keys(data);
        const values = Object.values(data);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

        const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
        const result = await client.query(query, values);

        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'insert', result.rows[0]);

        return {
          success: true,
          message: 'Data inserted successfully',
          data: result.rows[0],
          rowCount: 1,
        };
      } catch (error) {
        client.release();
        console.error('Error inserting data:', error);
        throw new GraphQLError('Failed to insert data', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Bulk insert data
     */
    bulkInsertData: async (
      _: any,
      { projectId, tableName, dataArray }: { projectId: number; tableName: string; dataArray: any[] }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
          throw new GraphQLError('Data array is required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        const insertedRows = [];

        for (const data of dataArray) {
          const columns = Object.keys(data);
          const values = Object.values(data);
          const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

          const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
          const result = await client.query(query, values);
          insertedRows.push(result.rows[0]);
        }

        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'insert', { count: insertedRows.length });

        return {
          success: true,
          message: `${insertedRows.length} rows inserted successfully`,
          data: insertedRows,
          rowCount: insertedRows.length,
        };
      } catch (error) {
        client.release();
        console.error('Error bulk inserting data:', error);
        throw new GraphQLError('Failed to bulk insert data', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Update data in a table
     */
    updateData: async (
      _: any,
      { projectId, tableName, data, where }: { projectId: number; tableName: string; data: any; where: any }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        if (!data || !where) {
          throw new GraphQLError('Data and where clause are required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Check if where clause is empty (no keys)
        const whereColumns = Object.keys(where);
        if (whereColumns.length === 0) {
          throw new GraphQLError('Where clause cannot be empty. At least one condition is required for safety.', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        const setColumns = Object.keys(data);
        const setValues = Object.values(data);
        const setClause = setColumns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');

        const whereValues = Object.values(where);
        const whereClause = whereColumns.map((col, i) => `"${col}" = $${setValues.length + i + 1}`).join(' AND ');

        const query = `UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause} RETURNING *`;
        const result = await client.query(query, [...setValues, ...whereValues]);

        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'update', result.rows);

        return {
          success: true,
          message: `${result.rowCount} row(s) updated successfully`,
          data: result.rows,
          rowCount: result.rowCount || 0,
        };
      } catch (error) {
        client.release();
        console.error('Error updating data:', error);
        throw new GraphQLError('Failed to update data', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Delete data from a table
     */
    deleteData: async (
      _: any,
      { projectId, tableName, where }: { projectId: number; tableName: string; where: any }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        if (!where) {
          throw new GraphQLError('Where clause is required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Check if where clause is empty (no keys)
        const whereColumns = Object.keys(where);
        if (whereColumns.length === 0) {
          throw new GraphQLError('Where clause cannot be empty. At least one condition is required for safety.', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        const whereValues = Object.values(where);
        const whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');

        const query = `DELETE FROM "${tableName}" WHERE ${whereClause} RETURNING *`;
        const result = await client.query(query, whereValues);

        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'delete', { count: result.rowCount });

        return {
          success: true,
          message: `${result.rowCount} row(s) deleted successfully`,
          data: { deletedCount: result.rowCount },
          rowCount: result.rowCount || 0,
        };
      } catch (error) {
        client.release();
        console.error('Error deleting data:', error);
        throw new GraphQLError('Failed to delete data', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Drop a table
     */
    dropTable: async (
      _: any,
      { projectId, tableName }: { projectId: number; tableName: string }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'drop_table', { tableName });

        return {
          success: true,
          message: `Table ${tableName} dropped successfully`,
        };
      } catch (error) {
        client.release();
        console.error('Error dropping table:', error);
        throw new GraphQLError('Failed to drop table', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Rename a table
     */
    renameTable: async (
      _: any,
      { projectId, tableName, newTableName }: { projectId: number; tableName: string; newTableName: string }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        if (!newTableName || !newTableName.trim()) {
          throw new GraphQLError('New table name is required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Validate table name
        const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (!tableNameRegex.test(newTableName)) {
          throw new GraphQLError(
            'Table name must start with a letter or underscore and contain only letters, numbers, and underscores',
            { extensions: { code: 'BAD_USER_INPUT' } }
          );
        }

        // Check if the new table name already exists
        const checkResult = await client.query(`
          SELECT table_name 
          FROM information_schema.tables 
          WHERE table_schema = current_schema() 
            AND table_name = $1
        `, [newTableName]);

        if (checkResult.rows.length > 0) {
          client.release();
          throw new GraphQLError(`Table "${newTableName}" already exists`, {
            extensions: { code: 'CONFLICT' }
          });
        }

        await client.query(`ALTER TABLE "${tableName}" RENAME TO "${newTableName}"`);
        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), newTableName, 'rename_table', { oldName: tableName, newName: newTableName });

        return {
          success: true,
          message: `Table renamed from "${tableName}" to "${newTableName}" successfully`,
          data: { oldName: tableName, newName: newTableName },
        };
      } catch (error) {
        client.release();
        console.error('Error renaming table:', error);
        throw new GraphQLError('Failed to rename table', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Add a column to a table
     */
    addColumn: async (
      _: any,
      { projectId, tableName, input }: { projectId: number; tableName: string; input: any }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        const { columnName, columnType, nullable = true, defaultValue } = input;

        if (!columnName || !columnType) {
          throw new GraphQLError('Column name and type are required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        let alterSQL = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`;
        
        if (!nullable) {
          alterSQL += ' NOT NULL';
        }
        
        if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
          const postgresqlFunctions = ['CURRENT_TIMESTAMP', 'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'LOCALTIMESTAMP', 'LOCALTIME'];
          const isFunction = postgresqlFunctions.some(func => defaultValue.toUpperCase().includes(func));
          
          if (isFunction) {
            alterSQL += ` DEFAULT ${defaultValue}`;
          } else {
            const escapedValue = String(defaultValue).replace(/'/g, "''");
            alterSQL += ` DEFAULT '${escapedValue}'`;
          }
        }

        await client.query(alterSQL);
        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'add_column', { columnName, columnType });

        return {
          success: true,
          message: `Column ${columnName} added successfully`,
          data: { columnName, columnType },
        };
      } catch (error) {
        client.release();
        console.error('Error adding column:', error);
        throw new GraphQLError('Failed to add column', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Drop a column from a table
     */
    dropColumn: async (
      _: any,
      { projectId, tableName, columnName }: { projectId: number; tableName: string; columnName: string }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        await client.query(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}"`);
        client.release();

        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'drop_column', { columnName });

        return {
          success: true,
          message: `Column ${columnName} dropped successfully`,
        };
      } catch (error) {
        client.release();
        console.error('Error dropping column:', error);
        throw new GraphQLError('Failed to drop column', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Create a foreign key constraint
     */
    createForeignKey: async (
      _: any,
      { projectId, tableName, input }: { projectId: number; tableName: string; input: any }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        const { columnName, referencedTable, referencedColumn, onDelete = 'RESTRICT', onUpdate = 'RESTRICT' } = input;

        if (!columnName || !referencedTable || !referencedColumn) {
          throw new GraphQLError('Column name, referenced table, and referenced column are required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Validate referential actions
        const validActions = ['RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'NO ACTION'];
        if (!validActions.includes(onDelete) || !validActions.includes(onUpdate)) {
          throw new GraphQLError('Invalid referential action', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        // Generate constraint name
        const constraintName = `fk_${tableName}_${columnName}_${referencedTable}_${referencedColumn}`.toLowerCase();

        const sql = `
          ALTER TABLE "${tableName}"
          ADD CONSTRAINT "${constraintName}"
          FOREIGN KEY ("${columnName}")
          REFERENCES "${referencedTable}" ("${referencedColumn}")
          ON DELETE ${onDelete}
          ON UPDATE ${onUpdate}
        `;

        await client.query(sql);
        client.release();

        return {
          success: true,
          message: 'Foreign key created successfully',
          data: {
            constraintName,
            tableName,
            columnName,
            referencedTable,
            referencedColumn,
            onDelete,
            onUpdate
          },
        };
      } catch (error) {
        client.release();
        console.error('Error creating foreign key:', error);
        throw new GraphQLError('Failed to create foreign key', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Drop a constraint from a table
     */
    dropConstraint: async (
      _: any,
      { projectId, tableName, constraintName }: { projectId: number; tableName: string; constraintName: string }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        await client.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
        client.release();

        return {
          success: true,
          message: `Constraint ${constraintName} dropped successfully`,
        };
      } catch (error) {
        client.release();
        console.error('Error dropping constraint:', error);
        throw new GraphQLError('Failed to drop constraint', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Create unique constraint
     */
    createUniqueConstraint: async (
      _: any,
      { projectId, tableName, columnName, constraintName }: { projectId: number; tableName: string; columnName: string; constraintName?: string }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        if (!columnName) {
          throw new GraphQLError('Column name is required', {
            extensions: { code: 'BAD_USER_INPUT' }
          });
        }

        const finalConstraintName = constraintName || `${tableName}_${columnName}_unique`;

        await client.query(`
          ALTER TABLE "${tableName}" 
          ADD CONSTRAINT "${finalConstraintName}" UNIQUE ("${columnName}")
        `);

        client.release();
        
        // Emit WebSocket event
        emitDatabaseChange(String(projectId), tableName, 'create_constraint', {
          constraintName: finalConstraintName,
          constraintType: 'UNIQUE',
          columnName
        });

        return {
          success: true,
          message: 'Unique constraint created successfully',
          data: {
            constraintName: finalConstraintName,
            tableName,
            columnName
          },
        };
      } catch (error) {
        client.release();
        console.error('Error creating unique constraint:', error);
        throw new GraphQLError('Failed to create unique constraint', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },

    /**
     * Execute raw SQL mutation
     */
    executeMutation: async (
      _: any,
      { projectId, query, parameters = [] }: { projectId: number; query: string; parameters?: any[] }
    ) => {
      const client = await getProjectClient(pool, projectId);
      
      try {
        const result = await client.query(query, parameters);
        client.release();

        return {
          success: true,
          message: 'Mutation executed successfully',
          data: result.rows,
          rowCount: result.rowCount || 0,
        };
      } catch (error) {
        client.release();
        console.error('Error executing mutation:', error);
        throw new GraphQLError('Failed to execute mutation', {
          extensions: { code: 'DATABASE_ERROR', originalError: error }
        });
      }
    },
  },
});

