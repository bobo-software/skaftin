import { useAppStore, useProjectStore, useOrganizationStore } from "../../../stores/StoresIndex";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ProjectCreationLoadingPage from "./ProjectCreationLoadingPage";
import { Database, FolderOpen, Plus, User, LogOut, Edit3, Trash2, Calendar, Cloud, Code, BarChart3, Activity } from "lucide-react";
import { AppButton, OrganizationSwitcher } from "../../../components/ComponentsIndex";
import CreateProjectModal from "../../../components/modals/CreateProjectModal";
import RequestUtils from "../../../utils/RequestUtils";
import ApiRoutes from "../../../constants/ApiRoutes";

interface ProjectsOverviewPageProps {
  onProjectSelect?: (_project: any) => void;
  onCreateProject?: (_projectData: { name: string; description: string }) => void;
}

const ProjectsOverviewPage = ({ onProjectSelect, onCreateProject }: ProjectsOverviewPageProps) => {
const navigate = useNavigate();
// Store variables
const { user, logout } = useAppStore();
const { 
projects, 
loading: isLoading, 
error, 
fetchProjects, 
createProject,
clearError 
} = useProjectStore();
const { currentOrganization, fetchOrganizations } = useOrganizationStore();

// Filter projects by current organization
const filteredProjects = currentOrganization
  ? projects.filter(project => project.organization_id === currentOrganization.id)
  : projects;

// State variables
const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
const [showLoadingPage, setShowLoadingPage] = useState(false);
const [creatingProject, setCreatingProject] = useState<any>(null);
const [dashboardStats, setDashboardStats] = useState<{
  totalProjects: number;
  totalTables: number;
  totalFiles: number;
  totalApiCalls: number;
} | null>(null);
const [loadingStats, setLoadingStats] = useState(false);

const loadDashboardStats = useCallback(async () => {
  setLoadingStats(true);
  try {
    const token = localStorage.getItem('skaftin-token') || '';
    const response = await RequestUtils.get(ApiRoutes.PROJECTS.DASHBOARD_STATS, token);
    if (response.success && response.data) {
      setDashboardStats(response.data);
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  } finally {
    setLoadingStats(false);
  }
}, []);

const loadUserProjects = useCallback(async () => {
    console.log('Loading projects for user:', user?.id);
    await fetchProjects();
}, [user?.id, fetchProjects]);

useEffect(() => {
  loadUserProjects();
  loadDashboardStats();
  // Load organizations if not already loaded
  fetchOrganizations();
}, [loadUserProjects, loadDashboardStats, fetchOrganizations]);

const handleCreateProject = () => {
setIsCreateModalOpen(true);
};

const handleProjectCreated = (project: any) => {
  console.log('Project created, showing loading page:', project);
  setIsCreateModalOpen(false);
  setCreatingProject(project);
  setShowLoadingPage(true);
  // Refresh stats after project creation
  loadDashboardStats();
};

const handleLoadingComplete = (project: any) => {
  console.log('Loading complete, navigating to project:', project);
  setShowLoadingPage(false);
  setCreatingProject(null);
  
  // Ensure project ID exists before navigating
  if (project && project.id) {
    console.log('Navigating to project ID:', project.id);
    navigate(`/projects/${project.id}`);
  } else {
    console.error('Project ID is missing:', project);
  }
};

const handleLoadingError = (error: string) => {
  console.error('Project creation error:', error);
  setShowLoadingPage(false);
  setCreatingProject(null);
};

const handleProjectSelect = (project: any) => {
onProjectSelect?.(project);
// Navigate to project dashboard
navigate(`/projects/${project.id}`);
};

const handleLogout = async () => {
  const { default: AuthService } = await import('../../../services/AuthService');
  await AuthService.logout();
  logout();
  navigate('/login');
};

// Show loading page during project creation
if (showLoadingPage && creatingProject) {
  return (
    <ProjectCreationLoadingPage
      project={creatingProject}
      onComplete={handleLoadingComplete}
      onError={handleLoadingError}
    />
  );
}

if (isLoading) {
return (
<div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800 flex items-center justify-center">
  <div className="text-center">
    <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl mb-6">
      <Database className="w-8 h-8 text-white animate-pulse" />
    </div>
    <h2 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">
      Loading Projects
    </h2>
    <p className="text-dark-600 dark:text-dark-300">
      Please wait while we fetch your projects...
    </p>
  </div>
</div>
);
}

return (
<div className="min-h-screen min-w-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-dark-900 dark:to-dark-800">
{/* Header */}
<header className="bg-white dark:bg-dark-800 border-b border-dark-200 dark:border-dark-700">
  <div className="max-w-7xl mx-auto px-6 py-4">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
          <Database className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Skaftin</h1>
          <p className="text-sm text-dark-600 dark:text-dark-300">Your Projects</p>
        </div>
        
        {/* Organization Switcher */}
        <div className="ml-4">
          <OrganizationSwitcher />
        </div>
      </div>
      
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 text-dark-600 dark:text-dark-300">
          <User className="w-4 h-4" />
          <span className="text-sm">{user?.email}</span>
        </div>
        <AppButton
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          icon={<LogOut className="w-4 h-4" />}
        >
          Logout
        </AppButton>
      </div>
    </div>
  </div>
</header>

{/* Main Content */}
<main className="max-w-7xl mx-auto px-6 py-8">
  <div className="flex items-center justify-between mb-8">
    <div>
      <h2 className="text-3xl font-bold text-dark-900 dark:text-white mb-2">
        Your Projects
      </h2>
      <p className="text-dark-600 dark:text-dark-300">
        Manage your database projects and storage buckets
      </p>
    </div>
    
    <AppButton
      onClick={handleCreateProject}
      icon={<Plus className="w-5 h-5" />}
      size="lg"
    >
      Create Project
    </AppButton>
  </div>

  {error && (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <button 
          onClick={clearError}
          className="text-red-400 hover:text-red-600"
        >
          ×
        </button>
      </div>
    </div>
  )}

  {/* Dashboard Metrics */}
  {dashboardStats && (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-1">Total Projects</p>
            <p className="text-3xl font-bold text-dark-900 dark:text-white">
              {loadingStats ? (
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                dashboardStats.totalProjects
              )}
            </p>
          </div>
          <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-1">Total Tables</p>
            <p className="text-3xl font-bold text-dark-900 dark:text-white">
              {loadingStats ? (
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                dashboardStats.totalTables
              )}
            </p>
          </div>
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
            <Database className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-1">Total Files</p>
            <p className="text-3xl font-bold text-dark-900 dark:text-white">
              {loadingStats ? (
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                dashboardStats.totalFiles
              )}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
            <Cloud className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-dark-600 dark:text-dark-300 mb-1">API Calls</p>
            <p className="text-3xl font-bold text-dark-900 dark:text-white">
              {loadingStats ? (
                <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                dashboardStats.totalApiCalls.toLocaleString()
              )}
            </p>
          </div>
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
            <Activity className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  )}

  {/* Quick Actions */}
  {filteredProjects.length > 0 && (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-6 mb-8">
      <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Quick Actions</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <AppButton
          onClick={handleCreateProject}
          variant="secondary"
          className="w-full justify-start"
          icon={<Plus className="w-4 h-4" />}
        >
          Create New Project
        </AppButton>
        {filteredProjects.length > 0 && (
          <AppButton
            onClick={() => navigate(`/projects/${filteredProjects[0].id}/analytics`)}
            variant="secondary"
            className="w-full justify-start"
            icon={<BarChart3 className="w-4 h-4" />}
          >
            View Analytics
          </AppButton>
        )}
        {filteredProjects.length > 0 && (
          <AppButton
            onClick={() => navigate(`/projects/${filteredProjects[0].id}/database`)}
            variant="secondary"
            className="w-full justify-start"
            icon={<Code className="w-4 h-4" />}
          >
            Open Database
          </AppButton>
        )}
      </div>
    </div>
  )}

  {/* Projects Grid */}
  {filteredProjects.length === 0 ? (
    <div className="text-center py-16">
      <div className="inline-flex items-center justify-center w-20 h-20 bg-dark-100 dark:bg-dark-800 rounded-2xl mb-6">
        <FolderOpen className="w-10 h-10 text-dark-400 dark:text-dark-500" />
      </div>
      <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">
        No Projects Yet
      </h3>
      <p className="text-dark-600 dark:text-dark-300 mb-8 max-w-md mx-auto">
        {currentOrganization 
          ? `Create your first project in ${currentOrganization.name} to start building your database and storage solution.`
          : 'Create your first project to start building your database and storage solution.'}
      </p>
      <AppButton
        onClick={handleCreateProject}
        icon={<Plus className="w-5 h-5" />}
        size="lg"
      >
        Create Your First Project
      </AppButton>
    </div>
  ) : (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredProjects.map((project) => (
        <div
          key={project.id}
          className="bg-white dark:bg-dark-800 rounded-xl shadow-lg border border-dark-200 dark:border-dark-700 p-6 hover:shadow-xl transition-all duration-200 cursor-pointer group"
          onClick={() => handleProjectSelect(project)}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-lg flex items-center justify-center">
                <Database className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-dark-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                  {project.name}
                </h3>
                <p className="text-sm text-dark-500 dark:text-dark-400">
                  {project.schema_name}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-700">
                <Edit3 className="w-4 h-4 text-dark-400" />
              </button>
              <button className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/20">
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>
            </div>
          </div>
          
          {project.description && (
            <p className="text-dark-600 dark:text-dark-300 text-sm mb-4 line-clamp-2">
              {project.description}
            </p>
          )}
          
          <div className="flex items-center justify-between text-sm text-dark-500 dark:text-dark-400">
            <div className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>
                {new Date(project.created_at).toLocaleDateString()}
              </span>
            </div>
            
            <div className="flex items-center space-x-1 text-primary-600 dark:text-primary-400">
              <span>Open</span>
              <Database className="w-4 h-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )}
</main>

{/* Create Project Modal */}
<CreateProjectModal
  isOpen={isCreateModalOpen}
  onClose={() => setIsCreateModalOpen(false)}
  onSuccess={handleProjectCreated}
/>
</div>
);
};

export default ProjectsOverviewPage;
