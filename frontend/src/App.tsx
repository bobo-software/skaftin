import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import ProjectsOverviewPage from './pages/user/projects/ProjectsOverviewPage';
import ProjectDashboardPage from './pages/user/dashboard/ProjectDashboardPage';
import { useAppStore } from './stores/StoresIndex';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactElement }) => {
  const { user } = useAppStore();
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
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
