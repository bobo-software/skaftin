import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Mail, 
  Phone, 
  Shield, 
  Calendar, 
  CheckCircle, 
  XCircle, 
  Edit,
  Trash2,
  User,
  Clock,
  Key
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

  useEffect(() => {
    if (projectId && userId) {
      fetchUserDetails();
      fetchRoles();
      fetchCustomFields();
    }
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
    // Navigate back to users list with edit modal open
    navigate(`/projects/${projectId}/auth/users`, { 
      state: { editUserId: userId } 
    });
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
                    <CheckCircle className="w-4 h-4 text-green-500 ml-2" title="Verified" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 ml-2" title="Not verified" />
                  )}
                </div>
              </div>
              
              {user.phone && (
                <div>
                  <label className="text-sm font-medium text-dark-500 dark:text-dark-400">Phone</label>
                  <div className="flex items-center mt-1">
                    <p className="text-dark-900 dark:text-white">{user.phone}</p>
                    {user.phone_verified && (
                      <CheckCircle className="w-4 h-4 text-green-500 ml-2" title="Verified" />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Account Information */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center">
              <User className="w-5 h-5 mr-2" />
              Account Information
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
      </div>
    </div>
  );
};

export default UserDetailsPage;

