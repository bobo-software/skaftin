import { useProjectStore } from '../../../../stores/StoresIndex';
import { GitBranch } from 'lucide-react';
import WorkflowEditor from './components/WorkflowEditor';

interface ProjectWorkflowsTabProps {
  projectId: string;
}

const ProjectWorkflowsTab = ({ projectId }: ProjectWorkflowsTabProps) => {
  const { currentProject } = useProjectStore();

  if (!currentProject) {
    return (
      <div className="text-center py-12">
        <GitBranch className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
        <p className="text-dark-600 dark:text-dark-300">Select a project to access workflows</p>
      </div>
    );
  }

  return (
    <div className="h-[93vh] flex flex-col">
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center space-x-3 px-6 py-4 border-b border-dark-200 dark:border-dark-700">
          <GitBranch className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h2 className="text-2xl font-semibold text-dark-900 dark:text-white">Workflows</h2>
        </div>
        
        <div className="flex-1 min-h-0 overflow-hidden">
          <WorkflowEditor projectId={projectId} />
        </div>
      </div>
    </div>
  );
};

export default ProjectWorkflowsTab;

