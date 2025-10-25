import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../../../stores/StoresIndex';
import McpService from '../../../../services/McpService';
import { 
  Cloud, 
  Plus,
  Code,
  Trash2
} from 'lucide-react';

const ProjectStorageTab = () => {
  const { currentProject } = useAppStore();
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFiles = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await McpService.listFiles(currentProject.id);
      
      if (response.success && response.result.success) {
        setFiles(response.result.data || []);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject]);

  useEffect(() => {
    if (currentProject) {
      loadFiles();
    }
  }, [currentProject, loadFiles]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Storage</h2>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Upload File
        </button>
      </div>

      <div className="card">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-dark-600 dark:text-dark-300">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="text-center py-12">
            <Cloud className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">No Files Uploaded</h3>
            <p className="text-dark-600 dark:text-dark-300 mb-6">Upload your first file to get started</p>
            <button className="btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              Upload File
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Files</h3>
            {files.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Cloud className="w-5 h-5 text-primary-500" />
                  <span className="font-medium text-dark-900 dark:text-white">{file.name}</span>
                  <span className="text-sm text-dark-500 dark:text-dark-400">({file.size} bytes)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300">
                    <Code className="w-4 h-4" />
                  </button>
                  <button className="text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectStorageTab;