import { useMemo } from 'react';
import { Info, Database, Code } from 'lucide-react';
import useWorkflowStore from '../../../../stores/workflows/useWorkflowStore';
import { useNodeSchema } from '../../../../hooks/useNodeSchema';
import type { Column } from '../../../../stores/data/useDatabaseStore';

interface NodeDetailsTabProps {
  nodeId: string;
}

const NodeDetailsTab = ({ nodeId }: NodeDetailsTabProps) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);

  const node = useMemo(() => nodes.find((n) => n.id === nodeId), [nodes, nodeId]);

  // Get schema if connected to dbSelect
  const { schema, sourceLabel, hasSchema } = useNodeSchema({
    nodeId,
    autoDetectSource: true,
    updateNodeData: false,
  });

  // Get connections
  const connections = useMemo(() => {
    if (!node) return { incoming: [], outgoing: [] };
    const incoming = edges.filter((e) => e.target === nodeId);
    const outgoing = edges.filter((e) => e.source === nodeId);
    return { incoming, outgoing };
  }, [edges, nodeId, node]);

  // Get execution result
  const result = nodeResults[nodeId];

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-dark-500 dark:text-dark-400">
        Node not found
      </div>
    );
  }

  const nodeData = node.data as any;

  return (
    <div className="h-full overflow-auto px-4 py-3">
      <div className="space-y-4">
        {/* Node Info */}
        <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Info className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <div className="text-xs font-semibold text-dark-900 dark:text-white">Node Information</div>
          </div>
          <div className="space-y-1 text-xs">
            <div>
              <span className="text-dark-500 dark:text-dark-400">ID:</span>
              <span className="ml-2 text-dark-900 dark:text-white font-mono">{nodeId}</span>
            </div>
            <div>
              <span className="text-dark-500 dark:text-dark-400">Type:</span>
              <span className="ml-2 text-dark-900 dark:text-white">{node.type}</span>
            </div>
            <div>
              <span className="text-dark-500 dark:text-dark-400">Label:</span>
              <span className="ml-2 text-dark-900 dark:text-white">{nodeData?.label || 'Unnamed'}</span>
            </div>
            <div>
              <span className="text-dark-500 dark:text-dark-400">Position:</span>
              <span className="ml-2 text-dark-900 dark:text-white">
                ({Math.round(node.position.x)}, {Math.round(node.position.y)})
              </span>
            </div>
          </div>
        </div>

        {/* Connections */}
        <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
          <div className="text-xs font-semibold text-dark-900 dark:text-white mb-2">Connections</div>
          <div className="space-y-2 text-xs">
            <div>
              <span className="text-dark-500 dark:text-dark-400">Incoming:</span>
              <span className="ml-2 text-dark-900 dark:text-white">
                {connections.incoming.length > 0
                  ? connections.incoming.map((e) => e.source).join(', ')
                  : 'None'}
              </span>
            </div>
            <div>
              <span className="text-dark-500 dark:text-dark-400">Outgoing:</span>
              <span className="ml-2 text-dark-900 dark:text-white">
                {connections.outgoing.length > 0
                  ? connections.outgoing.map((e) => e.target).join(', ')
                  : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Schema Info */}
        {hasSchema && (
          <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
            <div className="flex items-center space-x-2 mb-2">
              <Database className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div className="text-xs font-semibold text-dark-900 dark:text-white">Schema</div>
            </div>
            <div className="text-xs text-dark-500 dark:text-dark-400 mb-2">
              Connected to: <span className="font-mono text-dark-900 dark:text-white">{sourceLabel}</span>
            </div>
            <div className="text-xs text-dark-500 dark:text-dark-400 mb-2">
              {schema.length} column{schema.length !== 1 ? 's' : ''}
            </div>
            <details>
              <summary className="text-xs text-dark-500 dark:text-dark-400 cursor-pointer hover:text-dark-700 dark:hover:text-dark-300">
                View schema
              </summary>
              <pre className="mt-2 text-[10px] bg-dark-100 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded p-2 overflow-auto max-h-48">
                {JSON.stringify(
                  schema.map((col: Column) => ({
                    name: col.column_name,
                    type: col.data_type,
                    nullable: col.is_nullable,
                  })),
                  null,
                  2
                )}
              </pre>
            </details>
          </div>
        )}

        {/* Node Data */}
        <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
          <div className="flex items-center space-x-2 mb-2">
            <Code className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            <div className="text-xs font-semibold text-dark-900 dark:text-white">Node Data</div>
          </div>
          <details>
            <summary className="text-xs text-dark-500 dark:text-dark-400 cursor-pointer hover:text-dark-700 dark:hover:text-dark-300">
              View data
            </summary>
            <pre className="mt-2 text-[10px] bg-dark-100 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded p-2 overflow-auto max-h-48">
              {JSON.stringify(nodeData, null, 2)}
            </pre>
          </details>
        </div>

        {/* Execution Result */}
        {result && (
          <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
            <div className="text-xs font-semibold text-dark-900 dark:text-white mb-2">Last Execution</div>
            <div className="space-y-2 text-xs">
              <div>
                <span className="text-dark-500 dark:text-dark-400">Status:</span>
                <span
                  className={`ml-2 px-2 py-0.5 rounded ${
                    result.status === 'success'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  {result.status}
                </span>
              </div>
              {result.timestamp && (
                <div>
                  <span className="text-dark-500 dark:text-dark-400">Time:</span>
                  <span className="ml-2 text-dark-900 dark:text-white">{result.timestamp}</span>
                </div>
              )}
              <details>
                <summary className="text-xs text-dark-500 dark:text-dark-400 cursor-pointer hover:text-dark-700 dark:hover:text-dark-300">
                  View payload
                </summary>
                <pre className="mt-2 text-[10px] bg-dark-100 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded p-2 overflow-auto max-h-48">
                  {JSON.stringify(result.payload, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NodeDetailsTab;

