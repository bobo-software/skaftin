import React, { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, Eye, EyeOff, Clock, Activity } from 'lucide-react';
import RequestUtils from '../../../../utils/RequsetUtils';
import { useProjectStore } from '../../../../stores/StoresIndex';

interface ApiKey {
  id: number;
  keyName: string;
  keyPrefix: string;
  permissions: any;
  isActive: boolean;
  expiresAt?: string;
  lastUsedAt?: string;
  createdAt: string;
}

interface CreateKeyInput {
  keyName: string;
  projectId: string;
  permissions: any;
  expiresAt?: string;
}

const ApiKeyManagement = () => {
  const { currentProject } = useProjectStore();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKey, setNewKey] = useState<{ plainKey: string; keyName: string } | null>(null);
  const [createInput, setCreateInput] = useState<CreateKeyInput>({
    keyName: '',
    projectId: currentProject?.id || '',
    permissions: {
      database: { read: false, write: false, schema: false },
      storage: { read: false, write: false, delete: false },
      project: { read: false, update: false, delete: false },
      apiKeys: { read: false, create: false, update: false, delete: false },
    },
  });

  useEffect(() => {
    loadApiKeys();
    // Update project ID when current project changes
    if (currentProject?.id) {
      setCreateInput(prev => ({ ...prev, projectId: currentProject.id }));
    }
  }, [currentProject]);

  const loadApiKeys = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('skaftin-token');
      const response = await RequestUtils.get('/api/api-keys', token || '');
      if (response.success) {
        setApiKeys(response.keys);
      }
    } catch (error) {
      console.error('Error loading API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!createInput.keyName || !createInput.projectId) {
      alert('Please enter key name and project ID');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('skaftin-token');
      const response = await RequestUtils.post('/api/api-keys', token || '', createInput);
      
      if (response.success) {
        setNewKey({ plainKey: response.key.plainKey, keyName: response.key.keyName });
        setShowNewKey(true);
        setShowCreateModal(false);
        await loadApiKeys();
      }
    } catch (error) {
      console.error('Error creating API key:', error);
      alert('Failed to create API key');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKey = async (id: number) => {
    if (!confirm('Are you sure you want to revoke this API key?')) return;

    try {
      const token = localStorage.getItem('skaftin-token');
      const response = await RequestUtils.delete(`/api/api-keys/${id}`, token || '', {});
      
      if (response.success) {
        await loadApiKeys();
      }
    } catch (error) {
      console.error('Error deleting API key:', error);
      alert('Failed to revoke API key');
    }
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    alert('API key copied to clipboard!');
  };

  const togglePermission = (category: string, permission: string) => {
    setCreateInput(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [category]: {
          ...prev.permissions[category],
          [permission]: !prev.permissions[category][permission],
        },
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <Key className="w-5 h-5 text-primary-600" />
            API Keys
          </h3>
          <p className="text-sm text-dark-600 dark:text-dark-300 mt-1">
            Manage API keys for programmatic access
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create API Key
        </button>
      </div>

      {/* API Keys List */}
      {loading && apiKeys.length === 0 ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed border-dark-200 dark:border-dark-700 rounded-lg">
          <Key className="w-12 h-12 text-dark-400 mx-auto mb-4" />
          <p className="text-dark-600 dark:text-dark-300 mb-2">No API keys yet</p>
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Create your first API key to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div
              key={key.id}
              className="bg-white dark:bg-dark-800 border border-dark-200 dark:border-dark-700 rounded-lg p-4 flex items-center justify-between hover:shadow-sm transition-shadow"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                    <Key className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h4 className="font-medium text-dark-900 dark:text-white">{key.keyName}</h4>
                    <p className="text-sm text-dark-600 dark:text-dark-300 font-mono">
                      ska_...{key.keyPrefix}
                    </p>
                  </div>
                  {!key.isActive && (
                    <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-2 ml-13">
                  {key.lastUsedAt && (
                    <span className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Last used: {new Date(key.lastUsedAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className="text-xs text-dark-500 dark:text-dark-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Created: {new Date(key.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleDeleteKey(key.id)}
                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                title="Revoke API key"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-4">
                Create New API Key
              </h3>

              {/* Key Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Key Name *
                </label>
                <input
                  type="text"
                  value={createInput.keyName}
                  onChange={(e) => setCreateInput({ ...createInput, keyName: e.target.value })}
                  placeholder="e.g., Production API, Development Key"
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
                />
              </div>

              {/* Project ID */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Project ID *
                </label>
                <input
                  type="text"
                  value={createInput.projectId || currentProject?.id || ''}
                  disabled
                  placeholder="Auto-populated from current project"
                  className="w-full px-3 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-50 dark:bg-dark-900 text-dark-600 dark:text-dark-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-dark-500 dark:text-dark-400">
                  This key will be scoped to the current project: <span className="font-medium">{currentProject?.name}</span>
                </p>
              </div>

              {/* Permissions */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Permissions
                </label>
                <div className="space-y-4">
                  {Object.entries(createInput.permissions).map(([category, perms]: [string, any]) => (
                    <div key={category} className="border border-dark-200 dark:border-dark-700 rounded-lg p-3">
                      <h5 className="font-medium text-dark-900 dark:text-white mb-2 capitalize">
                        {category}
                      </h5>
                      <div className="flex flex-wrap gap-3">
                        {Object.keys(perms).map((perm) => (
                          <label key={perm} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={perms[perm]}
                              onChange={() => togglePermission(category, perm)}
                              className="w-4 h-4 text-primary-600 rounded border-dark-300"
                            />
                            <span className="text-sm text-dark-700 dark:text-dark-300 capitalize">{perm}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button onClick={handleCreateKey} className="btn-primary" disabled={loading}>
                  {loading ? 'Creating...' : 'Create API Key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Show New Key Modal */}
      {showNewKey && newKey && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-lg w-full">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
                API Key Created Successfully!
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                ⚠️ Save this key now. You won't be able to see it again!
              </p>

              <div className="bg-dark-50 dark:bg-dark-900 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-dark-700 dark:text-dark-300">
                    {newKey.keyName}
                  </span>
                  <button
                    onClick={() => handleCopyKey(newKey.plainKey)}
                    className="p-1 text-dark-600 dark:text-dark-400 hover:text-primary-600"
                    title="Copy to clipboard"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <code className="text-sm text-dark-900 dark:text-white break-all">
                  {newKey.plainKey}
                </code>
              </div>

              <button
                onClick={() => {
                  setShowNewKey(false);
                  setNewKey(null);
                }}
                className="btn-primary w-full"
              >
                I've Saved the Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyManagement;
