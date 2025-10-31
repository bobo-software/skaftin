import { useEffect, useState, useCallback } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import { 
  Database, 
  Cloud, 
  Code,
  Plus,
  Calendar,
  Clock
} from 'lucide-react';

const ProjectOverviewTab = () => {
  const { currentProject, projectStats, getProjectStats } = useProjectStore();
  const [isLoading, setIsLoading] = useState(false);

  const loadProjectStats = useCallback(async () => {
    setIsLoading(true);
    await getProjectStats(currentProject.id);
    setIsLoading(false);
  }, [currentProject, getProjectStats]);

  useEffect(() => {
    if (currentProject) {
      loadProjectStats();
    }
  }, [currentProject, loadProjectStats]);

  if (!currentProject) {
    return (
      <div className="text-center py-12">
        <Database className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
        <p className="text-dark-600 dark:text-dark-300 mb-6">Create or select a project to get started</p>
        <button className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Create Project
        </button>
      </div>
    );
  }

  // Format creation date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Project Information Card */}
      <div className="card">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">{currentProject.name}</h2>
            <p className="text-dark-600 dark:text-dark-300">{currentProject.description}</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-dark-500 dark:text-dark-400">
            <Calendar className="w-4 h-4" />
            <span>Created {formatDate(currentProject.created_at)}</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Database Schema</p>
              <p className="font-semibold text-dark-900 dark:text-white">{currentProject.name.toLowerCase()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Cloud className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Storage Bucket</p>
              <p className="font-semibold text-dark-900 dark:text-white">{currentProject.name.toLowerCase()}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-dark-500 dark:text-dark-400">Status</p>
              <p className="font-semibold text-green-600 dark:text-green-400">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-600 dark:text-dark-300">Database Tables</p>
              <p className="text-2xl font-bold text-dark-900 dark:text-white">
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  projectStats?.tableCount || 0
                )}
              </p>
            </div>
            <Database className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-600 dark:text-dark-300">Storage Files</p>
              <p className="text-2xl font-bold text-dark-900 dark:text-white">
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  projectStats?.fileCount || 0
                )}
              </p>
            </div>
            <Cloud className="w-8 h-8 text-primary-500" />
          </div>
        </div>
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-dark-600 dark:text-dark-300">API Calls</p>
              <p className="text-2xl font-bold text-dark-900 dark:text-white">
                {isLoading ? (
                  <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  projectStats?.apiCalls || 0
                )}
              </p>
            </div>
            <Code className="w-8 h-8 text-primary-500" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
              <div className="w-2 h-2 bg-primary-500 rounded-full mr-3"></div>
              Project created successfully
            </div>
            <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-3"></div>
              Database schema initialized
            </div>
            <div className="flex items-center text-sm text-dark-600 dark:text-dark-300">
              <div className="w-2 h-2 bg-blue-500 rounded-full mr-3"></div>
              Storage bucket created
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full btn-secondary text-left">
              <Database className="w-4 h-4 mr-2" />
              Create Table
            </button>
            <button className="w-full btn-secondary text-left">
              <Cloud className="w-4 h-4 mr-2" />
              Upload File
            </button>
            <button className="w-full btn-secondary text-left">
              <Code className="w-4 h-4 mr-2" />
              Open SQL Editor
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectOverviewTab;