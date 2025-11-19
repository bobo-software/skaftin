import { useState } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import { GitBranch, ArrowLeft } from 'lucide-react';
import WorkflowEditor from '@components/workflows/WorkflowEditor';
import WorkflowList from '@components/workflows/WorkflowList';
import { AppButton } from '@components/ComponentsIndex';
import useWorkflowStore from '@stores/workflows/useWorkflowStore';

interface ProjectWorkflowsTabProps {
  projectId: string;
}

const ProjectWorkflowsTab = ({ projectId }: ProjectWorkflowsTabProps) => {
  const { currentProject } = useProjectStore();
  const { loadWorkflow, reset } = useWorkflowStore();
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<number | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);

  const handleSelectWorkflow = async (workflowId: number) => {
    setLoadingWorkflow(true);
    setIsCreatingNew(false);
    try {
      reset(); // Clear current workflow state
      const result = await loadWorkflow(projectId, workflowId);
      if (result.success) {
        setSelectedWorkflowId(workflowId);
      } else {
        console.error('Failed to load workflow:', result.error);
      }
    } catch (error) {
      console.error('Error loading workflow:', error);
    } finally {
      setLoadingWorkflow(false);
    }
  };

  const handleCreateNew = () => {
    reset();
    setSelectedWorkflowId(null);
    setIsCreatingNew(true);
  };

  const handleBackToList = () => {
    setSelectedWorkflowId(null);
    setIsCreatingNew(false);
  };

  const handleWorkflowCreated = (workflowId: number) => {
    setSelectedWorkflowId(workflowId);
    setIsCreatingNew(false);
  };

  if (!currentProject) {
    return (
      <div className="text-center py-12">
        <GitBranch className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
        <p className="text-dark-600 dark:text-dark-300">Select a project to access workflows</p>
      </div>
    );
  }

  const showEditor = selectedWorkflowId !== null || isCreatingNew;

  return (
    <div className="h-[93vh] flex flex-col">
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 flex-1 min-h-0 flex flex-col overflow-hidden">
        {!showEditor ? (
          <WorkflowList
            projectId={projectId}
            onSelectWorkflow={handleSelectWorkflow}
            onCreateNew={handleCreateNew}
          />
        ) : (
          <>
            <div className="flex items-center space-x-3 px-6 py-4 border-b border-dark-200 dark:border-dark-700">
              <AppButton
                variant="secondary"
                size="sm"
                onClick={handleBackToList}
                className="flex items-center space-x-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to List</span>
              </AppButton>
              <div className="flex-1" />
              <GitBranch className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              <h2 className="text-2xl font-semibold text-dark-900 dark:text-white">
                {isCreatingNew ? 'New Workflow' : 'Workflow Editor'}
              </h2>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden">
              {loadingWorkflow ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                    <p className="text-dark-600 dark:text-dark-300">Loading workflow...</p>
                  </div>
                </div>
              ) : (
                <WorkflowEditor 
                  projectId={projectId} 
                  workflowId={selectedWorkflowId} 
                  onWorkflowCreated={handleWorkflowCreated}
                />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectWorkflowsTab;

