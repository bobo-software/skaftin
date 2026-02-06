import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/StoresIndex';
import RequestLogsService, { RequestLogStats } from '../../services/RequestLogsService';
import ToastUtils from '../../utils/ToastUtils';
import { Loader2, Activity, RefreshCw, TrendingUp, AlertTriangle, Clock, Zap } from 'lucide-react';

const RequestLogsStatsTab = () => {
  const { currentProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<RequestLogStats | null>(null);
  const [statsHours, setStatsHours] = useState(24);

  useEffect(() => {
    if (currentProject?.id) {
      loadStats();
    }
  }, [currentProject?.id, statsHours]);

  const loadStats = async () => {
    if (!currentProject?.id) return;
    
    setLoading(true);
    try {
      const statsData = await RequestLogsService.getStats(String(currentProject.id), statsHours);
      setStats(statsData);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      ToastUtils.error('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!currentProject?.id) return;
    
    setRefreshing(true);
    try {
      const statsData = await RequestLogsService.getStats(String(currentProject.id), statsHours);
      setStats(statsData);
      ToastUtils.success('Statistics refreshed');
    } catch (error: any) {
      ToastUtils.error('Failed to refresh statistics');
    } finally {
      setRefreshing(false);
    }
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

  if (loading) {
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
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-dark-600 dark:text-dark-400">Time Range:</span>
          <select
            value={statsHours}
            onChange={(e) => setStatsHours(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-700 text-dark-900 dark:text-white focus:ring-2 focus:ring-primary-500"
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
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-500 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">
                {stats.total_requests.toLocaleString()}
              </div>
              <div className="text-sm text-blue-600 dark:text-blue-400">Total Requests</div>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-red-500 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-3xl font-bold text-red-700 dark:text-red-300">
                {stats.error_count.toLocaleString()}
              </div>
              <div className="text-sm text-red-600 dark:text-red-400">Errors ({errorRate}%)</div>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-500 rounded-lg">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-3xl font-bold text-green-700 dark:text-green-300">
                {stats.response_time.avg_ms}ms
              </div>
              <div className="text-sm text-green-600 dark:text-green-400">Avg Response</div>
            </div>
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500 rounded-lg">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-700 dark:text-purple-300">
                {stats.response_time.max_ms}ms
              </div>
              <div className="text-sm text-purple-600 dark:text-purple-400">Max Response</div>
            </div>
          </div>
        </div>
      </div>

      {/* Status Code Breakdown */}
      <div className="card">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5" />
          Status Code Distribution
        </h3>
        
        {Object.keys(stats.by_status).length === 0 ? (
          <p className="text-dark-500 dark:text-dark-400 text-center py-4">No requests in this time period</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {['2xx', '3xx', '4xx', '5xx', 'unknown'].map((status) => {
              const count = stats.by_status[status] || 0;
              const percentage = stats.total_requests > 0 
                ? ((count / stats.total_requests) * 100).toFixed(1) 
                : '0';
              
              const colors: Record<string, string> = {
                '2xx': 'bg-green-500',
                '3xx': 'bg-blue-500',
                '4xx': 'bg-yellow-500',
                '5xx': 'bg-red-500',
                'unknown': 'bg-gray-500'
              };

              return (
                <div key={status} className="text-center p-4 bg-dark-50 dark:bg-dark-800 rounded-lg">
                  <div className={`w-3 h-3 rounded-full ${colors[status]} mx-auto mb-2`} />
                  <div className="text-2xl font-bold text-dark-900 dark:text-white">{count}</div>
                  <div className="text-sm text-dark-500 dark:text-dark-400">{status}</div>
                  <div className="text-xs text-dark-400 dark:text-dark-500">{percentage}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Method Breakdown */}
      <div className="card">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
          Requests by Method
        </h3>
        
        {Object.keys(stats.by_method).length === 0 ? (
          <p className="text-dark-500 dark:text-dark-400 text-center py-4">No requests in this time period</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.by_method).map(([method, count]) => (
              <div key={method} className="flex items-center gap-2 p-3 bg-dark-50 dark:bg-dark-800 rounded-lg">
                <span className={`px-3 py-1 rounded text-sm font-medium ${getMethodColor(method)}`}>
                  {method}
                </span>
                <span className="text-lg font-semibold text-dark-900 dark:text-white">{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Endpoints */}
      <div className="card">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">
          Top Endpoints
        </h3>
        
        {stats.top_endpoints.length === 0 ? (
          <p className="text-dark-500 dark:text-dark-400 text-center py-4">No requests in this time period</p>
        ) : (
          <div className="space-y-2">
            {stats.top_endpoints.map((endpoint, i) => (
              <div 
                key={i} 
                className="flex items-center gap-3 p-3 bg-dark-50 dark:bg-dark-800 rounded-lg"
              >
                <span className="text-lg font-bold text-dark-400 w-6">{i + 1}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-medium ${getMethodColor(endpoint.method)}`}>
                  {endpoint.method}
                </span>
                <span className="text-dark-700 dark:text-dark-300 flex-1 truncate font-mono text-sm">
                  {endpoint.url}
                </span>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-dark-600 dark:text-dark-400">
                    <strong className="text-dark-900 dark:text-white">{endpoint.count}</strong> calls
                  </span>
                  <span className="text-dark-500">
                    ~{endpoint.avg_duration_ms}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default RequestLogsStatsTab;
