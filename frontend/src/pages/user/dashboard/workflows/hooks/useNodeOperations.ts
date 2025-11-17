import { useCallback } from 'react';
import { useReactFlow } from 'reactflow';
import useWorkflowStore from '../../../../../stores/workflows/useWorkflowStore';

/**
 * Hook for common node operations
 */
export const useNodeOperations = (nodeId: string) => {
  const rf = useReactFlow();
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const setNodes = useWorkflowStore((s) => s.setNodes);
  const setEdges = useWorkflowStore((s) => s.setEdges);

  const handleDelete = useCallback(() => {
    deleteNode(nodeId);
    // Also update React Flow's internal state for immediate UI update
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    // Sync with React Flow instance
    rf.setNodes((nds) => nds.filter((n) => n.id !== nodeId));
    rf.setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
  }, [nodeId, deleteNode, setNodes, setEdges, rf]);

  const handleUpdateData = useCallback(
    <T = any>(data: Partial<T>) => {
      updateNodeData<T>(nodeId, data);
      // Also update React Flow's internal state for immediate UI update
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
      // Sync with React Flow instance
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n))
      );
    },
    [nodeId, updateNodeData, setNodes, rf]
  );

  return {
    handleDelete,
    handleUpdateData,
  };
};

