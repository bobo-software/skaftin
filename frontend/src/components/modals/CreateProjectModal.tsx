import React, { useState } from 'react';
import { AppButton, AppInput } from '@components/ComponentsIndex';
import { Database, X } from 'lucide-react';
import { useProjectStore } from '../../stores/StoresIndex';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (project: any) => void;
}

const CreateProjectModal = ({ isOpen, onClose, onSuccess }: CreateProjectModalProps) => {
  const { createProject } = useProjectStore();
  
  // State variables
  const [projectData, setProjectData] = useState({
    name: '',
    description: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData.name.trim()) return;

    setIsCreating(true);
    setError(null);

    try {
      // Make the API call to create the project
      const newProject = await createProject(projectData.name, projectData.description);

      if (newProject) {
        // Reset form
        setProjectData({ name: '', description: '' });
        // Call success callback with the created project
        onSuccess?.(newProject);
        onClose();
      } else {
        setError('Failed to create project. Please try again.');
      }
    } catch (err) {
      console.error('Error creating project:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProjectData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-dark-200 dark:border-dark-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-dark-900 dark:text-white">
              Create New Project
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
          >
            <X className="w-5 h-5 text-dark-600 dark:text-dark-300" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <AppInput
            label="Project Name"
            placeholder="Enter project name"
            value={projectData.name}
            onChange={(value: string) => handleInputChange('name', value)}
            required
            icon={<Database className="w-4 h-4" />}
          />
          <AppInput
            label="Description (Optional)"
            placeholder="Describe your project..."
            value={projectData.description}
            onChange={(value: string) => handleInputChange('description', value)}
          />


          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="flex space-x-3">
            <AppButton
              type="button"
              variant="secondary"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </AppButton>
            <AppButton
              type="submit"
              loading={isCreating}
              disabled={!projectData.name.trim() || isCreating}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </AppButton>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateProjectModal;