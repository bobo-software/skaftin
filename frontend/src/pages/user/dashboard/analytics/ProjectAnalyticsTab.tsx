import { useEffect, useState } from 'react';
import { useProjectStore, useRequestLogsStore } from '../../../../stores/StoresIndex';
import AnalyticsService, {
  DatabaseMetrics,
  StorageMetrics,
  TimeSeriesDataPoint,
} from '../../../../services/AnalyticsService';
import {
  BarChart3,
  Database,
  Cloud,
  Activity,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Zap,
  LineChart as LineChartIcon,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import LoadingSpinner from '../../../../components/elements/LoadingSpinner';
import ErrorMessage from '../../../../components/elements/ErrorMessage';
import { RequestLogsListTab, RequestLogsStatsTab, RequestLogsSettingsTab } from '@components/ComponentsIndex';

const ProjectAnalyticsTab = () => {
  const { currentProject } = useProjectStore();
  const {
    stats: apiStats,
    statsLoading: apiStatsLoading,
    fetchStats: fetchApiStats,
    setProjectId,
  } = useRequestLogsStore();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'overview' | 'graph' | 'api' | 'database' | 'storage'>('overview');

  const timeRange = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const [apiSubTab, setApiSubTab] = useState<'logs' | 'stats' | 'settings'>('logs');

  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);

  // Set project ID for request logs store
  useEffect(() => {
    if (currentProject?.id) {
      setProjectId(String(currentProject.id));
    }
  }, [currentProject?.id]);

  useEffect(() => {
    if (currentProject) {
      loadAnalytics();
    }
  }, [currentProject, startDate, endDate, activeTab]);

  // Convert timeRange (days) to hours for API stats
  const getHoursFromDays = (days: number) => days * 24;

  const loadAnalytics = async () => {
    if (!currentProject) return;
    if (activeTab === 'api') return;

    setLoading(true);
    setError('');

    try {
      if (activeTab === 'overview') {
        // Fetch API stats from request logs store
        await fetchApiStats(String(currentProject.id), getHoursFromDays(timeRange));

        // Fetch DB metrics for overview
        const dbResult = await AnalyticsService.getDatabaseMetrics(
          currentProject.id.toString(),
          timeRange,
          timeRange <= 7 ? 'hour' : 'day'
        );
        if (dbResult.success && dbResult.data) {
          setDbMetrics(dbResult.data);
        }

        // Fetch storage metrics for overview
        const storageResult = await AnalyticsService.getStorageMetrics(
          currentProject.id.toString(),
          timeRange,
          timeRange <= 7 ? 'hour' : 'day'
        );
        if (storageResult.success && storageResult.data) {
          setStorageMetrics(storageResult.data);
        }
      } else if (activeTab === 'graph') {
        const [dbResult, storageResult] = await Promise.all([
          AnalyticsService.getDatabaseMetrics(
            currentProject.id.toString(),
            timeRange,
            timeRange <= 7 ? 'hour' : 'day'
          ),
          AnalyticsService.getStorageMetrics(
            currentProject.id.toString(),
            timeRange,
            timeRange <= 7 ? 'hour' : 'day'
          ),
        ]);
        if (dbResult.success && dbResult.data) setDbMetrics(dbResult.data);
        if (storageResult.success && storageResult.data) setStorageMetrics(storageResult.data);
      } else if (activeTab === 'database') {
        const result = await AnalyticsService.getDatabaseMetrics(
          currentProject.id.toString(),
          timeRange,
          timeRange <= 7 ? 'hour' : 'day'
        );
        if (result.success && result.data) {
          setDbMetrics(result.data);
        } else {
          setError(result.error || 'Failed to load database metrics');
        }
      } else if (activeTab === 'storage') {
        const result = await AnalyticsService.getStorageMetrics(
          currentProject.id.toString(),
          timeRange,
          timeRange <= 7 ? 'hour' : 'day'
        );
        if (result.success && result.data) {
          setStorageMetrics(result.data);
        } else {
          setError(result.error || 'Failed to load storage metrics');
        }
      }
    } catch (err) {
      setError('Failed to load analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!currentProject) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-10 h-10 text-dark-300 dark:text-dark-600 mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-1">No Project Selected</h3>
        <p className="text-sm text-dark-600 dark:text-dark-300">Select a project to view analytics</p>
      </div>
    );
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  // Calculate derived API metrics from request logs store
  const apiMetrics = apiStats ? {
    totalRequests: apiStats.total_requests,
    errorCount: apiStats.error_count,
    errorRate: apiStats.total_requests > 0 ? (apiStats.error_count / apiStats.total_requests) * 100 : 0,
    successCount: apiStats.total_requests - apiStats.error_count,
    avgResponseTime: apiStats.response_time.avg_ms,
    maxResponseTime: apiStats.response_time.max_ms,
  } : null;

  // Calculate DB summary from dbMetrics
  const dbSummary = dbMetrics ? {
    totalQueries: dbMetrics.topTables.reduce((sum, t) => sum + t.queryCount, 0),
    avgExecutionTime: dbMetrics.topTables.length > 0 
      ? dbMetrics.topTables.reduce((sum, t) => sum + t.avgExecutionTime, 0) / dbMetrics.topTables.length 
      : 0,
    totalRowsAffected: dbMetrics.topTables.reduce((sum, t) => sum + (t.queryCount * 10), 0), // Estimate
  } : null;

  // Calculate storage summary from storageMetrics
  const storageSummary = storageMetrics ? {
    totalOperations: storageMetrics.operationBreakdown.reduce((sum, op) => sum + op.operationCount, 0),
    uploadCount: storageMetrics.operationBreakdown.find(op => op.operationType === 'upload')?.operationCount || 0,
    downloadCount: storageMetrics.operationBreakdown.find(op => op.operationType === 'download')?.operationCount || 0,
    totalStorageBytes: storageMetrics.operationBreakdown.reduce((sum, op) => sum + op.totalBytes, 0),
  } : null;

  const isOverviewLoading = loading || apiStatsLoading;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-dark-900 dark:text-white">Analytics</h2>
          <p className="text-xs text-dark-500 dark:text-dark-400">Monitor performance and usage</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dark-200 dark:border-dark-700">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
          { id: 'graph', label: 'Graphs', icon: LineChartIcon },
          { id: 'api', label: 'API', icon: BarChart3 },
          { id: 'database', label: 'Database', icon: Database },
          { id: 'storage', label: 'Storage', icon: Cloud },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {(activeTab === 'overview' ? isOverviewLoading : (activeTab !== 'api' && loading)) ? (
        <LoadingSpinner text="Loading..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  title="API Requests"
                  value={apiMetrics ? formatNumber(apiMetrics.totalRequests) : '0'}
                  subtitle={apiMetrics ? `${formatNumber(apiMetrics.successCount)} ok` : 'No data'}
                  icon={Activity}
                  trend={apiMetrics?.errorRate || null}
                  trendLabel="err"
                  color="blue"
                />
                <MetricCard
                  title="DB Queries"
                  value={dbSummary ? formatNumber(dbSummary.totalQueries) : '0'}
                  subtitle={dbSummary ? `${dbSummary.avgExecutionTime.toFixed(1)}ms avg` : 'No data'}
                  icon={Database}
                  trend={null}
                  color="green"
                />
                <MetricCard
                  title="Storage Ops"
                  value={storageSummary ? formatNumber(storageSummary.totalOperations) : '0'}
                  subtitle={storageSummary ? formatBytes(storageSummary.totalStorageBytes) : 'No data'}
                  icon={Cloud}
                  trend={null}
                  color="purple"
                />
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                  <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-blue-600" />
                    API Performance
                  </h3>
                  {apiMetrics ? (
                    <div className="space-y-1">
                      <StatRow label="Total Requests" value={formatNumber(apiMetrics.totalRequests)} />
                      <StatRow label="Success Rate" value={`${(100 - apiMetrics.errorRate).toFixed(1)}%`} />
                      <StatRow label="Avg Response" value={`${apiMetrics.avgResponseTime}ms`} />
                      <StatRow label="Max Response" value={`${apiMetrics.maxResponseTime}ms`} />
                      <StatRow label="Errors" value={formatNumber(apiMetrics.errorCount)} />
                    </div>
                  ) : (
                    <p className="text-xs text-dark-500">No API data available</p>
                  )}
                </div>

                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                  <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-green-600" />
                    Database Performance
                  </h3>
                  {dbSummary ? (
                    <div className="space-y-1">
                      <StatRow label="Total Queries" value={formatNumber(dbSummary.totalQueries)} />
                      <StatRow label="Avg Execution" value={`${dbSummary.avgExecutionTime.toFixed(1)}ms`} />
                      <StatRow label="Rows Affected" value={formatNumber(dbSummary.totalRowsAffected)} />
                    </div>
                  ) : (
                    <p className="text-xs text-dark-500">No database data available</p>
                  )}
                </div>
              </div>

              {/* API Status Breakdown */}
              {apiStats && (Object.keys(apiStats.by_status).length > 0 || Object.keys(apiStats.by_method).length > 0) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                    <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                      <Zap className="w-3.5 h-3.5 text-yellow-600" />
                      Status Codes
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {['2xx', '3xx', '4xx', '5xx'].map((status) => {
                        const count = apiStats.by_status[status as keyof typeof apiStats.by_status] || 0;
                        if (count === 0) return null;
                        const colors: Record<string, string> = {
                          '2xx': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          '3xx': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                          '4xx': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                          '5xx': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                        };
                        return (
                          <span key={status} className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[status]}`}>
                            {status}: {count}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                    <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                      <BarChart3 className="w-3.5 h-3.5 text-indigo-600" />
                      Methods
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {Object.entries(apiStats.by_method).map(([method, count]) => {
                        const colors: Record<string, string> = {
                          GET: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                          POST: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                          PUT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
                          DELETE: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
                          PATCH: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                        };
                        return (
                          <span key={method} className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[method] || 'bg-gray-100 text-gray-700'}`}>
                            {method}: {count}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-purple-600" />
                  Storage Usage
                </h3>
                {storageSummary ? (
                  <div className="grid grid-cols-4 gap-2">
                    <StatRow label="Operations" value={formatNumber(storageSummary.totalOperations)} />
                    <StatRow label="Uploads" value={formatNumber(storageSummary.uploadCount)} />
                    <StatRow label="Downloads" value={formatNumber(storageSummary.downloadCount)} />
                    <StatRow label="Total Size" value={formatBytes(storageSummary.totalStorageBytes)} />
                  </div>
                ) : (
                  <p className="text-xs text-dark-500">No storage data available</p>
                )}
              </div>
            </div>
          )}

          {/* Graphs Tab */}
          {activeTab === 'graph' && (
            <div className="space-y-4">
              {/* Date Range Picker */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={startDate}
                  max={endDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                />
                <span className="text-xs text-dark-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  max={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                />
              </div>
              {/* DB Queries Chart */}
              <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-4 h-4 text-green-600" />
                  <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Database Queries</h3>
                </div>
                {dbMetrics?.timeSeries?.length ? (
                  <AnalyticsChart
                    data={dbMetrics.timeSeries}
                    series={[
                      { key: 'queryCount', label: 'Queries', color: '#16a34a' },
                      { key: 'avgExecutionTime', label: 'Avg Time (ms)', color: '#f59e0b' },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-dark-500 py-8 text-center">No database data for this period</p>
                )}
              </div>

              {/* Storage Chart */}
              <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <div className="flex items-center gap-2 mb-4">
                  <Cloud className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Storage Operations</h3>
                </div>
                {storageMetrics?.timeSeries?.length ? (
                  <AnalyticsChart
                    data={storageMetrics.timeSeries}
                    series={[
                      { key: 'uploadCount', label: 'Uploads', color: '#9333ea' },
                      { key: 'downloadCount', label: 'Downloads', color: '#2563eb' },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-dark-500 py-8 text-center">No storage data for this period</p>
                )}
              </div>

              {/* Total Bytes Chart */}
              <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <div className="flex items-center gap-2 mb-4">
                  <Cloud className="w-4 h-4 text-blue-600" />
                  <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Storage Bytes Transferred</h3>
                </div>
                {storageMetrics?.timeSeries?.length ? (
                  <AnalyticsChart
                    data={storageMetrics.timeSeries}
                    series={[
                      { key: 'totalBytes', label: 'Bytes', color: '#0ea5e9' },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-dark-500 py-8 text-center">No storage data for this period</p>
                )}
              </div>
            </div>
          )}

          {/* Database Tab */}
          {activeTab === 'database' && dbMetrics && (
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-3">Query Trends</h3>
                <AnalyticsChart
                  data={dbMetrics.timeSeries}
                  series={[
                    { key: 'queryCount', label: 'Queries', color: '#16a34a' },
                    { key: 'avgExecutionTime', label: 'Avg Time (ms)', color: '#f59e0b' },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                  <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2">Top Tables</h3>
                  <div className="space-y-1.5">
                    {dbMetrics.topTables.slice(0, 5).map((table, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 bg-dark-50 dark:bg-dark-900 rounded text-xs"
                      >
                        <div>
                          <div className="font-medium text-dark-900 dark:text-white">{table.tableName}</div>
                          <div className="text-[10px] text-dark-500">{table.queryType} • {table.avgExecutionTime.toFixed(1)}ms</div>
                        </div>
                        <div className="font-semibold text-dark-900 dark:text-white">
                          {formatNumber(table.queryCount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                  <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-yellow-600" />
                    Slow Queries
                  </h3>
                  <div className="space-y-1.5">
                    {dbMetrics.slowQueries.length === 0 ? (
                      <p className="text-dark-500 text-xs py-2">No slow queries</p>
                    ) : (
                      dbMetrics.slowQueries.slice(0, 5).map((query, idx) => (
                        <div
                          key={idx}
                          className="p-2 bg-dark-50 dark:bg-dark-900 rounded border-l-2 border-yellow-500 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-dark-900 dark:text-white">{query.tableName}</span>
                            <span className="font-semibold text-yellow-600">{query.executionTimeMs}ms</span>
                          </div>
                          <div className="text-[10px] text-dark-500">{query.queryType} • {query.rowsAffected} rows</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Storage Tab */}
          {activeTab === 'storage' && storageMetrics && (
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-3">Operation Trends</h3>
                <AnalyticsChart
                  data={storageMetrics.timeSeries}
                  series={[
                    { key: 'uploadCount', label: 'Uploads', color: '#9333ea' },
                    { key: 'downloadCount', label: 'Downloads', color: '#2563eb' },
                  ]}
                />
              </div>

              <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2">Operation Breakdown</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {storageMetrics.operationBreakdown.map((op, idx) => (
                    <div key={idx} className="p-2 bg-dark-50 dark:bg-dark-900 rounded text-xs">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-dark-900 dark:text-white capitalize">{op.operationType}</span>
                        <span className="font-semibold text-dark-900 dark:text-white">{formatNumber(op.operationCount)}</span>
                      </div>
                      <div className="text-[10px] text-dark-500">
                        {formatBytes(op.totalBytes)} total • {formatBytes(op.avgFileSize)} avg
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* API Tab */}
      {activeTab === 'api' && (
        <div className="space-y-3">
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-dark-100 dark:bg-dark-800 rounded p-0.5 w-fit">
            {[
              { id: 'logs', label: 'Logs' },
              { id: 'stats', label: 'Stats' },
              { id: 'settings', label: 'Settings' },
            ].map((subTab) => (
              <button
                key={subTab.id}
                onClick={() => setApiSubTab(subTab.id as any)}
                className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                  apiSubTab === subTab.id
                    ? 'bg-white dark:bg-dark-700 text-dark-900 dark:text-white shadow-sm'
                    : 'text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-200'
                }`}
              >
                {subTab.label}
              </button>
            ))}
          </div>

          {apiSubTab === 'logs' && <RequestLogsListTab />}
          {apiSubTab === 'stats' && <RequestLogsStatsTab />}
          {apiSubTab === 'settings' && <RequestLogsSettingsTab />}
        </div>
      )}
    </div>
  );
};

// Helper Components
const MetricCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: any;
  trend: number | null;
  trendLabel?: string;
  color: 'blue' | 'green' | 'purple';
}) => {
  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
    green: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  };

  return (
    <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded ${colorClasses[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-dark-500 dark:text-dark-400 truncate">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <p className="text-lg font-bold text-dark-900 dark:text-white">{value}</p>
            <p className="text-[10px] text-dark-500 truncate">{subtitle}</p>
          </div>
        </div>
      </div>
      {trend !== null && trend > 0 && (
        <div className="mt-2 pt-2 border-t border-dark-100 dark:border-dark-700 flex items-center gap-1">
          {trend > 5 ? (
            <TrendingUp className="w-3 h-3 text-red-500" />
          ) : (
            <TrendingDown className="w-3 h-3 text-green-500" />
          )}
          <span className="text-[10px] text-dark-500">
            {trendLabel}: {trend.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between text-xs">
    <span className="text-dark-500 dark:text-dark-400">{label}</span>
    <span className="font-medium text-dark-900 dark:text-white">{value}</span>
  </div>
);

const AnalyticsChart = ({
  data,
  series,
}: {
  data: TimeSeriesDataPoint[];
  series: { key: keyof TimeSeriesDataPoint; label: string; color: string }[];
}) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-8 text-dark-500 text-xs">No data available</div>
    );
  }

  const formatted = data.map((d) => ({
    ...d,
    _label: new Date(d.time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={formatted} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key as string} id={`grad-${s.key as string}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={s.color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="_label"
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'var(--color-dark-800, #1e293b)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            fontSize: '11px',
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}
          itemStyle={{ color: 'rgba(255,255,255,0.9)' }}
        />
        {series.length > 1 && (
          <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
        )}
        {series.map((s) => (
          <Area
            key={s.key as string}
            type="monotone"
            dataKey={s.key as string}
            name={s.label}
            stroke={s.color}
            strokeWidth={2}
            fill={`url(#grad-${s.key as string})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default ProjectAnalyticsTab;
