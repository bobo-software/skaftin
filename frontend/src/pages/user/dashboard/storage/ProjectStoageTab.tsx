import { useProjectStore } from '../../../../stores/StoresIndex';
import StorageViewer from '../../../../components/database/StorageViewer';
import { Cloud } from 'lucide-react';

const ProjectStorageTab = () => {
  const { currentProject } = useProjectStore();
  



  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Cloud className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
          <p className="text-dark-600 dark:text-dark-300">Please select a project to view its storage</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full">
      <StorageViewer projectId={currentProject.id.toString()} />
    </div>
  );
};

export default ProjectStorageTab;