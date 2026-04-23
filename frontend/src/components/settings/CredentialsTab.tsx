import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, Power, PowerOff, X, Shield, RefreshCw, Sparkles, Code } from 'lucide-react';
import CredentialsService, {
  ApiCredential,
  CreateCredentialRequest,
  AvailablePermissions,
} from '../../services/CredentialsService';
import ToastUtils from '../../utils/ToastUtils';
import { ConfirmModal, CursorIntegrationModal } from '../ComponentsIndex';

const CredentialsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [mcpKey, setMcpKey] = useState<ApiCredential | null>(null);
  const [availablePermissions, setAvailablePermissions] = useState<AvailablePermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [mcpKeyLoading, setMcpKeyLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showToken, setShowToken] = useState<{ [key: number]: boolean }>({});
  const [showMcpKey, setShowMcpKey] = useState(false);
  const [copiedToken, setCopiedToken] = useState<number | null>(null);
  const [copiedMcpKey, setCopiedMcpKey] = useState(false);
  const [newCredential, setNewCredential] = useState<ApiCredential | null>(null);
  const [showMcpConfirm, setShowMcpConfirm] = useState(false);
  const [showCursorIntegration, setShowCursorIntegration] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    credential_type: 'api_key' as 'api_key' | 'access_token',
    permissions: [] as string[],
    expires_in_days: undefined as number | undefined,
  });

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [credentialsData, permissionsData, mcpKeyData] = await Promise.all([
        CredentialsService.listCredentials(projectId!),
        CredentialsService.getAvailablePermissions(),
        CredentialsService.getMcpKey(projectId!),
      ]);
      const normalizedMcpKey = Array.isArray(mcpKeyData)
        ? (mcpKeyData[0] ?? null)
        : mcpKeyData;
      // Filter out MCP key from regular credentials
      setCredentials(credentialsData.filter(c => c.credential_type !== 'mcp_key'));
      setMcpKey(normalizedMcpKey);
      setAvailablePermissions(permissionsData);
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.permissions.length === 0) {
      ToastUtils.error('Please select at least one permission');
      return;
    }

    try {
      const data: CreateCredentialRequest = {
        name: formData.name,
        credential_type: formData.credential_type,
        permissions: formData.permissions,
        expires_in_days: formData.expires_in_days,
      };

      const credential = await CredentialsService.createCredential(projectId!, data);
      setNewCredential(credential);
      ToastUtils.success('Credential created successfully!');
      loadData();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to create credential');
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setNewCredential(null);
    setFormData({
      name: '',
      credential_type: 'api_key',
      permissions: [],
      expires_in_days: undefined,
    });
  };

  const handleCopyToken = async (token: string, credentialId: number) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(credentialId);
      ToastUtils.success('Token copied to clipboard!');
      setTimeout(() => setCopiedToken(null), 2000);
    } catch (error) {
      ToastUtils.error('Failed to copy token');
    }
  };

  const handleCopyMcpKey = async (token: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedMcpKey(true);
      ToastUtils.success('MCP key copied to clipboard!');
      setTimeout(() => setCopiedMcpKey(false), 2000);
    } catch (error) {
      ToastUtils.error('Failed to copy MCP key');
    }
  };

  const handleRegenerateMcpKey = async () => {
    try {
      setMcpKeyLoading(true);
      const newMcpKey = await CredentialsService.regenerateMcpKey(projectId!);
      setMcpKey(newMcpKey);
      setShowMcpKey(true);
      setShowMcpConfirm(false);
      ToastUtils.success('MCP key regenerated successfully!');
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to regenerate MCP key');
    } finally {
      setMcpKeyLoading(false);
    }
  };

  const handleToggleActive = async (credential: ApiCredential) => {
    try {
      await CredentialsService.updateCredential(
        projectId!,
        credential.id.toString(),
        { is_active: !credential.is_active }
      );
      ToastUtils.success(`Credential ${!credential.is_active ? 'activated' : 'deactivated'}`);
      loadData();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to toggle credential');
    }
  };

  const handleDelete = async (credentialId: number) => {
    if (!window.confirm('Are you sure you want to revoke this credential? This cannot be undone.')) {
      return;
    }

    try {
      await CredentialsService.deleteCredential(projectId!, credentialId.toString());
      ToastUtils.success('Credential revoked successfully');
      loadData();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to revoke credential');
    }
  };

  const togglePermission = (permission: string) => {
    setFormData((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter((p) => p !== permission)
        : [...prev.permissions, permission],
    }));
  };

  const selectAllInCategory = (category: string[]) => {
    const allSelected = category.every((p) => formData.permissions.includes(p));
    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: prev.permissions.filter((p) => !category.includes(p)),
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: Array.from(new Set([...prev.permissions, ...category])),
      }));
    }
  };

  const selectAllPermissions = () => {
    if (!availablePermissions) return;
    const allPerms = Object.values(availablePermissions).flat();
    const allSelected = allPerms.every((p) => formData.permissions.includes(p));
    if (allSelected) {
      setFormData((prev) => ({
        ...prev,
        permissions: [],
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        permissions: allPerms,
      }));
    }
  };

  const areAllPermissionsSelected = () => {
    if (!availablePermissions) return false;
    const allPerms = Object.values(availablePermissions).flat();
    return allPerms.length > 0 && allPerms.every((p) => formData.permissions.includes(p));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary-600" />
            API Credentials
          </h2>
          <p className="text-dark-600 dark:text-dark-400 mt-1">
            Manage API keys and access tokens for external applications
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Credential
        </button>
      </div>

      {/* MCP Integration Key */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/40 rounded-lg">
              <Sparkles className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                MCP Integration Key
              </h3>
              <p className="text-sm text-dark-600 dark:text-dark-300">
                Connects this project to MCP (Model Context Protocol) tools
              </p>
            </div>
          </div>
        </div>

        {mcpKey ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                MCP Key
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-4 py-3 bg-white dark:bg-dark-900 border border-purple-200 dark:border-purple-700 rounded-lg font-mono text-sm text-dark-900 dark:text-white overflow-x-auto">
                  {showMcpKey
                    ? mcpKey.token
                    : `${mcpKey.token.substring(0, 20)}${'•'.repeat(40)}`}
                </code>
                <button
                  onClick={() => setShowMcpKey(!showMcpKey)}
                  className="p-3 text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:bg-white dark:hover:bg-dark-800 rounded-lg transition-colors"
                  title={showMcpKey ? 'Hide' : 'Show'}
                >
                  {showMcpKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
                <button
                  onClick={() => handleCopyMcpKey(mcpKey.token)}
                  className="p-3 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                  title="Copy MCP key"
                >
                  {copiedMcpKey ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-dark-500 dark:text-dark-400">
              <div className="space-y-1">
                <p>Created {new Date(mcpKey.created_at).toLocaleString()}</p>
                {mcpKey.last_used_at && (
                  <p>Last used {new Date(mcpKey.last_used_at).toLocaleString()}</p>
                )}
              </div>
              <button
                onClick={() => setShowMcpConfirm(true)}
                disabled={mcpKeyLoading}
                className="flex items-center gap-2 px-3 py-2 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${mcpKeyLoading ? 'animate-spin' : ''}`} />
                {mcpKeyLoading ? 'Regenerating...' : 'Regenerate Key'}
              </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-800 dark:text-blue-200 mb-1">
                    <strong>How to use:</strong> Configure your MCP client with this key
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Connect Cursor AI and other MCP-compatible tools
                  </p>
                </div>
                <button
                  onClick={() => setShowCursorIntegration(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Code className="w-4 h-4" />
                  Cursor Setup
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-dark-600 dark:text-dark-300 mb-4">
              No MCP key configured for this project
            </p>
            <button
              onClick={() => setShowMcpConfirm(true)}
              disabled={mcpKeyLoading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              {mcpKeyLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate MCP Key
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Credentials List */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Your Credentials</h3>
        </div>

        {credentials.length === 0 ? (
          <div className="p-8 text-center">
            <Key className="w-12 h-12 text-dark-400 mx-auto mb-3" />
            <p className="text-dark-600 dark:text-dark-400 mb-4">No credentials created yet</p>
            <button
              onClick={() => setShowModal(true)}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Create your first credential
            </button>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {credentials.map((credential) => (
              <div key={credential.id} className="p-4 hover:bg-dark-50 dark:hover:bg-dark-700/50">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-semibold text-dark-900 dark:text-white">
                        {credential.name}
                      </h4>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          credential.credential_type === 'api_key'
                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                        }`}
                      >
                        {credential.credential_type === 'api_key' ? 'API Key' : 'Access Token'}
                      </span>
                      {credential.is_active ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    
                    {/* Token Display */}
                    <div className="flex items-center gap-2 mb-2">
                      <code className="px-3 py-1 bg-dark-100 dark:bg-dark-900 rounded font-mono text-sm text-dark-900 dark:text-white">
                        {showToken[credential.id]
                          ? credential.token
                          : `${credential.token.substring(0, 20)}${'•'.repeat(20)}`}
                      </code>
                      <button
                        onClick={() =>
                          setShowToken((prev) => ({ ...prev, [credential.id]: !prev[credential.id] }))
                        }
                        className="p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                        title={showToken[credential.id] ? 'Hide' : 'Show'}
                      >
                        {showToken[credential.id] ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyToken(credential.token, credential.id)}
                        className="p-1 text-primary-600 hover:text-primary-700"
                        title="Copy token"
                      >
                        {copiedToken === credential.id ? (
                          <Check className="w-4 h-4 text-green-600" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Permissions */}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {credential.permissions.map((permission) => (
                        <span
                          key={permission}
                          className="px-2 py-0.5 text-xs bg-dark-200 dark:bg-dark-700 text-dark-700 dark:text-dark-300 rounded"
                        >
                          {permission}
                        </span>
                      ))}
                    </div>

                    {/* Metadata */}
                    <div className="text-xs text-dark-500 dark:text-dark-400 space-y-1">
                      <p>Created {new Date(credential.created_at).toLocaleString()}</p>
                      {credential.last_used_at && (
                        <p>Last used {new Date(credential.last_used_at).toLocaleString()}</p>
                      )}
                      {credential.expires_at && (
                        <p>Expires {new Date(credential.expires_at).toLocaleString()}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(credential)}
                      className={`p-2 rounded-lg transition-colors ${
                        credential.is_active
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20'
                      }`}
                      title={credential.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {credential.is_active ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleDelete(credential.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Revoke"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showModal && !newCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-white">
                Create API Credential
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Credential Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  placeholder="e.g., Production API Key"
                  required
                />
              </div>

              {/* Credential Type */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Credential Type *
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, credential_type: 'api_key' })}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      formData.credential_type === 'api_key'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700'
                    }`}
                  >
                    <div className="font-semibold text-dark-900 dark:text-white">API Key</div>
                    <div className="text-xs text-dark-600 dark:text-dark-400 mt-1">
                      For server-to-server communication
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, credential_type: 'access_token' })}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      formData.credential_type === 'access_token'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700'
                    }`}
                  >
                    <div className="font-semibold text-dark-900 dark:text-white">Access Token</div>
                    <div className="text-xs text-dark-600 dark:text-dark-400 mt-1">
                      For client applications
                    </div>
                  </button>
                </div>
              </div>

              {/* Permissions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300">
                    Permissions * (Select at least one)
                  </label>
                  <button
                    type="button"
                    onClick={selectAllPermissions}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                      areAllPermissionsSelected()
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 hover:bg-primary-200 dark:hover:bg-primary-900/50'
                        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    {areAllPermissionsSelected() ? 'Deselect All' : 'Select All (Admin)'}
                  </button>
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto p-3 border border-dark-200 dark:border-dark-700 rounded-lg">
                  {availablePermissions && Object.entries(availablePermissions).map(([category, perms]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-dark-900 dark:text-white capitalize">{category}</h4>
                        <button
                          type="button"
                          onClick={() => selectAllInCategory(perms)}
                          className="text-xs text-primary-600 hover:text-primary-700"
                        >
                          {perms.every((p) => formData.permissions.includes(p)) ? 'Deselect All' : 'Select All'}
                        </button>
                      </div>
                      {perms.map((permission) => (
                        <label key={permission} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.permissions.includes(permission)}
                            onChange={() => togglePermission(permission)}
                            className="w-4 h-4 text-primary-600 rounded"
                          />
                          <span className="text-sm text-dark-700 dark:text-dark-300">
                            {permission}
                          </span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Expiration (Optional)
                </label>
                <select
                  value={formData.expires_in_days || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, expires_in_days: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                >
                  <option value="">Never expires</option>
                  <option value="7">7 days</option>
                  <option value="30">30 days</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  ⚠️ Make sure to copy and securely store your credential. It will only be shown once!
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-dark-200 dark:border-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Create Credential
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Modal - Show Token Once */}
      {newCredential && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-white flex items-center gap-2">
                <Check className="w-6 h-6 text-green-600" />
                Credential Created Successfully!
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-300 font-medium mb-2">
                  ⚠️ Important: Copy your credential now!
                </p>
                <p className="text-sm text-green-800 dark:text-green-300">
                  This is the only time you'll see this token. Store it securely.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Your {newCredential.credential_type === 'api_key' ? 'API Key' : 'Access Token'}:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newCredential.token}
                    readOnly
                    className="flex-1 px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-50 dark:bg-dark-900 text-dark-900 dark:text-white font-mono text-sm"
                  />
                  <button
                    onClick={() => handleCopyToken(newCredential.token, newCredential.id)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    {copiedToken === newCredential.id ? (
                      <>
                        <Check className="w-4 h-4 inline mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 inline mr-1" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Permissions:
                </label>
                <div className="flex flex-wrap gap-2">
                  {newCredential.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="px-3 py-1 text-sm bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 rounded-full"
                    >
                      {permission}
                    </span>
                  ))}
                </div>
              </div>

              <button
                onClick={handleCloseModal}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MCP Key Confirmation Modal */}
      <ConfirmModal
        isOpen={showMcpConfirm}
        heading={mcpKey ? 'Regenerate MCP Key' : 'Generate MCP Key'}
        text={
          mcpKey
            ? 'Are you sure you want to regenerate the MCP key? The old key will stop working immediately and any integrations using it will break.'
            : 'This will create a new MCP integration key for this project. You can use it to connect MCP-compatible tools and AI assistants.'
        }
        onCancel={() => setShowMcpConfirm(false)}
        onConfirm={handleRegenerateMcpKey}
        confirmText={mcpKey ? 'Regenerate' : 'Generate'}
        variant={mcpKey ? 'warning' : 'info'}
        loading={mcpKeyLoading}
      />

      {/* Cursor Integration Guide Modal */}
      {mcpKey && (
        <CursorIntegrationModal
          isOpen={showCursorIntegration}
          onClose={() => setShowCursorIntegration(false)}
          mcpKey={mcpKey.token}
          projectId={projectId!}
        />
      )}
    </div>
  );
};

export default CredentialsTab;

