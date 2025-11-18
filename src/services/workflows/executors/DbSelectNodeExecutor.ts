import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * DbSelectNodeExecutor - Executes database SELECT queries
 */
export class DbSelectNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { table, limit, where, orderBy } = node.data;

      if (!table) {
        return this.fail('Table name is required', Date.now() - startTime);
      }

      // Validate table exists
      const schema = await this.getTableSchema(table);
      if (!schema) {
        return this.fail(`Table ${table} does not exist`, Date.now() - startTime);
      }

      // Build SELECT query
      let query = `SELECT * FROM "${table}"`;
      const params: any[] = [];
      let paramIndex = 1;

      // Add WHERE clause
      if (where && where.length > 0) {
        const whereClauses: string[] = [];
        for (const condition of where) {
          const value = this.substituteVariablesInObject(condition.value);
          whereClauses.push(`"${condition.field}" ${condition.operator} $${paramIndex}`);
          params.push(value);
          paramIndex++;
        }
        query += ` WHERE ${whereClauses.join(' AND ')}`;
      }

      // Add ORDER BY
      if (orderBy && orderBy.length > 0) {
        const orderClauses = orderBy.map(
          (o: { field: string; direction: string }) => `"${o.field}" ${o.direction}`
        );
        query += ` ORDER BY ${orderClauses.join(', ')}`;
      }

      // Add LIMIT
      if (limit) {
        query += ` LIMIT ${limit}`;
      }

      // Log query execution
      this.log(`Executing SELECT query on table: ${table}`);
      this.log(`Query: ${query}`, { params });

      // Execute query
      const result = await this.client.query(query, params);

      this.log(`Query executed successfully`, { rowCount: result.rowCount });

      return this.success(
        {
          rows: result.rows,
          rowCount: result.rowCount,
          columns: result.fields?.map((f) => f.name) || [],
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

