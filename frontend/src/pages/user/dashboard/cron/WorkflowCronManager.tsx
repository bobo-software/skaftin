import { useState, useEffect, useCallback } from 'react';
import { 
  Clock, 
  Trash2, 
  Edit2, 
  GitBranch,
  Pause,
  Play,
  History
} from 'lucide-react';
import RequestUtils from '../../../../utils/RequestUtils';
import ApiRoutes from '../../../../constants/ApiRoutes';
import { ScheduleWorkflowModal, WorkflowExecutionHistoryModal } from '../../../../components/ComponentsIndex';

interface Workflow {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  schedule: string | null;
  cron_job_id: number | null;
  created_at: string;
  updated_at: string;
}

interface WorkflowCronManagerProps {
  projectId: string;
}

const WorkflowCronManager = ({ projectId }: WorkflowCronManagerProps) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyWorkflow, setHistoryWorkflow] = useState<Workflow | null>(null);

  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.get(ApiRoutes.WORKFLOWS.LIST(projectId), token);
      if (response.success) {
        setWorkflows(response.data);
      }
    } catch (err: any) {
      console.error('Error fetching workflows:', err);
      setError(err.message || 'Failed to fetch workflows');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleScheduleWorkflow = async (schedule: string) => {
    if (!selectedWorkflow || !schedule.trim()) {
      setError('Schedule (cron expression) is required');
      return;
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.post(
        ApiRoutes.WORKFLOWS.SCHEDULE(projectId, selectedWorkflow.id),
        token,
        { schedule: schedule.trim() }
      );
      if (response.success) {
        setShowScheduleModal(false);
        setSelectedWorkflow(null);
        fetchWorkflows();
      }
    } catch (err: any) {
      console.error('Error scheduling workflow:', err);
      setError(err.message || 'Failed to schedule workflow');
    }
  };

  const handleUnscheduleWorkflow = async (workflow: Workflow) => {
    if (!confirm(`Are you sure you want to unschedule "${workflow.name}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.delete(
        ApiRoutes.WORKFLOWS.UNSCHEDULE(projectId, workflow.id),
        token,
        {}
      );
      if (response.success) {
        fetchWorkflows();
      }
    } catch (err: any) {
      console.error('Error unscheduling workflow:', err);
      setError(err.message || 'Failed to unschedule workflow');
    }
  };


  const openScheduleModal = (workflow: Workflow) => {
    setSelectedWorkflow(workflow);
    setShowScheduleModal(true);
  };

  const handleCancelSchedule = () => {
    setShowScheduleModal(false);
    setSelectedWorkflow(null);
    setError('');
  };

  const handleTogglePause = async (workflow: Workflow) => {
    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const response = await RequestUtils.put(
        ApiRoutes.WORKFLOWS.UPDATE(projectId, workflow.id),
        token,
        { enabled: !workflow.enabled }
      );
      if (response.success) {
        fetchWorkflows();
      }
    } catch (err: any) {
      console.error('Error toggling workflow pause:', err);
      setError(err.message || 'Failed to toggle workflow pause/resume');
    }
  };

  const handleViewHistory = (workflow: Workflow) => {
    setHistoryWorkflow(workflow);
    setShowHistoryModal(true);
  };

  const scheduledWorkflows = workflows.filter(w => w.schedule && w.cron_job_id);
  const unscheduledWorkflows = workflows.filter(w => !w.schedule || !w.cron_job_id);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Scheduled Workflows */}
      <div>
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3">
          Scheduled Workflows ({scheduledWorkflows.length})
        </h3>
        {scheduledWorkflows.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
            <Clock className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
            <h4 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
              No Scheduled Workflows
            </h4>
            <p className="text-dark-600 dark:text-dark-300 mb-4">
              Schedule workflows to run automatically on a schedule
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {scheduledWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <GitBranch className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                      <h4 className="font-semibold text-dark-900 dark:text-white">
                        {workflow.name}
                      </h4>
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          workflow.enabled
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                        }`}
                      >
                        {workflow.enabled ? 'Active' : 'Paused'}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-dark-600 dark:text-dark-300 mb-2">
                        {workflow.description}
                      </p>
                    )}
                    <div className="space-y-1 text-sm">
                      <p className="text-dark-600 dark:text-dark-300">
                        <span className="font-medium">Schedule:</span>{' '}
                        <code className="px-2 py-1 bg-dark-100 dark:bg-dark-900 rounded text-xs">
                          {workflow.schedule}
                        </code>
                      </p>
                      <p className="text-dark-600 dark:text-dark-300">
                        <span className="font-medium">Cron Job ID:</span>{' '}
                        <code className="px-2 py-1 bg-dark-100 dark:bg-dark-900 rounded text-xs">
                          {workflow.cron_job_id}
                        </code>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => handleViewHistory(workflow)}
                      className="p-2 text-dark-600 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                      title="View Execution History"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTogglePause(workflow)}
                      className={`p-2 rounded-lg transition-colors ${
                        workflow.enabled
                          ? 'text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                          : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                      }`}
                      title={workflow.enabled ? 'Pause Workflow' : 'Resume Workflow'}
                    >
                      {workflow.enabled ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => openScheduleModal(workflow)}
                      className="p-2 text-dark-600 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                      title="Edit Schedule"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleUnscheduleWorkflow(workflow)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Unschedule"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unscheduled Workflows */}
      {unscheduledWorkflows.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-3">
            Unscheduled Workflows ({unscheduledWorkflows.length})
          </h3>
          <div className="space-y-3">
            {unscheduledWorkflows.map((workflow) => (
              <div
                key={workflow.id}
                className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <GitBranch className="w-5 h-5 text-dark-400 dark:text-dark-500" />
                      <h4 className="font-semibold text-dark-900 dark:text-white">
                        {workflow.name}
                      </h4>
                    </div>
                    {workflow.description && (
                      <p className="text-sm text-dark-600 dark:text-dark-300">
                        {workflow.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={() => openScheduleModal(workflow)}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                    >
                      Schedule
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      <ScheduleWorkflowModal
        workflow={selectedWorkflow}
        isOpen={showScheduleModal}
        onSave={handleScheduleWorkflow}
        onCancel={handleCancelSchedule}
      />

      {/* Execution History Modal */}
      {historyWorkflow && (
        <WorkflowExecutionHistoryModal
          workflowId={historyWorkflow.id}
          projectId={projectId}
          workflowName={historyWorkflow.name}
          isOpen={showHistoryModal}
          onClose={() => {
            setShowHistoryModal(false);
            setHistoryWorkflow(null);
          }}
        />
      )}
    </div>
  );
};

export default WorkflowCronManager;

