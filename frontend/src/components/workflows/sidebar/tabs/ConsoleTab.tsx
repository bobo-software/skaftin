import { useEffect, useState, useCallback } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import RequestUtils from '../../../../utils/RequestUtils';
import ApiRoutes from '../../../../constants/ApiRoutes';

interface NodeLog {
  nodeId: string;
  nodeType: string;
  nodeData: any;
  status: 'success' | 'fail' | 'skipped';
  startedAt: string;
  completedAt: string | null;
  executionTimeMs: number | null;
  resultData: any;
  errorMessage: string | null;
}

interface ExecutionLogs {
  execution: {
    id: number;
    status: string;
    started_at: string;
    completed_at: string | null;
    triggered_by: string;
    input_data: any;
    result_data: any;
    error_message: string | null;
  };
  nodeLogs: NodeLog[];
}

interface ConsoleTabProps {
  projectId: string;
  workflowId: number | null;
  executionId: number | null;
}

const ConsoleTab = ({ projectId, workflowId, executionId }: ConsoleTabProps) => {
  const [logs, setLogs] = useState<ExecutionLogs | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    if (!workflowId || !executionId) return;

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const url = ApiRoutes.WORKFLOWS.GET_EXECUTION_LOGS(projectId, workflowId, executionId);
      const response = await RequestUtils.get(url, token);

      if (response && response.success !== false) {
        setLogs((response as any).data || response);
      } else {
        setError((response as any)?.message || 'Failed to fetch execution logs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch execution logs');
    } finally {
      setLoading(false);
    }
  }, [projectId, workflowId, executionId]);

  useEffect(() => {
    if (workflowId && executionId) {
      // Reset logs when executionId changes
      setLogs(null);
      setError(null);
      // Fetch logs once when executionId is set
      fetchLogs();
    } else {
      // Clear logs when no execution
      setLogs(null);
      setError(null);
      setLoading(false);
    }
  }, [workflowId, executionId, fetchLogs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'fail':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'skipped':
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'fail':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'skipped':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
      default:
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    }
  };

  const formatTime = (time: string | null) => {
    if (!time) return 'N/A';
    return new Date(time).toLocaleTimeString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return 'N/A';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  // Show loading if we have an executionId but no logs yet
  const isLoading = loading || (executionId && !logs && !error);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 overflow-auto px-4 py-3">
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary-600 dark:text-primary-400" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 mb-3">
            <div className="text-sm text-red-800 dark:text-red-200">{error}</div>
          </div>
        )}

        {logs && !isLoading && (
          <div className="space-y-4">
            {/* Execution Summary */}
            <div className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3">
              <div className="text-xs font-semibold text-dark-900 dark:text-white mb-2">Execution Summary</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-dark-500 dark:text-dark-400">Status:</span>
                  <span className={`ml-2 px-2 py-0.5 rounded ${getStatusColor(logs.execution.status)}`}>
                    {logs.execution.status}
                  </span>
                </div>
                <div>
                  <span className="text-dark-500 dark:text-dark-400">Triggered by:</span>
                  <span className="ml-2 text-dark-900 dark:text-white">{logs.execution.triggered_by || 'manual'}</span>
                </div>
                <div>
                  <span className="text-dark-500 dark:text-dark-400">Started:</span>
                  <span className="ml-2 text-dark-900 dark:text-white">{formatTime(logs.execution.started_at)}</span>
                </div>
                <div>
                  <span className="text-dark-500 dark:text-dark-400">Completed:</span>
                  <span className="ml-2 text-dark-900 dark:text-white">{formatTime(logs.execution.completed_at)}</span>
                </div>
              </div>
              {logs.execution.error_message && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  Error: {logs.execution.error_message}
                </div>
              )}
            </div>

            {/* Node Logs */}
            <div>
              <div className="text-xs font-semibold text-dark-900 dark:text-white mb-2">
                Node Execution Details ({logs.nodeLogs.length} nodes)
              </div>
              <div className="space-y-2">
                {logs.nodeLogs.map((nodeLog, index) => (
                  <div
                    key={index}
                    className="bg-dark-50 dark:bg-dark-900 border border-dark-200 dark:border-dark-700 rounded p-3"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2 flex-1">
                        {getStatusIcon(nodeLog.status)}
                        <div>
                          <div className="text-xs font-semibold text-dark-900 dark:text-white">
                            {nodeLog.nodeId} ({nodeLog.nodeType})
                          </div>
                          <div className="text-[10px] text-dark-500 dark:text-dark-400 mt-0.5">
                            {formatTime(nodeLog.startedAt)} - {formatTime(nodeLog.completedAt)}
                            {nodeLog.executionTimeMs && ` • ${formatDuration(nodeLog.executionTimeMs)}`}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(nodeLog.status)}`}>
                        {nodeLog.status}
                      </span>
                    </div>

                    {/* Node Configuration */}
                    {nodeLog.nodeData && (
                      <details className="mt-2">
                        <summary className="text-xs text-dark-500 dark:text-dark-400 cursor-pointer hover:text-dark-700 dark:hover:text-dark-300">
                          Configuration
                        </summary>
                        <pre className="mt-1 text-[10px] bg-dark-100 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded p-2 overflow-auto max-h-32">
                          {JSON.stringify(nodeLog.nodeData, null, 2)}
                        </pre>
                      </details>
                    )}

                    {/* Result Data */}
                    {nodeLog.resultData && (
                      <details className="mt-2">
                        <summary className="text-xs text-dark-500 dark:text-dark-400 cursor-pointer hover:text-dark-700 dark:hover:text-dark-300">
                          Result Data
                        </summary>
                        <pre className="mt-1 text-[10px] bg-dark-100 dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded p-2 overflow-auto max-h-32">
                          {JSON.stringify(nodeLog.resultData, null, 2)}
                        </pre>
                      </details>
                    )}

                    {/* Error Message */}
                    {nodeLog.errorMessage && (
                      <div className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-2">
                        <div className="font-semibold mb-1">Error:</div>
                        <div>{nodeLog.errorMessage}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!logs && !isLoading && !error && !executionId && (
          <div className="flex items-center justify-center h-full text-sm text-dark-500 dark:text-dark-400">
            No logs available. Run a workflow to see execution logs.
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsoleTab;

