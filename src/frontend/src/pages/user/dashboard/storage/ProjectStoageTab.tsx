import { useEffect, useState, useCallback, useRef } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import McpService from '../../../../services/McpService';
import { 
  Cloud, 
  Plus,
  Code,
  Trash2
} from 'lucide-react';

const ProjectStorageTab = () => {
  console.log('ProjectStorageTab: Component mounted');
  
  const { currentProject, setCurrentProject } = useProjectStore();
  console.log('ProjectStorageTab: Current project from store:', currentProject);
  
  // Temporary: Set a project if none is selected
  useEffect(() => {
    if (!currentProject) {
      console.log('ProjectStorageTab: No current project, setting test project');
      const testProject = {
        id: 'b76224c8-2f0b-488c-ae7e-ed194585dce0',
        name: 'vMelodic',
        description: 'Test Project',
        schema_name: 'project_vmelodic',
        bucket_name: 'project-vmelodic',
        created_at: '2025-10-25T09:01:53.091Z',
        updated_at: '2025-10-25T09:01:53.091Z',
        user_id: '550e8400-e29b-41d4-a716-446655440000'
      };
      setCurrentProject(testProject);
    }
  }, [currentProject, setCurrentProject]);
  
  const projectToUse = currentProject;
  console.log('ProjectStorageTab: Using project:', projectToUse);
  
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(false);

  const loadFiles = useCallback(async () => {
    console.log('ProjectStorageTab: Loading files for project:', projectToUse?.id);
    
    // Prevent multiple simultaneous requests
    if (isLoadingRef.current) {
      console.log('ProjectStorageTab: Already loading, skipping request');
      return;
    }
    
    try {
      isLoadingRef.current = true;
      setIsLoading(true);
      const response = await McpService.listFiles(projectToUse.id);
      console.log('ProjectStorageTab: MCP response:', response);
      
      if (response.success && response.result.success) {
        const files = response.result.data || [];
        console.log('ProjectStorageTab: Extracted files:', files);
        setFiles(files);
      } else {
        console.error('ProjectStorageTab: Failed to load files:', response);
        setFiles([]);
      }
    } catch (error) {
      console.error('ProjectStorageTab: Error loading files:', error);
      setFiles([]);
    } finally {
      console.log('ProjectStorageTab: Setting loading to false');
      isLoadingRef.current = false;
      setIsLoading(false);
    }
  }, [projectToUse.id]); // Only depend on project ID

  useEffect(() => {
    if (projectToUse?.id) {
      loadFiles();
    } else {
      console.log('ProjectStorageTab: No project available, setting loading to false');
      setIsLoading(false);
    }
  }, [projectToUse?.id, loadFiles]); // Only depend on project ID and loadFiles

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
        {!projectToUse ? (
          <div className="text-center py-12">
            <Cloud className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
            <p className="text-dark-600 dark:text-dark-300">Please select a project to view its storage</p>
          </div>
        ) : isLoading ? (
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