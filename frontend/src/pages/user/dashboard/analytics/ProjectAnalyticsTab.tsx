import { useEffect, useState } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import AnalyticsService, {
  OverviewMetrics,
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
} from 'lucide-react';
import LoadingSpinner from '../../../../components/elements/LoadingSpinner';
import ErrorMessage from '../../../../components/elements/ErrorMessage';
import { RequestLogsListTab, RequestLogsStatsTab, RequestLogsSettingsTab } from '@components/ComponentsIndex';

const ProjectAnalyticsTab = () => {
  const { currentProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState(7);
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'database' | 'storage'>('overview');
  const [apiSubTab, setApiSubTab] = useState<'logs' | 'stats' | 'settings'>('logs');

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadAnalytics();
    }
  }, [currentProject, timeRange, activeTab]);

  const loadAnalytics = async () => {
    if (!currentProject) return;
    if (activeTab === 'api') return;

    setLoading(true);
    setError('');

    try {
      if (activeTab === 'overview') {
        const result = await AnalyticsService.getOverview(currentProject.id.toString(), timeRange);
        if (result.success && result.data) {
          setOverview(result.data);
        } else {
          setError(result.error || 'Failed to load overview metrics');
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

      {loading ? (
        <LoadingSpinner text="Loading..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-4">
              {/* Overview Cards */}
              <div className="grid grid-cols-3 gap-3">
                <MetricCard
                  title="API Requests"
                  value={formatNumber(overview.api.totalRequests)}
                  subtitle={`${formatNumber(overview.api.successCount)} ok`}
                  icon={Activity}
                  trend={overview.api.errorRate}
                  trendLabel="err"
                  color="blue"
                />
                <MetricCard
                  title="DB Queries"
                  value={formatNumber(overview.database.totalQueries)}
                  subtitle={`${overview.database.avgExecutionTime.toFixed(1)}ms avg`}
                  icon={Database}
                  trend={null}
                  color="green"
                />
                <MetricCard
                  title="Storage Ops"
                  value={formatNumber(overview.storage.totalOperations)}
                  subtitle={formatBytes(overview.storage.totalStorageBytes)}
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
                  <div className="space-y-1">
                    <StatRow label="Total Requests" value={formatNumber(overview.api.totalRequests)} />
                    <StatRow label="Success Rate" value={`${(100 - overview.api.errorRate).toFixed(1)}%`} />
                    <StatRow label="Avg Response" value={`${overview.api.avgResponseTime.toFixed(1)}ms`} />
                    <StatRow label="Errors" value={formatNumber(overview.api.errorCount)} />
                  </div>
                </div>

                <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                  <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                    <Database className="w-3.5 h-3.5 text-green-600" />
                    Database Performance
                  </h3>
                  <div className="space-y-1">
                    <StatRow label="Total Queries" value={formatNumber(overview.database.totalQueries)} />
                    <StatRow label="Avg Execution" value={`${overview.database.avgExecutionTime.toFixed(1)}ms`} />
                    <StatRow label="Rows Affected" value={formatNumber(overview.database.totalRowsAffected)} />
                  </div>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <Cloud className="w-3.5 h-3.5 text-purple-600" />
                  Storage Usage
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  <StatRow label="Operations" value={formatNumber(overview.storage.totalOperations)} />
                  <StatRow label="Uploads" value={formatNumber(overview.storage.uploadCount)} />
                  <StatRow label="Downloads" value={formatNumber(overview.storage.downloadCount)} />
                  <StatRow label="Total Size" value={formatBytes(overview.storage.totalStorageBytes)} />
                </div>
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
      {trend !== null && (
        <div className="mt-2 pt-2 border-t border-dark-100 dark:border-dark-700 flex items-center gap-1">
          {trend > 0 ? (
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
