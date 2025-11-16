import { Handle, Position, useReactFlow } from 'reactflow';
import { Play, Trash2 } from 'lucide-react';
import { StartNodeData } from '../types/workflow.types';

interface StartNodeProps { id: string; data: StartNodeData; selected?: boolean; }

const StartNode = ({ id, data, selected }: StartNodeProps) => {
  const rf = useReactFlow();
  const handleDelete = () => {
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  };

  return (
    <div
      className={`relative px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] bg-white dark:bg-dark-800 ${
        selected
          ? 'border-primary-500 dark:border-primary-400'
          : 'border-dark-200 dark:border-dark-700'
      }`}
    >
      {selected && (
        <div className="absolute -top-3 -right-3 bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded shadow p-1 z-10 flex items-center space-x-1">
          <button
            onClick={handleDelete}
            className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      )}
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
    </div>
  );
};

export default StartNode;

