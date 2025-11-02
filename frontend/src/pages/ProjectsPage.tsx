import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  Plus,
  FolderOpen,
  Calendar,
  LogOut,
  Moon,
  Sun,
  Loader,
} from 'lucide-react';
import { useAppStore } from '../stores/StoresIndex';
import ProjectService from '../services/ProjectService';
import AuthService from '../services/AuthService';

const ProjectsPage = () => {
  const navigate = useNavigate();
  const { user, setUser, setProjects, projects, theme, setTheme, isLoading, setLoading, logout } = useAppStore();
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Fetch projects on mount
  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user]);

  const fetchProjects = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await ProjectService.getUserProjects();
      if (result.success && result.projects) {
        setProjects(result.projects);
      } else {
        setError(result.error || 'Failed to load projects');
      }
    } catch (err) {
      setError('Failed to load projects');
      console.error('Fetch projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    console.log('🚪 [User Action] Logout button clicked');
    await AuthService.logout();
    logout();
    navigate('/login');
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!projectForm.name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const result = await ProjectService.createProject(
        projectForm.name,
        projectForm.description || undefined
      );

      if (result.success && result.project) {
        setProjects([result.project, ...projects]);
        setShowCreateModal(false);
        setProjectForm({ name: '', description: '' });
      } else {
        setError(result.error || 'Failed to create project');
      }
    } catch (err) {
      setError('Failed to create project');
      console.error('Create project error:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-dark-50 dark:bg-dark-900">
      {/* Navigation Header */}
      <nav className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-dark-900 dark:text-white">Skaftin</span>
            </div>

            <div className="flex items-center space-x-3">
              <span className="text-sm text-dark-600 dark:text-dark-300 hidden sm:inline">
                {user.name || user.email}
              </span>
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className="p-2 rounded-lg bg-dark-100 dark:bg-dark-700 hover:bg-dark-200 dark:hover:bg-dark-600 transition-colors"
                title="Toggle theme"
              >
                {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
            My Projects
          </h1>
          <p className="text-dark-600 dark:text-dark-300">
            Manage your projects and applications
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-800 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="mb-6 flex justify-between items-center">
          <div className="text-sm text-dark-600 dark:text-dark-400">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'}
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center space-x-2"
          >
            <Plus className="w-5 h-5" />
            <span>New Project</span>
          </button>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-20">
            <Loader className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}

        {/* Empty State */}
        {!isLoading && projects.length === 0 && (
          <div className="text-center py-20 bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700">
            <FolderOpen className="w-16 h-16 mx-auto mb-4 text-dark-400 dark:text-dark-500" />
            <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
              No projects yet
            </h3>
            <p className="text-dark-600 dark:text-dark-400 mb-6 max-w-md mx-auto">
              Get started by creating your first project. Each project gets its own database schema and file storage.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Create Project</span>
            </button>
          </div>
        )}

        {/* Projects Grid */}
        {!isLoading && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-dark-800 rounded-xl border border-dark-200 dark:border-dark-700 p-6 hover:shadow-lg transition-all duration-300 cursor-pointer group"
                onClick={() => {
                  navigate(`/projects/${project.id}`);
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2 group-hover:text-primary-600 transition-colors">
                  {project.name}
                </h3>
                {project.description && (
                  <p className="text-dark-600 dark:text-dark-400 mb-4 line-clamp-2">
                    {project.description}
                  </p>
                )}
                <div className="flex items-center text-sm text-dark-500 dark:text-dark-400">
                  <Calendar className="w-4 h-4 mr-2" />
                  <span>Created {formatDate(project.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Project Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-4">
              Create New Project
            </h2>
            <form onSubmit={handleCreateProject}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={projectForm.name}
                  onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="My Awesome Project"
                  required
                  autoFocus
                />
              </div>
              <div className="mb-6">
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Description (Optional)
                </label>
                <textarea
                  value={projectForm.description}
                  onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  placeholder="A brief description of your project"
                  rows={3}
                />
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setProjectForm({ name: '', description: '' });
                    setError('');
                  }}
                  className="flex-1 px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                  disabled={isCreating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isCreating}
                >
                  {isCreating ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;

