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
  
  // Wait for session check to complete before redirecting
  if (isLoading) {
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
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

function App() {
  const { setUser, setLoading } = useAppStore();

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        setLoading(true);
        
        const sessionExists = await Session.doesSessionExist();
        
        if (sessionExists) {
          const response = await fetch('/api/users/me', {
            credentials: 'include',
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.success && data.data) {
              setUser(data.data.user);
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
