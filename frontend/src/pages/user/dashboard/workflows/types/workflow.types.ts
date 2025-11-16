export type NodeType = 'start' | 'httpRequest' | 'dbSelect' | 'display';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  position: { x: number; y: number };
  data: {
    label: string;
    [key: string]: any;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface HttpRequestNodeData {
  label: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  applicationContext?: string;
}

export interface StartNodeData {
  label: string;
  inputs: Array<{ id: string; name: string; value: string }>;
}

export interface DbSelectNodeData {
  label: string;
  projectId: string;
  table?: string;
  limit?: number;
  onLog?: (entry: { nodeId: string; type: string; data: any; timestamp?: string }) => void;
}

export interface DisplayNodeData {
  label: string;
  sourceNodeId?: string;
  keyPath?: string; // e.g., rows.0.name
}
