import { pool } from '../db/connection';

export class DatabaseService {
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
}
