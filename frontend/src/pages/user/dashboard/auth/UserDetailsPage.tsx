import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Shield, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Edit,
  Trash2,
  User,
  Clock,
  Key,
  AlertTriangle,
  Trash,
  Eye,
  EyeOff,
  X,
  Copy
} from 'lucide-react';
import AuthUsersService, { AppUser } from '../../../../services/AuthUsersService';
import RolesService, { Role } from '../../../../services/RolesService';
import CustomFieldsService, { CustomField } from '../../../../services/CustomFieldsService';
import { AppButton } from '../../../../components/ComponentsIndex';
import OTPManagement from '../../../../components/auth/OTPManagement';
import ToastUtils from '../../../../utils/ToastUtils';

const UserDetailsPage = () => {
  const { projectId, userId } = useParams<{ projectId: string; userId: string }>();
  const navigate = useNavigate();
  const [user, setUser] = useState<AppUser | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState<string | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [creatingPassword, setCreatingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [verifyPasswordInput, setVerifyPasswordInput] = useState('');
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [verifyPasswordResult, setVerifyPasswordResult] = useState<'valid' | 'invalid' | 'no_password' | null>(null);
  const [showVerifyPassword, setShowVerifyPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>([]);
  const [editFormData, setEditFormData] = useState({
    name: '',
    last_name: '',
    email: '',
    phone: '',
    custom_field_1: '',
    custom_field_2: '',
    is_active: true,
    metadataJson: '{}',
  });

  useEffect(() => {
    if (projectId && userId) {
      fetchUserDetails();
      fetchRoles();
      fetchCustomFields();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, userId]);

  const fetchUserDetails = async () => {
    if (!projectId || !userId) return;
    
    setLoading(true);
    setError(null);
    try {
      const userData = await AuthUsersService.getUser(projectId, userId);
      setUser(userData);
    } catch (err: any) {
      console.error('Error fetching user details:', err);
      setError(err.message || 'Failed to load user details');
      ToastUtils.error('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const handleViewPassword = async () => {
    if (!projectId || !userId) return;
    
    setLoadingPassword(true);
    setPassword(null);
    setHasPassword(false);
    setPasswordError(null);
    setNewPassword('');
    setConfirmPassword('');
    setIsChangingPassword(false);
    setVerifyPasswordInput('');
    setVerifyPasswordResult(null);
    setShowVerifyPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowPasswordModal(true);
    
    try {
      const passwordStatus = await AuthUsersService.getUserPassword(projectId, userId);
      setHasPassword(!!passwordStatus.has_password);
      setPassword(passwordStatus.password || null);
    } catch (err: any) {
      // If password doesn't exist, that's okay - we'll show the creation form
      if (err.message?.includes('does not have a password set') || err.message?.includes('404')) {
        setHasPassword(false);
        setPassword(null);
      } else {
        console.error('Error fetching password:', err);
        ToastUtils.error(err.message || 'Failed to load password');
        setPasswordError(err.message || 'Failed to load password');
      }
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleCreatePassword = async () => {
    if (!projectId || !userId) return;

    // Validation
    if (!newPassword) {
      setPasswordError('Password is required');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setCreatingPassword(true);
    setPasswordError(null);

    try {
      await AuthUsersService.setUserPassword(projectId, userId, newPassword);
      const successMessage = isChangingPassword ? 'Password changed successfully' : 'Password created successfully';
      ToastUtils.success(successMessage);
      setPassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setIsChangingPassword(false);
    } catch (err: any) {
      console.error('Error setting password:', err);
      setPasswordError(err.message || 'Failed to set password');
      ToastUtils.error(err.message || 'Failed to set password');
    } finally {
      setCreatingPassword(false);
    }
  };

  const handleStartChangePassword = () => {
    setIsChangingPassword(true);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const handleCancelChangePassword = () => {
    setIsChangingPassword(false);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  };

  const handleCopyPassword = () => {
    if (password) {
      navigator.clipboard.writeText(password);
      ToastUtils.success('Password copied to clipboard');
    }
  };

  const handleVerifyPassword = async () => {
    if (!projectId || !userId || !verifyPasswordInput.trim()) return;

    setVerifyingPassword(true);
    setVerifyPasswordResult(null);
    try {
      const result = await AuthUsersService.verifyUserPassword(projectId, userId, verifyPasswordInput);
      if (!result.has_password) {
        setVerifyPasswordResult('no_password');
      } else if (result.valid) {
        setVerifyPasswordResult('valid');
      } else {
        setVerifyPasswordResult('invalid');
      }
    } catch (err: any) {
      ToastUtils.error(err.message || 'Failed to verify password');
    } finally {
      setVerifyingPassword(false);
    }
  };

  const fetchRoles = async () => {
    if (!projectId) return;
    
    try {
      const rolesData = await RolesService.listRoles(projectId, true);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchCustomFields = async () => {
    if (!projectId) return;
    
    try {
      const fieldsData = await CustomFieldsService.listCustomFields(projectId, false);
      setCustomFields(fieldsData);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  };

  const handleBack = () => {
    navigate(`/projects/${projectId}/auth/users`);
  };

  const handleEdit = () => {
    if (!user) return;
    setEditError(null);
    setEditFormData({
      name: user.name || '',
      last_name: user.last_name || '',
      email: user.email || '',
      phone: user.phone || '',
      custom_field_1: user.custom_field_1 || '',
      custom_field_2: user.custom_field_2 || '',
      is_active: user.is_active,
      metadataJson: JSON.stringify(user.metadata || {}, null, 2),
    });
    setSelectedRoleIds((user.roles || []).map(role => role.id));
    setShowEditModal(true);
  };

  const handleRoleToggle = (roleId: number) => {
    setSelectedRoleIds(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      }
      return [...prev, roleId];
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !userId || !user) return;

    setEditSaving(true);
    setEditError(null);
    try {
      let parsedMetadata: any = {};
      const trimmedMetadata = editFormData.metadataJson.trim();
      if (trimmedMetadata) {
        parsedMetadata = JSON.parse(trimmedMetadata);
      }

      const updatedUser = await AuthUsersService.updateUser(projectId, userId, {
        name: editFormData.name,
        last_name: editFormData.last_name || undefined,
        email: editFormData.email || undefined,
        phone: editFormData.phone || undefined,
        custom_field_1: editFormData.custom_field_1 || undefined,
        custom_field_2: editFormData.custom_field_2 || undefined,
        is_active: editFormData.is_active,
        metadata: parsedMetadata,
      });

      // Sync role assignments from this details page as well.
      const currentRoleIds = (user.roles || []).map(role => role.id);
      const rolesToAdd = selectedRoleIds.filter(id => !currentRoleIds.includes(id));
      const rolesToRemove = currentRoleIds.filter(id => !selectedRoleIds.includes(id));

      for (const roleId of rolesToAdd) {
        await AuthUsersService.assignRole(projectId, userId, roleId);
      }
      for (const roleId of rolesToRemove) {
        await AuthUsersService.removeRole(projectId, userId, String(roleId));
      }

      setUser(updatedUser);
      await fetchUserDetails();
      setShowEditModal(false);
      ToastUtils.success('User updated successfully');
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!projectId || !userId || !user) return;
    
    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${user.name} (${user.email})? This will also delete the user from SuperTokens and cannot be undone.`
    );
    
    if (!confirmed) return;
    
    try {
      await AuthUsersService.deleteUser(projectId, userId, true);
      ToastUtils.success('User deleted successfully');
      handleBack();
    } catch (err: any) {
      console.error('Error deleting user:', err);
      ToastUtils.error(err.message || 'Failed to delete user');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="p-6">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={handleBack}
            className="flex items-center text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </button>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-200">
              {error || 'User not found'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={handleBack}
            className="flex items-center text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </button>
          
          <div className="flex items-start justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold text-2xl mr-4">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-dark-900 dark:text-white">
                  {user.name}
                </h1>
                <p className="text-dark-600 dark:text-dark-400 mt-1">
                  {user.email}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <AppButton
                variant="secondary"
                icon={<Edit className="w-4 h-4" />}
                onClick={handleEdit}
              >
                Edit
              </AppButton>
              <AppButton
                variant="danger"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={handleDelete}
              >
                Delete
              </AppButton>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="mb-6">
          {user.is_active ? (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
              <CheckCircle className="w-4 h-4 mr-2" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
              <XCircle className="w-4 h-4 mr-2" />
              Inactive
            </span>
          )}
        </div>

        {/* Deletion Warning Banner */}
        {user.deletion_scheduled_at && !user.deleted_at && (
          <div className="mb-6 bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-r-lg">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-1">
                  Account Scheduled for Deletion
                </h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                  This user has requested account deletion. The account will be permanently deactivated on{' '}
                  <strong>{new Date(user.deletion_scheduled_at).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</strong>
                  {user.deletion_requested_at && (
                    <> (requested {new Date(user.deletion_requested_at).toLocaleDateString()})</>
                  )}.
                </p>
                {user.deletion_reason && (
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-2">
                    <strong>Reason:</strong> {user.deletion_reason}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-3">
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200">
                    <Clock className="w-3 h-3 mr-1" />
                    {Math.ceil((new Date(user.deletion_scheduled_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                  </span>
                  <span className="text-xs text-orange-600 dark:text-orange-400">
                    User can cancel deletion before scheduled date
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {user.deleted_at && (
          <div className="mb-6 bg-gray-50 dark:bg-gray-900/20 border-l-4 border-gray-500 p-4 rounded-r-lg">
            <div className="flex items-start">
              <Trash className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-3 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
                  Account Deleted
                </h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  This account was deleted on{' '}
                  <strong>{new Date(user.deleted_at).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}</strong>. The account is deactivated but data is retained for compliance.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Contact Information */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center">
              <Mail className="w-5 h-5 mr-2" />
              Contact Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-dark-500 dark:text-dark-400">Email</label>
                <div className="flex items-center mt-1">
                  <p className="text-dark-900 dark:text-white">{user.email}</p>
                  {user.email_verified ? (
                    <span title="Verified">
                      <CheckCircle className="w-4 h-4 text-green-500 ml-2" />
                    </span>
                  ) : (
                    <span title="Not verified">
                      <XCircle className="w-4 h-4 text-red-500 ml-2" />
                    </span>
                  )}
                </div>
              </div>
              
              {user.phone && (
                <div>
                  <label className="text-sm font-medium text-dark-500 dark:text-dark-400">Phone</label>
                  <div className="flex items-center mt-1">
                    <p className="text-dark-900 dark:text-white">{user.phone}</p>
                    {user.phone_verified && (
                      <span title="Verified">
                        <CheckCircle className="w-4 h-4 text-green-500 ml-2" />
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center justify-between">
              <div className="flex items-center">
              <User className="w-5 h-5 mr-2" />
              Account Information
              </div>
              <button
                onClick={handleViewPassword}
                className="p-1.5 rounded-md hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 transition-colors"
                title="View Password (Admin)"
              >
                <Key className="w-4 h-4" />
              </button>
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-dark-500 dark:text-dark-400">User ID</label>
                <p className="text-dark-900 dark:text-white mt-1 font-mono text-sm">{user.id}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-dark-500 dark:text-dark-400">Created At</label>
                <div className="flex items-center mt-1">
                  <Calendar className="w-4 h-4 mr-2 text-dark-400" />
                  <p className="text-dark-900 dark:text-white">
                    {new Date(user.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              
              {user.updated_at && (
                <div>
                  <label className="text-sm font-medium text-dark-500 dark:text-dark-400">Last Updated</label>
                  <div className="flex items-center mt-1">
                    <Clock className="w-4 h-4 mr-2 text-dark-400" />
                    <p className="text-dark-900 dark:text-white">
                      {new Date(user.updated_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Roles */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Roles
            </h2>
            
            {user.roles && user.roles.length > 0 ? (
              <div className="space-y-3">
                {user.roles.map((role) => {
                  const fullRole = roles.find(r => r.id === role.id);
                  return (
                    <div 
                      key={role.id}
                      className="flex items-start justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg"
                    >
                      <div>
                        <div className="flex items-center">
                          <Shield className="w-4 h-4 mr-2 text-primary-600 dark:text-primary-400" />
                          <span className="font-medium text-dark-900 dark:text-white">
                            {role.role_name}
                          </span>
                        </div>
                        {fullRole?.description && (
                          <p className="text-sm text-dark-600 dark:text-dark-400 mt-1 ml-6">
                            {fullRole.description}
                          </p>
                        )}
                        {fullRole?.session_duration_minutes && (
                          <div className="flex items-center text-xs text-dark-500 dark:text-dark-400 mt-1 ml-6">
                            <Key className="w-3 h-3 mr-1" />
                            Session: {fullRole.session_duration_minutes} minutes
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-dark-500 dark:text-dark-400">No roles assigned</p>
            )}
          </div>

          {/* OTP Verification Status */}
          <div className="lg:col-span-2">
            <OTPManagement projectId={projectId!} userId={userId!} />
          </div>

          {/* Custom Fields */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Custom Fields
            </h2>
            
            <div className="space-y-4">
              {/* Legacy Custom Field 1 */}
              <div>
                <label className="text-sm font-medium text-dark-500 dark:text-dark-400">
                  Custom Field 1
                </label>
                <p className="text-dark-900 dark:text-white mt-1">
                  {user.custom_field_1 || <span className="text-dark-400 italic">Not set</span>}
                </p>
              </div>
              
              {/* Legacy Custom Field 2 */}
              <div>
                <label className="text-sm font-medium text-dark-500 dark:text-dark-400">
                  Custom Field 2
                </label>
                <p className="text-dark-900 dark:text-white mt-1">
                  {user.custom_field_2 || <span className="text-dark-400 italic">Not set</span>}
                </p>
              </div>
              
              {/* Dynamic Custom Fields from metadata */}
              {customFields.length > 0 && (
                <>
                  <div className="border-t border-dark-200 dark:border-dark-700 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-dark-700 dark:text-dark-300 mb-3">
                      Additional Custom Fields
                    </h3>
                  </div>
                  {customFields.map((field) => {
                    const value = user.metadata?.[field.field_name];
                    
                    return (
                      <div key={field.id}>
                        <label className="text-sm font-medium text-dark-500 dark:text-dark-400">
                          {field.field_label}
                          {field.is_required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-dark-900 dark:text-white">
                            {value ? (
                              typeof value === 'object' ? (
                                <span className="font-mono text-sm">{JSON.stringify(value, null, 2)}</span>
                              ) : (
                                String(value)
                              )
                            ) : (
                              <span className="text-dark-400 italic">Not set</span>
                            )}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-400">
                            {field.field_type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              
              {customFields.length === 0 && !user.custom_field_1 && !user.custom_field_2 && (
                <p className="text-dark-500 dark:text-dark-400 text-sm italic">
                  No custom fields configured for this project
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Additional Metadata */}
        {user.metadata && Object.keys(user.metadata).length > 0 && (
          <div className="mt-6 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
              Additional Metadata
            </h2>
            <pre className="bg-dark-50 dark:bg-dark-900 p-4 rounded text-sm overflow-x-auto">
              <code className="text-dark-900 dark:text-white">
                {JSON.stringify(user.metadata, null, 2)}
              </code>
            </pre>
          </div>
        )}

        {/* Password Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
            <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6 max-w-2xl w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center">
                  <Edit className="w-5 h-5 mr-2" />
                  Edit User
                </h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-md hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {editError && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <p className="text-sm text-red-600 dark:text-red-400">{editError}</p>
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Name</label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Last Name</label>
                    <input
                      type="text"
                      value={editFormData.last_name}
                      onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={editFormData.email}
                      onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Phone</label>
                    <input
                      type="text"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Custom Field 1</label>
                    <input
                      type="text"
                      value={editFormData.custom_field_1}
                      onChange={(e) => setEditFormData({ ...editFormData, custom_field_1: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Custom Field 2</label>
                    <input
                      type="text"
                      value={editFormData.custom_field_2}
                      onChange={(e) => setEditFormData({ ...editFormData, custom_field_2: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editFormData.is_active}
                      onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Active</span>
                  </label>
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                    Metadata (JSON)
                  </label>
                  <textarea
                    rows={8}
                    value={editFormData.metadataJson}
                    onChange={(e) => setEditFormData({ ...editFormData, metadataJson: e.target.value })}
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Roles
                  </label>
                  {roles.length > 0 ? (
                    <div className="space-y-2 border border-dark-200 dark:border-dark-700 rounded-lg p-3 max-h-48 overflow-y-auto">
                      {roles.map((role) => (
                        <label
                          key={role.id}
                          className="flex items-center space-x-2 cursor-pointer hover:bg-dark-50 dark:hover:bg-dark-700/50 p-2 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={selectedRoleIds.includes(role.id)}
                            onChange={() => handleRoleToggle(role.id)}
                            className="w-4 h-4 text-primary-600 border-dark-300 rounded focus:ring-primary-500"
                          />
                          <div className="flex items-center space-x-2 flex-1">
                            <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            <span className="text-sm text-dark-700 dark:text-dark-300">
                              {role.role_name}
                            </span>
                            {role.description && (
                              <span className="text-xs text-dark-500 dark:text-dark-400">
                                - {role.description}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-dark-500 dark:text-dark-400">
                      No roles available. Create roles in the Roles tab first.
                    </p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <AppButton
                    type="button"
                    variant="secondary"
                    onClick={() => setShowEditModal(false)}
                    disabled={editSaving}
                    className="flex-1"
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    type="submit"
                    disabled={editSaving}
                    className="flex-1"
                  >
                    {editSaving ? 'Saving...' : 'Save Changes'}
                  </AppButton>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowPasswordModal(false)}>
            <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center">
                  <Key className="w-5 h-5 mr-2" />
                  User Password
                </h3>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="p-1 rounded-md hover:bg-dark-100 dark:hover:bg-dark-700 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              {loadingPassword ? (
                <div className="py-8 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-dark-600 dark:border-dark-400"></div>
                  <p className="mt-4 text-dark-500 dark:text-dark-400">Loading password...</p>
                </div>
              ) : hasPassword && !isChangingPassword ? (
                <div>
                  <div className="bg-dark-50 dark:bg-dark-900 rounded-md p-4 mb-4">
                    {password ? (
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-mono text-dark-900 dark:text-white break-all">{password}</code>
                        <button
                          onClick={handleCopyPassword}
                          className="ml-2 p-2 rounded-md hover:bg-dark-200 dark:hover:bg-dark-700 text-dark-500 hover:text-dark-700 dark:text-dark-400 dark:hover:text-dark-300 transition-colors flex-shrink-0"
                          title="Copy password"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-dark-700 dark:text-dark-300">
                        Password is set for this user (hash is stored securely and cannot be viewed).
                      </p>
                    )}
                  </div>
                  <div className="flex items-center text-xs text-dark-500 dark:text-dark-400 mb-4">
                    <AlertTriangle className="w-4 h-4 mr-1" />
                    <span>This is a sensitive operation. Keep this information secure.</span>
                  </div>
                  <div className="flex gap-2">
                    <AppButton
                      onClick={handleStartChangePassword}
                      variant="secondary"
                      className="flex-1"
                    >
                      Change Password
                    </AppButton>
                    <AppButton
                      onClick={() => setShowPasswordModal(false)}
                      className="flex-1"
                    >
                      Close
                    </AppButton>
                  </div>

                  <div className="mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                      Verify Password
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showVerifyPassword ? 'text' : 'password'}
                          value={verifyPasswordInput}
                          onChange={(e) => {
                            setVerifyPasswordInput(e.target.value);
                            setVerifyPasswordResult(null);
                          }}
                          placeholder="Enter password to verify"
                          className="w-full px-3 py-2 pr-10 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                          title={showVerifyPassword ? 'Hide password' : 'Show password'}
                        >
                          {showVerifyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <AppButton
                        onClick={handleVerifyPassword}
                        disabled={verifyingPassword || !verifyPasswordInput.trim()}
                        variant="secondary"
                      >
                        {verifyingPassword ? 'Checking...' : 'Check'}
                      </AppButton>
                    </div>
                    {verifyPasswordResult === 'valid' && (
                      <p className="mt-2 text-sm text-green-600 dark:text-green-400">Password is correct.</p>
                    )}
                    {verifyPasswordResult === 'invalid' && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">Password is incorrect.</p>
                    )}
                    {verifyPasswordResult === 'no_password' && (
                      <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">User does not have a password set.</p>
                    )}
                  </div>
                </div>
              ) : hasPassword && isChangingPassword ? (
                <div>
                  <p className="text-dark-500 dark:text-dark-400 mb-4">Enter a new password for this user:</p>
                  
                  {passwordError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          className="w-full px-3 py-2 pr-10 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter new password (min 8 characters)"
                          disabled={creatingPassword}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                          title={showNewPassword ? 'Hide password' : 'Show password'}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          className="w-full px-3 py-2 pr-10 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Confirm new password"
                          disabled={creatingPassword}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !creatingPassword) {
                              handleCreatePassword();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                          title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <AppButton
                        onClick={handleCreatePassword}
                        disabled={creatingPassword || !newPassword || !confirmPassword}
                        className="flex-1"
                      >
                        {creatingPassword ? 'Changing...' : 'Change Password'}
                      </AppButton>
                      <AppButton
                        onClick={handleCancelChangePassword}
                        variant="secondary"
                        disabled={creatingPassword}
                      >
                        Cancel
                      </AppButton>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-dark-500 dark:text-dark-400 mb-4">No password set for this user. Create one below:</p>
                  
                  {passwordError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                      <p className="text-sm text-red-600 dark:text-red-400">{passwordError}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => {
                            setNewPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          className="w-full px-3 py-2 pr-10 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter new password (min 8 characters)"
                          disabled={creatingPassword}
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                          title={showNewPassword ? 'Hide password' : 'Show password'}
                        >
                          {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Confirm Password
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => {
                            setConfirmPassword(e.target.value);
                            setPasswordError(null);
                          }}
                          className="w-full px-3 py-2 pr-10 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Confirm new password"
                          disabled={creatingPassword}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !creatingPassword) {
                              handleCreatePassword();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                          title={showConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <AppButton
                        onClick={handleCreatePassword}
                        disabled={creatingPassword || !newPassword || !confirmPassword}
                        className="flex-1"
                      >
                        {creatingPassword ? 'Creating...' : 'Create Password'}
                      </AppButton>
                      <AppButton
                        onClick={() => setShowPasswordModal(false)}
                        variant="secondary"
                        disabled={creatingPassword}
                      >
                        Cancel
                      </AppButton>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-dark-200 dark:border-dark-700">
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                      Verify Password
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          type={showVerifyPassword ? 'text' : 'password'}
                          value={verifyPasswordInput}
                          onChange={(e) => {
                            setVerifyPasswordInput(e.target.value);
                            setVerifyPasswordResult(null);
                          }}
                          placeholder="Enter password to verify"
                          className="w-full px-3 py-2 pr-10 border border-dark-300 dark:border-dark-600 rounded-md bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowVerifyPassword(!showVerifyPassword)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                          title={showVerifyPassword ? 'Hide password' : 'Show password'}
                        >
                          {showVerifyPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      <AppButton
                        onClick={handleVerifyPassword}
                        disabled={verifyingPassword || !verifyPasswordInput.trim()}
                        variant="secondary"
                      >
                        {verifyingPassword ? 'Checking...' : 'Check'}
                      </AppButton>
                    </div>
                    {verifyPasswordResult === 'valid' && (
                      <p className="mt-2 text-sm text-green-600 dark:text-green-400">Password is correct.</p>
                    )}
                    {verifyPasswordResult === 'invalid' && (
                      <p className="mt-2 text-sm text-red-600 dark:text-red-400">Password is incorrect.</p>
                    )}
                    {verifyPasswordResult === 'no_password' && (
                      <p className="mt-2 text-sm text-orange-600 dark:text-orange-400">User does not have a password set.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserDetailsPage;

