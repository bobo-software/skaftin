import { useEffect, useMemo, useState } from 'react';
import useWorkflowStore from '../stores/workflows/useWorkflowStore';
import useDatabaseStore from '../stores/data/useDatabaseStore';
import type { Column } from '../stores/data/useDatabaseStore';
import { DbSelectNodeData } from '../types/workflow.types';

export interface UseNodeSchemaOptions {
  /**
   * Node ID to get schema for
   */
  nodeId: string;
  /**
   * Optional explicit source node ID (if not provided, auto-detects from connections)
   */
  sourceNodeId?: string;
  /**
   * Whether to auto-detect source node from incoming edges
   * @default true
   */
  autoDetectSource?: boolean;
  /**
   * Whether to update node data with detected source node ID
   * @default true
   */
  updateNodeData?: boolean;
}

export interface NodeSchemaResult {
  /**
   * Schema columns from connected dbSelect node
   */
  schema: Column[];
  /**
   * Whether schema is currently loading
   */
  loading: boolean;
  /**
   * Source node ID (if connected to a dbSelect node)
   */
  sourceNodeId: string | undefined;
  /**
   * Source node object
   */
  sourceNode: any | undefined;
  /**
   * Source node label (for display)
   */
  sourceLabel: string;
  /**
   * Whether schema is available
   */
  hasSchema: boolean;
  /**
   * Error message if schema fetch failed
   */
  error: string | null;
}

/**
 * Hook to automatically get schema from connected dbSelect nodes
 * 
 * This hook:
 * - Auto-detects source node from incoming edges
 * - Fetches schema from connected dbSelect nodes
 * - Caches schema from node data when available (preferred - no API call)
 * - Falls back to API fetch if schema not in node data
 * - Provides schema, loading state, and source node info
 * 
 * @example
 * ```tsx
 * // Auto-detect source and get schema
 * const { schema, loading, sourceLabel, hasSchema } = useNodeSchema({ nodeId: id });
 * 
 * // Use explicit source node
 * const { schema } = useNodeSchema({ 
 *   nodeId: id, 
 *   sourceNodeId: 'dbSelect-1',
 *   autoDetectSource: false 
 * });
 * ```
 */
export function useNodeSchema(options: UseNodeSchemaOptions): NodeSchemaResult {
  const { nodeId, sourceNodeId: explicitSourceNodeId, autoDetectSource = true, updateNodeData = true } = options;

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const updateNodeDataStore = useWorkflowStore((s) => s.updateNodeData);
  const getTableSchema = useDatabaseStore((s) => s.getTableSchema);

  const [schema, setSchema] = useState<Column[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedSourceNodeId, setDetectedSourceNodeId] = useState<string | undefined>(explicitSourceNodeId);

  // Auto-detect source node from connected edges
  useEffect(() => {
    if (!autoDetectSource || explicitSourceNodeId) {
      setDetectedSourceNodeId(explicitSourceNodeId);
      return;
    }

    // Find edges where this node is the target
    const incomingEdges = edges.filter((e) => e.target === nodeId);
    if (incomingEdges.length > 0) {
      // Use the first incoming edge's source
      const detectedSource = incomingEdges[0].source;
      setDetectedSourceNodeId(detectedSource);

      // Update node data if requested
      if (updateNodeData) {
        const currentNode = nodes.find((n) => n.id === nodeId);
        if (currentNode) {
          const currentSourceId = (currentNode.data as any)?.sourceNodeId;
          if (currentSourceId !== detectedSource) {
            updateNodeDataStore(nodeId, { sourceNodeId: detectedSource });
          }
        }
      }
    } else {
      setDetectedSourceNodeId(undefined);
      // Clear sourceNodeId if no incoming edges and updateNodeData is true
      if (updateNodeData) {
        const currentNode = nodes.find((n) => n.id === nodeId);
        if (currentNode && (currentNode.data as any)?.sourceNodeId) {
          updateNodeDataStore(nodeId, { sourceNodeId: undefined });
        }
      }
    }
  }, [edges, nodeId, explicitSourceNodeId, autoDetectSource, updateNodeData, nodes, updateNodeDataStore]);

  // Get source node
  const sourceNode = useMemo(() => {
    return nodes.find((n) => n.id === detectedSourceNodeId);
  }, [detectedSourceNodeId, nodes]);

  // Get schema from connected dbSelect node
  useEffect(() => {
    if (!sourceNode || sourceNode.type !== 'dbSelect') {
      setSchema([]);
      setLoading(false);
      setError(null);
      return;
    }

    const sourceData = sourceNode.data as DbSelectNodeData;

    // First, try to use schema stored in the source node (preferred - no API call needed)
    if (sourceData?.schema && sourceData.schema.length > 0) {
      setSchema(sourceData.schema as Column[]);
      setLoading(false);
      setError(null);
      return;
    }

    // Fallback: fetch schema if not stored in source node
    const tableName = sourceData?.table;
    const projectId = sourceData?.projectId;

    if (!tableName || !projectId) {
      setSchema([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    getTableSchema(projectId, tableName)
      .then((columns) => {
        setSchema(columns);
        setError(null);
      })
      .catch((err) => {
        console.error(`[useNodeSchema] Failed to fetch schema for node ${nodeId}:`, err);
        setSchema([]);
        setError(err instanceof Error ? err.message : 'Failed to fetch schema');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sourceNode, getTableSchema, nodeId]);

  // Compute source label
  const sourceLabel = useMemo(() => {
    return (sourceNode?.data as any)?.label ?? detectedSourceNodeId ?? 'None';
  }, [sourceNode, detectedSourceNodeId]);

  return {
    schema,
    loading,
    sourceNodeId: detectedSourceNodeId,
    sourceNode,
    sourceLabel,
    hasSchema: schema.length > 0,
    error,
  };
}

/**
 * Hook to get schema from a specific table name
 * Useful for nodes that select tables directly (DbInsert, DbUpdate, DbDelete)
 * 
 * @example
 * ```tsx
 * const { schema, loading } = useTableSchema({ 
 *   projectId: '3', 
 *   tableName: 'users' 
 * });
 * ```
 */
export interface UseTableSchemaOptions {
  projectId: string;
  tableName: string;
}

export interface TableSchemaResult {
  schema: Column[];
  loading: boolean;
  error: string | null;
}

export function useTableSchema(options: UseTableSchemaOptions): TableSchemaResult {
  const { projectId, tableName } = options;
  const getTableSchema = useDatabaseStore((s) => s.getTableSchema);
  
  const [schema, setSchema] = useState<Column[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !tableName) {
      setSchema([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    getTableSchema(projectId, tableName)
      .then((columns) => {
        setSchema(columns);
        setError(null);
      })
      .catch((err) => {
        console.error(`[useTableSchema] Failed to fetch schema for table ${tableName}:`, err);
        setSchema([]);
        setError(err instanceof Error ? err.message : 'Failed to fetch schema');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [projectId, tableName, getTableSchema]);

  return {
    schema,
    loading,
    error,
  };
}

