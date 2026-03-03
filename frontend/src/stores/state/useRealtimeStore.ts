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
        if ((get() as any).initialized) {
          return;
        }

        const onDbChange = (event: DatabaseEvent) => {
          console.log('📡 Database change received:', event);
          get().addEvent(event);
        };

        const onProjectEvent = (event: ProjectEvent) => {
          console.log('📡 Project event received:', event);
          get().addEvent(event);
        };

        // Listen for database changes
        socketService.onDatabaseChange(onDbChange);

        // Listen for project events
        socketService.onProjectEvent(onProjectEvent);

        // Update connection status periodically
        const statusInterval = setInterval(() => {
          get().getConnectionStatus();
        }, 5000);

        // Store interval ID for cleanup
        (get() as any).statusInterval = statusInterval;
        (get() as any).dbListener = onDbChange;
        (get() as any).projectListener = onProjectEvent;
        (get() as any).initialized = true;
      },

      cleanup: () => {
        // Clear status interval
        const statusInterval = (get() as any).statusInterval;
        if (statusInterval) {
          clearInterval(statusInterval);
        }

        const dbListener = (get() as any).dbListener;
        if (dbListener) {
          socketService.offDatabaseChange(dbListener);
        }
        const projectListener = (get() as any).projectListener;
        if (projectListener) {
          socketService.offProjectEvent(projectListener);
        }

        // Disconnect from socket
        socketService.disconnect();
        (get() as any).initialized = false;
        (get() as any).statusInterval = undefined;
        (get() as any).dbListener = undefined;
        (get() as any).projectListener = undefined;
        set({ isConnected: false, currentProject: null, recentEvents: [] });
      },
    }),
    {
      name: 'realtime-store',
    }
  )
);
