import { Request, Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import ResponseUtils from '../utils/ResponseUtils';
import CommonUtils from '../utils/CommonUtils';
import { emitDatabaseChange } from '../utils/websocketEmitter';
import { Pool } from 'pg';

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
  static async listTables(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
  static async getTableSchema(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
  static async createTable(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
            if (column.type.includes('INT') || column.type === 'BOOLEAN') {
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
  static async executeQuery(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
  static async selectData(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
  static async insertData(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
  static async bulkInsertData(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
  static async updateData(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
  static async deleteData(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
   * Drop a table
   */
  static async dropTable(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

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
}

export default DatabaseController;

