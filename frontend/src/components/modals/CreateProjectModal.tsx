import React, { useState } from 'react';
import { AppButton, AppInput, ErrorMessage } from '../ComponentsIndex';
import { Database, X } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (projectData: { name: string; description: string }) => void;
}

const CreateProjectModal = ({ isOpen, onClose, onSuccess }: CreateProjectModalProps) => {
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

    // Instead of making API call here, just pass the data to parent
    // The parent will handle the actual project creation
    onSuccess?.(projectData);
    onClose();
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
            onChange={(value) => handleInputChange('name', value)}
            required
            icon={<Database className="w-4 h-4" />}
          />

          <AppInput
            label="Description (Optional)"
            placeholder="Describe your project..."
            value={projectData.description}
            onChange={(value) => handleInputChange('description', value)}
          />

          {error && (
            <ErrorMessage
              message={error}
              type="error"
              onDismiss={() => setError(null)}
            />
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