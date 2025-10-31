import React, { useState } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import { useNavigate } from 'react-router-dom';
import { DeleteProjectModal } from '../../../../components/ComponentsIndex';

const ProjectSettingsTab = () => {
  const { currentProject, deleteProject } = useProjectStore();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const handleDeleteProject = async () => {
    if (!currentProject) return;
    
    try {
      const success = await deleteProject(currentProject.id);
      if (success) {
        // Navigate back to projects overview after successful deletion
        navigate('/projects');
      }
    } catch (error) {
      console.error('Failed to delete project:', error);
      // Error handling could be improved with toast notifications
    }
  };

  const handleResetDatabase = () => {
    // TODO: Implement database reset functionality
    console.log('Reset database functionality not implemented yet');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Settings</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Project Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Project Name
              </label>
              <input
                type="text"
                defaultValue={currentProject?.name || ''}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                placeholder="Enter project name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                defaultValue={currentProject?.description || ''}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                placeholder="Enter project description"
              />
            </div>
            <button className="btn-primary">
              Save Changes
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Danger Zone</h3>
          <div className="space-y-4">
            <button 
              onClick={() => setIsDeleteModalOpen(true)}
              className="w-full btn-secondary text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
            >
              Delete Project
            </button>
            <button 
              onClick={handleResetDatabase}
              className="w-full btn-secondary text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20"
            >
              Reset Database
            </button>
          </div>
        </div>
      </div>

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteProject}
        projectName={currentProject?.name || ''}
      />
    </div>
  );
};

export default ProjectSettingsTab;