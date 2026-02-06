import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/StoresIndex';
import RequestLogsService, { RequestLogEntry, LogsFilter } from '../../services/RequestLogsService';
import ToastUtils from '../../utils/ToastUtils';
import { Loader2, RefreshCw, Filter, ChevronLeft, ChevronRight, AlertCircle, X, Trash2 } from 'lucide-react';
import RequestLogDetailModal from './RequestLogDetailModal';

const RequestLogsListTab = () => {
  const { currentProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<RequestLogEntry[]>([]);
  const [pagination, setPagination] = useState({ total: 0, limit: 20, offset: 0, has_more: false });
  const [selectedLog, setSelectedLog] = useState<RequestLogEntry | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(7);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);
  
  const [filters, setFilters] = useState<LogsFilter>({
    limit: 20,
    offset: 0
  });

  useEffect(() => {
    if (currentProject?.id) {
      loadLogs();
    }
  }, [currentProject?.id]);

  const loadLogs = async () => {
    if (!currentProject?.id) return;
    
    setLoading(true);
    try {
      const logsData = await RequestLogsService.listLogs(String(currentProject.id), filters);
      setLogs(logsData.logs);
      setPagination(logsData.pagination);
    } catch (error: any) {
      console.error('Error loading logs:', error);
      ToastUtils.error('Failed to load request logs');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentProject?.id) return;
    
    try {
      const logsData = await RequestLogsService.listLogs(String(currentProject.id), filters);
      setLogs(logsData.logs);
      setPagination(logsData.pagination);
      ToastUtils.success('Logs refreshed');
    } catch (error: any) {
      ToastUtils.error('Failed to refresh logs');
    }
  };

  const handlePageChange = async (newOffset: number) => {
    if (!currentProject?.id) return;
    
    const newFilters = { ...filters, offset: newOffset };
    setFilters(newFilters);
    
    try {
      const logsData = await RequestLogsService.listLogs(String(currentProject.id), newFilters);
      setLogs(logsData.logs);
      setPagination(logsData.pagination);
    } catch (error: any) {
      ToastUtils.error('Failed to load logs');
    }
  };

  const handleApplyFilters = async () => {
    if (!currentProject?.id) return;
    
    const newFilters = { ...filters, offset: 0 };
    setFilters(newFilters);
    
    try {
      const logsData = await RequestLogsService.listLogs(String(currentProject.id), newFilters);
      setLogs(logsData.logs);
      setPagination(logsData.pagination);
      setShowFilters(false);
      ToastUtils.success('Filters applied');
    } catch (error: any) {
      ToastUtils.error('Failed to apply filters');
    }
  };

  const handleClearFilters = async () => {
    const newFilters: LogsFilter = { limit: 20, offset: 0 };
    setFilters(newFilters);
    
    if (!currentProject?.id) return;
    
    try {
      const logsData = await RequestLogsService.listLogs(String(currentProject.id), newFilters);
      setLogs(logsData.logs);
      setPagination(logsData.pagination);
      ToastUtils.success('Filters cleared');
    } catch (error: any) {
      ToastUtils.error('Failed to clear filters');
    }
  };

  const handleCleanup = async () => {
    if (!currentProject?.id) return;
    
    setCleaningUp(true);
    try {
      const result = await RequestLogsService.cleanup(String(currentProject.id), cleanupDays);
      ToastUtils.success(`Deleted ${result.deleted_count} logs older than ${cleanupDays} days`);
      setShowCleanup(false);
      handleRefresh();
    } catch (error: any) {
      ToastUtils.error('Failed to cleanup logs');
    } finally {
      setCleaningUp(false);
    }
  };

  const getStatusColor = (statusCode: number | null) => {
    if (!statusCode) return 'text-gray-500';
    if (statusCode >= 200 && statusCode < 300) return 'text-green-500';
    if (statusCode >= 300 && statusCode < 400) return 'text-blue-500';
    if (statusCode >= 400 && statusCode < 500) return 'text-yellow-500';
    if (statusCode >= 500) return 'text-red-500';
    return 'text-gray-500';
  };

  const getMethodColor = (method: string) => {
    switch (method?.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'PUT': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400';
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'PATCH': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  const hasActiveFilters = filters.method || filters.status_code || filters.has_error;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)} 
            className={`btn-secondary flex items-center gap-2 ${showFilters || hasActiveFilters ? 'bg-primary-100 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700' : ''}`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 rounded-full bg-primary-500" />
            )}
          </button>
          {hasActiveFilters && (
            <button 
              onClick={handleClearFilters}
              className="btn-secondary flex items-center gap-1 text-sm"
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowCleanup(!showCleanup)}
            className="btn-secondary flex items-center gap-2 text-red-600 dark:text-red-400"
          >
            <Trash2 className="w-4 h-4" />
            Cleanup
          </button>
          <button onClick={handleRefresh} className="btn-secondary flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="card bg-dark-50 dark:bg-dark-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Method</label>
              <select
                value={filters.method || ''}
                onChange={(e) => setFilters({ ...filters, method: e.target.value || undefined })}
                className="w-full px-3 py-2 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
              >
                <option value="">All Methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Status Code</label>
              <input
                type="number"
                value={filters.status_code || ''}
                onChange={(e) => setFilters({ ...filters, status_code: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="e.g., 404"
                className="w-full px-3 py-2 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Show</label>
              <select
                value={filters.has_error ? 'errors' : 'all'}
                onChange={(e) => setFilters({ ...filters, has_error: e.target.value === 'errors' })}
                className="w-full px-3 py-2 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
              >
                <option value="all">All Requests</option>
                <option value="errors">Errors Only (4xx & 5xx)</option>
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleApplyFilters} className="btn-primary w-full">
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cleanup Panel */}
      {showCleanup && (
        <div className="card bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800">
          <h4 className="font-medium text-red-800 dark:text-red-300 mb-3">Manual Cleanup</h4>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-red-700 dark:text-red-400">Delete logs older than</label>
              <input
                type="number"
                value={cleanupDays}
                onChange={(e) => setCleanupDays(Number(e.target.value))}
                min={1}
                max={365}
                className="w-20 px-2 py-1 border border-red-200 dark:border-red-700 rounded bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
              />
              <span className="text-sm text-red-700 dark:text-red-400">days</span>
            </div>
            <button
              onClick={handleCleanup}
              disabled={cleaningUp}
              className="btn-secondary bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50 flex items-center gap-2"
            >
              {cleaningUp && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete Now
            </button>
          </div>
        </div>
      )}

      {/* Logs Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800">
                <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-300 font-medium">Time</th>
                <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-300 font-medium">Method</th>
                <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-300 font-medium">URL</th>
                <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-300 font-medium">Status</th>
                <th className="text-left py-3 px-4 text-dark-600 dark:text-dark-300 font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-dark-500 dark:text-dark-400">
                    <div className="flex flex-col items-center gap-2">
                      <AlertCircle className="w-8 h-8 text-dark-400" />
                      <span>No request logs found</span>
                      {hasActiveFilters && (
                        <button onClick={handleClearFilters} className="text-primary-600 hover:underline">
                          Clear filters to see all logs
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr 
                    key={log.id} 
                    className="border-b border-dark-100 dark:border-dark-800 hover:bg-dark-50 dark:hover:bg-dark-800 cursor-pointer transition-colors"
                    onClick={() => setSelectedLog(log)}
                  >
                    <td className="py-3 px-4 text-dark-600 dark:text-dark-300 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getMethodColor(log.method)}`}>
                        {log.method}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-dark-600 dark:text-dark-300 max-w-md truncate font-mono text-xs">
                      {log.url}
                    </td>
                    <td className={`py-3 px-4 font-mono font-medium ${getStatusColor(log.status_code)}`}>
                      {log.status_code || '-'}
                      {log.error_message && <AlertCircle className="w-3 h-3 inline ml-1 text-red-500" />}
                    </td>
                    <td className="py-3 px-4 text-dark-500 whitespace-nowrap">
                      {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-between p-4 border-t border-dark-200 dark:border-dark-700 bg-dark-50 dark:bg-dark-800">
            <div className="text-sm text-dark-500 dark:text-dark-400">
              Showing {pagination.offset + 1} - {Math.min(pagination.offset + logs.length, pagination.total)} of {pagination.total}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => handlePageChange(Math.max(0, pagination.offset - pagination.limit))}
                disabled={pagination.offset === 0}
                className="btn-secondary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-dark-600 dark:text-dark-400">
                Page {Math.floor(pagination.offset / pagination.limit) + 1} of {Math.ceil(pagination.total / pagination.limit)}
              </span>
              <button
                onClick={() => handlePageChange(pagination.offset + pagination.limit)}
                disabled={!pagination.has_more}
                className="btn-secondary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

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
