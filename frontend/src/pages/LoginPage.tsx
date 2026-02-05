import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Database, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAppStore } from '../stores/StoresIndex';
import { signIn, signUp, redirectToThirdPartyLogin } from '../config/supertokens';
import OrganizationService from '../services/OrganizationService';

// Google icon SVG component
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// GitHub icon SVG component
const GitHubIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
  </svg>
);

const LoginPage = () => {
  const { setUser, setLoading, isLoading } = useAppStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  // Check for redirect parameters and OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const redirect = params.get('redirect');
    if (redirect) {
      sessionStorage.setItem('redirectAfterLogin', redirect);
    }

    // Handle OAuth callback - check if user is now logged in after returning from OAuth
    const checkOAuthCallback = async () => {
      // Check if we're returning from OAuth (SuperTokens handles the token exchange)
      const apiUrl = import.meta.env.VITE_API_URL || '';
      try {
        const response = await fetch(`${apiUrl}/api/users/me`, {
          credentials: 'include',
        });
        
        if (response.ok) {
          const userData = await response.json();
          if (userData.success && userData.data?.user) {
            // User is logged in via OAuth, redirect them
            setUser({
              ...userData.data.user,
              roles: userData.data.user.roles || [],
            });
            
            const redirectTo = sessionStorage.getItem('redirectAfterLogin');
            if (redirectTo) {
              sessionStorage.removeItem('redirectAfterLogin');
              navigate(redirectTo);
            } else {
              // Check organizations and redirect
              const orgResult = await OrganizationService.getUserOrganizations();
              if (orgResult.success && orgResult.organizations) {
                if (orgResult.organizations.length > 1) {
                  navigate('/organizations/select');
                } else if (orgResult.organizations.length === 1) {
                  navigate('/projects');
                } else {
                  navigate('/organizations/create');
                }
              } else {
                navigate('/organizations/create');
              }
            }
          }
        }
      } catch (err) {
        // Not logged in, that's fine - user needs to log in
      }
    };

    checkOAuthCallback();
  }, [location, navigate, setUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate password confirmation for registration
    if (!isLogin && formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      // Use SuperTokens signIn/signUp methods directly
      // This uses HTTP-only cookies automatically - no localStorage tokens!
      const response = isLogin 
        ? await signIn({ formFields: [
            { id: 'email', value: formData.email },
            { id: 'password', value: formData.password }
          ]})
        : await signUp({ formFields: [
            { id: 'email', value: formData.email },
            { id: 'password', value: formData.password }
          ]});

      if (response.status === 'OK') {
        // Fetch user data from our API to get full user info including roles
        const apiUrl = import.meta.env.VITE_API_URL || '';
        const userResponse = await fetch(`${apiUrl}/api/users/me`, {
          credentials: 'include',
        });

        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.success && userData.data?.user) {
            setUser({
              ...userData.data.user,
              roles: userData.data.user.roles || [],
            });
          }
        }
        
        // Check for redirect from invite or location state
        const redirectTo = (location.state as any)?.redirectTo || sessionStorage.getItem('redirectAfterLogin');
        
        if (redirectTo) {
          sessionStorage.removeItem('redirectAfterLogin');
          navigate(redirectTo);
        } else {
          // Check if user has organizations
          const orgResult = await OrganizationService.getUserOrganizations();
          
          if (orgResult.success && orgResult.organizations) {
            if (orgResult.organizations.length > 1) {
              // User has multiple organizations, let them choose
              navigate('/organizations/select');
            } else if (orgResult.organizations.length === 1) {
              // User has exactly one organization, go directly to projects
              navigate('/projects');
            } else {
              // User doesn't have organizations, redirect to create organization
              navigate('/organizations/create');
            }
          } else {
            // Error fetching organizations or no organizations
            navigate('/organizations/create');
          }
        }
      } else if (response.status === 'FIELD_ERROR') {
        // Handle field-specific errors from SuperTokens
        const fieldError = response.formFields?.find((f: any) => f.error);
        setError(fieldError?.error || 'Invalid input');
      } else if (response.status === 'WRONG_CREDENTIALS_ERROR') {
        setError('Invalid email or password');
      } else if (response.status === 'SIGN_UP_NOT_ALLOWED') {
        setError('An account with this email already exists');
      } else {
        setError('An error occurred. Please try again.');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Auth error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
            Welcome to Skaftin
          </h1>
          <p className="text-dark-600 dark:text-dark-300">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </p>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-10 pr-12 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                  placeholder="Enter your password"
                  required
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

            {/* Confirm Password (Register only) */}
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-dark-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full pl-10 pr-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white placeholder-dark-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                    placeholder="Confirm your password"
                    required
                  />
                </div>
              </div>
            )}

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
                  <span className="animate-spin mr-2">⏳</span>
                  {isLogin ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-dark-200 dark:border-dark-700"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white dark:bg-dark-800 text-dark-500 dark:text-dark-400">
                Or continue with
              </span>
            </div>
          </div>

          {/* OAuth Buttons */}
          <div className="space-y-3">
            {/* Google Sign In */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await redirectToThirdPartyLogin({
                    thirdPartyId: 'google',
                  });
                } catch (err) {
                  console.error('Google login error:', err);
                  setError('Failed to initiate Google login');
                }
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 hover:bg-dark-50 dark:hover:bg-dark-600 text-dark-700 dark:text-dark-200 font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* GitHub Sign In */}
            <button
              type="button"
              onClick={async () => {
                try {
                  await redirectToThirdPartyLogin({
                    thirdPartyId: 'github',
                  });
                } catch (err) {
                  console.error('GitHub login error:', err);
                  setError('Failed to initiate GitHub login');
                }
              }}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-dark-200 dark:border-dark-700 rounded-lg bg-dark-900 dark:bg-dark-900 hover:bg-dark-800 dark:hover:bg-dark-800 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <GitHubIcon />
              Continue with GitHub
            </button>
          </div>

          {/* Toggle Login/Register */}
          <div className="mt-6 text-center">
            <p className="text-dark-600 dark:text-dark-300">
              {isLogin ? "Don't have an account?" : "Already have an account?"}
            </p>
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setFormData({ email: '', password: '', confirmPassword: '' });
              }}
              className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
            >
              {isLogin ? 'Create an account' : 'Sign in instead'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-8">
          <p className="text-dark-500 dark:text-dark-400 text-sm">
            By continuing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
