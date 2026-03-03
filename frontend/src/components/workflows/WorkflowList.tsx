import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Play, Calendar, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { AppButton } from '@components/ComponentsIndex';
import ConfirmModal from '@components/modals/ConfirmModal';
import useWorkflowStore from '@stores/workflows/useWorkflowStore';

interface Workflow {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  schedule?: string;
  created_at: string;
  updated_at: string;
}

interface WorkflowListProps {
  projectId: string;
  onSelectWorkflow: (workflowId: number) => void;
  onCreateNew: () => void;
}

const WorkflowList = ({ projectId, onSelectWorkflow, onCreateNew }: WorkflowListProps) => {
  const { listWorkflows, deleteWorkflow } = useWorkflowStore();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; workflow: Workflow | null }>({
    isOpen: false,
    workflow: null,
  });
  const [deleting, setDeleting] = useState(false);

  const fetchWorkflows = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listWorkflows(projectId);
      if (result.success) {
        setWorkflows(Array.isArray(result.workflows) ? result.workflows : []);
      } else {
        setError(result.error || 'Failed to load workflows');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchWorkflows();
    }
  }, [projectId]);

  const handleDelete = async () => {
    if (!deleteConfirm.workflow) return;

    setDeleting(true);
    try {
      const result = await deleteWorkflow(projectId, deleteConfirm.workflow.id);
      if (result.success) {
        setWorkflows(workflows.filter((w) => w.id !== deleteConfirm.workflow!.id));
        setDeleteConfirm({ isOpen: false, workflow: null });
      } else {
        setError(result.error || 'Failed to delete workflow');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete workflow');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
          <AppButton variant="secondary" onClick={fetchWorkflows} className="mt-3">
            Retry
          </AppButton>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div>
            <h2 className="text-2xl font-semibold text-dark-900 dark:text-white">Workflows</h2>
            <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
              Manage and execute your automation workflows
            </p>
          </div>
          <AppButton variant="primary" onClick={onCreateNew} className="flex items-center space-x-2">
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </AppButton>
        </div>

        {/* Workflows List */}
        <div className="flex-1 overflow-y-auto p-6">
          {workflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12">
              <div className="w-16 h-16 bg-dark-100 dark:bg-dark-700 rounded-full flex items-center justify-center mb-4">
                <Play className="w-8 h-8 text-dark-400 dark:text-dark-500" />
              </div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">No Workflows Yet</h3>
              <p className="text-sm text-dark-600 dark:text-dark-300 mb-4">
                Create your first workflow to automate tasks and processes
              </p>
              <AppButton variant="primary" onClick={onCreateNew}>
                Create Workflow
              </AppButton>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((workflow) => (
                <div
                  key={workflow.id}
                  className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => onSelectWorkflow(workflow.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-1">
                        {workflow.name}
                      </h3>
                      {workflow.description && (
                        <p className="text-sm text-dark-600 dark:text-dark-300 line-clamp-2">
                          {workflow.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 ml-2">
                      {workflow.enabled ? (
                        <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {workflow.schedule && (
                      <div className="flex items-center space-x-1 text-xs text-dark-600 dark:text-dark-400 bg-dark-50 dark:bg-dark-700 px-2 py-1 rounded">
                        <Calendar className="w-3 h-3" />
                        <span>Scheduled</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1 text-xs text-dark-600 dark:text-dark-400">
                      <Clock className="w-3 h-3" />
                      <span>Updated {formatDate(workflow.updated_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 pt-3 border-t border-dark-200 dark:border-dark-700">
                    <AppButton
                      variant="secondary"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectWorkflow(workflow.id);
                      }}
                      className="flex-1 flex items-center justify-center space-x-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </AppButton>
                    <AppButton
                      variant="danger"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm({ isOpen: true, workflow });
                      }}
                      className="flex items-center justify-center space-x-1"
                    >
                      <Trash2 className="w-3 h-3" />
                    </AppButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        heading="Delete Workflow"
        text={`Are you sure you want to delete "${deleteConfirm.workflow?.name}"? This action cannot be undone and will delete all associated nodes, edges, and execution history.`}
        onCancel={() => setDeleteConfirm({ isOpen: false, workflow: null })}
        onConfirm={handleDelete}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </>
  );
};

export default WorkflowList;


