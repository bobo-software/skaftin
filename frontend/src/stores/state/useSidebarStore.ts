import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface SidebarState {
  isCollapsed: boolean;
  toggle: () => void;
  setCollapsed: (collapsed: boolean) => void;
}

const useSidebarStore = create<SidebarState>()(
  devtools(
    (set) => ({
      // Initial state - check localStorage for saved preference
      isCollapsed: (() => {
        if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('skaftin-sidebar-collapsed');
          return saved ? saved === 'true' : true;
        }
        return true;
      })(),
      
      // Actions
      toggle: () => set((state) => {
        const newState = !state.isCollapsed;
        if (typeof window !== 'undefined') {
          localStorage.setItem('skaftin-sidebar-collapsed', String(newState));
        }
        return { isCollapsed: newState };
      }),
      
      setCollapsed: (collapsed: boolean) => {
        set({ isCollapsed: collapsed });
        if (typeof window !== 'undefined') {
          localStorage.setItem('skaftin-sidebar-collapsed', String(collapsed));
        }
      },
    }),
    {
      name: 'sidebar-store',
    }
  )
);

export default useSidebarStore;

