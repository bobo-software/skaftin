import { useEffect, useState } from 'react';
import { useProjectStore, useRequestLogsStore } from '../../../../stores/StoresIndex';
import AnalyticsService, {
  DatabaseMetrics,
  StorageMetrics,
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
} from 'lucide-react';
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
  const [timeRange, setTimeRange] = useState(7);
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'database' | 'storage'>('overview');
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
  }, [currentProject, timeRange, activeTab]);

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
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
        >
          <option value={1}>24h</option>
          <option value={7}>7d</option>
          <option value={30}>30d</option>
          <option value={90}>90d</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-dark-200 dark:border-dark-700">
        {[
          { id: 'overview', label: 'Overview', icon: Activity },
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

      {isOverviewLoading && activeTab === 'overview' ? (
        <LoadingSpinner text="Loading..." />
      ) : loading && activeTab !== 'overview' ? (
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

          {/* Database Tab */}
          {activeTab === 'database' && dbMetrics && (
            <div className="space-y-3">
              <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2">Query Trends</h3>
                <SimpleBarChart
                  data={dbMetrics.timeSeries}
                  valueKey="queryCount"
                  labelKey="time"
                  color="green"
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
                <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2">Operation Trends</h3>
                <SimpleBarChart
                  data={storageMetrics.timeSeries}
                  valueKey="operationCount"
                  labelKey="time"
                  color="purple"
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

const SimpleBarChart = ({
  data,
  valueKey,
  labelKey,
  color,
}: {
  data: any[];
  valueKey: string;
  labelKey: string;
  color: string;
}) => {
  if (data.length === 0) {
    return (
      <div className="text-center py-4 text-dark-500 text-xs">
        No data available
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d[valueKey] || 0));

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const barColor = color === 'blue' ? '#2563eb' : color === 'green' ? '#16a34a' : '#9333ea';

  return (
    <div className="space-y-1">
      {data.slice(0, 8).map((item, idx) => {
        const value = item[valueKey] || 0;
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div key={idx} className="flex items-center gap-2 text-xs">
            <div className="w-16 text-[10px] text-dark-500 text-right truncate">
              {formatTime(item[labelKey])}
            </div>
            <div className="flex-1 bg-dark-100 dark:bg-dark-700 rounded h-4 overflow-hidden">
              <div
                className="h-full rounded flex items-center justify-end pr-1.5"
                style={{ width: `${Math.max(percentage, value > 0 ? 8 : 0)}%`, backgroundColor: barColor }}
              >
                {value > 0 && <span className="text-[9px] text-white font-medium">{value}</span>}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectAnalyticsTab;
