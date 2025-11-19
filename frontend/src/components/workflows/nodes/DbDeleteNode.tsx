import { Handle, Position } from 'reactflow';
import { Database, Trash2 } from 'lucide-react';
import { DbDeleteNodeData } from '../../../types/workflow.types';
import { NodeWrapper, NodeActions, NodeOutputTypeIndicator } from '../../ComponentsIndex';
import { useNodeConnection } from '../../../hooks/useNodeConnection';
import { useNodeOperations } from '../../../hooks/useNodeOperations';
import { useNodeSchema } from '../../../hooks/useNodeSchema';
import { useState, useMemo } from 'react';
import useWorkflowStore from '../../../stores/workflows/useWorkflowStore';

interface DbDeleteNodeProps {
  id: string;
  data: DbDeleteNodeData;
  selected?: boolean;
}

const DbDeleteNode = ({ id, data, selected }: DbDeleteNodeProps) => {
  const { isConnected } = useNodeConnection(id);
  const { handleDelete } = useNodeOperations(id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const [table] = useState(data.table || '');

  // Get schema from connected source node (for ForLoop connections)
  const { sourceNode, sourceNodeId } = useNodeSchema({
    nodeId: id,
    autoDetectSource: true,
    updateNodeData: false,
  });

  // Get item schema from ForLoop source
  const itemSchema = useMemo(() => {
    if (sourceNode?.type === 'forLoop') {
      const forLoopData = sourceNode.data as any;
      const loopSourceNodeId = forLoopData?.sourceNodeId;
      
      if (loopSourceNodeId) {
        const loopSourceNode = nodes.find((n) => n.id === loopSourceNodeId);
        if (loopSourceNode?.type === 'dbSelect') {
          const loopSourceData = loopSourceNode.data as any;
          return Array.isArray(loopSourceData?.schema) ? loopSourceData.schema : [];
        }
      }
    }
    return [];
  }, [sourceNode, nodes]);

  // Determine if connected to ForLoop
  const isConnectedToForLoop = sourceNode?.type === 'forLoop';

  return (
    <NodeWrapper
      id={id}
      selected={selected}
      isConnected={isConnected}
      minWidth="320px"
    >
      <NodeActions selected={selected || false} onDelete={handleDelete} />
      <div className="flex items-center space-x-2 mb-2">
        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
          {data.label || 'Delete Data'}
        </div>
        <NodeOutputTypeIndicator nodeId={id} sourceNodeId={sourceNodeId} position="header" />
      </div>

      <div className="px-4 py-3">
        <div className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Delete Configuration
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100">
            {table ? `Delete from ${table}` : 'Not configured'}
          </div>
          {isConnectedToForLoop && itemSchema.length > 0 && (
            <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">
              🔄 Connected to loop - {itemSchema.length} item field{itemSchema.length !== 1 ? 's' : ''} available
            </div>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
    </NodeWrapper>
  );
};

export default DbDeleteNode;

