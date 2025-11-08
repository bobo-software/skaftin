import { create } from "zustand";
import { devtools } from "zustand/middleware";
import RequestUtils from "../../utils/RequestUtils";
import ApiRoutes from "../../constants/ApiRoutes";

interface Project {
  id: string;
  name: string;
  description?: string;
  organization_id?: number;
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
  fetchProjects: () => Promise<void>;
  createProject: (name: string, description?: string, organization_id?: number) => Promise<Project | null>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<Project | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  setCurrentProject: (project: Project | null) => void;
  getProjectById: (projectId: string) => Promise<Project | null>;
  getProjectStats: (projectId: string) => Promise<void>;
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

      // Fetch all projects for the authenticated user
      fetchProjects: async () => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.get(ApiRoutes.PROJECTS.LIST, token);

          if (response.success) {
            set({
              projects: response.data.map((p: any) => ({
                id: p.id.toString(),
                name: p.name,
                description: p.description,
                organization_id: p.organization_id,
                schema_name: p.schema_name,
                bucket_name: p.bucket_name,
                created_at: p.created_at,
                updated_at: p.updated_at,
                user_id: p.user_id.toString(),
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
      createProject: async (name: string, description?: string, organization_id?: number) => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.post( 
            ApiRoutes.PROJECTS.CREATE, 
            token, 
            { name, description, organization_id }
          );

          if (response.success) {
            const projectData = response.data;
            const newProject: Project = {
              id: projectData.id.toString(),
              name: projectData.name,
              description: projectData.description,
              organization_id: projectData.organization_id,
              schema_name: projectData.schema_name,
              bucket_name: projectData.bucket_name,
              created_at: projectData.created_at,
              updated_at: projectData.updated_at,
              user_id: projectData.user_id.toString(),
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

      // Update a project
      updateProject: async (projectId: string, updates: Partial<Project>) => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.put(
            ApiRoutes.PROJECTS.UPDATE(projectId),
            token,
            updates
          );

          if (response.success) {
            const updatedProject = response.data;
            
            set(state => ({
              projects: state.projects.map(p =>
                p.id === projectId
                  ? {
                      ...p,
                      ...updatedProject,
                      id: updatedProject.id.toString(),
                      user_id: updatedProject.user_id.toString(),
                    }
                  : p
              ),
              currentProject: state.currentProject?.id === projectId
                ? {
                    ...state.currentProject,
                    ...updatedProject,
                    id: updatedProject.id.toString(),
                    user_id: updatedProject.user_id.toString(),
                  }
                : state.currentProject,
              loading: false
            }));

            return updatedProject;
          } else {
            set({
              error: response.message || 'Failed to update project',
              loading: false
            });
            return null;
          }
        } catch (error) {
          console.error('Error updating project:', error);
          set({
            error: 'Network error while updating project',
            loading: false
          });
          return null;
        }
      },

      // Delete a project
      deleteProject: async (projectId: string) => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.delete(
            ApiRoutes.PROJECTS.DELETE(projectId),
            token,
            {}
          );

          if (response.success) {
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

      // Get project by ID
      getProjectById: async (projectId: string) => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.get(
            ApiRoutes.PROJECTS.GET(projectId),
            token
          );

          if (response.success) {
            const projectData = response.data;
            const project: Project = {
              id: projectData.id.toString(),
              name: projectData.name,
              description: projectData.description,
              schema_name: projectData.schema_name,
              bucket_name: projectData.bucket_name,
              created_at: projectData.created_at,
              updated_at: projectData.updated_at,
              user_id: projectData.user_id.toString(),
            };

            set({ currentProject: project, loading: false });
            return project;
          } else {
            set({
              error: response.message || 'Failed to fetch project',
              loading: false
            });
            return null;
          }
        } catch (error) {
          console.error('Error fetching project:', error);
          set({
            error: 'Network error while fetching project',
            loading: false
          });
          return null;
        }
      },

      // Get project statistics
      getProjectStats: async (projectId: string) => {
        set({ loading: true, error: null });
        try {
          const token = localStorage.getItem('skaftin-token') || '';
          const response = await RequestUtils.get(
            ApiRoutes.PROJECTS.STATS(projectId),
            token
          );

          if (response.success) {
            set({
              projectStats: {
                tableCount: response.data.tableCount || 0,
                fileCount: response.data.fileCount || 0,
                apiCalls: response.data.apiCalls || 0,
              },
              loading: false
            });
          } else {
            set({
              error: response.message || 'Failed to fetch project statistics',
              loading: false
            });
          }
        } catch (error) {
          console.error('Error fetching project stats:', error);
          set({
            error: 'Failed to fetch project statistics',
            loading: false
          });
        }
      },

      // Set current project
      setCurrentProject: (project: Project | null) => {
        set({ currentProject: project });
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
          error: null,
        });
      },
    }),
    {
      name: 'project-store',
    }
  )
);

export default useProjectStore;
