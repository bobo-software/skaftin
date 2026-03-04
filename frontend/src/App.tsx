import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectsOverviewPage from './pages/user/projects/ProjectsOverviewPage';
import ProjectDashboardPage from './pages/user/dashboard/ProjectDashboardPage';
import CreateOrganizationPage from './pages/user/organizations/CreateOrganizationPage';
import SelectOrganizationPage from './pages/user/organizations/SelectOrganizationPage';
import OrganizationSettingsPage from './pages/user/organizations/OrganizationSettingsPage';
import InviteAcceptPage from './pages/public/InviteAcceptPage';
import InviteRegisterPage from './pages/public/InviteRegisterPage';
import UserProfile from './pages/user/dashboard/settings/UserProfile';
import PaymentReturnPage from './pages/payments/PaymentReturnPage';
import PaymentCancelPage from './pages/payments/PaymentCancelPage';
import FNBThankYouPage from './pages/payments/FNBThankYouPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { useAppStore } from './stores/StoresIndex';
import { bootstrapAuth } from './services/AuthFlowService';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';

// SuperTokens is now initialized in main.tsx with SuperTokensWrapper
// This provides automatic session refresh - no manual refresh needed!

function App() {
  const { setUser, setLoading } = useAppStore();

  // Check for existing session on mount
  // SuperTokens React SDK handles automatic session refresh via SuperTokensWrapper
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        const bootstrap = await bootstrapAuth({ preloadOrganizations: true });
        setUser(bootstrap.user);
      } catch (error) {
        console.error('Session check error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [setUser, setLoading]);

  // Note: Manual session refresh removed - SuperTokens React SDK handles this automatically
  // via the SuperTokensWrapper in main.tsx. The SDK intercepts API calls and refreshes
  // tokens when needed.

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          // Default options
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          // Success
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          // Error
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth/*" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/auth/reset-password" element={<ResetPasswordPage />} />
        {/* OAuth callback routes for Google, GitHub, Apple */}
        <Route path="/auth/callback/:providerId" element={<AuthCallbackPage />} />
        <Route path="/invite/:inviteCode" element={<InviteAcceptPage />} />
        <Route path="/invite/:inviteCode/register" element={<InviteRegisterPage />} />
        <Route
          path="/organizations/select"
          element={
            <ProtectedRoute>
              <SelectOrganizationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizations/create"
          element={
            <ProtectedRoute>
              <CreateOrganizationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/organizations/settings"
          element={
            <ProtectedRoute>
              <OrganizationSettingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <ProjectsOverviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:projectId/*"
          element={
            <ProtectedRoute>
              <ProjectDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <UserProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payments/return"
          element={<PaymentReturnPage />}
        />
        <Route
          path="/payments/cancel"
          element={<PaymentCancelPage />}
        />
        <Route
          path="/thankyou/:reference"
          element={<FNBThankYouPage />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
