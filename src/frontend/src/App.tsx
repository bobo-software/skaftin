import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectsOverviewPage from './pages/user/projects/ProjectsOverviewPage';
import ProjectCreationLoadingPage from './pages/user/projects/ProjectCreationLoadingPage';
import DashboardPage from './pages/user/dashboard/DashboardPage';
import AuthService from './services/AuthService';
import { ROUTES } from './utils/navigation';
import './index.css';
import { useAppStore, useProjectStore, useRealtimeStore } from './stores/StoresIndex';


// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    AuthService.isAuthenticated().then(setIsAuth);
  }, []);

  if (isAuth === null) {
    // Loading state
    return null;
  }

  if (!isAuth) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

// Public Route Component (redirects to projects if already authenticated)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const [isAuth, setIsAuth] = useState<boolean | null>(null);

  useEffect(() => {
    AuthService.isAuthenticated().then(setIsAuth);
  }, []);

  if (isAuth === null) {
    // Loading state
    return null;
  }

  if (isAuth) {
    return <Navigate to={ROUTES.PROJECTS} replace />;
  }

  return <>{children}</>;
};

// App Routes Component
const AppRoutes = () => {
  const { setCurrentProject } = useProjectStore();
  const navigate = useNavigate();

  return (
    <Routes>
      {/* Public Routes */}
      <Route path={ROUTES.HOME} element={ <PublicRoute> <HomePage onGetStarted={() => navigate(ROUTES.LOGIN)} /> </PublicRoute>} />
      <Route path={ROUTES.LOGIN}  element={<PublicRoute> <LoginPage onSuccess={() => navigate(ROUTES.PROJECTS)} /></PublicRoute>} />

      {/* Protected Routes */}
      <Route 
        path={ROUTES.PROJECTS} 
        element={
          <ProtectedRoute>
            <ProjectsOverviewPage 
              onProjectSelect={(project) => {
                setCurrentProject(project);
                navigate(ROUTES.DASHBOARD);
              }}
              onCreateProject={(projectData) => {
                // Store project data in sessionStorage for the loading page
                sessionStorage.setItem('projectCreationData', JSON.stringify(projectData));
                navigate(ROUTES.CREATE_PROJECT);
              }}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path={ROUTES.CREATE_PROJECT} 
        element={
          <ProtectedRoute>
            <ProjectCreationLoadingPage
              projectName={(() => {
                const data = sessionStorage.getItem('projectCreationData');
                return data ? JSON.parse(data).name : '';
              })()}
              onComplete={(project) => {
                setCurrentProject(project);
                navigate(ROUTES.DASHBOARD);
              }}
              onError={(error) => {
                console.error('Project creation error:', error);
                navigate(ROUTES.PROJECTS);
              }}
            />
          </ProtectedRoute>
        } 
      />
      <Route 
        path={ROUTES.DASHBOARD} 
        element={
          <ProtectedRoute>
            <DashboardPage onBackToProjects={() => navigate(ROUTES.PROJECTS)} />
          </ProtectedRoute>
        } 
      />

      {/* Catch all route */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  );
};

function App() {
  // Stores
  const { theme, setTheme, setUser } = useAppStore();
  const { initialize: initializeRealtime } = useRealtimeStore();

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('skaftin-theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme(savedTheme);
    } else {
      // Default to light theme
      setTheme('light');
    }

    // Check for existing SuperTokens session
    AuthService.isAuthenticated().then(isAuth => {
      if (isAuth) {
        // User is authenticated, session is managed by SuperTokens
        // You can fetch user info here if needed
      }
    });
  }, [setTheme]);

  useEffect(() => {
    // Initialize real-time updates
    initializeRealtime();
  }, [initializeRealtime]);

  useEffect(() => {
    // Apply theme to document
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <Router>
      <div className="min-h-screen bg-white dark:bg-dark-900 transition-colors duration-300">
        <AppRoutes />
      </div>
    </Router>
  );
}

export default App;