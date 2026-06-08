import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
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

const pageTransition = {
  initial: { opacity: 0, y: 18, scale: 0.995, filter: 'blur(3px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: { duration: 0.38, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -18,
    scale: 1.005,
    filter: 'blur(3px)',
    transition: { duration: 0.24, ease: 'easeIn' as const },
  },
};

const AnimatedPage = ({ children }: { children: ReactNode }) => (
  <motion.div
    variants={pageTransition}
    initial="initial"
    animate="animate"
    exit="exit"
    className="min-h-screen"
  >
    {children}
  </motion.div>
);

const StaticPage = ({ children }: { children: ReactNode }) => (
  <div className="min-h-screen">{children}</div>
);

function AppRoutes() {
  const location = useLocation();

  const parts = location.pathname.split('/');
  const routeKey = parts[1] === 'projects' && parts[2]
    ? `${parts[1]}/${parts[2]}`
    : location.pathname;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <Routes location={location} key={routeKey}>
        <Route path="/" element={<AnimatedPage><HomePage /></AnimatedPage>} />
        <Route path="/auth/*" element={<AnimatedPage><LoginPage /></AnimatedPage>} />
        <Route path="/login" element={<AnimatedPage><LoginPage /></AnimatedPage>} />
        <Route path="/forgot-password" element={<AnimatedPage><ForgotPasswordPage /></AnimatedPage>} />
        <Route path="/auth/reset-password" element={<AnimatedPage><ResetPasswordPage /></AnimatedPage>} />
        {/* OAuth callback routes for Google, GitHub, Apple */}
        <Route path="/auth/callback/:providerId" element={<AnimatedPage><AuthCallbackPage /></AnimatedPage>} />
        <Route path="/invite/:inviteCode" element={<AnimatedPage><InviteAcceptPage /></AnimatedPage>} />
        <Route path="/invite/:inviteCode/register" element={<AnimatedPage><InviteRegisterPage /></AnimatedPage>} />
        <Route
          path="/organizations/select"
          element={
            <StaticPage>
              <ProtectedRoute>
                <SelectOrganizationPage />
              </ProtectedRoute>
            </StaticPage>
          }
        />
        <Route
          path="/organizations/create"
          element={
            <StaticPage>
              <ProtectedRoute>
                <CreateOrganizationPage />
              </ProtectedRoute>
            </StaticPage>
          }
        />
        <Route
          path="/organizations/settings"
          element={
            <StaticPage>
              <ProtectedRoute>
                <OrganizationSettingsPage />
              </ProtectedRoute>
            </StaticPage>
          }
        />
        <Route
          path="/projects"
          element={
            <StaticPage>
              <ProtectedRoute>
                <ProjectsOverviewPage />
              </ProtectedRoute>
            </StaticPage>
          }
        />
        <Route
          path="/projects/:projectId/*"
          element={
            <StaticPage>
              <ProtectedRoute>
                <ProjectDashboardPage />
              </ProtectedRoute>
            </StaticPage>
          }
        />
        <Route
          path="/profile"
          element={
            <StaticPage>
              <ProtectedRoute>
                <UserProfile />
              </ProtectedRoute>
            </StaticPage>
          }
        />
        <Route path="/payments/return" element={<StaticPage><PaymentReturnPage /></StaticPage>} />
        <Route path="/payments/cancel" element={<StaticPage><PaymentCancelPage /></StaticPage>} />
        <Route path="/thankyou/:reference" element={<StaticPage><FNBThankYouPage /></StaticPage>} />
      </Routes>
    </AnimatePresence>
  );
}

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
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
