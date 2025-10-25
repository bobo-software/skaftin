import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  schema_name: string;
  bucket_name: string;
  created_at: string;
  updated_at: string;
}

interface AppState {
  // User state
  user: User | null;
  isAuthenticated: boolean;
  
  // Projects state
  projects: Project[];
  currentProject: Project | null;
  
  // UI state
  isLoading: boolean;
  theme: 'light' | 'dark';
  sidebarOpen: boolean;
  
  // Actions
  setUser: (user: User | null) => void;
  setProjects: (projects: Project[]) => void;
  setCurrentProject: (project: Project | null) => void;
  setLoading: (loading: boolean) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  toggleSidebar: () => void;
  logout: () => void;
}

const useAppStore = create<AppState>()(
  devtools(
    (set) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      projects: [],
      currentProject: null,
      isLoading: false,
      theme: 'light',
      sidebarOpen: false,
      
      // Actions
      setUser: (user) => set({ 
        user, 
        isAuthenticated: !!user 
      }),
      
      setProjects: (projects) => set({ projects }),
      
      setCurrentProject: (project) => set({ currentProject: project }),
      
      setLoading: (loading) => set({ isLoading: loading }),
      
      setTheme: (theme) => {
        set({ theme });
        localStorage.setItem('skaftin-theme', theme);
        document.documentElement.classList.toggle('dark', theme === 'dark');
      },
      
      toggleSidebar: () => set((state) => ({ 
        sidebarOpen: !state.sidebarOpen 
      })),
      
      logout: () => set({
        user: null,
        isAuthenticated: false,
        projects: [],
        currentProject: null,
        sidebarOpen: false,
      }),
    }),
    {
      name: 'skaftin-store',
    }
  )
);

// Initialize theme from localStorage
if (typeof window !== 'undefined') {
  const savedTheme = localStorage.getItem('skaftin-theme') as 'light' | 'dark' | null;
  if (savedTheme) {
    useAppStore.getState().setTheme(savedTheme);
  }
}

export default useAppStore;