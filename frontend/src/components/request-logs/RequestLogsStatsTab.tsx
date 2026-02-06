import React, { useEffect } from 'react';
import { useProjectStore, useRequestLogsStore } from '../../stores/StoresIndex';
import { Loader2, RefreshCw, TrendingUp, AlertTriangle, Clock, Zap } from 'lucide-react';

const RequestLogsStatsTab = () => {
  const { currentProject } = useProjectStore();
  const {
    stats,
    statsLoading,
    statsTimeRange,
    fetchStats,
    setStatsTimeRange,
    setProjectId,
  } = useRequestLogsStore();

  // Set project ID when component mounts or project changes
  useEffect(() => {
    if (currentProject?.id) {
      setProjectId(String(currentProject.id));
    }
  }, [currentProject?.id]);

  // Fetch stats on mount and when time range changes
  useEffect(() => {
    if (currentProject?.id) {
      fetchStats(String(currentProject.id), statsTimeRange);
    }
  }, [currentProject?.id, statsTimeRange]);

  const handleRefresh = async () => {
    if (currentProject?.id) {
      await fetchStats(String(currentProject.id), statsTimeRange);
    }
  };

  const handleTimeRangeChange = (hours: number) => {
    setStatsTimeRange(hours);
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

  if (statsLoading && !stats) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12 text-dark-500 dark:text-dark-400">
        No statistics available
      </div>
    );
  }

  const errorRate = stats.total_requests > 0 
    ? ((stats.error_count / stats.total_requests) * 100).toFixed(1) 
    : '0';

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-dark-500 dark:text-dark-400">Range:</span>
          <select
            value={statsTimeRange}
            onChange={(e) => handleTimeRangeChange(Number(e.target.value))}
            className="px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
          >
            <option value={1}>Last hour</option>
            <option value={6}>Last 6 hours</option>
            <option value={24}>Last 24 hours</option>
            <option value={168}>Last 7 days</option>
            <option value={720}>Last 30 days</option>
          </select>
        </div>
        <button 
          onClick={handleRefresh} 
          disabled={statsLoading}
          className="btn-secondary flex items-center gap-2 text-sm px-3 py-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-md">
            <TrendingUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-dark-900 dark:text-white">
              {stats.total_requests.toLocaleString()}
            </div>
            <div className="text-xs text-dark-500 dark:text-dark-400">Total Requests</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-md">
            <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-dark-900 dark:text-white">
              {stats.error_count.toLocaleString()}
            </div>
            <div className="text-xs text-dark-500 dark:text-dark-400">Errors ({errorRate}%)</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-md">
            <Zap className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-dark-900 dark:text-white">
              {stats.response_time.avg_ms}ms
            </div>
            <div className="text-xs text-dark-500 dark:text-dark-400">Avg Response</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-md">
            <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <div className="text-xl font-bold text-dark-900 dark:text-white">
              {stats.response_time.max_ms}ms
            </div>
            <div className="text-xs text-dark-500 dark:text-dark-400">Max Response</div>
          </div>
        </div>
      </div>

      {/* Status & Method Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Status Code Breakdown */}
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <h3 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">Status Codes</h3>
          {Object.keys(stats.by_status).length === 0 ? (
            <p className="text-dark-500 dark:text-dark-400 text-sm">No data</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {['2xx', '3xx', '4xx', '5xx'].map((status) => {
                const count = stats.by_status[status as keyof typeof stats.by_status] || 0;
                if (count === 0) return null;
                const percentage = stats.total_requests > 0 
                  ? ((count / stats.total_requests) * 100).toFixed(0) 
                  : '0';
                
                const colors: Record<string, string> = {
                  '2xx': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                  '3xx': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                  '4xx': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                  '5xx': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                };

                return (
                  <div key={status} className={`px-2.5 py-1 rounded-md text-xs font-medium ${colors[status]}`}>
                    {status}: {count} ({percentage}%)
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Method Breakdown */}
        <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
          <h3 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">Methods</h3>
          {Object.keys(stats.by_method).length === 0 ? (
            <p className="text-dark-500 dark:text-dark-400 text-sm">No data</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.by_method).map(([method, count]) => (
                <div key={method} className={`px-2.5 py-1 rounded-md text-xs font-medium ${getMethodColor(method)}`}>
                  {method}: {count}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top Endpoints */}
      <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <h3 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">Top Endpoints</h3>
        {stats.top_endpoints.length === 0 ? (
          <p className="text-dark-500 dark:text-dark-400 text-sm">No data</p>
        ) : (
          <div className="space-y-1.5">
            {stats.top_endpoints.slice(0, 5).map((endpoint, i) => (
              <div 
                key={i} 
                className="flex items-center gap-2 py-1.5 px-2 bg-dark-50 dark:bg-dark-900 rounded text-xs"
              >
                <span className="text-dark-400 w-4 font-medium">{i + 1}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${getMethodColor(endpoint.method)}`}>
                  {endpoint.method}
                </span>
                <span className="text-dark-600 dark:text-dark-300 flex-1 truncate font-mono">
                  {endpoint.url}
                </span>
                <span className="text-dark-500 whitespace-nowrap">
                  {endpoint.count} · {endpoint.avg_duration_ms}ms
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestLogsStatsTab;
