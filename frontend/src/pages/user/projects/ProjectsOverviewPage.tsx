import { useAppStore, useProjectStore, useOrganizationStore } from "../../../stores/StoresIndex";
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import ProjectCreationLoadingPage from "./ProjectCreationLoadingPage";
import { Database, FolderOpen, Plus, Users } from "lucide-react";
import { AppButton, AppText, OrganizationSwitcher, DashboardStatItems, ProjectTileItem } from "../../../components/ComponentsIndex";
import CreateProjectModal from "../../../components/modals/CreateProjectModal";
import AccountDropdown from "../../../components/dashboard/AccountDropdown";
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

// Split into owned and invited projects
const ownedProjects = filteredProjects.filter(project => project.user_id === user?.id);
const invitedProjects = filteredProjects.filter(project => project.user_id !== user?.id);

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
          <AppText
            as="h1"
            size="sm"
            color="primary"
            className="text-dark-900 dark:text-white"
          >
            Your Projects
          </AppText>
        </div>
        
        {/* Organization Switcher */}
        <div className="ml-4">
          <OrganizationSwitcher />
        </div>
      </div>
      
      <AccountDropdown onLogout={logout} />
    </div>
  </div>
</header>

{/* Main Content */}
<main className="max-w-7xl mx-auto px-6 py-8">
  <div className="flex items-center justify-between mb-8">
    <div>
      <AppText as="h2" size="2xl" weight="bold" color="default">
        Your Projects
      </AppText>
      <AppText as="p" size="sm" color="muted">
        Manage your database projects and storage buckets
      </AppText>
    </div>
    <AppButton size="md" variant="primary" onClick={handleCreateProject} icon={<Plus className="w-5 h-5" />}>
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
    <DashboardStatItems stats={dashboardStats} loading={loadingStats} />
  )}

  {/* Projects Grid */}

    <div className="space-y-5">
      {/* Owned Projects */}
            <AppText as="h3" size="lg" weight="semibold" color="default" className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary-400" />
              My Projects
            </AppText>
      {ownedProjects.length > 0 ? (
        <div>
          <div className="mb-4">
            <AppText as="p" size="sm" color="muted" className="mt-1">
              Projects you own and manage
            </AppText>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ownedProjects.map((project) => (
              <ProjectTileItem
                key={project.id}
                project={project}
                onClick={handleProjectSelect}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col justify-center items-center text-center">
          <AppText as="p" size="sm" color="muted" className="mt-1">
            You don't have any of your own projects yet.
          </AppText>
        </div>
      )}

     
        <div>
          <div className="mb-4">
            <AppText as="h3" size="lg" weight="semibold" color="default" className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary-400" />
              Invited Projects
            </AppText>
            <AppText as="p" size="sm" color="muted" className="mt-1">
              Projects you've been invited to collaborate on
            </AppText>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {invitedProjects.map((project) => (
              <ProjectTileItem
                key={project.id}
                project={project}
                onClick={handleProjectSelect}
              />
            ))}
          </div>
        </div>
    
    </div>
  
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
