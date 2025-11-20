// Backend workflow types

export type NodeType = 
  | 'start' 
  | 'httpRequest' 
  | 'dbSelect' 
  | 'display' 
  | 'condition' 
  | 'forLoop' 
  | 'dbInsert' 
  | 'dbDelete' 
  | 'dbUpdate'
  | 'email'
  | 'sms';

export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type NodeExecutionStatus = 'success' | 'fail' | 'skipped';

// Workflow node structure
export interface WorkflowNode {
  id: string; // Node ID within workflow (e.g., "start-1")
  type: NodeType;
  position: { x: number; y: number };
  data: Record<string, any>; // Node-specific configuration
}

// Workflow edge structure
export interface WorkflowEdge {
  id: string;
  source: string; // Source node ID
  target: string; // Target node ID
  sourceHandle?: string; // For condition nodes: 'true' or 'false'
  targetHandle?: string;
}

// Node execution result
export interface NodeExecutionResult {
  nodeId: string;
  status: NodeExecutionStatus;
  data?: any;
  error?: string;
  executionTimeMs?: number;
  timestamp: string;
}

// Workflow execution context
export interface WorkflowExecutionContext {
  workflowId: number;
  executionId: number;
  projectId: number;
  schemaName: string;
  inputs: Record<string, any>;
  nodeResults: Record<string, NodeExecutionResult>;
  variables: Record<string, any>; // Resolved variables for substitution
  startTime: Date;
  iterationContext?: ForLoopIterationContext; // Current for loop iteration context
}

// Workflow definition (loaded from database)
export interface WorkflowDefinition {
  id: number;
  projectId: number;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string;
  cronJobId?: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// Node executor interface
export interface INodeExecutor {
  execute(
    node: WorkflowNode,
    context: WorkflowExecutionContext
  ): Promise<NodeExecutionResult>;
}

// Variable reference pattern: {{nodeId.path}} or {{inputs.paramName}}
export interface VariableReference {
  type: 'node' | 'input';
  nodeId?: string;
  path: string;
  fullPath: string; // Original string like "{{dbSelect-1.rows.0.email}}"
}

// Condition expression evaluation result
export interface ConditionEvaluationResult {
  result: boolean;
  error?: string;
}

// For loop iteration context
export interface ForLoopIterationContext {
  item: any;
  index: number;
  variableName: string;
}

// For loop execution result
export interface ForLoopExecutionResult {
  array: any[];
  arrayLength: number;
  variableName: string;
  iterations: Array<{
    index: number;
    item: any;
    variableName: string;
  }>;
}

