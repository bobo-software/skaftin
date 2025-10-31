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
          
          if (response.status === 'success' && response.data) {
            // Handle both direct array and wrapped in 'projects' key
            const projects = Array.isArray(response.data) 
              ? response.data 
              : (response.data.projects || []);
            
            set({ 
              projects: projects.map((p: any) => ({
                id: p.id,
                name: p.name,
                description: p.description,
                schema_name: p.schemaName,
                bucket_name: p.bucketName,
                created_at: p.createdAt,
                updated_at: p.updatedAt,
                user_id: p.userId,
              })), 
              loading: false 
            });
          } else {
            set({ 
              error: response.message || 'Failed to fetch projects', 
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
          
          if (response.status === 'success' && response.data) {
            const projectData = response.data;
            const newProject = {
              id: projectData.id,
              name: projectData.name,
              description: projectData.description,
              schema_name: projectData.schemaName,
              bucket_name: projectData.bucketName,
              created_at: projectData.createdAt,
              updated_at: projectData.updatedAt,
              user_id: projectData.userId,
            };
            
            set(state => ({ 
              projects: [newProject, ...state.projects],
              loading: false 
            }));
            return newProject;
          } else {
            set({ 
              error: response.message || 'Failed to create project', 
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
          
          if (response.status === 'success') {
            set(state => ({
              projects: state.projects.filter(project => project.id !== projectId),
              currentProject: state.currentProject?.id === projectId ? null : state.currentProject,
              loading: false
            }));
            return true;
          } else {
            set({ 
              error: response.message || 'Failed to delete project', 
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

          const tableCount = tablesResponse.status === 'success' 
            ? (Array.isArray(tablesResponse.data) ? tablesResponse.data.length : (tablesResponse.data?.tables?.length || 0))
            : 0;
          const fileCount = filesResponse.status === 'success'
            ? (Array.isArray(filesResponse.data) ? filesResponse.data.length : (filesResponse.data?.files?.length || 0))
            : 0;

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
