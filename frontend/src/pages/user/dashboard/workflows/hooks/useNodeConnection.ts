import { useMemo } from 'react';
import useWorkflowStore from '../../../../../stores/workflows/useWorkflowStore';

/**
 * Hook to get connection status and information for a node
 */
export const useNodeConnection = (nodeId: string) => {
  const edges = useWorkflowStore((s) => s.edges);
  const isNodeConnected = useWorkflowStore((s) => s.isNodeConnected);
  const getNodeConnections = useWorkflowStore((s) => s.getNodeConnections);

  const connections = useMemo(() => getNodeConnections(nodeId), [nodeId, edges, getNodeConnections]);
  const isConnected = useMemo(() => isNodeConnected(nodeId), [nodeId, edges, isNodeConnected]);

  return {
    isConnected,
    hasIncoming: connections.incoming.length > 0,
    hasOutgoing: connections.outgoing.length > 0,
    incomingEdges: connections.incoming,
    outgoingEdges: connections.outgoing,
    incomingCount: connections.incoming.length,
    outgoingCount: connections.outgoing.length,
  };
};

