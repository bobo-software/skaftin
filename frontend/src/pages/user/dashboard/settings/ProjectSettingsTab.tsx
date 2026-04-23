import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import { useNavigate } from 'react-router-dom';
import { DeleteProjectModal, ResetProjectModal } from '../../../../components/ComponentsIndex';
import { Settings, Users, Shield, Database, Loader2, Key } from 'lucide-react';
import TeamTab from '../../../../components/settings/TeamTab';
import CredentialsTab from '../../../../components/settings/CredentialsTab';
import BackupTab from '../../../../components/settings/BackupTab';
import ToastUtils from '../../../../utils/ToastUtils';

type SettingsTabType = 'general' | 'team' | 'credentials' | 'backup';

const TABS: { id: SettingsTabType; label: string; icon: React.ReactNode }[] = [
  { id: 'general',     label: 'General',         icon: <Settings className="w-3.5 h-3.5" /> },
  { id: 'team',        label: 'Team',             icon: <Users className="w-3.5 h-3.5" /> },
  { id: 'credentials', label: 'API Credentials',  icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'backup',      label: 'Backups',           icon: <Database className="w-3.5 h-3.5" /> },
];

const FieldRow = ({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) => (
  <div className="grid grid-cols-[140px_1fr] items-start gap-3 py-2.5 border-b border-dark-100 dark:border-dark-700/60 last:border-0">
    <div className="pt-1.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-dark-500 dark:text-dark-400 font-mono">
        {label}
      </span>
      {hint && (
        <p className="text-[10px] text-dark-400 dark:text-dark-500 mt-0.5 leading-relaxed">{hint}</p>
      )}
    </div>
    <div>{children}</div>
  </div>
);

const compactInput =
  'w-full px-2.5 py-1.5 text-sm border border-dark-200 dark:border-dark-600 rounded-md bg-white dark:bg-dark-800 text-dark-900 dark:text-white focus:ring-1 focus:ring-primary-500 focus:border-primary-500 outline-none transition-colors disabled:bg-dark-50 dark:disabled:bg-dark-900 disabled:text-dark-400 dark:disabled:text-dark-500';

const ProjectSettingsTab = () => {
  const { currentProject, updateProject, deleteProject, resetProject } = useProjectStore();
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
      if (success) navigate('/projects');
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleSaveChanges = async () => {
    if (!currentProject) return;
    if (!projectName.trim()) { ToastUtils.error('Project name cannot be empty'); return; }
    setIsSaving(true);
    try {
      const result = await updateProject(currentProject.id, {
        name: projectName.trim(),
        description: projectDescription.trim() || undefined,
      });
      if (result) ToastUtils.success('Project updated successfully!');
      else ToastUtils.error('Failed to update project');
    } catch {
      ToastUtils.error('Error updating project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEncryptionKey = async () => {
    if (!currentProject) return;
    if (!fieldEncryptionKeyInput.trim()) { ToastUtils.error('Enter a key to set'); return; }
    setIsSavingEncryptionKey(true);
    try {
      const result = await updateProject(currentProject.id, { field_encryption_key: fieldEncryptionKeyInput } as any);
      if (result) { setFieldEncryptionKeyInput(''); ToastUtils.success('Field encryption key saved.'); }
      else ToastUtils.error('Failed to save encryption key');
    } catch {
      ToastUtils.error('Failed to save encryption key');
    } finally {
      setIsSavingEncryptionKey(false);
    }
  };

  const handleClearEncryptionKey = async () => {
    if (!currentProject) return;
    setIsSavingEncryptionKey(true);
    try {
      const result = await updateProject(currentProject.id, { field_encryption_key: null } as any);
      if (result) { setFieldEncryptionKeyInput(''); ToastUtils.success('Field encryption key cleared.'); }
      else ToastUtils.error('Failed to clear encryption key');
    } catch {
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
        if (errorCount === 0)
          ToastUtils.success(`Reset done. Dropped ${droppedTables} tables, deleted ${deletedFiles} files.`);
        else
          ToastUtils.warning(`Reset with ${errorCount} errors. Dropped ${droppedTables} tables, deleted ${deletedFiles} files.`);
        setIsResetModalOpen(false);
      } else {
        ToastUtils.error('Failed to reset project.');
      }
    } catch {
      ToastUtils.error('Error resetting project.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Heading */}
      <h2 className="text-base font-semibold text-dark-900 dark:text-white tracking-tight">Settings</h2>

      {/* Tabs */}
      <nav className="flex items-center gap-0.5 bg-dark-100 dark:bg-dark-800 rounded-lg p-0.5 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* General tab */}
      {activeTab === 'general' && (
        <div className="flex flex-col gap-4">

          {/* Project settings */}
          <div className="rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-dark-100 dark:border-dark-700 flex items-center justify-between">
              <span className="text-xs font-semibold text-dark-700 dark:text-dark-200 uppercase tracking-wider">Project</span>
              <button
                onClick={handleSaveChanges}
                disabled={isSaving || !projectName.trim()}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>

            <div className="px-4">
              <FieldRow label="Name">
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className={compactInput}
                  placeholder="Project name"
                  disabled={isSaving}
                />
              </FieldRow>

              <FieldRow label="Description">
                <textarea
                  rows={2}
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                  className={`${compactInput} resize-none`}
                  placeholder="Short description"
                  disabled={isSaving}
                />
              </FieldRow>

              <FieldRow label="DB Schema" hint="PostgreSQL schema name">
                <input
                  type="text"
                  value={currentProject?.schema_name || ''}
                  className={compactInput}
                  disabled
                  readOnly
                />
              </FieldRow>

              <FieldRow label="Storage" hint="Manage buckets in the Storage tab">
                <input
                  type="text"
                  value="Multiple buckets supported"
                  className={compactInput}
                  disabled
                  readOnly
                />
              </FieldRow>
            </div>

            {/* Encryption section */}
            <div className="border-t border-dark-100 dark:border-dark-700 mt-1">
              <div className="px-4 py-2.5 bg-dark-50 dark:bg-dark-900/40 flex items-center gap-2">
                <Key className="w-3.5 h-3.5 text-dark-500 dark:text-dark-400" />
                <span className="text-xs font-semibold text-dark-700 dark:text-dark-200 uppercase tracking-wider">Field Encryption</span>
                {currentProject?.field_encryption_key_set && (
                  <span className="ml-auto text-[10px] font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-1.5 py-0.5 rounded">
                    KEY SET
                  </span>
                )}
              </div>
              <div className="px-4 py-3">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={fieldEncryptionKeyInput}
                    onChange={(e) => setFieldEncryptionKeyInput(e.target.value)}
                    className={`${compactInput} flex-1`}
                    placeholder={currentProject?.field_encryption_key_set ? 'Enter new key to replace…' : 'Enter encryption key…'}
                    disabled={isSavingEncryptionKey}
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    onClick={handleSaveEncryptionKey}
                    disabled={isSavingEncryptionKey || !fieldEncryptionKeyInput.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                  >
                    {isSavingEncryptionKey && <Loader2 className="w-3 h-3 animate-spin" />}
                    Set key
                  </button>
                  {currentProject?.field_encryption_key_set && (
                    <button
                      type="button"
                      onClick={handleClearEncryptionKey}
                      disabled={isSavingEncryptionKey}
                      className="px-3 py-1.5 text-xs font-medium rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-dark-400 dark:text-dark-500 mt-1.5 leading-relaxed">
                  Used for encrypt/decrypt in DB payloads.{' '}
                  Generate: <code className="font-mono bg-dark-100 dark:bg-dark-700 px-1 rounded">openssl rand -base64 32</code>
                </p>
              </div>
            </div>
          </div>

          {/* Danger zone */}
          <div className="rounded-lg border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-800 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-dark-100 dark:border-dark-700">
              <span className="text-xs font-semibold text-dark-700 dark:text-dark-200 uppercase tracking-wider">Danger Zone</span>
            </div>

            <div className="divide-y divide-dark-100 dark:divide-dark-700">
              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-dark-800 dark:text-dark-100">Reset project</p>
                    <p className="text-[10px] text-dark-500 dark:text-dark-400 mt-0.5 leading-relaxed">
                      Clear all tables & storage. Structure stays intact.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsResetModalOpen(true)}
                    disabled={isResetting}
                    className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-md border border-orange-200 dark:border-orange-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                  >
                    {isResetting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                    {isResetting ? 'Resetting…' : 'Reset'}
                  </button>
                </div>
              </div>

              <div className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-dark-800 dark:text-dark-100">Delete project</p>
                    <p className="text-[10px] text-dark-500 dark:text-dark-400 mt-0.5 leading-relaxed">
                      Moved to deleted. Permanently removed in 2 days.
                    </p>
                  </div>
                  <button
                    onClick={() => setIsDeleteModalOpen(true)}
                    className="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-md border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'team' && <TeamTab />}
      {activeTab === 'credentials' && <CredentialsTab />}
      {activeTab === 'backup' && <BackupTab />}

      <DeleteProjectModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDeleteProject}
        projectName={currentProject?.name || ''}
      />
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
