import { pool } from '../db/connection';
import SocketService from './socket.service';

export class DatabaseService {
  private socketService: SocketService | undefined;

  constructor(socketService?: SocketService) {
    this.socketService = socketService;
  }
  async executeQuery(projectId: string, query: string, parameters: any[] = []): Promise<any> {
    try {
      // Set search path to project schema
      const project = await this.getProject(projectId);
      await pool.query(`SET search_path TO ${project.schema_name}, public`);
      
      const result = await pool.query(query, parameters);
      return {
        rows: result.rows,
        rowCount: result.rowCount,
        command: result.command
      };
    } catch (error) {
      console.error('Database query error:', error);
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listTables(projectId: string): Promise<any[]> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const query = `
        SELECT 
          table_name,
          table_type,
          table_schema
        FROM information_schema.tables
        WHERE table_schema = $1
        ORDER BY table_name
      `;
      
      const result = await pool.query(query, [schemaName]);
      return result.rows;
    } catch (error) {
      console.error('Error listing tables:', error);
      throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createTable(projectId: string, tableName: string, columns: any[]): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const columnDefinitions = columns.map(col => 
        `${col.name} ${col.type} ${col.nullable ? '' : 'NOT NULL'}`
      ).join(', ');
      
      const query = `CREATE TABLE ${schemaName}.${tableName} (${columnDefinitions})`;
      await pool.query(query);
    } catch (error) {
      console.error('Error creating table:', error);
      throw new Error(`Failed to create table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getTableSchema(projectId: string, tableName: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const query = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default,
          character_maximum_length
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `;
      
      const result = await pool.query(query, [schemaName, tableName]);
      return result.rows;
    } catch (error) {
      console.error('Error getting table schema:', error);
      throw new Error(`Failed to get table schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateTypeScriptTypes(projectId: string, tableName?: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      let query = `
        SELECT 
          table_name,
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1
      `;
      
      const params = [schemaName];
      
      if (tableName) {
        query += ' AND table_name = $2';
        params.push(tableName);
      }
      
      query += ' ORDER BY table_name, ordinal_position';
      
      const result = await pool.query(query, params);
      
      // Group by table
      const tables: any = {};
      result.rows.forEach(row => {
        if (!tables[row.table_name]) {
          tables[row.table_name] = [];
        }
        tables[row.table_name].push({
          name: row.column_name,
          type: this.mapPostgresToTypeScript(row.data_type),
          nullable: row.is_nullable === 'YES'
        });
      });
      
      // Generate TypeScript interfaces
      const interfaces = Object.keys(tables).map(tableName => {
        const columns = tables[tableName];
        const interfaceCode = this.generateInterface(tableName, columns);
        return interfaceCode;
      });
      
      return {
        tables: Object.keys(tables),
        interfaces: interfaces.join('\n\n')
      };
    } catch (error) {
      console.error('Error generating TypeScript types:', error);
      throw new Error(`Failed to generate types: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      await pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
    }
  }

  private async getProject(projectId: string): Promise<any> {
    const query = 'SELECT * FROM platform.projects WHERE id = $1';
    const result = await pool.query(query, [projectId]);
    
    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }
    
    return result.rows[0];
  }

  private mapPostgresToTypeScript(postgresType: string): string {
    const typeMap: { [key: string]: string } = {
      'integer': 'number',
      'bigint': 'number',
      'smallint': 'number',
      'decimal': 'number',
      'numeric': 'number',
      'real': 'number',
      'double precision': 'number',
      'serial': 'number',
      'bigserial': 'number',
      'varchar': 'string',
      'character varying': 'string',
      'text': 'string',
      'char': 'string',
      'boolean': 'boolean',
      'date': 'string',
      'timestamp': 'string',
      'timestamptz': 'string',
      'time': 'string',
      'uuid': 'string',
      'json': 'any',
      'jsonb': 'any'
    };
    
    return typeMap[postgresType.toLowerCase()] || 'any';
  }

  private generateInterface(tableName: string, columns: any[]): string {
    const interfaceName = this.toPascalCase(tableName);
    const properties = columns.map(col => {
      const optional = col.nullable ? '?' : '';
      return `  ${col.name}${optional}: ${col.type};`;
    }).join('\n');
    
    return `interface ${interfaceName} {\n${properties}\n}`;
  }

  private toPascalCase(str: string): string {
    return str.replace(/(^|_)([a-z])/g, (_, __, letter) => letter.toUpperCase());
  }

  // CRUD Operations
  async insertData(projectId: string, tableName: string, data: any): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const columns = Object.keys(data);
      const values = Object.values(data);
      const placeholders = values.map((_, index) => `$${index + 1}`).join(', ');
      
      const query = `
        INSERT INTO ${schemaName}.${tableName} (${columns.join(', ')})
        VALUES (${placeholders})
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      
      // Emit Socket.IO event for real-time updates
      if (this.socketService) {
        this.socketService.emitRowInserted(projectId, tableName, result.rows[0]);
      }
      
      return {
        success: true,
        data: result.rows[0],
        message: 'Data inserted successfully'
      };
    } catch (error) {
      console.error('Error inserting data:', error);
      throw new Error(`Failed to insert data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateData(projectId: string, tableName: string, data: any, where: any): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const setClause = Object.keys(data).map((key, index) => `${key} = $${index + 1}`).join(', ');
      const whereClause = Object.keys(where).map((key, index) => `${key} = $${Object.keys(data).length + index + 1}`).join(' AND ');
      
      const values = [...Object.values(data), ...Object.values(where)];
      
      const query = `
        UPDATE ${schemaName}.${tableName}
        SET ${setClause}
        WHERE ${whereClause}
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      
      // Emit Socket.IO event for real-time updates
      if (this.socketService && result.rows.length > 0) {
        this.socketService.emitRowUpdated(projectId, tableName, result.rows, where);
      }
      
      return {
        success: true,
        data: result.rows,
        message: 'Data updated successfully'
      };
    } catch (error) {
      console.error('Error updating data:', error);
      throw new Error(`Failed to update data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteData(projectId: string, tableName: string, where: any): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const whereClause = Object.keys(where).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
      const values = Object.values(where);
      
      const query = `
        DELETE FROM ${schemaName}.${tableName}
        WHERE ${whereClause}
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      
      // Emit Socket.IO event for real-time updates
      if (this.socketService && result.rows.length > 0) {
        this.socketService.emitRowDeleted(projectId, tableName, result.rows);
      }
      
      return {
        success: true,
        data: result.rows,
        message: 'Data deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting data:', error);
      throw new Error(`Failed to delete data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async selectData(projectId: string, tableName: string, columns?: string[], where?: any, limit?: number, offset?: number): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const selectColumns = columns ? columns.join(', ') : '*';
      let query = `SELECT ${selectColumns} FROM ${schemaName}.${tableName}`;
      const values: any[] = [];
      
      if (where) {
        const whereClause = Object.keys(where).map((key, index) => `${key} = $${index + 1}`).join(' AND ');
        query += ` WHERE ${whereClause}`;
        values.push(...Object.values(where));
      }
      
      if (limit) {
        query += ` LIMIT $${values.length + 1}`;
        values.push(limit);
      }
      
      if (offset) {
        query += ` OFFSET $${values.length + 1}`;
        values.push(offset);
      }
      
      const result = await pool.query(query, values);
      return {
        success: true,
        data: result.rows,
        count: result.rows.length
      };
    } catch (error) {
      console.error('Error selecting data:', error);
      throw new Error(`Failed to select data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Schema Operations
  async addColumn(projectId: string, tableName: string, columnName: string, columnType: string, nullable: boolean = true): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const nullConstraint = nullable ? '' : 'NOT NULL';
      const query = `ALTER TABLE ${schemaName}.${tableName} ADD COLUMN ${columnName} ${columnType} ${nullConstraint}`;
      
      await pool.query(query);
      return {
        success: true,
        message: `Column ${columnName} added successfully`
      };
    } catch (error) {
      console.error('Error adding column:', error);
      throw new Error(`Failed to add column: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async dropColumn(projectId: string, tableName: string, columnName: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const query = `ALTER TABLE ${schemaName}.${tableName} DROP COLUMN ${columnName}`;
      await pool.query(query);
      
      return {
        success: true,
        message: `Column ${columnName} dropped successfully`
      };
    } catch (error) {
      console.error('Error dropping column:', error);
      throw new Error(`Failed to drop column: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async dropTable(projectId: string, tableName: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const query = `DROP TABLE ${schemaName}.${tableName}`;
      await pool.query(query);
      
      return {
        success: true,
        message: `Table ${tableName} dropped successfully`
      };
    } catch (error) {
      console.error('Error dropping table:', error);
      throw new Error(`Failed to drop table: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Index Operations
  async createIndex(projectId: string, tableName: string, indexName: string, columns: string[], unique: boolean = false): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const uniqueKeyword = unique ? 'UNIQUE ' : '';
      const columnsList = columns.join(', ');
      const query = `CREATE ${uniqueKeyword}INDEX ${indexName} ON ${schemaName}.${tableName} (${columnsList})`;
      
      await pool.query(query);
      return {
        success: true,
        message: `Index ${indexName} created successfully`
      };
    } catch (error) {
      console.error('Error creating index:', error);
      throw new Error(`Failed to create index: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async listIndexes(projectId: string, tableName: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const query = `
        SELECT 
          indexname,
          indexdef,
          indisunique
        FROM pg_indexes 
        WHERE schemaname = $1 AND tablename = $2
      `;
      
      const result = await pool.query(query, [schemaName, tableName]);
      return {
        success: true,
        data: result.rows
      };
    } catch (error) {
      console.error('Error listing indexes:', error);
      throw new Error(`Failed to list indexes: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Foreign Key Operations
  async createForeignKey(projectId: string, tableName: string, columnName: string, referencedTable: string, referencedColumn: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      const fkName = `fk_${tableName}_${columnName}`;
      const query = `
        ALTER TABLE ${schemaName}.${tableName}
        ADD CONSTRAINT ${fkName}
        FOREIGN KEY (${columnName})
        REFERENCES ${schemaName}.${referencedTable}(${referencedColumn})
      `;
      
      await pool.query(query);
      return {
        success: true,
        message: `Foreign key ${fkName} created successfully`
      };
    } catch (error) {
      console.error('Error creating foreign key:', error);
      throw new Error(`Failed to create foreign key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Backup Operations
  async backupSchema(projectId: string, backupName?: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      const backup = backupName || `backup_${schemaName}_${Date.now()}`;
      
      // This is a simplified backup - in production, you'd want to use pg_dump
      const query = `
        CREATE SCHEMA IF NOT EXISTS ${backup}
      `;
      
      await pool.query(query);
      
      // Copy all tables to backup schema
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
      `;
      
      const tablesResult = await pool.query(tablesQuery, [schemaName]);
      
      for (const table of tablesResult.rows) {
        const copyQuery = `
          CREATE TABLE ${backup}.${table.table_name} AS 
          SELECT * FROM ${schemaName}.${table.table_name}
        `;
        await pool.query(copyQuery);
      }
      
      return {
        success: true,
        message: `Schema backed up as ${backup}`,
        backupName: backup
      };
    } catch (error) {
      console.error('Error backing up schema:', error);
      throw new Error(`Failed to backup schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async restoreSchema(projectId: string, backupName: string): Promise<any> {
    try {
      const project = await this.getProject(projectId);
      const schemaName = project.schema_name;
      
      // Drop existing schema and recreate
      await pool.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE`);
      await pool.query(`CREATE SCHEMA ${schemaName}`);
      
      // Copy tables from backup
      const tablesQuery = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1
      `;
      
      const tablesResult = await pool.query(tablesQuery, [backupName]);
      
      for (const table of tablesResult.rows) {
        const copyQuery = `
          CREATE TABLE ${schemaName}.${table.table_name} AS 
          SELECT * FROM ${backupName}.${table.table_name}
        `;
        await pool.query(copyQuery);
      }
      
      return {
        success: true,
        message: `Schema restored from ${backupName}`
      };
    } catch (error) {
      console.error('Error restoring schema:', error);
      throw new Error(`Failed to restore schema: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
