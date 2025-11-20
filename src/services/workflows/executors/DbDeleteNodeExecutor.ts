import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * DbDeleteNodeExecutor - Deletes data from database tables
 */
export class DbDeleteNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { table, where } = node.data;

      if (!table) {
        return this.fail('Table name is required', Date.now() - startTime);
      }

      if (!where || where.length === 0) {
        return this.fail(
          'WHERE conditions are required for DELETE operations',
          Date.now() - startTime
        );
      }

      // Validate table exists
      const schema = await this.getTableSchema(table);
      if (!schema) {
        return this.fail(`Table ${table} does not exist`, Date.now() - startTime);
      }

      // Validate where conditions
      const validation = await this.validateWhereConditions(table, where);
      if (!validation.valid) {
        return this.fail(
          `WHERE condition validation failed: ${validation.errors.join(', ')}`,
          Date.now() - startTime
        );
      }

      // Build DELETE query
      let query = `DELETE FROM "${table}"`;
      const params: any[] = [];
      let paramIndex = 1;

      // Add WHERE clause
      const whereClauses: string[] = [];
      for (const condition of where) {
        const value = this.substituteVariablesInObject(condition.value);
        
        if (condition.operator.toUpperCase() === 'IN' || condition.operator.toUpperCase() === 'NOT IN') {
          if (!Array.isArray(value)) {
            return this.fail(
              `IN operator requires an array value`,
              Date.now() - startTime
            );
          }
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          whereClauses.push(`"${condition.field}" ${condition.operator} (${placeholders})`);
          params.push(...value);
        } else {
          whereClauses.push(`"${condition.field}" ${condition.operator} $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
      }
      query += ` WHERE ${whereClauses.join(' AND ')}`;

      // Log delete execution
      this.log(`Executing DELETE query on table: ${table}`);
      this.log(`Query: ${query}`, { params });

      // Execute delete
      const result = await this.client.query(query, params);

      this.log(`Delete executed successfully`, { deletedCount: result.rowCount });

      return this.success(
        {
          deletedCount: result.rowCount,
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

