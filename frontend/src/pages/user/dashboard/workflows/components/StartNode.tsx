import { Handle, Position } from 'reactflow';
import { Play } from 'lucide-react';
import { StartNodeData } from '../types/workflow.types';
import NodeWrapper from './shared/NodeWrapper';
import NodeActions from './shared/NodeActions';
import { useNodeConnection } from '../hooks/useNodeConnection';
import { useNodeOperations } from '../hooks/useNodeOperations';

interface StartNodeProps { id: string; data: StartNodeData; selected?: boolean; }

const StartNode = ({ id, data, selected }: StartNodeProps) => {
  const { isConnected } = useNodeConnection(id);
  const { handleDelete } = useNodeOperations(id);

  return (
    <NodeWrapper
      id={id}
      selected={selected}
      isConnected={isConnected}
      minWidth="200px"
      showTargetHandle={false}
    >
      <NodeActions selected={selected || false} onDelete={handleDelete} />
      <div className="flex items-center space-x-2 mb-2">
        <Play className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white">{data.label}</div>
      </div>
      
      {data.inputs && data.inputs.length > 0 && (
        <div className="mt-2 space-y-1">
          {data.inputs.map((input) => (
            <div
              key={input.id}
              className="flex items-center space-x-2 text-xs text-dark-600 dark:text-dark-400"
            >
              <span className="font-mono">{input.name}:</span>
              <span className="truncate">{input.value || 'Empty'}</span>
            </div>
          ))}
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Right}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
    </NodeWrapper>
  );
};

export default StartNode;

