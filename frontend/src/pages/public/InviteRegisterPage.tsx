import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, CheckCircle, Users, Sparkles, ArrowRight } from 'lucide-react';
import InvitationsService, { ProjectInvitation } from '../../services/InvitationsService';
import { useAppStore } from '../../stores/StoresIndex';
import ToastUtils from '../../utils/ToastUtils';
import { signUp } from '../../config/supertokens';
import { bootstrapAuth } from '../../services/AuthFlowService';
import skaftinLogo from '../../assets/skaftinLogo.png';

const InviteRegisterPage = () => {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { setUser, setLoading: setAppLoading } = useAppStore();
  const [invitation, setInvitation] = useState<ProjectInvitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState('');

  useEffect(() => {
    if (inviteCode) {
      loadInvitation();
    }
  }, [inviteCode]);

  const loadInvitation = async () => {
    try {
      setLoading(true);
      const data = await InvitationsService.getInvitationByCode(inviteCode!);
      setInvitation(data);
      // Pre-fill email from invitation
      setFormData((prev) => ({ ...prev, email: data.email }));
    } catch (error: any) {
      ToastUtils.error('Invalid invitation link');
      setTimeout(() => navigate('/login'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      setSubmitting(true);
      setAppLoading(true);

      const response = await signUp({
        formFields: [
          { id: 'email', value: formData.email },
          { id: 'password', value: formData.password },
        ],
      });

      if (response.status === 'OK') {
        const bootstrap = await bootstrapAuth({ preloadOrganizations: true, force: true });
        setUser(bootstrap.user);

        ToastUtils.success('Account created successfully!');

        // Wait a moment then redirect to accept invitation
        setTimeout(() => {
          navigate(`/invite/${inviteCode}`);
        }, 1000);
      } else if (response.status === 'FIELD_ERROR') {
        const fieldError = response.formFields?.find((field) => field.error);
        setError(fieldError?.error || 'Invalid input');
      } else if (response.status === 'SIGN_UP_NOT_ALLOWED') {
        setError('An account with this email already exists');
      } else {
        setError('Failed to create account');
      }
    } catch (error: any) {
      console.error('Registration error:', error);
      setError('Failed to create account. Please try again.');
    } finally {
      setSubmitting(false);
      setAppLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-dark-600 dark:text-dark-400">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (!invitation) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-purple-50 to-pink-50 dark:from-dark-900 dark:via-dark-800 dark:to-dark-900 flex items-center justify-center p-4">
      <div className="max-w-5xl w-full grid lg:grid-cols-2 gap-8">
        {/* Left Side - Welcome Message */}
        <div className="hidden lg:flex flex-col justify-center space-y-6 text-white">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">You're Invited!</span>
            </div>
            
            <h1 className="text-5xl font-bold leading-tight text-black/80">
              Join{' '}
              <span className="bg-gradient-to-r from-primary-400 to-purple-400 bg-clip-text text-transparent">
                {invitation.project_name}
              </span>
            </h1>
            
            <p className="text-xl text-black/80">
              Create your account to start collaborating with your team on Skaftin Platform.
            </p>
          </div>

          {/* Features */}
          <div className="space-y-4 pt-8">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-black/70">Instant Access</h3>
                <p className="text-black/70 text-sm">
                  Get immediate access to the project after registration
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-black/70">Team Collaboration</h3>
                <p className="text-black/70 text-sm">
                  Work together with your team on shared resources
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold mb-1 text-black/70">Secure Platform</h3>
                <p className="text-black/70 text-sm">
                  Enterprise-grade security for all your data
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Registration Form */}
        <div className="flex items-center">
          <div className="w-full bg-white dark:bg-dark-800 rounded-2xl shadow-2xl p-8 lg:p-10">
            {/* Mobile Header */}
            <div className="lg:hidden mb-6 text-center">
              <img src={skaftinLogo} alt="Skaftin logo" className="w-16 h-16 mx-auto mb-4 rounded-2xl object-contain" />
              <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
                Join {invitation.project_name}
              </h2>
              <p className="text-dark-600 dark:text-dark-400">
                Create your account to get started
              </p>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block mb-8">
              <h2 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
                Create Your Account
              </h2>
              <p className="text-dark-600 dark:text-dark-400">
                Join your team on Skaftin Platform
              </p>
            </div>

            {/* Invitation Info Card */}
            <div className="mb-6 p-4 bg-gradient-to-br from-primary-50 to-purple-50 dark:from-primary-900/20 dark:to-purple-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary-600" />
                <span className="text-sm font-medium text-primary-900 dark:text-primary-300">
                  You're being invited to:
                </span>
              </div>
              <p className="font-semibold text-dark-900 dark:text-white">
                {invitation.project_name}
              </p>
              {invitation.project_description && (
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                  {invitation.project_description}
                </p>
              )}
              <p className="text-xs text-dark-500 dark:text-dark-500 mt-2">
                Role: <span className="font-medium capitalize">{invitation.role}</span>
              </p>
            </div>

            {/* Registration Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Email Field (Pre-filled, Read-only) */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type="email"
                    value={formData.email}
                    readOnly
                    className="w-full pl-10 pr-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-50 dark:bg-dark-900 text-dark-900 dark:text-white cursor-not-allowed"
                  />
                </div>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  This email is linked to your invitation
                </p>
              </div>

              {/* Password Field */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter your password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Minimum 6 characters
                </p>
              </div>

              {/* Confirm Password Field */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full pl-10 pr-12 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Confirm your password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* What Happens Next */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-300">
                  <strong>What happens next?</strong><br />
                  After creating your account, you'll automatically join{' '}
                  <strong>{invitation.project_name}</strong> and can start collaborating right away!
                </p>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg hover:from-primary-700 hover:to-purple-700 transition-all duration-200 font-medium shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {submitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account & Join Project
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </form>

            {/* Already Have Account */}
            <div className="mt-6 pt-6 border-t border-dark-200 dark:border-dark-700 text-center">
              <p className="text-sm text-dark-600 dark:text-dark-400">
                Already have an account?{' '}
                <button
                  onClick={() => navigate(`/invite/${inviteCode}`)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Sign in instead
                </button>
              </p>
            </div>

            {/* Security Note */}
            <div className="mt-6 text-center">
              <p className="text-xs text-dark-500 dark:text-dark-400">
                🔒 Your data is encrypted and secure
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500/5 rounded-full blur-3xl"></div>
      </div>
    </div>
  );
};

export default InviteRegisterPage;

