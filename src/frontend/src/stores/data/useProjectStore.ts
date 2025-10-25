import { create } from "zustand";
import { devtools } from "zustand/middleware";
import McpService from "../../services/McpService";

interface Project {
  id: string;
  name: string;
  description?: string;
  schema_name: string;
  bucket_name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

interface ProjectStats {
  tableCount: number;
  fileCount: number;
  apiCalls: number;
}

interface ProjectStoreType {
  // State
  projects: Project[];
  currentProject: Project | null;
  projectStats: ProjectStats | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchProjects: (_userId: string) => Promise<void>;
  createProject: (_userId: string, _name: string, _description?: string) => Promise<Project | null>;
  updateProject: (_projectId: string, _updates: Partial<Project>) => Promise<Project | null>;
  deleteProject: (_projectId: string) => Promise<boolean>;
  setCurrentProject: (_project: Project | null) => void;
  getProjectStats: (_projectId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const useProjectStore = create<ProjectStoreType>()(
  devtools(
    (set, get) => ({
      // Initial state
      projects: [],
      currentProject: null,
      projectStats: null,
      loading: false,
      error: null,

      // Fetch all projects for a user
      fetchProjects: async (userId: string) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.listProjects(userId);
          
          if (response.success && response.result.success) {
            set({ 
              projects: response.result.data || [], 
              loading: false 
            });
          } else {
            set({ 
              error: 'Failed to fetch projects', 
              loading: false 
            });
          }
        } catch (error) {
          console.error('Error fetching projects:', error);
          set({ 
            error: 'Network error while fetching projects', 
            loading: false 
          });
        }
      },

      // Create a new project
      createProject: async (userId: string, name: string, description?: string) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.createProject(userId, name, description);
          
          if (response.success && response.result.success) {
            const newProject = response.result.data;
            set(state => ({ 
              projects: [newProject, ...state.projects],
              loading: false 
            }));
            return newProject;
          } else {
            set({ 
              error: response.error || 'Failed to create project', 
              loading: false 
            });
            return null;
          }
        } catch (error) {
          console.error('Error creating project:', error);
          set({ 
            error: 'Network error while creating project', 
            loading: false 
          });
          return null;
        }
      },

      // Update an existing project
      updateProject: async (projectId: string, updates: Partial<Project>) => {
        set({ loading: true, error: null });
        try {
          // Note: This would need to be implemented in the backend
          // For now, we'll update the local state
          set(state => ({
            projects: state.projects.map(project => 
              project.id === projectId 
                ? { ...project, ...updates, updated_at: new Date().toISOString() }
                : project
            ),
            currentProject: state.currentProject?.id === projectId 
              ? { ...state.currentProject, ...updates, updated_at: new Date().toISOString() }
              : state.currentProject,
            loading: false
          }));
          return get().projects.find(p => p.id === projectId) || null;
        } catch (error) {
          console.error('Error updating project:', error);
          set({ 
            error: 'Failed to update project', 
            loading: false 
          });
          return null;
        }
      },

      // Delete a project
      deleteProject: async (projectId: string) => {
        set({ loading: true, error: null });
        try {
          const response = await McpService.deleteProject(projectId);
          
          if (response.success) {
            set(state => ({
              projects: state.projects.filter(project => project.id !== projectId),
              currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
              loading: false
            }));
            return true;
          } else {
            set({ 
              error: response.error || 'Failed to delete project', 
              loading: false 
            });
            return false;
          }
        } catch (error) {
          console.error('Error deleting project:', error);
          set({ 
            error: 'Network error while deleting project', 
            loading: false 
          });
          return false;
        }
      },

      // Set current project
      setCurrentProject: (project: Project | null) => {
        set({ currentProject: project });
      },

      // Get project statistics
      getProjectStats: async (projectId: string) => {
        set({ loading: true, error: null });
        try {
          // Fetch tables and files in parallel
          const [tablesResponse, filesResponse] = await Promise.all([
            McpService.listTables(projectId),
            McpService.listFiles(projectId)
          ]);

          const tableCount = tablesResponse.success ? (tablesResponse.result?.data?.length || 0) : 0;
          const fileCount = filesResponse.success ? (filesResponse.result?.data?.length || 0) : 0;

          set({ 
            projectStats: {
              tableCount,
              fileCount,
              apiCalls: 0 // TODO: Implement API call tracking
            },
            loading: false 
          });
        } catch (error) {
          console.error('Error fetching project stats:', error);
          set({ 
            error: 'Failed to fetch project statistics', 
            loading: false 
          });
        }
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Reset store
      reset: () => {
        set({
          projects: [],
          currentProject: null,
          projectStats: null,
          loading: false,
          error: null
        });
      }
    }),
    {
      name: 'project-store',
    }
  )
);

export default useProjectStore;
