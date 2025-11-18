import { Handle, Position } from 'reactflow';
import { Repeat } from 'lucide-react';
import { ForLoopNodeData } from '../../../types/workflow.types';
import { NodeWrapper, NodeActions } from '../../ComponentsIndex';
import { useNodeConnection } from '../../../hooks/useNodeConnection';
import { useNodeOperations } from '../../../hooks/useNodeOperations';
import { useState } from 'react';
import useWorkflowStore from '../../../stores/workflows/useWorkflowStore';

interface ForLoopNodeProps {
  id: string;
  data: ForLoopNodeData;
  selected?: boolean;
}

const ForLoopNode = ({ id, data, selected }: ForLoopNodeProps) => {
  const { isConnected } = useNodeConnection(id);
  const { handleDelete, handleUpdateData } = useNodeOperations(id);
  const nodes = useWorkflowStore((s) => s.nodes);
  const [showConfig, setShowConfig] = useState(false);
  const [sourceNodeId, setSourceNodeId] = useState(data.sourceNodeId || '');
  const [arrayPath, setArrayPath] = useState(data.arrayPath || 'rows');
  const [itemVariableName, setItemVariableName] = useState(data.itemVariableName || 'item');

  const availableNodes = nodes.filter((n) => n.id !== id && n.type !== 'start');

  const handleSave = () => {
    handleUpdateData<ForLoopNodeData>({
      sourceNodeId: sourceNodeId || undefined,
      arrayPath: arrayPath || undefined,
      itemVariableName: itemVariableName || undefined,
    });
    setShowConfig(false);
  };

  return (
    <NodeWrapper
      id={id}
      selected={selected}
      isConnected={isConnected}
      minWidth="280px"
    >
      <NodeActions selected={selected || false} onDelete={handleDelete} />
      <div className="flex items-center space-x-2 mb-2">
        <Repeat className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
          {data.label || 'For Loop'}
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => setShowConfig(true)}
          className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2 hover:border-primary-400 transition-colors"
        >
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Loop Configuration
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100">
            {sourceNodeId ? `Loop over ${sourceNodeId}.${arrayPath}` : 'Click to configure'}
          </div>
        </button>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 rounded-lg" onClick={() => setShowConfig(false)} />
          <div className="relative z-30 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg p-4 w-[400px]">
            <div className="text-sm font-semibold text-dark-900 dark:text-white mb-3">For Loop Configuration</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-dark-500 dark:text-dark-400 mb-1">Source Node</div>
                <select
                  value={sourceNodeId}
                  onChange={(e) => setSourceNodeId(e.target.value)}
                  className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                >
                  <option value="">Select source node</option>
                  {availableNodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.id} ({n.type})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-dark-500 dark:text-dark-400 mb-1">Array Path (e.g., "rows")</div>
                <input
                  type="text"
                  value={arrayPath}
                  onChange={(e) => setArrayPath(e.target.value)}
                  placeholder="rows"
                  className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                />
              </div>
              <div>
                <div className="text-xs text-dark-500 dark:text-dark-400 mb-1">Item Variable Name</div>
                <input
                  type="text"
                  value={itemVariableName}
                  onChange={(e) => setItemVariableName(e.target.value)}
                  placeholder="item"
                  className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  onClick={() => setShowConfig(false)}
                  className="px-3 py-1.5 text-sm rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-3 py-1.5 text-sm rounded bg-primary-600 hover:bg-primary-700 text-white"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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

export default ForLoopNode;

