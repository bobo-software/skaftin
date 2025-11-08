import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Users, UserPlus, Mail, Trash2, X, Copy, Check } from 'lucide-react';
import InvitationsService, { ProjectInvitation, ProjectMember, CreateInvitationRequest } from '../../services/InvitationsService';
import CommunicationsService, { EmailProvider } from '../../services/CommunicationsService';
import ToastUtils from '../../utils/ToastUtils';

const TeamTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);
  const [emailProviders, setEmailProviders] = useState<EmailProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<number | undefined>();
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [membersData, invitationsData, providersData] = await Promise.all([
        InvitationsService.listMembers(projectId!),
        InvitationsService.listInvitations(projectId!),
        CommunicationsService.listEmailProviders(projectId!),
      ]);
      setMembers(membersData);
      setInvitations(invitationsData.filter((inv) => inv.status === 'pending'));
      setEmailProviders(providersData.filter((p) => p.is_active));
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!inviteEmail) {
      ToastUtils.error('Please enter an email address');
      return;
    }

    try {
      const data: CreateInvitationRequest = {
        email: inviteEmail,
        role: 'member',
      };

      if (selectedProvider) {
        data.email_provider_id = selectedProvider;
      }

      console.log('📤 [TeamTab] Sending invitation request:');
      console.log('  └─ projectId:', projectId);
      console.log('  └─ email:', inviteEmail);
      console.log('  └─ selectedProvider:', selectedProvider);
      console.log('  └─ data:', data);

      const result = await InvitationsService.createInvitation(projectId!, data);
      
      if (selectedProvider) {
        ToastUtils.success('Invitation sent via email!');
      } else {
        ToastUtils.success('Invitation created! Share the link with the user.');
        // Copy link to clipboard
        navigator.clipboard.writeText(result.invite_link);
      }

      setShowInviteModal(false);
      setInviteEmail('');
      setSelectedProvider(undefined);
      loadData();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to send invitation');
    }
  };

  const handleCopyLink = async (inviteCode: string) => {
    const link = `${window.location.origin}/invite/${inviteCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedLink(inviteCode);
      ToastUtils.success('Invite link copied!');
      setTimeout(() => setCopiedLink(null), 2000);
    } catch (error) {
      ToastUtils.error('Failed to copy link');
    }
  };

  const handleRevokeInvitation = async (invitationId: number) => {
    if (!window.confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    try {
      await InvitationsService.revokeInvitation(projectId!, invitationId.toString());
      ToastUtils.success('Invitation revoked');
      loadData();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to revoke invitation');
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!window.confirm('Are you sure you want to remove this member?')) {
      return;
    }

    try {
      await InvitationsService.removeMember(projectId!, memberId.toString());
      ToastUtils.success('Member removed');
      loadData();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to remove member');
    }
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
            <Users className="w-6 h-6 text-primary-600" />
            Team Management
          </h2>
          <p className="text-dark-600 dark:text-dark-400 mt-1">
            Manage team members and invitations
          </p>
        </div>
        <button
          onClick={() => setShowInviteModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
          Invite Member
        </button>
      </div>

      {/* Team Members */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Team Members</h3>
        </div>

        {members.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 text-dark-400 mx-auto mb-3" />
            <p className="text-dark-600 dark:text-dark-400">No team members yet</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {members.map((member) => (
              <div key={member.id} className="p-4 flex items-center justify-between hover:bg-dark-50 dark:hover:bg-dark-700/50">
                <div>
                  <p className="font-medium text-dark-900 dark:text-white">{member.user_id}</p>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    {member.role} • Joined {new Date(member.joined_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRemoveMember(member.id)}
                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  title="Remove member"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Pending Invitations</h3>
        </div>

        {invitations.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-12 h-12 text-dark-400 mx-auto mb-3" />
            <p className="text-dark-600 dark:text-dark-400">No pending invitations</p>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {invitations.map((invitation) => (
              <div key={invitation.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-dark-900 dark:text-white">{invitation.email}</p>
                    <p className="text-sm text-dark-600 dark:text-dark-400">
                      {invitation.role} • Expires {new Date(invitation.expires_at).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-dark-500 dark:text-dark-500 mt-1">
                      Invited {new Date(invitation.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCopyLink(invitation.invite_code)}
                      className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      title="Copy invite link"
                    >
                      {copiedLink === invitation.invite_code ? (
                        <Check className="w-5 h-5 text-green-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevokeInvitation(invitation.id)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Revoke invitation"
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

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-white">Invite Team Member</h2>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleInvite} className="p-6 space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  placeholder="colleague@example.com"
                  required
                />
              </div>

              {/* Email Provider Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Send via Email Provider (Optional)
                </label>
                <select
                  value={selectedProvider || ''}
                  onChange={(e) => setSelectedProvider(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                >
                  <option value="">Don't send email (copy link manually)</option>
                  {emailProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.from_email})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  {selectedProvider 
                    ? 'An email with the invite link will be sent automatically'
                    : 'You\'ll get an invite link to share manually'}
                </p>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  {selectedProvider 
                    ? '📧 An email will be sent with an invite link and code'
                    : '🔗 You\'ll receive an invite link to share with the user'}
                </p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="flex-1 px-4 py-2 border border-dark-200 dark:border-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamTab;

