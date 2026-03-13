import { useCallback, useEffect, useState } from 'react';
import { Activity, BarChart3, Cloud, Database, LineChart as LineChartIcon } from 'lucide-react';
import ErrorMessage from '../../../../components/elements/ErrorMessage';
import LoadingSpinner from '../../../../components/elements/LoadingSpinner';
import AnalyticsService, { ApiMetrics, DatabaseMetrics, StorageMetrics } from '../../../../services/AnalyticsService';
import RequestLogsService, { RequestLogEntry } from '../../../../services/RequestLogsService';
import { useProjectStore, useRequestLogsStore } from '../../../../stores/StoresIndex';
import AnalyticsApiTab from './tabs/AnalyticsApiTab';
import AnalyticsDatabaseTab from './tabs/AnalyticsDatabaseTab';
import AnalyticsGraphTab from './tabs/AnalyticsGraphTab';
import AnalyticsOverviewTab from './tabs/AnalyticsOverviewTab';
import AnalyticsStorageTab from './tabs/AnalyticsStorageTab';
import {
  ActiveAnalyticsTab,
  ApiMetricsSummary,
  ApiSubTab,
  DatabaseSummary,
  StorageSummary,
} from './tabs/AnalyticsTabTypes';

const toBucketKey = (date: Date, groupBy: 'hour' | 'day'): string => {
  if (groupBy === 'hour') {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        0,
        0,
        0
      )
    ).toISOString();
  }

  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0)).toISOString();
};

const buildApiMetricsFromLogs = (logs: RequestLogEntry[], groupBy: 'hour' | 'day'): ApiMetrics => {
  const buckets = new Map<string, { requestCount: number; errorCount: number; totalResponseMs: number; sampledResponses: number }>();
  const endpoints = new Map<string, { endpoint: string; method: string; requestCount: number; totalDuration: number; errorCount: number }>();

  logs.forEach((log) => {
    const createdAt = new Date(log.created_at);
    if (Number.isNaN(createdAt.getTime())) return;

    const bucketKey = toBucketKey(createdAt, groupBy);
    const current = buckets.get(bucketKey) || {
      requestCount: 0,
      errorCount: 0,
      totalResponseMs: 0,
      sampledResponses: 0,
    };

    current.requestCount += 1;
    const isError = (log.status_code || 0) >= 400 || Boolean(log.error_message);
    if (isError) current.errorCount += 1;
    if (typeof log.duration_ms === 'number' && log.duration_ms >= 0) {
      current.totalResponseMs += log.duration_ms;
      current.sampledResponses += 1;
    }
    buckets.set(bucketKey, current);

    const endpointKey = `${log.method}:${log.url}`;
    const endpointCurrent = endpoints.get(endpointKey) || {
      endpoint: log.url,
      method: log.method,
      requestCount: 0,
      totalDuration: 0,
      errorCount: 0,
    };
    endpointCurrent.requestCount += 1;
    if (isError) endpointCurrent.errorCount += 1;
    if (typeof log.duration_ms === 'number' && log.duration_ms >= 0) {
      endpointCurrent.totalDuration += log.duration_ms;
    }
    endpoints.set(endpointKey, endpointCurrent);
  });

  const timeSeries = Array.from(buckets.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([time, values]) => ({
      time,
      requestCount: values.requestCount,
      errorCount: values.errorCount,
      avgResponseTime: values.sampledResponses > 0 ? Math.round(values.totalResponseMs / values.sampledResponses) : 0,
    }));

  const topEndpoints = Array.from(endpoints.values())
    .sort((a, b) => b.requestCount - a.requestCount)
    .slice(0, 10)
    .map((item) => ({
      endpoint: item.endpoint,
      method: item.method,
      requestCount: item.requestCount,
      avgResponseTime: item.requestCount > 0 ? Math.round(item.totalDuration / item.requestCount) : 0,
      errorCount: item.errorCount,
    }));

  return { timeSeries, topEndpoints };
};

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
  const [activeTab, setActiveTab] = useState<ActiveAnalyticsTab>('overview');

  const timeRange = Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000));
  const [apiSubTab, setApiSubTab] = useState<ApiSubTab>('logs');

  const [dbMetrics, setDbMetrics] = useState<DatabaseMetrics | null>(null);
  const [storageMetrics, setStorageMetrics] = useState<StorageMetrics | null>(null);
  const [apiGraphMetrics, setApiGraphMetrics] = useState<ApiMetrics | null>(null);

  // Set project ID for request logs store
  // Convert timeRange (days) to hours for API stats
  const getHoursFromDays = (days: number) => days * 24;

  const loadAnalytics = useCallback(async () => {
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
        const [apiResult, dbResult, storageResult] = await Promise.all([
          AnalyticsService.getApiMetrics(
            currentProject.id.toString(),
            timeRange,
            timeRange <= 7 ? 'hour' : 'day'
          ),
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
        if (apiResult.success && apiResult.data && apiResult.data.timeSeries.length > 0) {
          setApiGraphMetrics(apiResult.data);
        } else {
          // Fallback: build graph series from request logs when analytics API returns empty.
          const limit = 500;
          const projectId = String(currentProject.id);
          const allLogs: RequestLogEntry[] = [];
          let offset = 0;
          let hasMore = true;
          let pages = 0;

          while (hasMore && pages < 10) {
            const logsResponse = await RequestLogsService.listLogs(projectId, {
              start_date: startDate,
              end_date: endDate,
              limit,
              offset,
            });
            allLogs.push(...logsResponse.logs);
            hasMore = logsResponse.pagination.has_more;
            offset += limit;
            pages += 1;
          }

          setApiGraphMetrics(buildApiMetricsFromLogs(allLogs, timeRange <= 7 ? 'hour' : 'day'));
        }
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
  }, [activeTab, currentProject, endDate, fetchApiStats, startDate, timeRange]);

  useEffect(() => {
    if (currentProject?.id) {
      setProjectId(String(currentProject.id));
    }
  }, [currentProject?.id, setProjectId]);

  useEffect(() => {
    if (currentProject) {
      loadAnalytics();
    }
  }, [currentProject, endDate, loadAnalytics, startDate]);

  if (!currentProject) {
    return (
      <div className="text-center py-8">
        <BarChart3 className="w-10 h-10 text-dark-300 dark:text-dark-600 mx-auto mb-2" />
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-1">No Project Selected</h3>
        <p className="text-sm text-dark-600 dark:text-dark-300">Select a project to view analytics</p>
      </div>
    );
  }

  const apiMetrics: ApiMetricsSummary | null = apiStats
    ? {
    totalRequests: apiStats.total_requests,
    errorCount: apiStats.error_count,
    errorRate: apiStats.total_requests > 0 ? (apiStats.error_count / apiStats.total_requests) * 100 : 0,
    successCount: apiStats.total_requests - apiStats.error_count,
    avgResponseTime: apiStats.response_time.avg_ms,
    maxResponseTime: apiStats.response_time.max_ms,
      }
    : null;

  const dbSummary: DatabaseSummary | null = dbMetrics
    ? {
    totalQueries: dbMetrics.topTables.reduce((sum, t) => sum + t.queryCount, 0),
    avgExecutionTime: dbMetrics.topTables.length > 0
      ? dbMetrics.topTables.reduce((sum, t) => sum + t.avgExecutionTime, 0) / dbMetrics.topTables.length
      : 0,
    totalRowsAffected: dbMetrics.topTables.reduce((sum, t) => sum + (t.queryCount * 10), 0), // Estimate
      }
    : null;

  const storageSummary: StorageSummary | null = storageMetrics
    ? {
    totalOperations: storageMetrics.operationBreakdown.reduce((sum, op) => sum + op.operationCount, 0),
    uploadCount: storageMetrics.operationBreakdown.find(op => op.operationType === 'upload')?.operationCount || 0,
    downloadCount: storageMetrics.operationBreakdown.find(op => op.operationType === 'download')?.operationCount || 0,
    totalStorageBytes: storageMetrics.operationBreakdown.reduce((sum, op) => sum + op.totalBytes, 0),
      }
    : null;

  const isOverviewLoading = loading || apiStatsLoading;

  const renderNonApiContent = () => {
    if (activeTab === 'overview') {
      return (
        <AnalyticsOverviewTab
          apiMetrics={apiMetrics}
          dbSummary={dbSummary}
          storageSummary={storageSummary}
          apiStats={apiStats}
        />
      );
    }

    if (activeTab === 'graph') {
      return (
        <AnalyticsGraphTab
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          apiMetrics={apiGraphMetrics}
          dbMetrics={dbMetrics}
          storageMetrics={storageMetrics}
        />
      );
    }

    if (activeTab === 'database' && dbMetrics) {
      return <AnalyticsDatabaseTab dbMetrics={dbMetrics} />;
    }

    if (activeTab === 'storage' && storageMetrics) {
      return <AnalyticsStorageTab storageMetrics={storageMetrics} />;
    }

    return null;
  };

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
              onClick={() => setActiveTab(tab.id as ActiveAnalyticsTab)}
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

      {activeTab === 'api' ? (
        <AnalyticsApiTab apiSubTab={apiSubTab} setApiSubTab={setApiSubTab} />
      ) : (activeTab === 'overview' ? isOverviewLoading : loading) ? (
        <LoadingSpinner text="Loading..." />
      ) : error ? (
        <ErrorMessage message={error} />
      ) : (
        renderNonApiContent()
      )}
    </div>
  );
};

export default ProjectAnalyticsTab;
