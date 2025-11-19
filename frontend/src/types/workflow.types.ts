// Extended node types
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
  | 'email';

// Base workflow node interface
export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    [key: string]: any;
  };
}

// Workflow edge interface
export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string; // For condition nodes: 'true' or 'false'
  targetHandle?: string;
}

// Node-specific data types
export interface StartNodeData {
  label: string;
  inputs: Array<{ id: string; name: string; value: string }>;
}

export interface HttpRequestNodeData {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  applicationContext?: string;
}

export interface DbSelectNodeData {
  label: string;
  projectId: string;
  table?: string;
  limit?: number;
  where?: Array<{ field: string; operator: string; value: any }>;
  orderBy?: Array<{ field: string; direction: 'ASC' | 'DESC' }>;
  schema?: Array<{ column_name: string; data_type: string; is_nullable: boolean; column_default?: string; character_maximum_length?: number }>;
  onLog?: (entry: { nodeId: string; type: string; data: any; timestamp?: string }) => void;
}

export interface DisplayNodeData {
  label: string;
  sourceNodeId?: string;
  keyPath?: string; // e.g., rows.0.name
}

export interface ConditionNodeData {
  label: string;
  condition: string; // Expression to evaluate (e.g., "{{nodeId.field}} > 10")
  trueBranchLabel?: string;
  falseBranchLabel?: string;
}

export interface ForLoopNodeData {
  label: string;
  sourceNodeId?: string; // Node that outputs an array
  arrayPath?: string; // Path to array in source node (e.g., "rows")
  itemVariableName?: string; // Variable name for current item (e.g., "item")
}

export interface DbInsertNodeData {
  label: string;
  projectId: string;
  table?: string;
  fieldMappings?: Array<{ 
    column: string; 
    value: string; // Can contain variables like "{{nodeId.field}}"
  }>;
  schema?: Array<{ column_name: string; data_type: string; is_nullable: boolean; column_default?: string; character_maximum_length?: number }>;
}

export interface DbDeleteNodeData {
  label: string;
  projectId: string;
  table?: string;
  where?: Array<{ field: string; operator: string; value: any }>;
  schema?: Array<{ column_name: string; data_type: string; is_nullable: boolean; column_default?: string; character_maximum_length?: number }>;
}

export interface DbUpdateNodeData {
  label: string;
  projectId: string;
  table?: string;
  updates?: Array<{ 
    field: string; 
    value: string; // Can contain variables like "{{nodeId.field}}"
  }>;
  where?: Array<{ field: string; operator: string; value: any }>;
  schema?: Array<{ column_name: string; data_type: string; is_nullable: boolean; column_default?: string; character_maximum_length?: number }>;
}

export interface EmailNodeData {
  label: string;
  projectId: string;
  templateId?: number;
  templateName?: string;
  recipientEmail?: string; // Can contain variables like "{{nodeId.field}}"
  providerId?: number;
  variableMappings?: Record<string, string>; // Maps template variables to values/variables (e.g., { "name": "{{nodeId.field}}", "email": "user@example.com" })
}

// Workflow execution types
export type WorkflowExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
export type NodeExecutionStatus = 'success' | 'fail' | 'skipped';
export type NodeRunStatus = 'idle' | 'running' | 'success' | 'fail';

// Node execution result
export interface NodeExecutionResult {
  status: NodeExecutionStatus;
  data?: any;
  error?: string;
  executionTimeMs?: number;
}

// Workflow execution context (for variable resolution)
export interface WorkflowExecutionContext {
  workflowId: string;
  executionId: string;
  inputs: Record<string, any>;
  nodeResults: Record<string, NodeExecutionResult>;
  variables: Record<string, any>; // Resolved variables
}

// Workflow definition (for save/load)
export interface WorkflowDefinition {
  id?: number;
  name: string;
  description?: string;
  projectId: string;
  enabled?: boolean;
  schedule?: string; // Cron expression
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// Workflow execution record
export interface WorkflowExecution {
  id: number;
  workflowId: number;
  status: WorkflowExecutionStatus;
  startedAt: string;
  completedAt?: string;
  triggeredBy: 'manual' | 'cron' | 'api';
  inputData?: Record<string, any>;
  resultData?: any;
  errorMessage?: string;
}
