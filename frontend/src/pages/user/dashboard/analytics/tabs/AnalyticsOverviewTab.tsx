import { Activity, BarChart3, Cloud, Database, Zap } from 'lucide-react';
import { AnalyticsOverviewTabProps } from './AnalyticsTabTypes';
import { MetricCard, StatRow } from './AnalyticsTabShared';
import { formatBytes, formatNumber } from './AnalyticsTabUtils';

const AnalyticsOverviewTab = ({ apiMetrics, dbSummary, storageSummary, apiStats }: AnalyticsOverviewTabProps) => {
  return (
    <div className="space-y-4">
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
                  <span
                    key={method}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${colors[method] || 'bg-gray-100 text-gray-700'}`}
                  >
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
  );
};

export default AnalyticsOverviewTab;
