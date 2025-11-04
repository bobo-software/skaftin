import { Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import ResponseUtils from '../utils/ResponseUtils';
import { emitDatabaseChange } from '../utils/websocketEmitter';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';

class DatabaseController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    DatabaseController.pool = pool;
  }

  /**
   * Get project-specific database client
   */
  private static async getProjectClient(projectId: string) {
    const client = await DatabaseController.pool.connect();
    
    try {
      const projectIdInt = parseInt(projectId, 10);
      const result = await client.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [projectIdInt]
      );
      
      if (result.rows.length === 0) {
        client.release();
        return null;
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
   * List all tables in a project
   */
  static async listTables(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware (not needed here, just for consistency)

    try {
      const { projectId } = req.params;
      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const result = await client.query(`
        SELECT 
          table_name,
          table_schema,
          table_type
        FROM information_schema.tables
        WHERE table_schema = current_schema()
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);

      client.release();
      ResponseUtils.success(res, 'Tables fetched successfully', result.rows);
    } catch (error) {
      console.error('Error fetching tables:', error);
      ResponseUtils.error(res, 'Failed to fetch tables', error);
    }
  }

  /**
   * Get table schema (columns)
   */
  static async getTableSchema(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;
      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

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
        return ResponseUtils.error(res, 'Table not found', null, null, 404);
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
      ResponseUtils.success(res, 'Table schema fetched successfully', columns);
    } catch (error) {
      console.error('Error fetching table schema:', error);
      ResponseUtils.error(res, 'Failed to fetch table schema', error);
    }
  }

  /**
   * Create a new table
   */
  static async createTable(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId } = req.params;
      const { tableName, columns } = req.body;

      if (!tableName || !columns || columns.length === 0) {
        return ResponseUtils.error(res, 'Table name and columns are required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
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
            // PostgreSQL functions (NOW, CURRENT_TIMESTAMP, etc.) should not be quoted
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
      emitDatabaseChange(projectId, tableName, 'create_table', { tableName, columns: columns.length });

      ResponseUtils.success(res, `Table ${tableName} created successfully`, { tableName, columns: columns.length }, 201);
    } catch (error) {
      console.error('Error creating table:', error);
      ResponseUtils.error(res, 'Failed to create table', error);
    }
  }

  /**
   * Execute SQL query
   */
  static async executeQuery(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId } = req.params;
      const { query, parameters = [] } = req.body;

      if (!query) {
        return ResponseUtils.error(res, 'Query is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const startTime = Date.now();
      const result = await client.query(query, parameters);
      const executionTime = Date.now() - startTime;

      client.release();

      ResponseUtils.success(res, 'Query executed successfully', {
        rows: result.rows,
        rowCount: result.rowCount,
        columns: result.fields?.map(f => f.name) || [],
        executionTime,
      });
    } catch (error) {
      console.error('Error executing query:', error);
      ResponseUtils.error(res, 'Failed to execute query', error);
    }
  }

  /**
   * Select data from a table
   */
  static async selectData(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;
      const { columns, where, limit = 100, offset = 0 } = req.body;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

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
      client.release();

      ResponseUtils.success(res, 'Data fetched successfully', result.rows);
    } catch (error) {
      console.error('Error selecting data:', error);
      ResponseUtils.error(res, 'Failed to select data', error);
    }
  }

  /**
   * Insert data into a table
   */
  static async insertData(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;
      const { data } = req.body;

      if (!data) {
        return ResponseUtils.error(res, 'Data is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

      const query = `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders}) RETURNING *`;
      const result = await client.query(query, values);

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'insert', result.rows[0]);

      ResponseUtils.success(res, 'Data inserted successfully', result.rows[0], 201);
    } catch (error) {
      console.error('Error inserting data:', error);
      ResponseUtils.error(res, 'Failed to insert data', error);
    }
  }

  /**
   * Bulk insert data
   */
  static async bulkInsertData(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;
      const { dataArray } = req.body;

      if (!dataArray || !Array.isArray(dataArray) || dataArray.length === 0) {
        return ResponseUtils.error(res, 'Data array is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
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
      emitDatabaseChange(projectId, tableName, 'insert', { count: insertedRows.length });

      ResponseUtils.success(res, `${insertedRows.length} rows inserted successfully`, insertedRows, 201);
    } catch (error) {
      console.error('Error bulk inserting data:', error);
      ResponseUtils.error(res, 'Failed to bulk insert data', error);
    }
  }

  /**
   * Update data in a table
   */
  static async updateData(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;
      const { data, where } = req.body;

      if (!data || !where) {
        return ResponseUtils.error(res, 'Data and where clause are required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const setColumns = Object.keys(data);
      const setValues = Object.values(data);
      const setClause = setColumns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');

      const whereColumns = Object.keys(where);
      const whereValues = Object.values(where);
      const whereClause = whereColumns.map((col, i) => `"${col}" = $${setValues.length + i + 1}`).join(' AND ');

      const query = `UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause} RETURNING *`;
      const result = await client.query(query, [...setValues, ...whereValues]);

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'update', result.rows);

      ResponseUtils.success(res, `${result.rowCount} row(s) updated successfully`, result.rows);
    } catch (error) {
      console.error('Error updating data:', error);
      ResponseUtils.error(res, 'Failed to update data', error);
    }
  }

  /**
   * Delete data from a table
   */
  static async deleteData(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;
      const { where } = req.body;

      if (!where) {
        return ResponseUtils.error(res, 'Where clause is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const whereColumns = Object.keys(where);
      const whereValues = Object.values(where);
      const whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');

      const query = `DELETE FROM "${tableName}" WHERE ${whereClause} RETURNING *`;
      const result = await client.query(query, whereValues);

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'delete', { count: result.rowCount });

      ResponseUtils.success(res, `${result.rowCount} row(s) deleted successfully`, { deletedCount: result.rowCount });
    } catch (error) {
      console.error('Error deleting data:', error);
      ResponseUtils.error(res, 'Failed to delete data', error);
    }
  }

  /**
   * Rename a table
   */
  static async renameTable(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;
      const { newTableName } = req.body;

      if (!newTableName || !newTableName.trim()) {
        return ResponseUtils.error(res, 'New table name is required', null, null, 400);
      }

      // Validate table name (alphanumeric and underscore only)
      const tableNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
      if (!tableNameRegex.test(newTableName)) {
        return ResponseUtils.error(
          res, 
          'Table name must start with a letter or underscore and contain only letters, numbers, and underscores', 
          null, 
          null, 
          400
        );
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
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
        return ResponseUtils.error(res, `Table "${newTableName}" already exists`, null, null, 409);
      }

      // Rename the table
      await client.query(`ALTER TABLE "${tableName}" RENAME TO "${newTableName}"`);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, newTableName, 'rename_table', { oldName: tableName, newName: newTableName });

      ResponseUtils.success(res, `Table renamed from "${tableName}" to "${newTableName}" successfully`, { 
        oldName: tableName, 
        newName: newTableName 
      });
    } catch (error) {
      console.error('Error renaming table:', error);
      ResponseUtils.error(res, 'Failed to rename table', error);
    }
  }

  /**
   * Drop a table
   */
  static async dropTable(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware

    try {
      const { projectId, tableName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      await client.query(`DROP TABLE IF EXISTS "${tableName}"`);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'drop_table', { tableName });

      ResponseUtils.success(res, `Table ${tableName} dropped successfully`);
    } catch (error) {
      console.error('Error dropping table:', error);
      ResponseUtils.error(res, 'Failed to drop table', error);
    }
  }

  /**
   * Add a column to a table
   */
  static async addColumn(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName } = req.params;
      const { columnName, columnType, nullable = true, defaultValue } = req.body;

      if (!columnName || !columnType) {
        return ResponseUtils.error(res, 'Column name and type are required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      let alterSQL = `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" ${columnType}`;
      
      if (!nullable) {
        alterSQL += ' NOT NULL';
      }
      
      if (defaultValue !== undefined && defaultValue !== null && defaultValue !== '') {
        // PostgreSQL functions (NOW, CURRENT_TIMESTAMP, etc.) should not be quoted
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
      emitDatabaseChange(projectId, tableName, 'add_column', { columnName, columnType });

      ResponseUtils.success(res, `Column ${columnName} added successfully`, { columnName, columnType });
    } catch (error) {
      console.error('Error adding column:', error);
      ResponseUtils.error(res, 'Failed to add column', error);
    }
  }

  /**
   * Alter/modify a column
   */
  static async alterColumn(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName, columnName } = req.params;
      const { newName, newType, nullable, defaultValue } = req.body;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Execute alterations in sequence
      if (newType) {
        await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" TYPE ${newType}`);
      }

      if (nullable !== undefined) {
        const nullableSQL = nullable ? 'DROP NOT NULL' : 'SET NOT NULL';
        await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" ${nullableSQL}`);
      }

      if (defaultValue !== undefined) {
        if (defaultValue === null || defaultValue === '') {
          await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" DROP DEFAULT`);
        } else {
          // PostgreSQL functions (NOW, CURRENT_TIMESTAMP, etc.) should not be quoted
          const postgresqlFunctions = ['CURRENT_TIMESTAMP', 'NOW()', 'CURRENT_DATE', 'CURRENT_TIME', 'LOCALTIMESTAMP', 'LOCALTIME'];
          const isFunction = postgresqlFunctions.some(func => String(defaultValue).toUpperCase().includes(func));
          
          if (isFunction) {
            await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT ${defaultValue}`);
          } else {
            const escapedValue = String(defaultValue).replace(/'/g, "''");
            await client.query(`ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET DEFAULT '${escapedValue}'`);
          }
        }
      }

      if (newName && newName !== columnName) {
        await client.query(`ALTER TABLE "${tableName}" RENAME COLUMN "${columnName}" TO "${newName}"`);
      }

      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'alter_column', { columnName, newName });

      ResponseUtils.success(res, `Column ${columnName} altered successfully`);
    } catch (error) {
      console.error('Error altering column:', error);
      ResponseUtils.error(res, 'Failed to alter column', error);
    }
  }

  /**
   * Drop a column from a table
   */
  static async dropColumn(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName, columnName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      await client.query(`ALTER TABLE "${tableName}" DROP COLUMN IF EXISTS "${columnName}"`);
      client.release();

      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'drop_column', { columnName });

      ResponseUtils.success(res, `Column ${columnName} dropped successfully`);
    } catch (error) {
      console.error('Error dropping column:', error);
      ResponseUtils.error(res, 'Failed to drop column', error);
    }
  }

  /**
   * List all constraints for a table
   */
  static async listConstraints(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

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
      ResponseUtils.success(res, 'Constraints fetched successfully', result.rows);
    } catch (error) {
      console.error('Error listing constraints:', error);
      ResponseUtils.error(res, 'Failed to list constraints', error);
    }
  }

  /**
   * List foreign keys for a table
   */
  static async listForeignKeys(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

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
      ResponseUtils.success(res, 'Foreign keys fetched successfully', result.rows);
    } catch (error) {
      console.error('Error listing foreign keys:', error);
      ResponseUtils.error(res, 'Failed to list foreign keys', error);
    }
  }

  /**
   * Create a foreign key constraint
   */
  static async createForeignKey(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName } = req.params;
      const { columnName, referencedTable, referencedColumn, onDelete = 'RESTRICT', onUpdate = 'RESTRICT' } = req.body;

      if (!columnName || !referencedTable || !referencedColumn) {
        return ResponseUtils.error(res, 'Column name, referenced table, and referenced column are required', null, null, 400);
      }

      // Validate referential actions
      const validActions = ['RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT', 'NO ACTION'];
      if (!validActions.includes(onDelete) || !validActions.includes(onUpdate)) {
        return ResponseUtils.error(res, 'Invalid referential action', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

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
      client.release();

      ResponseUtils.success(res, 'Foreign key created successfully', {
        constraintName,
        tableName,
        columnName,
        referencedTable,
        referencedColumn,
        onDelete,
        onUpdate
      }, 201);
    } catch (error) {
      console.error('Error creating foreign key:', error);
      ResponseUtils.error(res, 'Failed to create foreign key', error);
    }
  }

  /**
   * Drop a constraint from a table
   */
  static async dropConstraint(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName, constraintName } = req.params;

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if this is a NOT NULL constraint (system-generated CHECK constraint)
      const constraintCheck = await client.query(`
        SELECT cc.check_clause, tc.constraint_type
        FROM information_schema.table_constraints AS tc
        LEFT JOIN information_schema.check_constraints AS cc
          ON tc.constraint_name = cc.constraint_name
          AND tc.table_schema = cc.constraint_schema
        WHERE tc.table_schema = current_schema()
          AND tc.table_name = $1
          AND tc.constraint_name = $2
      `, [tableName, constraintName]);

      if (constraintCheck.rows.length > 0) {
        const constraint = constraintCheck.rows[0];
        
        // Check if it's a NOT NULL constraint
        if (constraint.constraint_type === 'CHECK' && 
            constraint.check_clause && 
            constraint.check_clause.includes('IS NOT NULL')) {
          client.release();
          return ResponseUtils.error(
            res, 
            'Cannot drop NOT NULL constraint directly. Please edit the column and change it to nullable instead.',
            null,
            null,
            400
          );
        }
      }

      await client.query(`ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "${constraintName}"`);
      client.release();

      ResponseUtils.success(res, `Constraint ${constraintName} dropped successfully`);
    } catch (error) {
      console.error('Error dropping constraint:', error);
      ResponseUtils.error(res, 'Failed to drop constraint', error);
    }
  }

  /**
   * Create a unique constraint
   * POST /api/database/:projectId/tables/:tableName/constraints/unique
   */
  static async createUniqueConstraint(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName } = req.params;
      const { columnName, constraintName } = req.body;

      if (!columnName) {
        return ResponseUtils.error(res, 'Column name is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Generate constraint name if not provided
      const finalConstraintName = constraintName || `${tableName}_${columnName}_unique`;

      await client.query(`
        ALTER TABLE "${tableName}" 
        ADD CONSTRAINT "${finalConstraintName}" UNIQUE ("${columnName}")
      `);

      client.release();
      
      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'create_constraint', {
        constraintName: finalConstraintName,
        constraintType: 'UNIQUE',
        columnName
      });

      ResponseUtils.success(res, 'Unique constraint created successfully', {
        constraintName: finalConstraintName,
        tableName,
        columnName
      }, 201);
    } catch (error: any) {
      console.error('Error creating unique constraint:', error);
      
      if (error.message?.includes('already exists')) {
        return ResponseUtils.error(res, 'A constraint with this name already exists', error, null, 409);
      }
      
      ResponseUtils.error(res, 'Failed to create unique constraint', error);
    }
  }

  /**
   * Create a primary key constraint
   * POST /api/database/:projectId/tables/:tableName/constraints/primary-key
   */
  static async createPrimaryKeyConstraint(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName } = req.params;
      const { columnNames, constraintName } = req.body;

      if (!columnNames || !Array.isArray(columnNames) || columnNames.length === 0) {
        return ResponseUtils.error(res, 'Column names array is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if table already has a primary key
      const existingPK = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_schema = current_schema()
          AND table_name = $1
          AND constraint_type = 'PRIMARY KEY'
      `, [tableName]);

      if (existingPK.rows.length > 0) {
        client.release();
        return ResponseUtils.error(
          res,
          'Table already has a primary key. Drop the existing primary key before creating a new one.',
          null,
          null,
          400
        );
      }

      // Generate constraint name if not provided
      const finalConstraintName = constraintName || `${tableName}_pkey`;

      // Build column list
      const columnList = columnNames.map((col: string) => `"${col}"`).join(', ');

      await client.query(`
        ALTER TABLE "${tableName}" 
        ADD CONSTRAINT "${finalConstraintName}" PRIMARY KEY (${columnList})
      `);

      client.release();
      
      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'create_constraint', {
        constraintName: finalConstraintName,
        constraintType: 'PRIMARY KEY',
        columnNames
      });

      ResponseUtils.success(res, 'Primary key constraint created successfully', {
        constraintName: finalConstraintName,
        tableName,
        columnNames
      }, 201);
    } catch (error: any) {
      console.error('Error creating primary key constraint:', error);
      
      if (error.message?.includes('already exists')) {
        return ResponseUtils.error(res, 'A constraint with this name already exists', error, null, 409);
      }
      
      if (error.message?.includes('contains null values')) {
        return ResponseUtils.error(res, 'Cannot create primary key on column(s) containing NULL values', error, null, 400);
      }
      
      ResponseUtils.error(res, 'Failed to create primary key constraint', error);
    }
  }

  /**
   * Create a check constraint
   * POST /api/database/:projectId/tables/:tableName/constraints/check
   */
  static async createCheckConstraint(req: SuperTokensAuthenticatedRequest, res: Response) {
    try {
      const { projectId, tableName } = req.params;
      const { checkExpression, constraintName } = req.body;

      if (!checkExpression) {
        return ResponseUtils.error(res, 'Check expression is required', null, null, 400);
      }

      const client = await DatabaseController.getProjectClient(projectId);
      
      if (!client) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Generate constraint name if not provided
      const finalConstraintName = constraintName || `${tableName}_check_${Date.now()}`;

      await client.query(`
        ALTER TABLE "${tableName}" 
        ADD CONSTRAINT "${finalConstraintName}" CHECK (${checkExpression})
      `);

      client.release();
      
      // Emit WebSocket event
      emitDatabaseChange(projectId, tableName, 'create_constraint', {
        constraintName: finalConstraintName,
        constraintType: 'CHECK',
        checkExpression
      });

      ResponseUtils.success(res, 'Check constraint created successfully', {
        constraintName: finalConstraintName,
        tableName,
        checkExpression
      }, 201);
    } catch (error: any) {
      console.error('Error creating check constraint:', error);
      
      if (error.message?.includes('already exists')) {
        return ResponseUtils.error(res, 'A constraint with this name already exists', error, null, 409);
      }
      
      ResponseUtils.error(res, 'Failed to create check constraint', error);
    }
  }
}

export default DatabaseController;

