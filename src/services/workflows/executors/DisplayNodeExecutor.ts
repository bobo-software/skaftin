import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * DisplayNodeExecutor - Formats and logs output
 */
export class DisplayNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { sourceNodeId, keyPath } = node.data;

      let displayData: any;

      if (sourceNodeId) {
        const sourceResult = this.context.nodeResults[sourceNodeId];
        if (!sourceResult) {
          return this.fail(
            `Source node ${sourceNodeId} not found`,
            Date.now() - startTime
          );
        }

        if (keyPath) {
          // Extract nested value using keyPath
          const parts = keyPath.split('.');
          let current = sourceResult.data;
          for (const part of parts) {
            if (current === undefined || current === null) {
              break;
            }
            if (/^\d+$/.test(part)) {
              current = current[parseInt(part, 10)];
            } else {
              current = current[part];
            }
          }
          displayData = current;
        } else {
          displayData = sourceResult.data;
        }
      } else {
        displayData = { message: 'No source node specified' };
      }

      // Log the display data
      this.log('Display output', displayData);

      return this.success(
        {
          displayed: displayData,
          formatted: JSON.stringify(displayData, null, 2),
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

