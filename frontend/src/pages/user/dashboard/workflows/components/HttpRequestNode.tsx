import { Handle, Position, useReactFlow } from 'reactflow';
import { Globe, Send, Trash2, Plus } from 'lucide-react';
import { HttpRequestNodeData } from '../types/workflow.types';

interface HttpRequestNodeProps { id: string; data: HttpRequestNodeData; selected?: boolean; }

const HttpRequestNode = ({ id, data, selected }: HttpRequestNodeProps) => {
  const rf = useReactFlow();
  const handleDelete = () => {
    rf.setNodes((nds) => nds.filter((n) => n.id !== id));
  };
  const addNodeAndConnect = (sourceHandle: 'success' | 'fail') => {
    const current = rf.getNode(id) as any;
    const baseX = current?.position?.x ?? 0;
    const baseY = current?.position?.y ?? 0;
    const newId = `http-${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'httpRequest',
      position: { x: baseX + 260, y: baseY + (sourceHandle === 'success' ? -10 : 10) },
      data: {
        label: 'HTTP Request',
        method: 'GET',
        url: 'http://localhost:8001/api/health',
        headers: {},
        body: '',
      },
    };
    rf.setNodes((nds) => [...nds, newNode]);
    rf.setEdges((eds) => [...eds, { id: `${id}-${sourceHandle}-${newId}`, source: id, target: newId, sourceHandle }]);
  };
  const methodColors: Record<string, string> = {
    GET: 'bg-blue-500',
    POST: 'bg-green-500',
    PUT: 'bg-yellow-500',
    DELETE: 'bg-red-500',
    PATCH: 'bg-purple-500',
  };

  return (
    <div
      className={`relative px-4 py-3 shadow-lg rounded-lg border-2 min-w-[280px] bg-white dark:bg-dark-800 ${
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
        <Globe className="w-4 h-4 text-primary-600 dark:text-primary-400" />
        <div className="font-semibold text-sm text-dark-900 dark:text-white flex-1 truncate">
          {data.label}
        </div>
      </div>

      {data.applicationContext && (
        <div className="text-xs text-dark-500 dark:text-dark-400 mb-2">
          {data.applicationContext}
        </div>
      )}

      <div className="flex items-center space-x-2 mb-2">
        <span
          className={`px-2 py-0.5 rounded text-xs font-semibold text-white ${
            methodColors[data.method] || 'bg-gray-500'
          }`}
        >
          {data.method}
        </span>
        <span className="text-xs text-dark-600 dark:text-dark-400 font-mono truncate flex-1">
          {data.url}
        </span>
      </div>

      <div className="flex items-center space-x-2 mt-2">
        <Send className="w-3 h-3 text-dark-400 dark:text-dark-500" />
        <span className="text-xs text-dark-500 dark:text-dark-400">Send</span>
      </div>

      <div className="mt-3 pt-2 border-t border-dark-200 dark:border-dark-700">
        <div className="flex items-center space-x-2 mb-1">
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 bg-green-500 dark:bg-green-400"
            id="success"
            style={{ top: 'auto', bottom: '40%' }}
          />
          <div className="text-xs text-green-600 dark:text-green-400 flex items-center space-x-1">
            <span>Success ()</span>
            <button
              onClick={() => addNodeAndConnect('success')}
              className="ml-1 p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
              title="Add and connect node"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Handle
            type="source"
            position={Position.Right}
            className="w-3 h-3 bg-red-500 dark:bg-red-400"
            id="fail"
            style={{ top: 'auto', bottom: '20%' }}
          />
          <div className="text-xs text-red-600 dark:text-red-400 flex items-center space-x-1">
            <span>Fail ()</span>
            <button
              onClick={() => addNodeAndConnect('fail')}
              className="ml-1 p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700"
              title="Add and connect node"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-3 h-3 bg-primary-500 dark:bg-primary-400"
      />
    </div>
  );
};

export default HttpRequestNode;

