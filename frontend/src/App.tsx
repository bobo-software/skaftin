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
import { useAppStore } from './stores/StoresIndex';
import { initSuperTokensFrontend, Session } from './config/supertokens';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';

// Initialize SuperTokens
initSuperTokensFrontend();

function App() {
  const { setUser, setLoading, user } = useAppStore();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        
        const sessionExists = await Session.doesSessionExist();
        
        if (sessionExists) {
          const apiUrl = import.meta.env.VITE_API_URL || '';
          const response = await fetch(`${apiUrl}/api/users/me`, {
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              // Include roles if provided by the API
              const userData = {
                ...data.data.user,
                roles: data.data.user.roles || [],
              };
              setUser(userData);
            }
          }
        }
      } catch (error) {
        console.error('Session check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, [setUser, setLoading]);

  // Automatic session refresh - runs every 30 minutes to keep session alive
  // This ensures tokens are refreshed before they expire, even if user is inactive
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout | null = null;
    
    const refreshSession = async () => {
      try {
        const sessionExists = await Session.doesSessionExist();
        
        if (sessionExists) {
          // Use SuperTokens' built-in refresh method
          // This automatically handles token refresh via cookies
          try {
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiUrl}/auth/session/refresh`, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
            });

            if (response.ok) {
              console.log('✅ Session refreshed successfully');
            } else if (response.status === 401) {
              // Session is invalid or refresh token expired
              console.log('⚠️ Session expired, user needs to log in again');
              const stillExists = await Session.doesSessionExist();
              if (!stillExists) {
                setUser(null);
              }
            }
          } catch (fetchError) {
            console.error('❌ Session refresh request failed:', fetchError);
          }
        }
      } catch (error) {
        console.error('❌ Session refresh error:', error);
        // Check if session still exists after error
        try {
          const stillExists = await Session.doesSessionExist();
          if (!stillExists) {
            setUser(null);
          }
        } catch {
          // If we can't check, assume session is invalid
          setUser(null);
        }
      }
    };

    // Only set up refresh if user is logged in
    if (user) {
      // Refresh session immediately to ensure it's fresh
      refreshSession();
      
      // Set up interval to refresh every 30 minutes (1800000ms)
      // Access tokens now last 24 hours, so refreshing every 30 min keeps them fresh
      // This ensures sessions stay active even during idle periods
      refreshInterval = setInterval(refreshSession, 30 * 60 * 1000);
    }

    // Cleanup interval on unmount or when user logs out
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [user, setUser]);

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
        <Route path="/login" element={<LoginPage />} />
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
