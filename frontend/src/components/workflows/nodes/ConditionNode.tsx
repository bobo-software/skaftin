import { Handle, Position } from 'reactflow';
import { GitBranch } from 'lucide-react';
import { ConditionNodeData } from '../../../types/workflow.types';
import { NodeWrapper, NodeActions } from '../../ComponentsIndex';
import { useNodeConnection } from '../../../hooks/useNodeConnection';
import { useNodeOperations } from '../../../hooks/useNodeOperations';
import { useState } from 'react';

interface ConditionNodeProps {
  id: string;
  data: ConditionNodeData;
  selected?: boolean;
}

const ConditionNode = ({ id, data, selected }: ConditionNodeProps) => {
  const { isConnected } = useNodeConnection(id);
  const { handleDelete, handleUpdateData } = useNodeOperations(id);
  const [showConfig, setShowConfig] = useState(false);
  const [condition, setCondition] = useState(data.condition || '');

  const handleSave = () => {
    handleUpdateData<ConditionNodeData>({ condition });
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
        <GitBranch className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
          {data.label || 'Condition'}
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => setShowConfig(true)}
          className="w-full text-left bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-3 py-2 hover:border-primary-400 transition-colors"
        >
          <div className="text-[11px] uppercase tracking-wide text-dark-400 dark:text-dark-500 mb-1">
            Condition Expression
          </div>
          <div className="text-sm text-dark-900 dark:text-dark-100 truncate font-mono">
            {condition || 'Click to set condition'}
          </div>
        </button>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="absolute inset-0 z-20 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30 rounded-lg" onClick={() => setShowConfig(false)} />
          <div className="relative z-30 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg shadow-lg p-4 w-[400px]">
            <div className="text-sm font-semibold text-dark-900 dark:text-white mb-3">Condition Expression</div>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-dark-500 dark:text-dark-400 mb-1">
                  Expression (e.g., {'{'}{'{'}nodeId.field{'}'}{'}'} &gt; 10)
                </div>
                <textarea
                  value={condition}
                  onChange={(e) => setCondition(e.target.value)}
                  placeholder="Enter condition expression"
                  className="w-full text-sm bg-white dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded px-2 py-1 font-mono"
                  rows={3}
                />
              </div>
              <div className="text-xs text-dark-500 dark:text-dark-400">
                Use variables like: {'{'}{'{'}nodeId.field{'}'}{'}'} or {'{'}{'{'}inputs.paramName{'}'}{'}'}
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

      {/* True/False Handles */}
      <div className="mt-3 pt-2 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center space-x-2 mb-2">
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 bg-green-500 dark:bg-green-400"
            id="true"
            style={{ top: 'auto', bottom: '60%' }}
          />
          <div className="text-xs text-green-600 dark:text-green-400">True</div>
        </div>
        <div className="flex items-center space-x-2">
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 bg-red-500 dark:bg-red-400"
            id="false"
            style={{ top: 'auto', bottom: '30%' }}
          />
          <div className="text-xs text-red-600 dark:text-red-400">False</div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
    </NodeWrapper>
  );
};

export default ConditionNode;

