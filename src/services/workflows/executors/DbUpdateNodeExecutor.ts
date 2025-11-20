import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * DbUpdateNodeExecutor - Updates data in database tables
 */
export class DbUpdateNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { table, updates, where } = node.data;

      if (!table) {
        return this.fail('Table name is required', Date.now() - startTime);
      }

      if (!updates || updates.length === 0) {
        return this.fail('Update fields are required', Date.now() - startTime);
      }

      if (!where || where.length === 0) {
        return this.fail(
          'WHERE conditions are required for UPDATE operations',
          Date.now() - startTime
        );
      }

      // Validate table exists
      const schema = await this.getTableSchema(table);
      if (!schema) {
        return this.fail(`Table ${table} does not exist`, Date.now() - startTime);
      }

      // Validate update fields
      const updateValidation = await this.validateFieldMappings(
        table,
        updates.map((u: { field: string; value: any }) => ({ column: u.field, value: u.value }))
      );
      if (!updateValidation.valid) {
        return this.fail(
          `Update field validation failed: ${updateValidation.errors.join(', ')}`,
          Date.now() - startTime
        );
      }

      // Validate where conditions
      const whereValidation = await this.validateWhereConditions(table, where);
      if (!whereValidation.valid) {
        return this.fail(
          `WHERE condition validation failed: ${whereValidation.errors.join(', ')}`,
          Date.now() - startTime
        );
      }

      // Build UPDATE query
      let query = `UPDATE "${table}" SET`;
      const params: any[] = [];
      let paramIndex = 1;

      // Add SET clause
      const setClauses: string[] = [];
      for (const update of updates) {
        const value = this.substituteVariablesInObject(update.value);
        setClauses.push(`"${update.field}" = $${paramIndex}`);
        params.push(value);
        paramIndex++;
      }
      query += ` ${setClauses.join(', ')}`;

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
      query += ` WHERE ${whereClauses.join(' AND ')} RETURNING *`;

      // Log update execution
      this.log(`Executing UPDATE query on table: ${table}`);
      this.log(`Query: ${query}`, { params });

      // Execute update
      const result = await this.client.query(query, params);

      this.log(`Update executed successfully`, { rowCount: result.rowCount, updated: result.rows });

      return this.success(
        {
          updated: result.rows,
          updatedCount: result.rowCount,
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

