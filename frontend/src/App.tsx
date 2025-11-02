import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectsOverviewPage from './pages/user/projects/ProjectsOverviewPage';
import ProjectDashboardPage from './pages/user/dashboard/ProjectDashboardPage';
import { useAppStore } from './stores/StoresIndex';
import { initSuperTokensFrontend, Session } from './config/supertokens';
import './App.css';

// Initialize SuperTokens
initSuperTokensFrontend();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { user, isLoading } = useAppStore();
  
  console.log('🔒 [ProtectedRoute] Checking authentication...');
  console.log('🔒 [ProtectedRoute] User:', user);
  console.log('🔒 [ProtectedRoute] Is Loading:', isLoading);
  
  // Wait for session check to complete before redirecting
  if (isLoading) {
    console.log('⏳ [ProtectedRoute] Still loading, showing loader...');
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px'
      }}>
        Loading...
      </div>
    );
  }
  
  if (!user) {
    console.log('❌ [ProtectedRoute] No user found, redirecting to login');
    return <Navigate to="/login" replace />;
  }
  
  console.log('✅ [ProtectedRoute] User authenticated, rendering protected content');
  return children;
};

function App() {
  const { setUser, setLoading } = useAppStore();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      console.log('🔍 [Session Check] Starting session check...');
      
      try {
        setLoading(true);
        
        // Check if SuperTokens session exists
        const sessionExists = await Session.doesSessionExist();
        console.log('🔍 [Session Check] SuperTokens session exists:', sessionExists);
        
        // Check cookies manually for debugging
        const cookies = document.cookie;
        console.log('🍪 [Cookies] All cookies:', cookies);
        console.log('🍪 [Cookies] Has sAccessToken:', cookies.includes('sAccessToken'));
        console.log('🍪 [Cookies] Has sRefreshToken:', cookies.includes('sRefreshToken'));
        
        if (sessionExists) {
          console.log('✅ [Session Check] Valid session found, fetching user info...');
          
          // Get user info from backend
          const response = await fetch('/api/users/me', {
            credentials: 'include',
          });
          
          console.log('📡 [API Call] /api/users/me response status:', response.status);
          
          if (response.ok) {
            const data = await response.json();
            console.log('📡 [API Call] /api/users/me response data:', data);
            
            if (data.success && data.data) {
              setUser(data.data.user);
              console.log('✅ [Session Restored] User:', data.data.user.email);
              console.log('✅ [Session Restored] Projects:', data.data.user.projectIds);
            } else {
              console.warn('⚠️ [Session Check] Invalid response format:', data);
            }
          } else {
            console.error('❌ [API Call] Failed with status:', response.status);
            const errorText = await response.text();
            console.error('❌ [API Call] Error:', errorText);
          }
        } else {
          console.log('ℹ️ [Session Check] No active session found');
        }
      } catch (error) {
        console.error('❌ [Session Check] Error:', error);
      } finally {
        setLoading(false);
        console.log('🔍 [Session Check] Session check complete');
      }
    };

    checkSession();
  }, [setUser, setLoading]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
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
      </Routes>
    </BrowserRouter>
  );
}

export default App;
