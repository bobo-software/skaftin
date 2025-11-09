import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import { useNavigate } from 'react-router-dom';
import { DeleteProjectModal } from '../../../../components/ComponentsIndex';
import { Settings, Users, Shield, Loader2 } from 'lucide-react';
import TeamTab from '../../../../components/settings/TeamTab';
import CredentialsTab from '../../../../components/settings/CredentialsTab';
import ToastUtils from '../../../../utils/ToastUtils';

type SettingsTabType = 'general' | 'team' | 'credentials';

const ProjectSettingsTab = () => {
  const { currentProject, updateProject, deleteProject, loading } = useProjectStore();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabType>('general');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Initialize form with current project data
  useEffect(() => {
    if (currentProject) {
      setProjectName(currentProject.name);
      setProjectDescription(currentProject.description || '');
    }
  }, [currentProject]);

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

  const handleSaveChanges = async () => {
    if (!currentProject) return;

    if (!projectName.trim()) {
      ToastUtils.error('Project name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const result = await updateProject(currentProject.id, {
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
      });

      if (result) {
        ToastUtils.success('Project updated successfully!');
      } else {
        ToastUtils.error('Failed to update project');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      ToastUtils.error('Error updating project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDatabase = () => {
    // TODO: Implement database reset functionality
    console.log('Reset database functionality not implemented yet');
    ToastUtils.warning('Database reset functionality coming soon');
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Settings</h2>
      
      {/* Tabs */}
      <div className="border-b border-dark-200 dark:border-dark-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'general'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300'
            }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            General
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'team'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Team
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'credentials'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300'
            }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            API Credentials
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'general' && (
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
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter project name"
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Description
              </label>
              <textarea
                rows={3}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                placeholder="Enter project description"
                disabled={isSaving}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Database Schema
              </label>
              <input
                type="text"
                value={currentProject?.schema_name || ''}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400"
                disabled
                readOnly
              />
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                This is the PostgreSQL schema name for your project database
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Storage Bucket
              </label>
              <input
                type="text"
                value={currentProject?.bucket_name || ''}
                className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400"
                disabled
                readOnly
              />
              <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                This is the MinIO bucket name for your project files
              </p>
            </div>
            <button 
              onClick={handleSaveChanges}
              disabled={isSaving || !projectName.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isSaving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
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
      )}

      {activeTab === 'team' && (
        <TeamTab />
      )}

      {activeTab === 'credentials' && (
        <CredentialsTab />
      )}

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