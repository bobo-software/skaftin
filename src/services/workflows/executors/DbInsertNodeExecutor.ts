import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * DbInsertNodeExecutor - Inserts data into database tables
 */
export class DbInsertNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { table, fieldMappings } = node.data;

      if (!table) {
        return this.fail('Table name is required', Date.now() - startTime);
      }

      if (!fieldMappings || fieldMappings.length === 0) {
        return this.fail('Field mappings are required', Date.now() - startTime);
      }

      // Validate table exists
      const schema = await this.getTableSchema(table);
      if (!schema) {
        return this.fail(`Table ${table} does not exist`, Date.now() - startTime);
      }

      // Validate field mappings
      const validation = await this.validateFieldMappings(table, fieldMappings);
      if (!validation.valid) {
        return this.fail(
          `Field mapping validation failed: ${validation.errors.join(', ')}`,
          Date.now() - startTime
        );
      }

      // Build INSERT query
      const columns = fieldMappings.map((m: { column: string; value: any }) => m.column);
      const values: any[] = [];
      const placeholders: string[] = [];

      for (let i = 0; i < fieldMappings.length; i++) {
        const mapping = fieldMappings[i];
        // Substitute variables in value
        const resolvedValue = this.substituteVariablesInObject(mapping.value);
        values.push(resolvedValue);
        placeholders.push(`$${i + 1}`);
      }

      const query = `INSERT INTO "${table}" (${columns.map((c: string) => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;

      // Log insert execution
      this.log(`Executing INSERT query on table: ${table}`);
      this.log(`Query: ${query}`, { values });

      // Execute insert
      const result = await this.client.query(query, values);

      this.log(`Insert executed successfully`, { rowCount: result.rowCount, inserted: result.rows[0] });

      return this.success(
        {
          inserted: result.rows[0],
          rowCount: result.rowCount,
        },
        Date.now() - startTime
      );
    } catch (error) {
      return this.fail(
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }
}

