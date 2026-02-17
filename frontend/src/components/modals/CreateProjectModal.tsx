import React, { useState, useEffect } from 'react';
import { AppButton, AppInput } from '@components/ComponentsIndex';
import { Database, X, Building2, Plus } from 'lucide-react';
import { useProjectStore, useOrganizationStore } from '../../stores/StoresIndex';
import CreateOrganizationModal from './CreateOrganizationModal';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (project: any) => void;
}

const CreateProjectModal = ({ isOpen, onClose, onSuccess }: CreateProjectModalProps) => {
  const { createProject } = useProjectStore();
  const { organizations, fetchOrganizations } = useOrganizationStore();
  // Only show orgs where the user has permission to create projects (admin or dev)
  const creatableOrgs = organizations.filter(org => org.role === 'admin' || org.role === 'dev');
  const hasOrganizations = creatableOrgs.length > 0;
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  
  // State variables
  const [projectData, setProjectData] = useState({
    name: '',
    description: '',
    organization_id: 0
  });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch organizations when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen, fetchOrganizations]);

  // Set default organization when creatable organizations are loaded
  useEffect(() => {
    if (creatableOrgs.length > 0 && projectData.organization_id === 0) {
      setProjectData(prev => ({
        ...prev,
        organization_id: creatableOrgs[0].id
      }));
    }
  }, [creatableOrgs, projectData.organization_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectData.name.trim() || !projectData.organization_id) return;

    setIsCreating(true);
    setError(null);

    try {
      // Make the API call to create the project with organization_id
      const newProject = await createProject(projectData.name, projectData.description, projectData.organization_id);

      if (newProject) {
        // Reset form
        setProjectData({ name: '', description: '', organization_id: creatableOrgs.length > 0 ? creatableOrgs[0].id : 0 });
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
          {/* Organization Selection */}
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Organization *
            </label>
            {hasOrganizations ? (
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="w-4 h-4 text-dark-400" />
                </div>
                <select
                  value={projectData.organization_id}
                  onChange={(e) => handleInputChange('organization_id', e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-dark-200 dark:border-dark-700 rounded-lg 
                           bg-white dark:bg-dark-700 text-dark-900 dark:text-white 
                           focus:ring-2 focus:ring-primary-500 focus:border-transparent
                           transition-colors"
                  required
                >
                  {creatableOrgs.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                <p className="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  You need an organization before you can create a project.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateOrgModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Create Organization
                </button>
              </div>
            )}
          </div>

          <AppInput
            label="Project Name"
            placeholder="Enter project name"
            value={projectData.name}
            onChange={(value: string) => handleInputChange('name', value)}
            required
            disabled={!hasOrganizations}
            icon={<Database className="w-4 h-4" />}
          />
          <AppInput
            label="Description (Optional)"
            placeholder="Describe your project..."
            value={projectData.description}
            onChange={(value: string) => handleInputChange('description', value)}
            disabled={!hasOrganizations}
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
              disabled={!projectData.name.trim() || !projectData.organization_id || isCreating || creatableOrgs.length === 0}
              className="flex-1"
            >
              {isCreating ? 'Creating...' : 'Create Project'}
            </AppButton>
          </div>
        </form>
      </div>

      {/* Create Organization Modal */}
      <CreateOrganizationModal
        isOpen={showCreateOrgModal}
        onClose={() => setShowCreateOrgModal(false)}
        onSuccess={() => fetchOrganizations()}
      />
    </div>
  );
};

export default CreateProjectModal;