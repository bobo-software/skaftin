import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteProjectModal, ResetProjectModal } from '../../../../components/ComponentsIndex';
import { Settings, Users, Shield, Database, Loader2, Key } from 'lucide-react';
import TeamTab from '../../../../components/settings/TeamTab';
import CredentialsTab from '../../../../components/settings/CredentialsTab';
import BackupTab from '../../../../components/settings/BackupTab';
import ToastUtils from '../../../../utils/ToastUtils';

type SettingsTabType = 'general' | 'team' | 'credentials' | 'backup';

const ProjectSettingsTab = () => {
  const { currentProject, updateProject, deleteProject, resetProject, loading } = useProjectStore();
  const navigate = useNavigate();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<SettingsTabType>('general');
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [fieldEncryptionKeyInput, setFieldEncryptionKeyInput] = useState('');
  const [isSavingEncryptionKey, setIsSavingEncryptionKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

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

  const handleSaveEncryptionKey = async () => {
    if (!currentProject) return;
    if (!fieldEncryptionKeyInput.trim()) {
      ToastUtils.error('Enter a key to set');
      return;
    }
    setIsSavingEncryptionKey(true);
    try {
      const result = await updateProject(currentProject.id, {
        field_encryption_key: fieldEncryptionKeyInput,
      } as any);
      if (result) {
        setFieldEncryptionKeyInput('');
        ToastUtils.success('Field encryption key saved.');
      } else {
        ToastUtils.error('Failed to save encryption key');
      }
    } catch (error) {
      console.error('Failed to save encryption key:', error);
      ToastUtils.error('Failed to save encryption key');
    } finally {
      setIsSavingEncryptionKey(false);
    }
  };

  const handleClearEncryptionKey = async () => {
    if (!currentProject) return;
    setIsSavingEncryptionKey(true);
    try {
      const result = await updateProject(currentProject.id, {
        field_encryption_key: null,
      } as any);
      if (result) {
        setFieldEncryptionKeyInput('');
        ToastUtils.success('Field encryption key cleared.');
      } else {
        ToastUtils.error('Failed to clear encryption key');
      }
    } catch (error) {
      console.error('Failed to clear encryption key:', error);
      ToastUtils.error('Failed to clear encryption key');
    } finally {
      setIsSavingEncryptionKey(false);
    }
  };

  const handleResetProject = async () => {
    if (!currentProject) return;

    setIsResetting(true);
    try {
      const result = await resetProject(currentProject.id);

      if (result.success && result.result) {
        const { droppedTables, deletedFiles, errorCount } = result.result;

        if (errorCount === 0) {
          ToastUtils.success(`Project reset successfully! Dropped ${droppedTables} tables and deleted ${deletedFiles} files.`);
        } else {
          ToastUtils.warning(`Project reset completed with ${errorCount} errors. Dropped ${droppedTables} tables and deleted ${deletedFiles} files.`);
        }

        setIsResetModalOpen(false);
      } else {
        ToastUtils.error('Failed to reset project. Please try again.');
      }
    } catch (error) {
      console.error('Error resetting project:', error);
      ToastUtils.error('Error resetting project. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Settings</h2>

      {/* Tabs */}
      <div className="border-b border-dark-200 dark:border-dark-700">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab('general')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'general'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300'
              }`}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            General
          </button>
          <button
            onClick={() => setActiveTab('team')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'team'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300'
              }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Team
          </button>
          <button
            onClick={() => setActiveTab('credentials')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'credentials'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300'
              }`}
          >
            <Shield className="w-4 h-4 inline mr-2" />
            API Credentials
          </button>
          <button
            onClick={() => setActiveTab('backup')}
            className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'backup'
              ? 'border-primary-600 text-primary-600'
              : 'border-transparent text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300'
              }`}
          >
            <Database className="w-4 h-4 inline mr-2" />
            Backups
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
                  Storage Buckets
                </label>
                <input
                  type="text"
                  value="Multiple buckets supported"
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-100 dark:bg-dark-800 text-dark-600 dark:text-dark-400"
                  disabled
                  readOnly
                />
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  This project supports multiple storage buckets. Manage buckets in the Storage tab.
                </p>
              </div>
              <div className="border-t border-dark-200 dark:border-dark-700 pt-4 mt-4">
                <h4 className="text-sm font-semibold text-dark-900 dark:text-white mb-2 flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Field encryption
                </h4>
                {currentProject?.field_encryption_key_set && (
                  <p className="text-xs text-green-600 dark:text-green-400 mb-2">
                    Encryption key is set (used for encrypt/decrypt in insert/select payloads).
                  </p>
                )}
                <input
                  type="password"
                  value={fieldEncryptionKeyInput}
                  onChange={(e) => setFieldEncryptionKeyInput(e.target.value)}
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder={currentProject?.field_encryption_key_set ? 'Enter new key to replace' : 'Enter encryption key'}
                  disabled={isSavingEncryptionKey}
                  autoComplete="off"
                />
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Used when you pass encrypt/decrypt in database insert/update/select payloads. Leave empty to keep current key.
                </p>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Create the key yourself: use a long random string, a password manager, or run <code className="px-1 py-0.5 rounded bg-dark-200 dark:bg-dark-600 font-mono text-[11px]">openssl rand -base64 32</code> in a terminal. Store it securely — if you lose it, encrypted data cannot be decrypted.
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={handleSaveEncryptionKey}
                    disabled={isSavingEncryptionKey || !fieldEncryptionKeyInput.trim()}
                    className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isSavingEncryptionKey && <Loader2 className="w-4 h-4 animate-spin" />}
                    Save encryption key
                  </button>
                  {currentProject?.field_encryption_key_set && (
                    <button
                      type="button"
                      onClick={handleClearEncryptionKey}
                      disabled={isSavingEncryptionKey}
                      className="btn-secondary text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                    >
                      Clear key
                    </button>
                  )}
                </div>
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
              <div className="border-2 border-orange-200 dark:border-orange-800 rounded-lg p-4">
                <h4 className="font-medium text-dark-900 dark:text-white mb-2">Reset Project</h4>
                <p className="text-sm text-dark-600 dark:text-dark-300 mb-3">
                  Clear all database tables and storage files. The project structure will remain.
                </p>
                <button
                  onClick={() => setIsResetModalOpen(true)}
                  disabled={isResetting}
                  className="w-full btn-secondary text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isResetting ? 'Resetting...' : 'Reset Project'}
                </button>
              </div>

              <div className="border-2 border-red-200 dark:border-red-800 rounded-lg p-4">
                <h4 className="font-medium text-dark-900 dark:text-white mb-2">Delete Project</h4>
                <p className="text-sm text-dark-600 dark:text-dark-300 mb-3">
                  Permanently delete this project and all its data. This action cannot be undone.
                </p>
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="w-full btn-secondary text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  Delete Project
                </button>
              </div>
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

      {activeTab === 'backup' && (
        <BackupTab />
      )}

      {/* Delete Project Modal */}
      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteProject}
        projectName={currentProject?.name || ''}
      />

      {/* Reset Project Modal */}
      <ResetProjectModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={handleResetProject}
        projectName={currentProject?.name || ''}
        loading={isResetting}
      />
    </div>
  );
};

export default ProjectSettingsTab;