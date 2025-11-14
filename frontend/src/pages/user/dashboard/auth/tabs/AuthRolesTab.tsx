import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Search, RefreshCw, Edit, Trash2, Shield, Users, Clock, AlertCircle } from 'lucide-react';
import RolesService, { Role, CreateRoleRequest } from '../../../../../services/RolesService';
import { AppButton } from '../../../../../components/ComponentsIndex';

const AuthRolesTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const fetchRoles = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const rolesData = await RolesService.listRoles(projectId, true);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching roles:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchRoles();
    }
  }, [projectId, fetchRoles]);

  const handleDeleteRole = async (roleId: number, roleName: string) => {
    if (!projectId || !window.confirm(`Are you sure you want to delete the role "${roleName}"?`)) return;
    
    try {
      await RolesService.deleteRole(projectId, String(roleId));
      fetchRoles();
    } catch (error: any) {
      alert('Error deleting role: ' + error.message);
    }
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setShowEditModal(true);
  };

  const filteredRoles = roles.filter((role) =>
    role.role_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    role.role_key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Role Management</h1>
          <p className="text-dark-600 dark:text-dark-400">
            Create and manage user roles with custom permissions and session durations.
          </p>
        </div>

        {/* Toolbar */}
        <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4 mb-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="text"
                  placeholder="Search roles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-dark-700 dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={fetchRoles}
                className="px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <AppButton
                onClick={() => setShowCreateModal(true)}
                icon={<Plus className="w-5 h-5" />}
              >
                Create Role
              </AppButton>
            </div>
          </div>
        </div>

        {/* Roles Grid */}
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-2 text-dark-600 dark:text-dark-400">Loading roles...</p>
          </div>
        ) : filteredRoles.length === 0 ? (
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-8 text-center">
            <Shield className="w-12 h-12 text-dark-400 mx-auto mb-2" />
            <p className="text-dark-600 dark:text-dark-400">No roles found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRoles.map((role) => (
              <div
                key={role.id}
                className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      role.is_system_role
                        ? 'bg-purple-100 dark:bg-purple-900/30'
                        : 'bg-primary-100 dark:bg-primary-900/30'
                    }`}>
                      <Shield className={`w-5 h-5 ${
                        role.is_system_role
                          ? 'text-purple-600 dark:text-purple-400'
                          : 'text-primary-600 dark:text-primary-400'
                      }`} />
                    </div>
                    <div className="ml-3">
                      <h3 className="font-semibold text-dark-900 dark:text-white">{role.role_name}</h3>
                      <p className="text-sm text-dark-500 dark:text-dark-400">{role.role_key}</p>
                    </div>
                  </div>
                  {role.is_system_role && (
                    <span className="px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                      System
                    </span>
                  )}
                </div>

                {role.description && (
                  <p className="text-sm text-dark-600 dark:text-dark-400 mb-4 line-clamp-2">
                    {role.description}
                  </p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-dark-600 dark:text-dark-400">
                    <Users className="w-4 h-4 mr-2" />
                    <span>{role.user_count || 0} users</span>
                  </div>
                  <div className="flex items-center text-sm text-dark-600 dark:text-dark-400">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>
                      Session: {role.session_duration_minutes < 60 
                        ? `${role.session_duration_minutes} min`
                        : role.session_duration_minutes < 1440
                        ? `${Math.floor(role.session_duration_minutes / 60)} hours`
                        : `${Math.floor(role.session_duration_minutes / 1440)} days`
                      }
                    </span>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t border-dark-200 dark:border-dark-700">
                  <button
                    onClick={() => handleEditRole(role)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                    Edit
                  </button>
                  {!role.is_system_role && (
                    <button
                      onClick={() => handleDeleteRole(role.id, role.role_name)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <CreateRoleModal
          projectId={projectId!}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchRoles();
          }}
        />
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedRole && (
        <EditRoleModal
          projectId={projectId!}
          role={selectedRole}
          onClose={() => {
            setShowEditModal(false);
            setSelectedRole(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedRole(null);
            fetchRoles();
          }}
        />
      )}
    </div>
  );
};

// Create Role Modal
const CreateRoleModal = ({ projectId, onClose, onSuccess }: { projectId: string; onClose: () => void; onSuccess: () => void }) => {
  const [formData, setFormData] = useState<CreateRoleRequest>({
    role_name: '',
    role_key: '',
    description: '',
    permissions: [],
    session_duration_minutes: 10080, // 7 days default
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleKeyChange = (value: string) => {
    // Auto-generate role_key from role_name
    const key = value.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    setFormData({ ...formData, role_key: key });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await RolesService.createRole(projectId, formData);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Create New Role</h2>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm flex items-start">
            <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Role Name *
            </label>
            <input
              type="text"
              required
              value={formData.role_name}
              onChange={(e) => {
                setFormData({ ...formData, role_name: e.target.value });
                if (!formData.role_key) {
                  handleRoleKeyChange(e.target.value);
                }
              }}
              placeholder="e.g., Manager, Support Agent"
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Role Key * <span className="text-xs text-dark-500">(lowercase, alphanumeric + underscore)</span>
            </label>
            <input
              type="text"
              required
              value={formData.role_key}
              onChange={(e) => setFormData({ ...formData, role_key: e.target.value })}
              pattern="[a-z0-9_]+"
              placeholder="e.g., manager, support_agent"
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              placeholder="Describe what this role is for..."
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Session Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_duration_minutes: 60 })}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  formData.session_duration_minutes === 60
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-dark-300 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700'
                }`}
              >
                1 Hour
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_duration_minutes: 1440 })}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  formData.session_duration_minutes === 1440
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-dark-300 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700'
                }`}
              >
                1 Day
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_duration_minutes: 10080 })}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  formData.session_duration_minutes === 10080
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-dark-300 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700'
                }`}
              >
                7 Days
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={formData.session_duration_minutes}
                onChange={(e) => setFormData({ ...formData, session_duration_minutes: parseInt(e.target.value) || 60 })}
                className="flex-1 px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
              />
              <span className="text-sm text-dark-600 dark:text-dark-400">minutes</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
              Permissions (Optional)
            </label>
            <p className="text-xs text-dark-500 dark:text-dark-400 mb-2">
              Define custom permissions as needed. You can update these later.
            </p>
            <div className="bg-dark-50 dark:bg-dark-900/50 rounded-lg p-3 text-sm text-dark-600 dark:text-dark-400">
              Permissions can be managed after creating the role.
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Edit Role Modal
const EditRoleModal = ({ projectId, role, onClose, onSuccess }: { projectId: string; role: Role; onClose: () => void; onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    role_name: role.role_name,
    description: role.description || '',
    session_duration_minutes: role.session_duration_minutes,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await RolesService.updateRole(projectId, String(role.id), formData);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">
          Edit Role: {role.role_name}
        </h2>
        
        {role.is_system_role && (
          <div className="mb-4 p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded text-purple-700 dark:text-purple-300 text-sm">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            This is a system role. Only session duration and permissions can be modified.
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Role Name
            </label>
            <input
              type="text"
              required
              disabled={role.is_system_role}
              value={formData.role_name}
              onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Role Key
            </label>
            <input
              type="text"
              disabled
              value={role.role_key}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-dark-100 dark:bg-dark-900 opacity-50 cursor-not-allowed"
            />
            <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">Role key cannot be changed</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Description
            </label>
            <textarea
              disabled={role.is_system_role}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Session Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_duration_minutes: 60 })}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  formData.session_duration_minutes === 60
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-dark-300 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700'
                }`}
              >
                1 Hour
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_duration_minutes: 1440 })}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  formData.session_duration_minutes === 1440
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-dark-300 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700'
                }`}
              >
                1 Day
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_duration_minutes: 10080 })}
                className={`px-3 py-2 border rounded-lg transition-colors ${
                  formData.session_duration_minutes === 10080
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'border-dark-300 dark:border-dark-600 hover:bg-dark-50 dark:hover:bg-dark-700'
                }`}
              >
                7 Days
              </button>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="1"
                value={formData.session_duration_minutes}
                onChange={(e) => setFormData({ ...formData, session_duration_minutes: parseInt(e.target.value) || 60 })}
                className="flex-1 px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
              />
              <span className="text-sm text-dark-600 dark:text-dark-400">minutes</span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthRolesTab;
