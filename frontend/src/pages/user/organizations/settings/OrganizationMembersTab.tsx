import { useState, useEffect } from 'react';
import { Users, UserPlus, Crown, Shield, Eye, User, Trash2, Loader2, Mail } from 'lucide-react';
import { useOrganizationStore } from '../../../../stores/StoresIndex';
import { Organization, OrganizationWithMembers, OrganizationRole, OrganizationMember } from '../../../../types/Types';
import ToastUtils from '../../../../utils/ToastUtils';

interface OrganizationMembersTabProps {
  organization: Organization;
  organizationDetails: OrganizationWithMembers | null;
}

const roleIcons: Record<OrganizationRole, React.ReactNode> = {
  admin: <Crown className="w-4 h-4 text-amber-500" />,
  dev: <Shield className="w-4 h-4 text-blue-500" />,
  member: <User className="w-4 h-4 text-green-500" />,
  viewer: <Eye className="w-4 h-4 text-gray-500" />,
};

const roleLabels: Record<OrganizationRole, string> = {
  admin: 'Admin',
  dev: 'Developer',
  member: 'Member',
  viewer: 'Viewer',
};

const roleDescriptions: Record<OrganizationRole, string> = {
  admin: 'Full access to all organization settings and projects',
  dev: 'Can create and manage projects',
  member: 'Can view and contribute to projects',
  viewer: 'Read-only access to projects',
};

const OrganizationMembersTab = ({ organization, organizationDetails }: OrganizationMembersTabProps) => {
  const { addMember, updateMemberRole, removeMember, getOrganizationById } = useOrganizationStore();
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [addMemberData, setAddMemberData] = useState({
    userId: '',
    role: 'member' as OrganizationRole,
  });
  const [addMemberLoading, setAddMemberLoading] = useState(false);

  useEffect(() => {
    if (organizationDetails?.members) {
      setMembers(organizationDetails.members);
    }
  }, [organizationDetails]);

  const refreshMembers = async () => {
    setLoading(true);
    try {
      const details = await getOrganizationById(organization.id);
      if (details?.members) {
        setMembers(details.members);
      }
    } catch (error) {
      console.error('Error refreshing members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!addMemberData.userId.trim()) {
      ToastUtils.error('User ID is required');
      return;
    }

    setAddMemberLoading(true);
    try {
      await addMember(organization.id, {
        user_id: addMemberData.userId.trim(),
        role: addMemberData.role,
      });

      ToastUtils.success('Member added successfully');
      setShowAddMember(false);
      setAddMemberData({ userId: '', role: 'member' });
      await refreshMembers();
    } catch (error) {
      console.error('Error adding member:', error);
      ToastUtils.error('Failed to add member');
    } finally {
      setAddMemberLoading(false);
    }
  };

  const handleRoleChange = async (memberId: number, newRole: OrganizationRole) => {
    try {
      await updateMemberRole(organization.id, memberId, newRole);
      ToastUtils.success('Role updated successfully');
      await refreshMembers();
    } catch (error) {
      console.error('Error updating role:', error);
      ToastUtils.error('Failed to update role');
    }
  };

  const handleRemoveMember = async (memberId: number, memberName?: string) => {
    const confirmMessage = memberName
      ? `Are you sure you want to remove ${memberName} from this organization?`
      : 'Are you sure you want to remove this member?';

    if (!confirm(confirmMessage)) return;

    try {
      await removeMember(organization.id, memberId);
      ToastUtils.success('Member removed successfully');
      await refreshMembers();
    } catch (error) {
      console.error('Error removing member:', error);
      ToastUtils.error('Failed to remove member');
    }
  };

  const isOwner = organization.isOwner || organization.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <Users className="w-5 h-5" />
            Members
          </h2>
          <p className="text-dark-600 dark:text-dark-400 mt-1">
            Manage who has access to this organization
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => setShowAddMember(!showAddMember)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg 
                     hover:bg-primary-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Add Member
          </button>
        )}
      </div>

      {/* Add Member Form */}
      {showAddMember && (
        <div className="bg-dark-50 dark:bg-dark-900 rounded-lg p-4 border border-dark-200 dark:border-dark-700">
          <h3 className="font-medium text-dark-900 dark:text-white mb-4">Add New Member</h3>
          <form onSubmit={handleAddMember} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  User ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={addMemberData.userId}
                  onChange={(e) => setAddMemberData({ ...addMemberData, userId: e.target.value })}
                  placeholder="Enter user ID"
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg 
                           bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Role
                </label>
                <select
                  value={addMemberData.role}
                  onChange={(e) => setAddMemberData({ ...addMemberData, role: e.target.value as OrganizationRole })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg 
                           bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                >
                  <option value="viewer">Viewer</option>
                  <option value="member">Member</option>
                  <option value="dev">Developer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddMember(false)}
                className="px-4 py-2 text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={addMemberLoading}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg 
                         hover:bg-primary-700 transition-colors disabled:opacity-50"
              >
                {addMemberLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Add Member
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Legend */}
      <div className="bg-dark-50 dark:bg-dark-900 rounded-lg p-4 border border-dark-200 dark:border-dark-700">
        <h3 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">Role Permissions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.keys(roleLabels) as OrganizationRole[]).map((role) => (
            <div key={role} className="flex items-start gap-2">
              {roleIcons[role]}
              <div>
                <p className="text-sm font-medium text-dark-900 dark:text-white">{roleLabels[role]}</p>
                <p className="text-xs text-dark-500 dark:text-dark-400">{roleDescriptions[role]}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Members List */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary-600" />
            <p className="text-dark-500 dark:text-dark-400">Loading members...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto mb-3 text-dark-300 dark:text-dark-600" />
            <p className="text-dark-500 dark:text-dark-400">No members found</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {members.map((member) => {
              const isCurrentUserOwner = member.user_id === organization.owner_id;

              return (
                <div
                  key={member.id}
                  className="p-4 flex items-center justify-between hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {(member.name || member.email || 'U')[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-dark-900 dark:text-white">
                          {member.name || 'Unnamed User'}
                        </p>
                        {isCurrentUserOwner && (
                          <span className="px-2 py-0.5 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                            Owner
                          </span>
                        )}
                      </div>
                      {member.email && (
                        <p className="text-sm text-dark-500 dark:text-dark-400 flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {member.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Role Badge/Selector */}
                    {isOwner && !isCurrentUserOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as OrganizationRole)}
                        className="px-3 py-1.5 border border-dark-200 dark:border-dark-700 rounded-lg 
                                 bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="member">Member</option>
                        <option value="dev">Developer</option>
                        <option value="admin">Admin</option>
                      </select>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1.5 bg-dark-100 dark:bg-dark-700 rounded-lg text-sm">
                        {roleIcons[member.role]}
                        <span className="text-dark-700 dark:text-dark-300">{roleLabels[member.role]}</span>
                      </span>
                    )}

                    {/* Remove Button */}
                    {isOwner && !isCurrentUserOwner && (
                      <button
                        onClick={() => handleRemoveMember(member.id, member.name)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizationMembersTab;
