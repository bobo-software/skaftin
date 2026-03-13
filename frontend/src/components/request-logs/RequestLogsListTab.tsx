import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore, useRealtimeStore, useRequestLogsStore } from '../../stores/StoresIndex';
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { RequestLogDetailModal } from '@components/ComponentsIndex';

const RequestLogsListTab = () => {
  const { currentProject } = useProjectStore();
  const {
    joinProject,
    leaveProject,
    recentEvents,
    initialize: initializeRealtime,
  } = useRealtimeStore();
  const {
    logs,
    logsLoading,
    pagination,
    filters,
    selectedLog,
    fetchLogs,
    refreshLogs,
    setFilters,
    clearFilters,
    setPage,
    setSelectedLog,
    setProjectId,
  } = useRequestLogsStore();

  const [statusCodeInput, setStatusCodeInput] = useState('');
  const lastRealtimeRefreshRef = useRef(0);

  // Initialize realtime websocket listeners once for this page session
  useEffect(() => {
    initializeRealtime();
  }, [initializeRealtime]);

  // Set project ID when component mounts or project changes
  useEffect(() => {
    if (currentProject?.id) {
      setProjectId(String(currentProject.id));
    }
  }, [currentProject?.id]);

  // Initial fetch
  useEffect(() => {
    if (currentProject?.id) {
      fetchLogs(String(currentProject.id));
    }
  }, [currentProject?.id]);

  // Subscribe to project websocket stream while logs tab is mounted
  useEffect(() => {
    if (!currentProject?.id) return;

    const projectId = String(currentProject.id);
    joinProject(projectId);

    return () => {
      leaveProject(projectId);
    };
  }, [currentProject?.id, joinProject, leaveProject]);

  // Debounce status code input
  useEffect(() => {
    const timer = setTimeout(() => {
      const statusCode = statusCodeInput ? Number(statusCodeInput) : undefined;
      if (filters.status_code !== statusCode) {
        setFilters({ status_code: statusCode });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [statusCodeInput]);

  // Fetch when filters change (except status_code which is handled above)
  useEffect(() => {
    if (currentProject?.id) {
      fetchLogs(String(currentProject.id), filters);
    }
  }, [filters.method, filters.status_code, filters.has_error]);

  // Auto-refresh when backend emits request_log_created for this project
  useEffect(() => {
    if (!currentProject?.id || recentEvents.length === 0) return;

    const projectId = String(currentProject.id);
    const latestEvent = recentEvents[0];
    if (latestEvent.projectId !== projectId || latestEvent.type !== 'request_log_created') {
      return;
    }

    const now = Date.now();
    if (now - lastRealtimeRefreshRef.current < 1000) {
      return;
    }
    lastRealtimeRefreshRef.current = now;

    void refreshLogs(projectId);
  }, [recentEvents, currentProject?.id, refreshLogs]);

  const handleRefresh = async () => {
    if (currentProject?.id) {
      await refreshLogs(String(currentProject.id));
    }
  };

  const handlePageChange = async (newOffset: number) => {
    if (currentProject?.id) {
      await setPage(String(currentProject.id), newOffset);
    }
  };

  const handleClearFilters = () => {
    setStatusCodeInput('');
    clearFilters();
  };

  const updateFilter = (key: string, value: any) => {
    setFilters({ [key]: value });
  };

  const getStatusColor = (statusCode: number | null) => {
    if (!statusCode) return 'text-gray-500';
    if (statusCode >= 200 && statusCode < 300) return 'text-green-600 dark:text-green-400';
    if (statusCode >= 300 && statusCode < 400) return 'text-blue-600 dark:text-blue-400';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-600 dark:text-yellow-400';
    if (statusCode >= 500) return 'text-red-600 dark:text-red-400';
    return 'text-gray-500';
  };

  const getMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'POST': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      case 'PUT': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'DELETE': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
      case 'PATCH': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const hasActiveFilters = filters.method || filters.status_code || filters.has_error;

  return (
    <div className="space-y-3">
      {/* Compact Filters Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.method || ''}
          onChange={(e) => updateFilter('method', e.target.value || undefined)}
          className="px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
        >
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
        </select>
        <input
          type="number"
          value={statusCodeInput}
          onChange={(e) => setStatusCodeInput(e.target.value)}
          placeholder="Status"
          className="w-20 px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
        />
        <select
          value={filters.has_error ? 'errors' : 'all'}
          onChange={(e) => updateFilter('has_error', e.target.value === 'errors')}
          className="px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
        >
          <option value="all">All</option>
          <option value="errors">Errors Only</option>
        </select>
        {hasActiveFilters && (
          <button 
            onClick={handleClearFilters}
            className="px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300"
          >
            Clear
          </button>
        )}
        <button 
          onClick={handleRefresh} 
          className="ml-auto px-2 py-1 text-xs text-dark-500 hover:text-dark-700 dark:hover:text-dark-300 flex items-center gap-1"
          disabled={logsLoading}
        >
          <RefreshCw className={`w-3 h-3 ${logsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Loading State */}
      {logsLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {/* Logs Table */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900">
                    <th className="text-left py-2 px-3 text-dark-500 dark:text-dark-400 font-medium">Time</th>
                    <th className="text-left py-2 px-3 text-dark-500 dark:text-dark-400 font-medium">Method</th>
                    <th className="text-left py-2 px-3 text-dark-500 dark:text-dark-400 font-medium">URL</th>
                    <th className="text-left py-2 px-3 text-dark-500 dark:text-dark-400 font-medium">Status</th>
                    <th className="text-left py-2 px-3 text-dark-500 dark:text-dark-400 font-medium">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-dark-500 dark:text-dark-400">
                        <div className="flex flex-col items-center gap-1">
                          <AlertCircle className="w-5 h-5 text-dark-400" />
                          <span className="text-xs">No logs found</span>
                          {hasActiveFilters && (
                            <button onClick={handleClearFilters} className="text-xs text-primary-600 hover:underline">
                              Clear filters
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => (
                      <tr 
                        key={log.id} 
                        className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-900 cursor-pointer"
                        onClick={() => setSelectedLog(log)}
                      >
                        <td className="py-1.5 px-3 text-dark-600 dark:text-dark-300 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString(undefined, { 
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                          })}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getMethodColor(log.method)}`}>
                            {log.method}
                          </span>
                        </td>
                        <td className="py-1.5 px-3 text-dark-600 dark:text-dark-300 max-w-xs truncate font-mono">
                          {log.url}
                        </td>
                        <td className={`py-1.5 px-3 font-mono font-medium ${getStatusColor(log.status_code)}`}>
                          {log.status_code || '-'}
                          {log.error_message && <AlertCircle className="w-2.5 h-2.5 inline ml-0.5 text-red-500" />}
                        </td>
                        <td className="py-1.5 px-3 text-dark-500 whitespace-nowrap">
                          {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Compact Pagination */}
            {pagination.total > 0 && (
              <div className="flex items-center justify-between px-3 py-2 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-900">
                <span className="text-[10px] text-dark-500 dark:text-dark-400">
                  {pagination.offset + 1}-{Math.min(pagination.offset + logs.length, pagination.total)} of {pagination.total}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                    disabled={pagination.offset === 0}
                    className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 disabled:opacity-30"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-dark-500 px-1">
                    {Math.floor(pagination.offset / pagination.limit) + 1}/{Math.ceil(pagination.total / pagination.limit)}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                    disabled={!pagination.has_more}
                    className="p-1 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 disabled:opacity-30"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Log Detail Modal */}
      {selectedLog && (
        <RequestLogDetailModal 
          log={selectedLog} 
          onClose={() => setSelectedLog(null)} 
        />
      )}
    </div>
  );
};

export default RequestLogsListTab;
