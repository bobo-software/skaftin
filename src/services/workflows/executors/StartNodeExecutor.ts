import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';

/**
 * StartNodeExecutor - Initializes workflow execution
 * Simply passes through the workflow inputs
 */
export class StartNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      // Start node just initializes the workflow with inputs
      // The inputs are already in the context
      const result = {
        inputs: this.context.inputs,
        message: 'Workflow started',
      };

      return this.success(result, Date.now() - startTime);
    } catch (error) {
      return this.fail(
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }
}

