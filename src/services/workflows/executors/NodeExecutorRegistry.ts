import { PoolClient } from 'pg';
import {
  WorkflowNode,
  WorkflowExecutionContext,
  NodeExecutionResult,
  INodeExecutor,
} from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';
import { StartNodeExecutor } from './StartNodeExecutor';
import { DbSelectNodeExecutor } from './DbSelectNodeExecutor';
import { DbInsertNodeExecutor } from './DbInsertNodeExecutor';
import { DbDeleteNodeExecutor } from './DbDeleteNodeExecutor';
import { DbUpdateNodeExecutor } from './DbUpdateNodeExecutor';
import { ConditionNodeExecutor } from './ConditionNodeExecutor';
import { ForLoopNodeExecutor } from './ForLoopNodeExecutor';
import { HttpRequestNodeExecutor } from './HttpRequestNodeExecutor';
import { DisplayNodeExecutor } from './DisplayNodeExecutor';
import { EmailNodeExecutor } from './EmailNodeExecutor';

/**
 * Registry for node executors
 * Creates appropriate executor instances based on node type
 */
export class NodeExecutorRegistry {
  /**
   * Create an executor for a specific node type
   */
  static createExecutor(
    nodeType: string,
    client: PoolClient,
    context: WorkflowExecutionContext
  ): INodeExecutor {
    switch (nodeType) {
      case 'start':
        return new StartNodeExecutor(client, context);
      case 'dbSelect':
        return new DbSelectNodeExecutor(client, context);
      case 'dbInsert':
        return new DbInsertNodeExecutor(client, context);
      case 'dbDelete':
        return new DbDeleteNodeExecutor(client, context);
      case 'dbUpdate':
        return new DbUpdateNodeExecutor(client, context);
      case 'condition':
        return new ConditionNodeExecutor(client, context);
      case 'forLoop':
        return new ForLoopNodeExecutor(client, context);
      case 'httpRequest':
        return new HttpRequestNodeExecutor(client, context);
      case 'display':
        return new DisplayNodeExecutor(client, context);
      case 'email':
        return new EmailNodeExecutor(client, context);
      default:
        throw new Error(`Unknown node type: ${nodeType}`);
    }
  }

  /**
   * Check if a node type is supported
   */
  static isSupported(nodeType: string): boolean {
    const supportedTypes = [
      'start',
      'email',
      'dbSelect',
      'dbInsert',
      'dbDelete',
      'dbUpdate',
      'condition',
      'forLoop',
      'httpRequest',
      'display',
    ];
    return supportedTypes.includes(nodeType);
  }
}

