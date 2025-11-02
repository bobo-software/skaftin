import { useState, useEffect } from 'react';
import { useNavigate, useParams, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore, useProjectStore } from '../../../stores/StoresIndex';
import ProjectSidebar from '../../../components/dashboard/ProjectSidebar';
import DashboardNavbar from '../../../components/dashboard/DashboardNavbar';

import ProjectDatabaseTab from './database/ProjectDatabaseTab';
import ProjectStorageTab from './storage/ProjectStoageTab';
import ProjectOverviewTab from './overview/ProjectOverviewTab';
import ProjectSettingsTab from './settings/ProjectSettingsTab';

const ProjectDashboardPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user, theme, setTheme, logout, sidebarOpen, toggleSidebar } = useAppStore();
  const { currentProject, setCurrentProject, fetchProjects } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    if (projectId) {
      fetchProject();
    }
  }, [projectId, user, navigate]);

  const fetchProject = async () => {
    if (!projectId) return;

    setLoading(true);
    setError('');

    try {
      // Fetch projects list first to populate store
      await fetchProjects();
      
      // Try to find project in the store after fetching
      const { projects } = useProjectStore.getState();
      const project = projects.find(p => p.id === projectId);
      
      if (project) {
        setCurrentProject(project);
      } else {
        setError('Project not found');
      }
    } catch (err) {
      setError('Failed to load project');
      console.error('Fetch project error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-dark-600 dark:text-dark-400">Loading project...</p>
        </div>
      </div>
    );
  }

  if (error || !currentProject) {
    return (
      <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
            {error || 'Project Not Found'}
          </h2>
          <p className="text-dark-600 dark:text-dark-400 mb-6">
            The project you're looking for doesn't exist or you don't have access to it.
          </p>
          <button
            onClick={() => navigate('/projects')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900">
      {/* Sidebar Component */}
      <ProjectSidebar
        projectName={currentProject.name}
        projectDescription={currentProject.description}
        isOpen={sidebarOpen}
      />

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Main Content - Add left padding to account for collapsed sidebar */}
      <main className="flex flex-col min-w-0 min-h-screen lg:pl-16">
        {/* Navbar Component */}
        <DashboardNavbar
          projectName={currentProject.name}
          theme={theme}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={toggleSidebar}
          onToggleTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onLogout={logout}
        />

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto p-2">
          <Routes>
            <Route index element={projectId ? <ProjectOverviewTab /> : null} />
            <Route path="overview" element={projectId ? <ProjectOverviewTab /> : null} />
            <Route path="database" element={projectId ? <ProjectDatabaseTab projectId={projectId} /> : null} />
            <Route path="storage" element={projectId ? <ProjectStorageTab /> : null} />
            <Route path="settings" element={projectId ? <ProjectSettingsTab /> : null} />
            <Route path="*" element={projectId ? <Navigate to="" replace /> : null} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default ProjectDashboardPage;
