import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult, ForLoopIterationContext } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * ForLoopNodeExecutor - Iterates over arrays
 * Note: This executor sets up the iteration context, but the actual
 * iteration over child nodes is handled by the WorkflowEngine
 */
export class ForLoopNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { sourceNodeId, arrayPath, itemVariableName } = node.data;

      if (!sourceNodeId) {
        return this.fail('Source node ID is required', Date.now() - startTime);
      }

      // Get source node result
      const sourceResult = this.context.nodeResults[sourceNodeId];
      if (!sourceResult) {
        return this.fail(
          `Source node ${sourceNodeId} not found or not executed`,
          Date.now() - startTime
        );
      }

      // Extract array from source result
      let array: any[];
      if (arrayPath) {
        const parts = arrayPath.split('.');
        let current = sourceResult.data;
        for (const part of parts) {
          if (current === undefined || current === null) {
            throw new Error(`Path ${arrayPath} not found in source node result`);
          }
          if (/^\d+$/.test(part)) {
            current = current[parseInt(part, 10)];
          } else {
            current = current[part];
          }
        }
        array = Array.isArray(current) ? current : [];
      } else {
        // Default: look for 'rows' or assume data is an array
        array = Array.isArray(sourceResult.data?.rows)
          ? sourceResult.data.rows
          : Array.isArray(sourceResult.data)
          ? sourceResult.data
          : [];
      }

      const variableName = itemVariableName || 'item';

      return this.success(
        {
          array,
          arrayLength: array.length,
          variableName,
          iterations: array.map((item, index) => ({
            index,
            item,
            variableName,
          })),
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

