import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Database, Lock, Eye, EyeOff, ArrowRight, CheckCircle, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';
import { submitNewPassword, getResetPasswordTokenFromURL } from '../config/supertokens';

const RESET_LINK_LIFETIME_SECONDS = 900; // 15 minutes
const USED_TOKENS_KEY = 'skaftin_used_reset_tokens';

/** Mark a reset token as consumed in localStorage. */
function markTokenUsed(token: string) {
  try {
    const stored = JSON.parse(localStorage.getItem(USED_TOKENS_KEY) || '[]') as string[];
    // Keep only the last 20 entries to avoid unbounded growth
    const updated = [...stored.slice(-19), token];
    localStorage.setItem(USED_TOKENS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors (private browsing, quota, etc.)
  }
}

/** Check whether a reset token has already been consumed. */
function isTokenUsed(token: string): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(USED_TOKENS_KEY) || '[]') as string[];
    return stored.includes(token);
  } catch {
    return false;
  }
}

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Check if we have a valid token in the URL
  let token: string | undefined;
  try {
    token = getResetPasswordTokenFromURL();
  } catch {
    token = undefined;
  }

  // Check if the link has expired using the issued-at timestamp in the URL
  const isLinkExpired = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const iat = params.get('iat');
    if (!iat) return false; // No iat param -- fall through to server-side validation
    const issuedAt = parseInt(iat, 10);
    if (isNaN(issuedAt)) return false;
    return Math.floor(Date.now() / 1000) > issuedAt + RESET_LINK_LIFETIME_SECONDS;
  }, []);

  // Check if this token was already used (client-side via localStorage)
  const isAlreadyUsed = useMemo(() => {
    return token ? isTokenUsed(token) : false;
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const response = await submitNewPassword({
        formFields: [{ id: 'password', value: password }],
      });

      if (response.status === 'OK') {
        if (token) markTokenUsed(token);
        setSuccess(true);
      } else if (response.status === 'RESET_PASSWORD_INVALID_TOKEN_ERROR') {
        setError('This reset link has expired or is invalid. Please request a new one.');
      } else if (response.status === 'FIELD_ERROR') {
        const fieldError = response.formFields?.find((f: { id: string; error: string }) => f.error);
        setError(fieldError?.error || 'Invalid password');
      } else {
        setError('An error occurred. Please try again.');
      }
    } catch (err) {
      console.error('Reset password error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Link has expired (detected client-side via iat timestamp)
  if (token && isLinkExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
              Link Expired
            </h1>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full mx-auto">
              <Clock className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-dark-600 dark:text-dark-300 text-sm">
                This password reset link has expired. Reset links are valid for 15 minutes. Please request a new one.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="w-full btn-primary text-lg py-3 flex items-center justify-center"
            >
              Request New Reset Link
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Link has already been used (detected client-side via localStorage)
  if (token && isAlreadyUsed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
              Link Already Used
            </h1>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full mx-auto">
              <ShieldCheck className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-dark-600 dark:text-dark-300 text-sm">
                This password reset link has already been used. For security, each link can only be used once.
              </p>
            </div>
            <div className="space-y-3">
              <Link
                to="/forgot-password"
                className="w-full btn-primary text-lg py-3 flex items-center justify-center"
              >
                Request New Reset Link
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
              <Link
                to="/login"
                className="w-full text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors text-sm inline-flex items-center justify-center"
              >
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No token in URL
  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
              Invalid Link
            </h1>
          </div>
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8 text-center space-y-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full mx-auto">
              <AlertTriangle className="w-8 h-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-dark-600 dark:text-dark-300 text-sm">
                This password reset link is invalid or has expired. Please request a new one.
              </p>
            </div>
            <Link
              to="/forgot-password"
              className="w-full btn-primary text-lg py-3 flex items-center justify-center"
            >
              Request New Reset Link
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
            {success ? 'Password Updated' : 'Set New Password'}
          </h1>
          <p className="text-dark-600 dark:text-dark-300">
            {success
              ? 'Your password has been reset successfully'
              : 'Enter your new password below'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
          {success ? (
            /* Success State */
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-dark-600 dark:text-dark-300 text-sm">
                  Your password has been updated. You can now sign in with your new password.
                </p>
              </div>
              <button
                onClick={() => navigate('/login')}
                className="w-full btn-primary text-lg py-3 flex items-center justify-center"
              >
                Sign In
                <ArrowRight className="w-5 h-5 ml-2" />
              </button>
            </div>
          ) : (
            /* Password Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Enter new password"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Confirm new password"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                  {error.includes('expired') && (
                    <Link
                      to="/forgot-password"
                      className="text-primary-600 dark:text-primary-400 hover:underline text-sm mt-1 inline-block"
                    >
                      Request a new reset link
                    </Link>
                  )}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary text-lg py-3 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">&#8987;</span>
                    Resetting...
                  </>
                ) : (
                  <>
                    Set New Password
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-dark-500 dark:text-dark-400 text-sm">
            Remember your password?{' '}
            <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
