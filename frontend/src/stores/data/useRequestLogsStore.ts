import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import RequestLogsService, {
  RequestLogEntry,
  RequestLogSettings,
  RequestLogStats,
  LogsFilter,
  LogsPagination,
} from '../../services/RequestLogsService';

interface RequestLogsStoreState {
  // Logs state
  logs: RequestLogEntry[];
  logsLoading: boolean;
  logsError: string | null;
  pagination: LogsPagination;
  filters: LogsFilter;

  // Stats state
  stats: RequestLogStats | null;
  statsLoading: boolean;
  statsError: string | null;
  statsTimeRange: number; // hours

  // Settings state
  settings: RequestLogSettings;
  settingsLoading: boolean;
  settingsError: string | null;

  // Selected log for detail view
  selectedLog: RequestLogEntry | null;

  // Current project ID (to track changes)
  currentProjectId: string | null;
}

interface RequestLogsStoreActions {
  // Logs actions
  fetchLogs: (projectId: string, newFilters?: Partial<LogsFilter>) => Promise<void>;
  refreshLogs: (projectId: string) => Promise<void>;
  setFilters: (filters: Partial<LogsFilter>) => void;
  clearFilters: () => void;
  setPage: (projectId: string, offset: number) => Promise<void>;

  // Stats actions
  fetchStats: (projectId: string, hours?: number) => Promise<void>;
  setStatsTimeRange: (hours: number) => void;

  // Settings actions
  fetchSettings: (projectId: string) => Promise<void>;
  updateSettings: (projectId: string, settings: Partial<RequestLogSettings>) => Promise<boolean>;

  // Cleanup action
  cleanup: (projectId: string, olderThanDays: number) => Promise<{ deleted_count: number } | null>;

  // Log detail
  setSelectedLog: (log: RequestLogEntry | null) => void;
  fetchLogDetail: (projectId: string, logId: string) => Promise<RequestLogEntry | null>;

  // Reset
  reset: () => void;
  setProjectId: (projectId: string | null) => void;
}

type RequestLogsStore = RequestLogsStoreState & RequestLogsStoreActions;

const initialFilters: LogsFilter = {
  limit: 20,
  offset: 0,
};

const initialPagination: LogsPagination = {
  total: 0,
  limit: 20,
  offset: 0,
  has_more: false,
};

const initialSettings: RequestLogSettings = {
  request_logging_enabled: false,
  request_log_retention: 'weekly',
};

const useRequestLogsStore = create<RequestLogsStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      logs: [],
      logsLoading: false,
      logsError: null,
      pagination: initialPagination,
      filters: initialFilters,

      stats: null,
      statsLoading: false,
      statsError: null,
      statsTimeRange: 24,

      settings: initialSettings,
      settingsLoading: false,
      settingsError: null,

      selectedLog: null,
      currentProjectId: null,

      // Set project ID and reset if changed
      setProjectId: (projectId: string | null) => {
        const current = get().currentProjectId;
        if (current !== projectId) {
          set({
            currentProjectId: projectId,
            logs: [],
            stats: null,
            settings: initialSettings,
            filters: initialFilters,
            pagination: initialPagination,
            selectedLog: null,
            logsError: null,
            statsError: null,
            settingsError: null,
          });
        }
      },

      // Fetch logs with optional new filters
      fetchLogs: async (projectId: string, newFilters?: Partial<LogsFilter>) => {
        const currentFilters = get().filters;
        const mergedFilters = newFilters 
          ? { ...currentFilters, ...newFilters, offset: newFilters.offset ?? 0 }
          : currentFilters;

        set({ logsLoading: true, logsError: null, filters: mergedFilters });

        try {
          const response = await RequestLogsService.listLogs(projectId, mergedFilters);
          set({
            logs: response.logs,
            pagination: response.pagination,
            logsLoading: false,
          });
        } catch (error: any) {
          set({
            logsError: error.message || 'Failed to fetch logs',
            logsLoading: false,
          });
        }
      },

      // Refresh logs with current filters
      refreshLogs: async (projectId: string) => {
        const filters = get().filters;
        set({ logsLoading: true, logsError: null });

        try {
          const response = await RequestLogsService.listLogs(projectId, filters);
          set({
            logs: response.logs,
            pagination: response.pagination,
            logsLoading: false,
          });
        } catch (error: any) {
          set({
            logsError: error.message || 'Failed to refresh logs',
            logsLoading: false,
          });
        }
      },

      // Set filters (will trigger fetch in component via useEffect)
      setFilters: (newFilters: Partial<LogsFilter>) => {
        set((state) => ({
          filters: { ...state.filters, ...newFilters, offset: 0 },
        }));
      },

      // Clear all filters
      clearFilters: () => {
        set({ filters: initialFilters });
      },

      // Change page
      setPage: async (projectId: string, offset: number) => {
        const filters = { ...get().filters, offset };
        set({ logsLoading: true, logsError: null, filters });

        try {
          const response = await RequestLogsService.listLogs(projectId, filters);
          set({
            logs: response.logs,
            pagination: response.pagination,
            logsLoading: false,
          });
        } catch (error: any) {
          set({
            logsError: error.message || 'Failed to load page',
            logsLoading: false,
          });
        }
      },

      // Fetch stats
      fetchStats: async (projectId: string, hours?: number) => {
        const timeRange = hours ?? get().statsTimeRange;
        set({ statsLoading: true, statsError: null, statsTimeRange: timeRange });

        try {
          const stats = await RequestLogsService.getStats(projectId, timeRange);
          set({ stats, statsLoading: false });
        } catch (error: any) {
          set({
            statsError: error.message || 'Failed to fetch stats',
            statsLoading: false,
          });
        }
      },

      // Set stats time range
      setStatsTimeRange: (hours: number) => {
        set({ statsTimeRange: hours });
      },

      // Fetch settings
      fetchSettings: async (projectId: string) => {
        set({ settingsLoading: true, settingsError: null });

        try {
          const settings = await RequestLogsService.getSettings(projectId);
          set({ settings, settingsLoading: false });
        } catch (error: any) {
          set({
            settingsError: error.message || 'Failed to fetch settings',
            settingsLoading: false,
          });
        }
      },

      // Update settings
      updateSettings: async (projectId: string, newSettings: Partial<RequestLogSettings>) => {
        set({ settingsLoading: true, settingsError: null });

        try {
          const updatedSettings = await RequestLogsService.updateSettings(projectId, newSettings);
          set({ settings: updatedSettings, settingsLoading: false });
          return true;
        } catch (error: any) {
          set({
            settingsError: error.message || 'Failed to update settings',
            settingsLoading: false,
          });
          return false;
        }
      },

      // Cleanup old logs
      cleanup: async (projectId: string, olderThanDays: number) => {
        try {
          const result = await RequestLogsService.cleanup(projectId, olderThanDays);
          // Refresh logs after cleanup
          await get().refreshLogs(projectId);
          return result;
        } catch (error: any) {
          return null;
        }
      },

      // Set selected log
      setSelectedLog: (log: RequestLogEntry | null) => {
        set({ selectedLog: log });
      },

      // Fetch log detail
      fetchLogDetail: async (projectId: string, logId: string) => {
        try {
          const log = await RequestLogsService.getLog(projectId, logId);
          set({ selectedLog: log });
          return log;
        } catch (error: any) {
          return null;
        }
      },

      // Reset store
      reset: () => {
        set({
          logs: [],
          logsLoading: false,
          logsError: null,
          pagination: initialPagination,
          filters: initialFilters,
          stats: null,
          statsLoading: false,
          statsError: null,
          statsTimeRange: 24,
          settings: initialSettings,
          settingsLoading: false,
          settingsError: null,
          selectedLog: null,
          currentProjectId: null,
        });
      },
    }),
    { name: 'request-logs-store' }
  )
);

export default useRequestLogsStore;
