import { useCallback, useMemo, useState } from 'react';
import { Search, RefreshCw, ShieldAlert, UserX, Ban, Clock, Mail, User } from 'lucide-react';
import SuperTokensAdminService, { SuperTokensUser } from '../../../../../services/SuperTokensAdminService';
import ConfirmModal from '../../../../../components/modals/ConfirmModal';
import ToastUtils from '../../../../../utils/ToastUtils';
import { AppButton } from '../../../../../components/ComponentsIndex';
import useAppStore from '../../../../../stores/state/useAppStore';

type PendingAction = 'revoke' | 'delete' | null;

const AuthSuperTokensTab = () => {
  const { user } = useAppStore();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<SuperTokensUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SuperTokensUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isAdmin = useMemo(
    () => !!user?.roles?.some((role) => role.role_key === 'admin'),
    [user]
  );

  const fetchUsers = useCallback(
    async (searchQuery: string) => {
      setLoading(true);
      try {
        const result = await SuperTokensAdminService.searchUsers(searchQuery);
        setUsers(result);

        if (selectedUser) {
          const updatedSelected = result.find((item) => item.id === selectedUser.id) || null;
          setSelectedUser(updatedSelected);
        } else if (result.length > 0) {
          setSelectedUser(result[0]);
        } else {
          setSelectedUser(null);
        }
      } catch (error: any) {
        ToastUtils.error(error.message || 'Failed to load SuperTokens users');
      } finally {
        setLoading(false);
      }
    },
    [selectedUser]
  );

  const handleSearch = async () => {
    await fetchUsers(query);
  };

  const handleRefresh = async () => {
    await fetchUsers(query);
  };

  const requestAction = (action: PendingAction) => {
    if (!selectedUser || !action) return;
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    if (!selectedUser || !pendingAction) return;

    setActionLoading(true);
    try {
      if (pendingAction === 'revoke') {
        const result = await SuperTokensAdminService.revokeSessions(selectedUser.id);
        const revokedCount = result.sessionHandlesRevoked?.length || 0;
        ToastUtils.success(`Revoked ${revokedCount} session(s) for user ${selectedUser.id}`);
      } else if (pendingAction === 'delete') {
        await SuperTokensAdminService.deleteUser(selectedUser.id);
        ToastUtils.success(`Deleted SuperTokens user ${selectedUser.id}`);
        await fetchUsers(query);
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to complete action');
    } finally {
      setActionLoading(false);
      setConfirmOpen(false);
      setPendingAction(null);
    }
  };

  const selectedEmail = selectedUser?.emails?.[0] || 'No email';
  const joinedAt = selectedUser?.timeJoined
    ? new Date(selectedUser.timeJoined > 1_000_000_000_000 ? selectedUser.timeJoined : selectedUser.timeJoined * 1000).toLocaleString()
    : 'N/A';

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">SuperTokens</h1>
          <p className="text-dark-600 dark:text-dark-400">
            Search SuperTokens users by email or user ID and run safe admin actions.
          </p>
        </div>

        {!isAdmin && (
          <div className="rounded-lg border border-yellow-300 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-yellow-700 dark:text-yellow-300 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                You can view this tab, but management actions are disabled because your account is not an admin.
              </div>
            </div>
          </div>
        )}

        <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleSearch();
                  }
                }}
                placeholder="Search by email or SuperTokens user ID"
                className="w-full pl-10 pr-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-dark-700 dark:text-white"
              />
            </div>
            <div className="flex gap-2">
              <AppButton onClick={() => void handleSearch()} icon={<Search className="w-4 h-4" />} disabled={loading}>
                Search
              </AppButton>
              <button
                onClick={() => void handleRefresh()}
                disabled={loading}
                className="px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
                title="Refresh results"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-dark-600 dark:text-dark-400">Loading SuperTokens users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="p-8 text-center">
                <User className="w-12 h-12 text-dark-400 mx-auto mb-2" />
                <p className="text-dark-600 dark:text-dark-400">No users found. Try searching by email or user ID.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-dark-50 dark:bg-dark-900 border-b border-dark-200 dark:border-dark-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                        User ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-dark-500 dark:text-dark-400 uppercase tracking-wider">
                        Joined
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dark-200 dark:divide-dark-700">
                    {users.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedUser(item)}
                        className={`cursor-pointer transition-colors ${
                          selectedUser?.id === item.id
                            ? 'bg-primary-50 dark:bg-primary-900/20'
                            : 'hover:bg-dark-50 dark:hover:bg-dark-700/40'
                        }`}
                      >
                        <td className="px-4 py-3 text-sm font-mono text-dark-700 dark:text-dark-300">{item.id}</td>
                        <td className="px-4 py-3 text-sm text-dark-700 dark:text-dark-300">{item.emails?.[0] || '-'}</td>
                        <td className="px-4 py-3 text-sm text-dark-600 dark:text-dark-400">
                          {item.timeJoined
                            ? new Date(item.timeJoined > 1_000_000_000_000 ? item.timeJoined : item.timeJoined * 1000).toLocaleString()
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-4 space-y-4">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white">User Details</h2>
            {selectedUser ? (
              <>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 uppercase">User ID</div>
                    <div className="text-sm font-mono text-dark-800 dark:text-dark-200 break-all">{selectedUser.id}</div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 uppercase flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email
                    </div>
                    <div className="text-sm text-dark-800 dark:text-dark-200">{selectedEmail}</div>
                  </div>
                  <div>
                    <div className="text-xs text-dark-500 dark:text-dark-400 uppercase flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Joined At
                    </div>
                    <div className="text-sm text-dark-800 dark:text-dark-200">{joinedAt}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-dark-200 dark:border-dark-700 space-y-2">
                  <AppButton
                    variant="secondary"
                    className="w-full"
                    icon={<Ban className="w-4 h-4" />}
                    onClick={() => requestAction('revoke')}
                    disabled={!isAdmin || actionLoading}
                  >
                    Revoke All Sessions
                  </AppButton>
                  <AppButton
                    variant="danger"
                    className="w-full"
                    icon={<UserX className="w-4 h-4" />}
                    onClick={() => requestAction('delete')}
                    disabled={!isAdmin || actionLoading}
                  >
                    Delete User
                  </AppButton>
                </div>
              </>
            ) : (
              <p className="text-sm text-dark-600 dark:text-dark-400">Select a user to view details and actions.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmOpen}
        heading={pendingAction === 'delete' ? 'Delete SuperTokens User' : 'Revoke User Sessions'}
        text={
          pendingAction === 'delete'
            ? `Delete SuperTokens user ${selectedUser?.id}? This action cannot be undone.`
            : `Revoke all active sessions for user ${selectedUser?.id}? The user will be signed out everywhere.`
        }
        onCancel={() => {
          setConfirmOpen(false);
          setPendingAction(null);
        }}
        onConfirm={() => void handleConfirmAction()}
        confirmText={pendingAction === 'delete' ? 'Delete User' : 'Revoke Sessions'}
        variant={pendingAction === 'delete' ? 'danger' : 'warning'}
        loading={actionLoading}
      />
    </div>
  );
};

export default AuthSuperTokensTab;
