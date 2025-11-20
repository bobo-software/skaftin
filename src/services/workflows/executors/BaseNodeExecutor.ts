import { PoolClient } from 'pg';
import {
  WorkflowNode,
  WorkflowExecutionContext,
  NodeExecutionResult,
  INodeExecutor,
} from '../../../types/workflow.types';
import { VariableResolver } from '../VariableResolver';
import { SchemaResolver } from '../SchemaResolver';

/**
 * Base class for all node executors
 * Provides common functionality for variable resolution and schema access
 */
export abstract class BaseNodeExecutor implements INodeExecutor {
  protected client: PoolClient;
  protected context: WorkflowExecutionContext;
  protected currentNodeId: string = '';

  constructor(client: PoolClient, context: WorkflowExecutionContext) {
    this.client = client;
    this.context = context;
  }

  /**
   * Execute the node - must be implemented by subclasses
   * This is the actual implementation that subclasses override
   */
  protected abstract executeNode(node: WorkflowNode): Promise<NodeExecutionResult>;

  /**
   * Implementation of INodeExecutor interface
   */
  async execute(node: WorkflowNode, context: WorkflowExecutionContext): Promise<NodeExecutionResult> {
    // Update context
    this.context = context;
    this.currentNodeId = node.id;
    // Call the protected executeNode method
    const result = await this.executeNode(node);
    result.nodeId = node.id;
    return result;
  }

  /**
   * Resolve a variable reference
   */
  protected resolveVariable(ref: string): any {
    const variableRef = VariableResolver.parseVariableReference(ref);
    if (!variableRef) {
      return ref; // Not a variable reference, return as-is
    }
    return VariableResolver.resolveVariable(variableRef, this.context);
  }

  /**
   * Substitute variables in a string
   */
  protected substituteVariables(template: string): string {
    return VariableResolver.substituteVariables(template, this.context);
  }

  /**
   * Substitute variables in an object recursively
   */
  protected substituteVariablesInObject(obj: any): any {
    return VariableResolver.substituteVariablesInObject(obj, this.context);
  }

  /**
   * Get table schema
   */
  protected async getTableSchema(tableName: string): Promise<any> {
    return SchemaResolver.getTableSchema(
      this.client,
      this.context.schemaName,
      tableName
    );
  }

  /**
   * Validate field mappings
   */
  protected async validateFieldMappings(
    tableName: string,
    fieldMappings: Array<{ column: string; value: any }>
  ): Promise<{ valid: boolean; errors: string[] }> {
    return SchemaResolver.validateFieldMappings(
      this.client,
      this.context.schemaName,
      tableName,
      fieldMappings
    );
  }

  /**
   * Validate where conditions
   */
  protected async validateWhereConditions(
    tableName: string,
    conditions: Array<{ field: string; operator: string; value: any }>
  ): Promise<{ valid: boolean; errors: string[] }> {
    return SchemaResolver.validateWhereConditions(
      this.client,
      this.context.schemaName,
      tableName,
      conditions
    );
  }

  /**
   * Create a success result
   */
  protected success(data: any, executionTimeMs?: number): NodeExecutionResult {
    return {
      nodeId: '',
      status: 'success',
      data,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a failure result
   */
  protected fail(error: string, executionTimeMs?: number): NodeExecutionResult {
    return {
      nodeId: '',
      status: 'fail',
      error,
      executionTimeMs,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Create a skipped result
   */
  protected skipped(): NodeExecutionResult {
    return {
      nodeId: '',
      status: 'skipped',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Log execution (for debugging)
   */
  protected log(message: string, data?: any): void {
    const nodeId = this.currentNodeId || 'unknown';
    console.log(`[Workflow ${this.context.workflowId}] [Execution ${this.context.executionId}] [Node ${nodeId}] ${message}`);
    if (data !== undefined) {
      console.log(`[Workflow ${this.context.workflowId}] [Execution ${this.context.executionId}] [Node ${nodeId}] Data:`, JSON.stringify(data, null, 2));
    }
  }
}

