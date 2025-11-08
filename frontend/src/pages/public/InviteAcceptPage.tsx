import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import InvitationsService, { ProjectInvitation } from '../../services/InvitationsService';
import { useAppStore } from '../../stores/StoresIndex';
import ToastUtils from '../../utils/ToastUtils';

const InviteAcceptPage = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useAppStore();
  const [invitation, setInvitation] = useState<ProjectInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (inviteCode) {
      loadInvitation();
    }
  }, [inviteCode]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await InvitationsService.getInvitationByCode(inviteCode!);
      setInvitation(data);
    } catch (error: any) {
      setError(error.message || 'Invalid or expired invitation');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      // Store invite code and redirect to login
      sessionStorage.setItem('redirectAfterLogin', `/invite/${inviteCode}`);
      navigate('/login', { state: { redirectTo: `/invite/${inviteCode}` } });
      return;
    }

    try {
      setAccepting(true);
      await InvitationsService.acceptInvitation(inviteCode!);
      ToastUtils.success('Invitation accepted! Redirecting to project...');
      setTimeout(() => {
        navigate(`/projects/${invitation?.project_id}`);
      }, 1500);
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to accept invitation');
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-dark-600 dark:text-dark-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
              Invalid Invitation
            </h1>
            <p className="text-dark-600 dark:text-dark-400 mb-6">
              {error || 'This invitation link is invalid or has expired.'}
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Check if invitation is expired
  const isExpired = new Date(invitation.expires_at) < new Date();

  if (isExpired) {
    return (
      <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
              Invitation Expired
            </h1>
            <p className="text-dark-600 dark:text-dark-400 mb-6">
              This invitation has expired. Please contact the project owner to send a new invitation.
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-dark-800 rounded-lg shadow-lg p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-primary-600" />
            </div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
              You're Invited! 🎉
            </h1>
            <p className="text-dark-600 dark:text-dark-400">
              You've been invited to join a project on Skaftin
            </p>
          </div>

          {/* Invitation Details */}
          <div className="bg-dark-50 dark:bg-dark-700 rounded-lg p-4 mb-6 space-y-2">
            <div>
              <span className="text-sm text-dark-600 dark:text-dark-400">Project:</span>
              <p className="font-semibold text-dark-900 dark:text-white">{invitation.project_name}</p>
            </div>
            {invitation.project_description && (
              <div>
                <span className="text-sm text-dark-600 dark:text-dark-400">Description:</span>
                <p className="text-dark-900 dark:text-white">{invitation.project_description}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-dark-600 dark:text-dark-400">Role:</span>
              <p className="font-medium text-dark-900 dark:text-white capitalize">{invitation.role}</p>
            </div>
            <div>
              <span className="text-sm text-dark-600 dark:text-dark-400">Invited to:</span>
              <p className="font-medium text-dark-900 dark:text-white">{invitation.email}</p>
            </div>
            <div>
              <span className="text-sm text-dark-600 dark:text-dark-400">Expires:</span>
              <p className="text-dark-900 dark:text-white">
                {new Date(invitation.expires_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Action based on user authentication */}
          {!user ? (
            <div>
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-300">
                    <p className="font-medium mb-1">Account Required</p>
                    <p>You need to sign in or create an account to accept this invitation.</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Link
                  to={`/invite/${inviteCode}/register`}
                  className="block w-full px-6 py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-center rounded-lg hover:from-primary-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl"
                >
                  Create Account
                </Link>
                <Link
                  to="/login"
                  state={{ redirectTo: `/invite/${inviteCode}` }}
                  className="block w-full px-6 py-3 border border-primary-600 text-primary-600 text-center rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors font-medium"
                >
                  Sign In to Accept
                </Link>
              </div>
            </div>
          ) : (
            <div>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-800 dark:text-green-300">
                    <p className="font-medium mb-1">Ready to Join</p>
                    <p>Click the button below to accept the invitation and join the project.</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {accepting ? 'Accepting...' : 'Accept Invitation'}
              </button>
            </div>
          )}

          {/* Footer */}
          <div className="mt-6 pt-6 border-t border-dark-200 dark:border-dark-700 text-center">
            <p className="text-xs text-dark-500 dark:text-dark-400">
              Skaftin Platform - Secure Project Collaboration
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InviteAcceptPage;

