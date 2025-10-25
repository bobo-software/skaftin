import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import socketService, { DatabaseEvent, ProjectEvent } from '../../services/SocketService';

interface RealtimeStoreType {
  // State
  isConnected: boolean;
  currentProject: string | null;
  recentEvents: (DatabaseEvent | ProjectEvent)[];
  connectionStatus: {
    isConnected: boolean;
    reconnectAttempts: number;
    socketId: string | null;
  };

  // Actions
  joinProject: (projectId: string) => void;
  leaveProject: (projectId: string) => void;
  addEvent: (event: DatabaseEvent | ProjectEvent) => void;
  clearEvents: () => void;
  getConnectionStatus: () => void;
  initialize: () => void;
  cleanup: () => void;
}

export const useRealtimeStore = create<RealtimeStoreType>()(
  devtools(
    (set, get) => ({
      // State
      isConnected: false,
      currentProject: null,
      recentEvents: [],
      connectionStatus: {
        isConnected: false,
        reconnectAttempts: 0,
        socketId: null,
      },

      // Actions
      joinProject: (projectId: string) => {
        socketService.joinProject(projectId);
        set({ currentProject: projectId });
      },

      leaveProject: (projectId: string) => {
        socketService.leaveProject(projectId);
        set({ currentProject: null });
      },

      addEvent: (event: DatabaseEvent | ProjectEvent) => {
        set((state) => ({
          recentEvents: [event, ...state.recentEvents].slice(0, 50), // Keep last 50 events
        }));
      },

      clearEvents: () => {
        set({ recentEvents: [] });
      },

      getConnectionStatus: () => {
        const status = socketService.getConnectionStatus();
        set({ connectionStatus: status, isConnected: status.isConnected });
      },

      initialize: () => {
        // Listen for database changes
        socketService.onDatabaseChange((event: DatabaseEvent) => {
          console.log('📡 Database change received:', event);
          get().addEvent(event);
        });

        // Listen for project events
        socketService.onProjectEvent((event: ProjectEvent) => {
          console.log('📡 Project event received:', event);
          get().addEvent(event);
        });

        // Update connection status periodically
        const statusInterval = setInterval(() => {
          get().getConnectionStatus();
        }, 5000);

        // Store interval ID for cleanup
        (get() as any).statusInterval = statusInterval;
      },

      cleanup: () => {
        // Clear status interval
        const statusInterval = (get() as any).statusInterval;
        if (statusInterval) {
          clearInterval(statusInterval);
        }

        // Disconnect from socket
        socketService.disconnect();
        set({ isConnected: false, currentProject: null, recentEvents: [] });
      },
    }),
    {
      name: 'realtime-store',
    }
  )
);
