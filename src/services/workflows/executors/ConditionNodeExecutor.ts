import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';
import { VariableResolver } from '../VariableResolver';

/**
 * ConditionNodeExecutor - Evaluates conditions and branches execution
 */
export class ConditionNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { condition } = node.data;

      if (!condition) {
        return this.fail('Condition expression is required', Date.now() - startTime);
      }

      // Substitute variables in condition
      const resolvedCondition = this.substituteVariables(condition);

      // Evaluate condition (simple JavaScript expression evaluation)
      // Note: In production, you might want to use a safer expression evaluator
      let result: boolean;
      try {
        // Replace common operators and functions
        const safeExpression = resolvedCondition
          .replace(/\s*==\s*/g, ' === ')
          .replace(/\s*!=\s*/g, ' !== ')
          .replace(/\s*>\s*/g, ' > ')
          .replace(/\s*<\s*/g, ' < ')
          .replace(/\s*>=\s*/g, ' >= ')
          .replace(/\s*<=\s*/g, ' <= ');

        // Evaluate using Function constructor (safer than eval, but still be careful)
        // Only allow simple comparisons and basic operations
        const allowedPattern = /^[\d\s+\-*/().><=!&|]+$/;
        if (!allowedPattern.test(safeExpression)) {
          throw new Error('Invalid condition expression');
        }

        result = new Function(`return ${safeExpression}`)() as boolean;
      } catch (error) {
        return this.fail(
          `Failed to evaluate condition: ${error instanceof Error ? error.message : String(error)}`,
          Date.now() - startTime
        );
      }

      return this.success(
        {
          result,
          condition: resolvedCondition,
          branch: result ? 'true' : 'false',
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

