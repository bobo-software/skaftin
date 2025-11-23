import { Pool, PoolClient } from 'pg';

export interface TableColumn {
  column_name: string;
  data_type: string;
  character_maximum_length?: number;
  is_nullable: boolean;
  column_default?: string;
  ordinal_position: number;
}

export interface TableSchema {
  table_name: string;
  columns: TableColumn[];
}

/**
 * SchemaResolver - Resolves and validates database table schemas
 * Used for schema-aware workflow node configuration
 */
export class SchemaResolver {
  /**
   * Get schema for a specific table in a project
   */
  static async getTableSchema(
    client: PoolClient,
    schemaName: string,
    tableName: string
  ): Promise<TableSchema | null> {
    try {
      const result = await client.query(
        `
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
        `,
        [schemaName, tableName]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return {
        table_name: tableName,
        columns: result.rows.map((row) => ({
          column_name: row.column_name,
          data_type: row.data_type,
          character_maximum_length: row.character_maximum_length,
          is_nullable: row.is_nullable === 'YES',
          column_default: row.column_default,
          ordinal_position: row.ordinal_position,
        })),
      };
    } catch (error) {
      console.error(`Error fetching schema for table ${schemaName}.${tableName}:`, error);
      return null;
    }
  }

  /**
   * Get all tables in a project schema
   */
  static async getTablesInSchema(
    client: PoolClient,
    schemaName: string
  ): Promise<string[]> {
    try {
      const result = await client.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = $1
        AND table_type = 'BASE TABLE'
        AND table_name NOT LIKE 'skaftin_system_%'
        ORDER BY table_name
        `,
        [schemaName]
      );

      return result.rows.map((row) => row.table_name);
    } catch (error) {
      console.error(`Error fetching tables for schema ${schemaName}:`, error);
      return [];
    }
  }

  /**
   * Validate that a column exists in a table
   */
  static async validateColumn(
    client: PoolClient,
    schemaName: string,
    tableName: string,
    columnName: string
  ): Promise<boolean> {
    try {
      const result = await client.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = $1 
        AND table_name = $2 
        AND column_name = $3
        `,
        [schemaName, tableName, columnName]
      );

      return result.rows.length > 0;
    } catch (error) {
      console.error(`Error validating column ${schemaName}.${tableName}.${columnName}:`, error);
      return false;
    }
  }

  /**
   * Validate field mappings for insert/update operations
   */
  static async validateFieldMappings(
    client: PoolClient,
    schemaName: string,
    tableName: string,
    fieldMappings: Array<{ column: string; value: any }>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const schema = await this.getTableSchema(client, schemaName, tableName);

    if (!schema) {
      return {
        valid: false,
        errors: [`Table ${schemaName}.${tableName} does not exist`],
      };
    }

    const columnNames = schema.columns.map((col) => col.column_name);

    for (const mapping of fieldMappings) {
      if (!columnNames.includes(mapping.column)) {
        errors.push(`Column ${mapping.column} does not exist in table ${tableName}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate where conditions
   */
  static async validateWhereConditions(
    client: PoolClient,
    schemaName: string,
    tableName: string,
    conditions: Array<{ field: string; operator: string; value: any }>
  ): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    const schema = await this.getTableSchema(client, schemaName, tableName);

    if (!schema) {
      return {
        valid: false,
        errors: [`Table ${schemaName}.${tableName} does not exist`],
      };
    }

    const columnNames = schema.columns.map((col) => col.column_name);
    const validOperators = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IN', 'NOT IN'];

    for (const condition of conditions) {
      if (!columnNames.includes(condition.field)) {
        errors.push(`Column ${condition.field} does not exist in table ${tableName}`);
      }

      if (!validOperators.includes(condition.operator.toUpperCase())) {
        errors.push(`Invalid operator: ${condition.operator}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get column type information for a specific column
   */
  static async getColumnType(
    client: PoolClient,
    schemaName: string,
    tableName: string,
    columnName: string
  ): Promise<string | null> {
    try {
      const result = await client.query(
        `
        SELECT data_type
        FROM information_schema.columns
        WHERE table_schema = $1 
        AND table_name = $2 
        AND column_name = $3
        `,
        [schemaName, tableName, columnName]
      );

      return result.rows.length > 0 ? result.rows[0].data_type : null;
    } catch (error) {
      console.error(`Error getting column type:`, error);
      return null;
    }
  }

  /**
   * Check if a table structure has changed since last known schema
   */
  static async detectSchemaChanges(
    client: PoolClient,
    schemaName: string,
    tableName: string,
    lastKnownSchema: TableColumn[]
  ): Promise<{ changed: boolean; changes: string[] }> {
    const currentSchema = await this.getTableSchema(client, schemaName, tableName);

    if (!currentSchema) {
      return {
        changed: true,
        changes: ['Table no longer exists'],
      };
    }

    const changes: string[] = [];
    const lastKnownColumns = new Map(
      lastKnownSchema.map((col) => [col.column_name, col])
    );
    const currentColumns = new Map(
      currentSchema.columns.map((col) => [col.column_name, col])
    );

    // Check for removed columns
    for (const [columnName] of lastKnownColumns) {
      if (!currentColumns.has(columnName)) {
        changes.push(`Column ${columnName} was removed`);
      }
    }

    // Check for added columns
    for (const [columnName] of currentColumns) {
      if (!lastKnownColumns.has(columnName)) {
        changes.push(`Column ${columnName} was added`);
      }
    }

    // Check for type changes
    for (const [columnName, currentCol] of currentColumns) {
      const lastKnownCol = lastKnownColumns.get(columnName);
      if (lastKnownCol && lastKnownCol.data_type !== currentCol.data_type) {
        changes.push(
          `Column ${columnName} type changed from ${lastKnownCol.data_type} to ${currentCol.data_type}`
        );
      }
    }

    return {
      changed: changes.length > 0,
      changes,
    };
  }
}

