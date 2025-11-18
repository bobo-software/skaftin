import { useState } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import useWorkflowStore from '../../../../stores/workflows/useWorkflowStore';
import { ResultPreview } from '@components/ComponentsIndex';

interface ExecutionStatusTabProps {
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
}

const ExecutionStatusTab = ({ selectedNodeId, onSelectNode }: ExecutionStatusTabProps) => {
  const nodes = useWorkflowStore((s) => s.nodes);
  const runStatuses = useWorkflowStore((s) => s.runStatuses);
  const nodeResults = useWorkflowStore((s) => s.nodeResults);
  const clearRun = useWorkflowStore((s) => s.clearRun);
  const [showResultModal, setShowResultModal] = useState(false);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'text-green-600 dark:text-green-400';
      case 'running':
        return 'text-amber-600 dark:text-amber-400';
      case 'fail':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-dark-500 dark:text-dark-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'running':
        return 'bg-amber-500';
      case 'fail':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusSymbol = (status: string) => {
    switch (status) {
      case 'success':
        return '✔';
      case 'running':
        return '…';
      case 'fail':
        return '✖';
      default:
        return '•';
    }
  };

  if (Object.keys(runStatuses).length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-dark-500 dark:text-dark-400">
        No execution in progress. Run a workflow to see status.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-2 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
        <div className="text-xs font-semibold text-dark-900 dark:text-white">Execution Status</div>
        <button
          onClick={clearRun}
          className="flex items-center space-x-1 px-2 py-1 text-xs rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
          title="Clear execution status"
        >
          <Trash2 className="w-3 h-3" />
          <span>Clear</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="px-2 py-2 space-y-1">
          {Object.entries(runStatuses).map(([nodeId, status]) => {
            const node = nodes.find((n) => n.id === nodeId);
            const label = (node?.data as any)?.label ?? `${node?.type ?? 'node'} (${nodeId})`;
            const isSelected = selectedNodeId === nodeId;
            const result = nodeResults[nodeId];

            return (
              <button
                key={nodeId}
                onClick={() => onSelectNode(isSelected ? null : nodeId)}
                className={`w-full text-left flex items-center justify-between text-xs rounded px-3 py-2 mb-1 transition-colors ${
                  isSelected
                    ? 'bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-500 dark:border-primary-400'
                    : 'bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 hover:bg-dark-100 dark:hover:bg-dark-800'
                }`}
              >
                <div className="truncate pr-2 flex items-center flex-1">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${getStatusBgColor(status)}`} />
                  <span className="font-medium">{label}</span>
                  <span className="ml-2 opacity-70 text-[10px]">[{nodeId}]</span>
                </div>
                <div className={`ml-2 font-semibold ${getStatusColor(status)}`}>{getStatusSymbol(status)}</div>
              </button>
            );
          })}
        </div>

        {/* Selected Node Details */}
        {selectedNodeId && nodeResults[selectedNodeId] && (
          <div className="px-4 py-3 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs text-dark-500 dark:text-dark-400">
                  Node: <span className="font-medium text-dark-900 dark:text-white">{selectedNodeId}</span>
                </div>
                {nodeResults[selectedNodeId].timestamp && (
                  <div className="text-[10px] text-dark-400 dark:text-dark-500">
                    {nodeResults[selectedNodeId].timestamp}
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    nodeResults[selectedNodeId].status === 'success'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                  }`}
                >
                  {nodeResults[selectedNodeId].status === 'success' ? 'Success' : 'Fail'}
                </span>
                <button
                  onClick={() => setShowResultModal(true)}
                  className="px-2 py-0.5 text-xs rounded bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 text-dark-900 dark:text-white"
                  title="View data"
                >
                  View Details
                </button>
              </div>
              {nodeResults[selectedNodeId].payload && (
                <details className="mt-2">
                  <summary className="text-xs text-dark-500 dark:text-dark-400 cursor-pointer hover:text-dark-700 dark:hover:text-dark-300">
                    Quick Preview
                  </summary>
                  <pre className="mt-2 text-[10px] bg-dark-100 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded p-2 overflow-auto max-h-32">
                    {JSON.stringify(nodeResults[selectedNodeId].payload, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Result Modal */}
      {showResultModal && selectedNodeId && nodeResults[selectedNodeId] && (
        <ResultPreview
          title={`${selectedNodeId}`}
          status={nodeResults[selectedNodeId].status}
          payload={nodeResults[selectedNodeId].payload}
          onClose={() => setShowResultModal(false)}
        />
      )}
    </div>
  );
};

export default ExecutionStatusTab;

