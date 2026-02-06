import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Loader2 } from 'lucide-react';
import ThirdParty from 'supertokens-auth-react/recipe/thirdparty';
import { useAppStore } from '../stores/StoresIndex';
import OrganizationService from '../services/OrganizationService';

/**
 * OAuth Callback Page
 * 
 * This page handles the redirect from OAuth providers (Google, GitHub, Apple).
 * SuperTokens redirects the user here after they authenticate with the provider.
 * 
 * The page:
 * 1. Extracts the authorization code from the URL
 * 2. Calls SuperTokens to exchange the code for session tokens
 * 3. Fetches user data and redirects to the appropriate page
 */
const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { setUser } = useAppStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // SuperTokens ThirdParty.signInAndUp handles the OAuth code exchange
        // It reads the code and state from the URL automatically
        const response = await ThirdParty.signInAndUp();

        if (response.status === 'OK') {
          // Successfully signed in - fetch user data
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

          // Check for stored redirect
          const redirectTo = sessionStorage.getItem('redirectAfterLogin');
          if (redirectTo) {
            sessionStorage.removeItem('redirectAfterLogin');
            navigate(redirectTo);
            return;
          }

          // Check organizations and redirect appropriately
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
        } else if (response.status === 'NO_EMAIL_GIVEN_BY_PROVIDER') {
          setError('The OAuth provider did not share your email address. Please try a different login method.');
        } else if (response.status === 'SIGN_IN_UP_NOT_ALLOWED') {
          setError('Sign in is not allowed. Please contact support.');
        } else {
          setError('Authentication failed. Please try again.');
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('An error occurred during authentication. Please try again.');
      }
    };

    handleOAuthCallback();
  }, [navigate, setUser]);

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-500 to-red-600 rounded-2xl mb-4">
              <Database className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
              Authentication Error
            </h1>
          </div>
          
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl p-8">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <p className="text-red-600 dark:text-red-400">{error}</p>
            </div>
            
            <button
              onClick={() => navigate('/login')}
              className="w-full btn-primary text-lg py-3"
            >
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-4">
            <Database className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-4">
            Completing Sign In...
          </h1>
          <div className="flex items-center justify-center gap-2 text-dark-600 dark:text-dark-300">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Please wait while we complete your authentication</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthCallbackPage;
