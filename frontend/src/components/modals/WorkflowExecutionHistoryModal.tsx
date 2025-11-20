import { useState, useEffect } from 'react';
import { X, Clock, CheckCircle2, XCircle, Loader2, AlertCircle } from 'lucide-react';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

interface WorkflowExecution {
  id: number;
  workflow_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string;
  completed_at: string | null;
  triggered_by: 'manual' | 'cron' | 'api' | null;
  input_data: any;
  result_data: any;
  error_message: string | null;
  created_at: string;
}

interface WorkflowExecutionHistoryModalProps {
  workflowId: number;
  projectId: string;
  workflowName: string;
  isOpen: boolean;
  onClose: () => void;
}

const WorkflowExecutionHistoryModal = ({
  workflowId,
  projectId,
  workflowName,
  isOpen,
  onClose,
}: WorkflowExecutionHistoryModalProps) => {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchExecutions();
    }
  }, [isOpen, workflowId, projectId]);

  const fetchExecutions = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.get(
        ApiRoutes.WORKFLOWS.GET_EXECUTIONS(projectId, workflowId),
        token
      );
      if (response.success) {
        setExecutions(response.data || []);
      } else {
        setError(response.message || 'Failed to fetch execution history');
      }
    } catch (err: any) {
      console.error('Error fetching executions:', err);
      setError(err.message || 'Failed to fetch execution history');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 text-xs rounded-full font-medium';
    switch (status) {
      case 'completed':
        return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300`;
      case 'failed':
        return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300`;
      case 'running':
        return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300`;
      case 'pending':
        return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300`;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const formatDuration = (started: string, completed: string | null) => {
    if (!completed) return 'Running...';
    const start = new Date(started).getTime();
    const end = new Date(completed).getTime();
    const duration = end - start;
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white">
              Execution History
            </h3>
            <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
              {workflowName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            </div>
          ) : executions.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
              <h4 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
                No Execution History
              </h4>
              <p className="text-dark-600 dark:text-dark-300">
                This workflow hasn't been executed yet.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {executions.map((execution) => (
                <div
                  key={execution.id}
                  className="bg-white dark:bg-dark-900 rounded-lg border border-dark-200 dark:border-dark-700 p-4"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(execution.status)}
                      <div>
                        <p className="font-medium text-dark-900 dark:text-white">
                          Execution #{execution.id}
                        </p>
                        <p className="text-xs text-dark-500 dark:text-dark-400">
                          {formatDate(execution.started_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={getStatusBadge(execution.status)}>
                        {execution.status}
                      </span>
                      {execution.triggered_by && (
                        <span className="px-2 py-1 text-xs rounded-full bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400">
                          {execution.triggered_by}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <p className="text-dark-500 dark:text-dark-400">Started</p>
                      <p className="text-dark-900 dark:text-white">
                        {formatDate(execution.started_at)}
                      </p>
                    </div>
                    <div>
                      <p className="text-dark-500 dark:text-dark-400">Duration</p>
                      <p className="text-dark-900 dark:text-white">
                        {formatDuration(execution.started_at, execution.completed_at)}
                      </p>
                    </div>
                    {execution.completed_at && (
                      <div>
                        <p className="text-dark-500 dark:text-dark-400">Completed</p>
                        <p className="text-dark-900 dark:text-white">
                          {formatDate(execution.completed_at)}
                        </p>
                      </div>
                    )}
                  </div>

                  {execution.error_message && (
                    <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                        Error
                      </p>
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {execution.error_message}
                      </p>
                    </div>
                  )}

                  {execution.result_data && execution.status === 'completed' && (
                    <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                      <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-1">
                        Result
                      </p>
                      <pre className="text-xs text-green-700 dark:text-green-300 overflow-x-auto">
                        {JSON.stringify(execution.result_data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-dark-200 dark:border-dark-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkflowExecutionHistoryModal;

