import { useEffect, useState } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import AnalyticsService, {
  OverviewMetrics,
  ApiMetrics,
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
  Clock,
  AlertCircle,
  FileText,
  HardDrive,
} from 'lucide-react';
import LoadingSpinner from '../../../../components/elements/LoadingSpinner';
import ErrorMessage from '../../../../components/elements/ErrorMessage';

const ProjectAnalyticsTab = () => {
  const { currentProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [timeRange, setTimeRange] = useState(7); // days
  const [activeTab, setActiveTab] = useState<'overview' | 'api' | 'database' | 'storage'>('overview');

  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [apiMetrics, setApiMetrics] = useState<ApiMetrics | null>(null);
  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);

  useEffect(() => {
    if (currentProject) {
      loadAnalytics();
    }
  }, [currentProject, timeRange, activeTab]);

  const loadAnalytics = async () => {
    if (!currentProject) return;

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
      } else if (activeTab === 'api') {
        const result = await AnalyticsService.getApiMetrics(
          currentProject.id.toString(),
          timeRange,
          timeRange <= 7 ? 'hour' : 'day'
        );
        if (result.success && result.data) {
          setApiMetrics(result.data);
        } else {
          setError(result.error || 'Failed to load API metrics');
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
      <div className="text-center py-12">
        <BarChart3 className="w-16 h-16 text-dark-300 dark:text-dark-600 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-dark-900 dark:text-white mb-2">No Project Selected</h3>
        <p className="text-dark-600 dark:text-dark-300">Select a project to view analytics</p>
      </div>
    );
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`;
    return num.toString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-dark-900 dark:text-white">Analytics</h2>
          <p className="text-dark-600 dark:text-dark-300 mt-1">Monitor your project's performance and usage</p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(Number(e.target.value))}
            className="px-4 py-2 border border-dark-300 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
          >
            <option value={1}>Last 24 hours</option>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-dark-200 dark:border-dark-700">
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
              className={`px-4 py-2 flex items-center space-x-2 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-dark-600 dark:text-dark-400 hover:text-dark-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <LoadingSpinner message="Loading analytics..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        <>
          {/* Overview Tab */}
          {activeTab === 'overview' && overview && (
            <div className="space-y-6">
              {/* Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <MetricCard
                  title="API Requests"
                  value={formatNumber(overview.api.totalRequests)}
                  subtitle={`${formatNumber(overview.api.successCount)} successful`}
                  icon={Activity}
                  trend={overview.api.errorRate}
                  trendLabel="Error Rate"
                  color="blue"
                />
                <MetricCard
                  title="Database Queries"
                  value={formatNumber(overview.database.totalQueries)}
                  subtitle={`${overview.database.avgExecutionTime.toFixed(2)}ms avg`}
                  icon={Database}
                  trend={null}
                  color="green"
                />
                <MetricCard
                  title="Storage Operations"
                  value={formatNumber(overview.storage.totalOperations)}
                  subtitle={formatBytes(overview.storage.totalStorageBytes)}
                  icon={Cloud}
                  trend={null}
                  color="purple"
                />
              </div>

              {/* Detailed Stats */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2 text-blue-600" />
                    API Performance
                  </h3>
                  <div className="space-y-3">
                    <StatRow label="Total Requests" value={formatNumber(overview.api.totalRequests)} />
                    <StatRow label="Success Rate" value={`${(100 - overview.api.errorRate).toFixed(1)}%`} />
                    <StatRow label="Avg Response Time" value={`${overview.api.avgResponseTime.toFixed(2)}ms`} />
                    <StatRow label="Errors" value={formatNumber(overview.api.errorCount)} />
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center">
                    <Database className="w-5 h-5 mr-2 text-green-600" />
                    Database Performance
                  </h3>
                  <div className="space-y-3">
                    <StatRow label="Total Queries" value={formatNumber(overview.database.totalQueries)} />
                    <StatRow label="Avg Execution Time" value={`${overview.database.avgExecutionTime.toFixed(2)}ms`} />
                    <StatRow label="Rows Affected" value={formatNumber(overview.database.totalRowsAffected)} />
                  </div>
                </div>
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center">
                  <Cloud className="w-5 h-5 mr-2 text-purple-600" />
                  Storage Usage
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <StatRow label="Total Operations" value={formatNumber(overview.storage.totalOperations)} />
                  <StatRow label="Uploads" value={formatNumber(overview.storage.uploadCount)} />
                  <StatRow label="Downloads" value={formatNumber(overview.storage.downloadCount)} />
                  <StatRow label="Total Size" value={formatBytes(overview.storage.totalStorageBytes)} />
                </div>
              </div>
            </div>
          )}

          {/* API Tab */}
          {activeTab === 'api' && apiMetrics && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Request Trends</h3>
                <SimpleBarChart
                  data={apiMetrics.timeSeries}
                  valueKey="requestCount"
                  labelKey="time"
                  color="blue"
                />
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Top Endpoints</h3>
                <div className="space-y-2">
                  {apiMetrics.topEndpoints.map((endpoint, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-800 rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-mono bg-dark-200 dark:bg-dark-700 px-2 py-1 rounded">
                            {endpoint.method}
                          </span>
                          <span className="text-dark-900 dark:text-white font-medium">{endpoint.endpoint}</span>
                        </div>
                        <div className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                          {endpoint.avgResponseTime.toFixed(2)}ms avg
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-dark-900 dark:text-white">
                          {formatNumber(endpoint.requestCount)}
                        </div>
                        {endpoint.errorCount > 0 && (
                          <div className="text-sm text-red-600 dark:text-red-400">{endpoint.errorCount} errors</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Database Tab */}
          {activeTab === 'database' && dbMetrics && (
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Query Trends</h3>
                <SimpleBarChart
                  data={dbMetrics.timeSeries}
                  valueKey="queryCount"
                  labelKey="time"
                  color="green"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="card">
                  <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Top Tables</h3>
                  <div className="space-y-2">
                    {dbMetrics.topTables.map((table, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-dark-50 dark:bg-dark-800 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-dark-900 dark:text-white">{table.tableName}</div>
                          <div className="text-sm text-dark-600 dark:text-dark-400">
                            {table.queryType} • {table.avgExecutionTime.toFixed(2)}ms avg
                          </div>
                        </div>
                        <div className="text-lg font-semibold text-dark-900 dark:text-white">
                          {formatNumber(table.queryCount)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card">
                  <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center">
                    <AlertCircle className="w-5 h-5 mr-2 text-yellow-600" />
                    Slow Queries
                  </h3>
                  <div className="space-y-2">
                    {dbMetrics.slowQueries.length === 0 ? (
                      <p className="text-dark-600 dark:text-dark-400 text-sm">No slow queries found</p>
                    ) : (
                      dbMetrics.slowQueries.map((query, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-dark-50 dark:bg-dark-800 rounded-lg border-l-4 border-yellow-500"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-dark-900 dark:text-white">{query.tableName}</span>
                            <span className="text-sm font-semibold text-yellow-600">{query.executionTimeMs}ms</span>
                          </div>
                          <div className="text-sm text-dark-600 dark:text-dark-400">
                            {query.queryType} • {query.rowsAffected} rows
                          </div>
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
            <div className="space-y-6">
              <div className="card">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Operation Trends</h3>
                <SimpleBarChart
                  data={storageMetrics.timeSeries}
                  valueKey="operationCount"
                  labelKey="time"
                  color="purple"
                />
              </div>

              <div className="card">
                <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Operation Breakdown</h3>
                <div className="space-y-3">
                  {storageMetrics.operationBreakdown.map((op, idx) => (
                    <div key={idx} className="p-4 bg-dark-50 dark:bg-dark-800 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-dark-900 dark:text-white capitalize">
                          {op.operationType}
                        </span>
                        <span className="text-lg font-semibold text-dark-900 dark:text-white">
                          {formatNumber(op.operationCount)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm text-dark-600 dark:text-dark-400">
                        <span>Total: {formatBytes(op.totalBytes)}</span>
                        <span>Avg: {formatBytes(op.avgFileSize)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
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
    <div className="card">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-dark-500 dark:text-dark-400 mb-1">{title}</p>
          <p className="text-2xl font-bold text-dark-900 dark:text-white mb-1">{value}</p>
          <p className="text-sm text-dark-600 dark:text-dark-300">{subtitle}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {trend !== null && (
        <div className="mt-4 pt-4 border-t border-dark-200 dark:border-dark-700 flex items-center space-x-2">
          {trend > 0 ? (
            <TrendingUp className="w-4 h-4 text-red-600" />
          ) : (
            <TrendingDown className="w-4 h-4 text-green-600" />
          )}
          <span className="text-sm text-dark-600 dark:text-dark-400">
            {trendLabel}: {trend.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
  );
};

const StatRow = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-center justify-between py-2">
    <span className="text-dark-600 dark:text-dark-400">{label}</span>
    <span className="font-semibold text-dark-900 dark:text-white">{value}</span>
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
      <div className="text-center py-8 text-dark-600 dark:text-dark-400">
        No data available for this time period
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d[valueKey] || 0));

  const formatTime = (timeStr: string) => {
    const date = new Date(timeStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit' });
  };

  return (
    <div className="space-y-2">
      {data.map((item, idx) => {
        const value = item[valueKey] || 0;
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0;
        return (
          <div key={idx} className="flex items-center space-x-3">
            <div className="w-24 text-xs text-dark-600 dark:text-dark-400 text-right">
              {formatTime(item[labelKey])}
            </div>
            <div className="flex-1 bg-dark-200 dark:bg-dark-700 rounded-full h-6 overflow-hidden">
              <div
                className="h-full rounded-full transition-all flex items-center justify-end pr-2"
                style={{
                  width: `${percentage}%`,
                  backgroundColor:
                    color === 'blue'
                      ? '#2563eb'
                      : color === 'green'
                      ? '#16a34a'
                      : '#9333ea',
                }}
              >
                {value > 0 && (
                  <span className="text-xs text-white font-medium">{value}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProjectAnalyticsTab;

