import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Plus, Search, RefreshCw, Edit, Trash2, UserPlus, Shield, Mail, Phone, CheckCircle, XCircle, Eye, EyeOff, RotateCw, Copy, Clock, AlertCircle, Trash, Download, Upload } from 'lucide-react';
import AuthUsersService, { AppUser, CreateUserRequest } from '../../../../../services/AuthUsersService';
import RolesService, { Role } from '../../../../../services/RolesService';
import CustomFieldsService, { CustomField } from '../../../../../services/CustomFieldsService';
import ToastUtils from '../../../../../utils/ToastUtils';
import { AppButton, UserImportModal } from '../../../../../components/ComponentsIndex';
import AppLabledAutocomplete from '../../../../../components/forms/AppLabledAutocomplete';
import DeleteConfirmModal from '../../../../../components/modals/DeleteConfirmModal';

const AuthUsersTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState<boolean | undefined>(undefined);
  const [filterDeletion, setFilterDeletion] = useState<'all' | 'scheduled' | 'none'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [userToDelete, setUserToDelete] = useState<AppUser | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  const isSearching = searchTerm.trim().length > 0;

  const fetchUsers = useCallback(async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const response = await AuthUsersService.listUsers(projectId, {
        // Search is handled client-side so custom field values in metadata are included.
        search: undefined,
        role_id: filterRole || undefined,
        is_active: filterActive,
        page: isSearching ? 1 : currentPage,
        limit: isSearching ? 1000 : pageSize,
      });
      setUsers(response.users);
      setTotalPages(isSearching ? 1 : response.pagination.totalPages);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, filterRole, filterActive, currentPage, isSearching]);

  const fetchRoles = useCallback(async () => {
    if (!projectId) return;

    try {
      const rolesData = await RolesService.listRoles(projectId, true);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  }, [projectId]);

  const fetchCustomFields = useCallback(async () => {
    if (!projectId) return;

    try {
      const fieldsData = await CustomFieldsService.listCustomFields(projectId, false);
      setCustomFields(fieldsData);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchUsers();
      fetchRoles();
      fetchCustomFields();
    }
  }, [projectId, fetchUsers, fetchRoles, fetchCustomFields]);


  const confirmDelete = async () => {
    if (!projectId || !userToDelete) return;

    setDeleteLoading(true);
    try {
      // Permanently delete user (true = permanent deletion)
      await AuthUsersService.deleteUser(projectId, String(userToDelete.id), true);
      setShowDeleteModal(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      alert('Error deleting user: ' + (error.message || 'Unknown error'));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleViewUser = (user: AppUser) => {
    navigate(`/projects/${projectId}/auth/users/${user.id}`);
  };

  const handleEditUser = (user: AppUser, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent row click
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDeleteUser = (user: AppUser, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent row click
    setUserToDelete(user);
    setShowDeleteModal(true);
  };

  const handleExportUsers = async () => {
    if (!projectId) return;

    setExportLoading(true);
    try {
      await AuthUsersService.exportUsers(projectId);
      ToastUtils.success('Users exported successfully!');
    } catch (error: any) {
      console.error('Error exporting users:', error);
      ToastUtils.error(error.message || 'Failed to export users');
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportUsers = async (sqlContent: string, clearExisting: boolean) => {
    if (!projectId) return;

    setImportLoading(true);
    try {
      const result = await AuthUsersService.importUsers(projectId, sqlContent, clearExisting);

      if (result.success && result.result) {
        const { successCount, errorCount, errors } = result.result;

        if (errorCount === 0) {
          ToastUtils.success(`Successfully imported ${successCount} SQL statements!`);
        } else {
          const message = `Imported ${successCount} statements with ${errorCount} errors.`;
          ToastUtils.warning(message);

          // Log errors to console for debugging
          if (errors && errors.length > 0) {
            console.error('Import errors:', errors);
          }
        }

        setShowImportModal(false);
        await fetchUsers();
      } else {
        ToastUtils.error('Failed to import users. Please check the SQL content and console for errors.');
      }
    } catch (error: any) {
      console.error('Error importing users:', error);
      ToastUtils.error(error.message || 'Failed to import users.');
    } finally {
      setImportLoading(false);
    }
  };

  // Helper function to render OTP status indicator
  const renderOTPStatus = (user: AppUser) => {
    // Show verification status based on user's active and verified status
    if (user.is_active && (user.email_verified || user.phone_verified)) {
      return (
        <span className="inline-flex items-center text-green-600 dark:text-green-400" title="Verified">
          <CheckCircle className="w-4 h-4" />
        </span>
      );
    } else if (!user.is_active) {
      return (
        <span className="inline-flex items-center text-yellow-600 dark:text-yellow-400" title="OTP Pending">
          <Clock className="w-4 h-4" />
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center text-red-600 dark:text-red-400" title="Not Verified">
          <AlertCircle className="w-4 h-4" />
        </span>
      );
    }
  };

  // Helper function to render deletion status indicator
  const renderDeletionStatus = (user: AppUser) => {
    if (user.deleted_at) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300">
          <Trash className="w-3 h-3 mr-1" />
          Deleted
        </span>
      );
    }

    if (user.deletion_scheduled_at) {
      const scheduledDate = new Date(user.deletion_scheduled_at);
      const daysRemaining = Math.ceil((scheduledDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

      return (
        <span
          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"
          title={`Scheduled for deletion on ${scheduledDate.toLocaleDateString()}`}
        >
          <Trash className="w-3 h-3 mr-1" />
          {daysRemaining > 0 ? `${daysRemaining}d left` : 'Today'}
        </span>
      );
    }

    return null;
  };

  const matchesSearch = (user: AppUser) => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return true;

    const metadataValues =
      user.metadata && typeof user.metadata === 'object'
        ? Object.values(user.metadata)
          .map((value) => String(value ?? '').toLowerCase())
          .join(' ')
        : '';

    return [
      user.name,
      user.last_name,
      user.email,
      user.phone,
      user.custom_field_1,
      user.custom_field_2,
      metadataValues,
    ]
      .map((value) => String(value ?? '').toLowerCase())
      .some((value) => value.includes(term));
  };

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">User Management</h1>
              <p className="text-dark-600 dark:text-dark-400">
                Manage application users, assign roles, and control access.
              </p>
            </div>
            {users.filter(u => u.deletion_scheduled_at && !u.deleted_at).length > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg px-4 py-2">
                <div className="flex items-center gap-2">
                  <Trash className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                    {users.filter(u => u.deletion_scheduled_at && !u.deleted_at).length} account(s) scheduled for deletion
                  </span>
                </div>
              </div>
            )}
          </div>
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
                  placeholder="Search by name, email, phone, or custom fields..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full pl-10 pr-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-dark-700 dark:text-white"
                />
              </div>
            </div>

            {/* Filters */}
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            >
              <option value="">All Roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.role_name}
                </option>
              ))}
            </select>

            <select
              value={filterActive === undefined ? '' : String(filterActive)}
              onChange={(e) => {
                setFilterActive(e.target.value === '' ? undefined : e.target.value === 'true');
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>

            <select
              value={filterDeletion}
              onChange={(e) => {
                setFilterDeletion(e.target.value as 'all' | 'scheduled' | 'none');
                setCurrentPage(1);
              }}
              className="px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            >
              <option value="all">All Accounts</option>
              <option value="scheduled">⚠️ Scheduled for Deletion</option>
              <option value="none">Not Scheduled</option>
            </select>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={fetchUsers}
                className="px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <AppButton
                onClick={() => setShowImportModal(true)}
                icon={<Upload className="w-5 h-5" />}
                variant="secondary"
                loading={importLoading}
                disabled={importLoading}
              >
                Import
              </AppButton>
              <AppButton
                onClick={handleExportUsers}
                icon={<Download className="w-5 h-5" />}
                variant="secondary"
                loading={exportLoading}
                disabled={exportLoading}
              >
                Export
              </AppButton>
              <AppButton
                onClick={() => setShowCreateModal(true)}
                icon={<Plus className="w-5 h-5" />}
              >
                Create User
              </AppButton>
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-2 text-dark-600 dark:text-dark-400">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center">
              <UserPlus className="w-12 h-12 text-dark-400 mx-auto mb-2" />
              <p className="text-dark-600 dark:text-dark-400">No users found</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-primary-600 hover:text-primary-700"
              >
                Create your first user
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      ID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Last Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Custom Field 1
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Custom Field 2
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Roles
                    </th>
                    {customFields.map((field) => (
                      <th key={field.id} className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                        {field.field_label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      OTP
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
                  {users
                    .filter((user) => {
                      if (!matchesSearch(user)) {
                        return false;
                      }

                      if (filterDeletion === 'scheduled') {
                        return user.deletion_scheduled_at && !user.deleted_at;
                      } else if (filterDeletion === 'none') {
                        return !user.deletion_scheduled_at;
                      }
                      return true; // 'all'
                    })
                    .map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => handleViewUser(user)}
                        className="hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400 font-mono">
                          {user.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center">
                            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400 font-semibold mr-3">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-dark-900 dark:text-white">{user.name}</span>
                                {user.deletion_scheduled_at && (
                                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300" title={`Deletion scheduled for ${new Date(user.deletion_scheduled_at).toLocaleDateString()}`}>
                                    <Trash className="w-3 h-3" />
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-dark-500 dark:text-dark-400">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                          {user.last_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <div className="flex items-center text-sm text-dark-600 dark:text-dark-400">
                              <Mail className="w-4 h-4 mr-1" />
                              {user.email_verified ? (
                                <CheckCircle className="w-4 h-4 text-green-500 ml-1" />
                              ) : (
                                <XCircle className="w-4 h-4 text-red-500 ml-1" />
                              )}
                            </div>
                            {user.phone && (
                              <div className="flex items-center text-sm text-dark-600 dark:text-dark-400">
                                <Phone className="w-4 h-4 mr-1" />
                                {user.phone}
                                {user.phone_verified && <CheckCircle className="w-4 h-4 text-green-500 ml-1" />}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                          {user.custom_field_1 || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                          {user.custom_field_2 || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {user.roles && user.roles.length > 0 ? (
                              user.roles.map((role) => (
                                <span
                                  key={role.id}
                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                                >
                                  <Shield className="w-3 h-3 mr-1" />
                                  {role.role_name}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-dark-400">No roles</span>
                            )}
                          </div>
                        </td>
                        {customFields.map((field) => (
                          <td key={field.id} className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                            {user.metadata?.[field.field_name] || '-'}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                            {user.is_active ? (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Active
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                                <XCircle className="w-3 h-3 mr-1" />
                                Inactive
                              </span>
                            )}
                            {renderDeletionStatus(user)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {renderOTPStatus(user)}
                        </td>
                        <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={(e) => handleEditUser(user, e)}
                              className="p-1 text-dark-600 hover:text-primary-600 dark:text-dark-400 dark:hover:text-primary-400"
                              title="Edit user"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDeleteUser(user, e)}
                              className="p-1 text-dark-600 hover:text-red-600 dark:text-dark-400 dark:hover:text-red-400"
                              title="Delete user"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <div className="text-sm text-dark-600 dark:text-dark-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border border-dark-300 dark:border-dark-600 rounded hover:bg-dark-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border border-dark-300 dark:border-dark-600 rounded hover:bg-dark-50 dark:hover:bg-dark-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          projectId={projectId!}
          roles={roles}
          customFields={customFields}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchUsers();
          }}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          projectId={projectId!}
          user={selectedUser}
          roles={roles}
          customFields={customFields}
          onClose={() => {
            setShowEditModal(false);
            setSelectedUser(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedUser(null);
            fetchUsers();
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setUserToDelete(null);
        }}
        onConfirm={confirmDelete}
        title="Delete User"
        message={`Are you sure you want to permanently delete ${userToDelete?.name} (${userToDelete?.email})? This will also delete the user from SuperTokens and cannot be undone.`}
        itemName="user"
        loading={deleteLoading}
      />

      {/* User Import Modal */}
      <UserImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImportUsers}
        loading={importLoading}
      />
    </div>
  );
};

// Password generator helper
const generatePassword = (length: number = 12): string => {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const symbols = '!@#$%^&*';

  const allChars = lowercase + uppercase + numbers + symbols;
  let password = '';

  // Ensure at least one of each type
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
};

// Create User Modal Component
const CreateUserModal = ({ projectId, roles, customFields, onClose, onSuccess }: { projectId: string; roles: Role[]; customFields: CustomField[]; onClose: () => void; onSuccess: () => void }) => {
  // Find the default "User" role
  const defaultUserRole = roles.find(r => r.role_key === 'user') || null;

  const [formData, setFormData] = useState<CreateUserRequest>({
    name: '',
    last_name: '',
    email: '',
    password: generatePassword(),
    phone: '',
    custom_field_1: '',
    custom_field_2: '',
    role_ids: defaultUserRole ? [defaultUserRole.id] : [],
    metadata: {},
  });
  const [selectedRole, setSelectedRole] = useState<Role | null>(defaultUserRole);
  const [showPassword, setShowPassword] = useState(true);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGeneratePassword = () => {
    const newPassword = generatePassword();
    setFormData({ ...formData, password: newPassword });
    setPasswordCopied(false);
  };

  const handleCopyPassword = async () => {
    try {
      await navigator.clipboard.writeText(formData.password);
      setPasswordCopied(true);
      setTimeout(() => setPasswordCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy password:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const userData = {
        ...formData,
        role_ids: selectedRole ? [selectedRole.id] : [],
      };
      await AuthUsersService.createUser(projectId, userData);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Create New User</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.last_name || ''}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Email *
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Password *
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  setPasswordCopied(false);
                }}
                className="w-full px-3 py-2 pr-24 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white font-mono"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleCopyPassword}
                  className="p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                  title="Copy password"
                >
                  <Copy className={`w-4 h-4 ${passwordCopied ? 'text-green-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="p-1 text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
                  title="Generate new password"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-dark-500 dark:text-dark-400">
                Auto-generated. Click <RotateCw className="w-3 h-3 inline" /> to regenerate or edit manually.
              </p>
              {passwordCopied && (
                <p className="text-xs text-green-600 dark:text-green-400 flex items-center">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Copied!
                </p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Custom Field 1
            </label>
            <input
              type="text"
              value={formData.custom_field_1 || ''}
              onChange={(e) => setFormData({ ...formData, custom_field_1: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
              placeholder="e.g., ID Number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Custom Field 2
            </label>
            <input
              type="text"
              value={formData.custom_field_2 || ''}
              onChange={(e) => setFormData({ ...formData, custom_field_2: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
              placeholder="e.g., Employee ID"
            />
          </div>

          <div>
            <AppLabledAutocomplete
              label="Role"
              options={roles}
              onSelect={(role) => setSelectedRole(role)}
              onClear={() => setSelectedRole(null)}
              value={selectedRole?.id.toString()}
              displayValue={selectedRole?.role_name || ''}
              accessor="role_name"
              valueAccessor="id"
              placeholder="Select a role"
              className="mb-2"
            />
            {selectedRole && (
              <p className="text-xs text-dark-500 dark:text-dark-400">
                Selected: <span className="font-medium">{selectedRole.role_name}</span>
              </p>
            )}
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="border-t border-dark-200 dark:border-dark-700 pt-4">
              <h3 className="text-sm font-semibold text-dark-900 dark:text-white mb-3">Custom Fields</h3>
              <div className="space-y-3">
                {customFields.map((field) => (
                  <div key={field.id}>
                    {renderCustomFieldInput(field, formData.metadata || {}, (value) => {
                      setFormData({
                        ...formData,
                        metadata: {
                          ...formData.metadata,
                          [field.field_name]: value,
                        },
                      });
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

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
              {loading ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper function to render custom field inputs
const renderCustomFieldInput = (field: CustomField, metadata: any, onChange: any) => {
  const value = metadata[field.field_name] || '';

  switch (field.field_type) {
    case 'text':
      return (
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            required={field.is_required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
          />
        </div>
      );

    case 'number':
      return (
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="number"
            required={field.is_required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
          />
        </div>
      );

    case 'boolean':
      return (
        <div className="flex items-center">
          <input
            type="checkbox"
            checked={value === true || value === 'true'}
            onChange={(e) => onChange(e.target.checked)}
            className="mr-2"
          />
          <label className="text-sm font-medium text-dark-700 dark:text-dark-300">
            {field.field_label}
          </label>
        </div>
      );

    case 'date':
      return (
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="date"
            required={field.is_required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
          />
        </div>
      );

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
          </label>
          <select
            required={field.is_required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
          >
            <option value="">Select...</option>
            {field.options && Array.isArray(field.options) && field.options.map((option: string, idx: number) => (
              <option key={idx} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    default:
      return (
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            {field.field_label} {field.is_required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            required={field.is_required}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
          />
        </div>
      );
  }
};

// Edit User Modal Component
const EditUserModal = ({ projectId, user, roles, customFields, onClose, onSuccess }: { projectId: string; user: AppUser; roles: Role[]; customFields: CustomField[]; onClose: () => void; onSuccess: () => void }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    last_name: user.last_name || '',
    email: user.email,
    phone: user.phone || '',
    custom_field_1: user.custom_field_1 || '',
    custom_field_2: user.custom_field_2 || '',
    is_active: user.is_active,
    metadata: user.metadata || {},
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Track selected role IDs (initialize with user's current roles)
  const [selectedRoleIds, setSelectedRoleIds] = useState<number[]>(
    (user.roles || []).map(role => role.id)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Update user basic info
      await AuthUsersService.updateUser(projectId, String(user.id), formData);

      // Update roles: assign new roles and remove unselected roles
      const currentRoleIds = (user.roles || []).map(role => role.id);
      const rolesToAdd = selectedRoleIds.filter(id => !currentRoleIds.includes(id));
      const rolesToRemove = currentRoleIds.filter(id => !selectedRoleIds.includes(id));

      // Assign new roles
      for (const roleId of rolesToAdd) {
        await AuthUsersService.assignRole(projectId, String(user.id), roleId);
      }

      // Remove unselected roles
      for (const roleId of rolesToRemove) {
        await AuthUsersService.removeRole(projectId, String(user.id), String(roleId));
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (roleId: number) => {
    setSelectedRoleIds(prev => {
      if (prev.includes(roleId)) {
        return prev.filter(id => id !== roleId);
      } else {
        return [...prev, roleId];
      }
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-800 rounded-lg max-w-md w-full p-6">
        <h2 className="text-xl font-bold text-dark-900 dark:text-white mb-4">Edit User</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Last Name
            </label>
            <input
              type="text"
              value={formData.last_name || ''}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Email
            </label>
            <input
              type="email"
              required
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Phone
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Custom Field 1
            </label>
            <input
              type="text"
              value={formData.custom_field_1 || ''}
              onChange={(e) => setFormData({ ...formData, custom_field_1: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
              placeholder="e.g., ID Number"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
              Custom Field 2
            </label>
            <input
              type="text"
              value={formData.custom_field_2 || ''}
              onChange={(e) => setFormData({ ...formData, custom_field_2: e.target.value })}
              className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
              placeholder="e.g., Employee ID"
            />
          </div>

          {/* Role Assignment */}
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

          <div>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm font-medium text-dark-700 dark:text-dark-300">Active</span>
            </label>
          </div>

          {/* Custom Fields */}
          {customFields.length > 0 && (
            <div className="border-t border-dark-200 dark:border-dark-700 pt-4">
              <h3 className="text-sm font-semibold text-dark-900 dark:text-white mb-3">Custom Fields</h3>
              <div className="space-y-3">
                {customFields.map((field) => (
                  <div key={field.id}>
                    {renderCustomFieldInput(field, formData.metadata, (value) => {
                      setFormData({
                        ...formData,
                        metadata: {
                          ...formData.metadata,
                          [field.field_name]: value,
                        },
                      });
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

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

export default AuthUsersTab;
