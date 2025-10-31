import { useState, useEffect } from 'react';
import { useNavigate, useParams, Routes, Route, NavLink } from 'react-router-dom';
import {
  Database,
  Cloud,
  Settings,
  LogOut,
  Moon,
  Sun,
  ArrowLeft,
  Menu,
  X,
  Table,
  FileText,
  Code,
  Layers,
} from 'lucide-react';
import { useAppStore } from '../stores/state/StoresIndex';
import AuthService from '../services/AuthService';
import RequestUtils from '../utils/RequestUtils';
import ApiRoutes from '../constants/ApiRoutes';

import DatabaseTab from '../components/database/DatabaseTab';
import StorageTab from '../components/storage/StorageTab';

const SettingsTab = () => (
  <div className="p-6">
    <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-4">Settings</h2>
    <p className="text-dark-600 dark:text-dark-400">Project settings coming soon...</p>
  </div>
);

const ProjectDashboardPage = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { user, setCurrentProject, currentProject, theme, setTheme, logout, sidebarOpen, toggleSidebar } = useAppStore();
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
      // Get project info from projects list or fetch directly
      const result = await RequestUtils.get(ApiRoutes.PROJECTS.GET(projectId));
      
      if (result.success && result.data) {
        setCurrentProject(result.data);
      } else {
        // If direct fetch fails, try to get from projects list
        const projectsResult = await RequestUtils.get(ApiRoutes.PROJECTS.LIST);
        if (projectsResult.success && projectsResult.data) {
          const project = (projectsResult.data as any[]).find((p: any) => p.id.toString() === projectId);
          if (project) {
            setCurrentProject(project);
          } else {
            setError('Project not found');
          }
        } else {
          setError('Failed to load project');
        }
      }
    } catch (err) {
      setError('Failed to load project');
      console.error('Fetch project error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    AuthService.logout();
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: 'database', icon: Database, label: 'Database' },
    { path: 'storage', icon: Cloud, label: 'Storage' },
    { path: 'settings', icon: Settings, label: 'Settings' },
  ];

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
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-4">Project Not Found</h2>
          <p className="text-dark-600 dark:text-dark-400 mb-6">{error || 'The project you\'re looking for doesn\'t exist.'}</p>
          <button
            onClick={() => navigate('/projects')}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Projects</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900 flex">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } fixed lg:static lg:translate-x-0 w-64 bg-white dark:bg-dark-800 border-r border-dark-200 dark:border-dark-700 z-40 transition-transform duration-300 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-dark-200 dark:border-dark-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold text-dark-900 dark:text-white">Skaftin</span>
              </div>
              <button
                onClick={toggleSidebar}
                className="lg:hidden p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
              >
                <X className="w-5 h-5 text-dark-600 dark:text-dark-400" />
              </button>
            </div>
            <div className="mt-4">
              <button
                onClick={() => navigate('/projects')}
                className="flex items-center space-x-2 text-sm text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Projects</span>
              </button>
            </div>
          </div>

          {/* Project Info */}
          <div className="p-4 border-b border-dark-200 dark:border-dark-700">
            <h2 className="text-lg font-semibold text-dark-900 dark:text-white mb-1 truncate">
              {currentProject.name}
            </h2>
            {currentProject.description && (
              <p className="text-sm text-dark-600 dark:text-dark-400 line-clamp-2">
                {currentProject.description}
              </p>
            )}
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === 'database'}
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-600 text-white'
                        : 'text-dark-600 dark:text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700 hover:text-dark-900 dark:hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Sidebar Footer */}
          <div className="p-4 border-t border-dark-200 dark:border-dark-700 space-y-2">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-sm text-dark-600 dark:text-dark-400">{user.name || user.email}</span>
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
                title="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={toggleSidebar}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 sticky top-0 z-20">
          <div className="px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <button
              onClick={toggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700"
            >
              <Menu className="w-5 h-5 text-dark-600 dark:text-dark-400" />
            </button>
            <div className="flex-1" />
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="database" element={<DatabaseTab />} />
            <Route path="storage" element={<StorageTab />} />
            <Route path="settings" element={<SettingsTab />} />
            <Route path="*" element={<DatabaseTab />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

export default ProjectDashboardPage;

