import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { sendPasswordResetEmail } from '../config/supertokens';
import skaftinLogo from '../assets/skaftinLogo.png';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await sendPasswordResetEmail({
        formFields: [{ id: 'email', value: email }],
      });

      if (response.status === 'OK') {
        setEmailSent(true);
      } else if (response.status === 'FIELD_ERROR') {
        const fieldError = response.formFields?.find((f: { id: string; error: string }) => f.error);
        setError(fieldError?.error || 'Invalid email address');
      } else if (response.status === 'PASSWORD_RESET_NOT_ALLOWED') {
        setError('Password reset is not allowed for this account. You may have signed up with a social provider.');
      } else {
        setError('An error occurred. Please try again.');
      }
    } catch (err) {
      console.error('Password reset error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={skaftinLogo} alt="Skaftin logo" className="w-16 h-16 mx-auto mb-4 rounded-2xl object-contain" />
          <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
            Reset Password
          </h1>
          <p className="text-dark-600 dark:text-dark-300">
            {emailSent
              ? 'Check your email for a reset link'
              : "Enter your email and we'll send you a reset link"}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
          {emailSent ? (
            /* Success State */
            <div className="text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-2">
                  Email Sent
                </h2>
                <p className="text-dark-600 dark:text-dark-300 text-sm">
                  If an account exists for <span className="font-medium text-dark-800 dark:text-dark-200">{email}</span>, you'll receive a password reset link shortly.
                </p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-amber-700 dark:text-amber-400 text-sm">
                  The link will expire in 1 hour. Check your spam folder if you don't see the email.
                </p>
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    setEmailSent(false);
                    setEmail('');
                    setError('');
                  }}
                  className="w-full text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors text-sm"
                >
                  Try a different email
                </button>
                <Link
                  to="/login"
                  className="w-full btn-primary text-lg py-3 flex items-center justify-center"
                >
                  <ArrowLeft className="w-5 h-5 mr-2" />
                  Back to Login
                </Link>
              </div>
            </div>
          ) : (
            /* Email Entry Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Enter your email"
                    required
                  />
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
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
                    Sending...
                  </>
                ) : (
                  <>
                    Send Reset Link
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Back to Login Link (shown on form step only) */}
          {!emailSent && (
            <div className="mt-6 text-center">
              <Link
                to="/login"
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors inline-flex items-center"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Login
              </Link>
            </div>
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

export default ForgotPasswordPage;
