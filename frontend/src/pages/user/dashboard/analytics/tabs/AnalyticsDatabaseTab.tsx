import { AlertCircle } from 'lucide-react';
import { AnalyticsDatabaseTabProps } from './AnalyticsTabTypes';
import { AnalyticsChart } from './AnalyticsTabShared';
import { formatNumber } from './AnalyticsTabUtils';

const AnalyticsDatabaseTab = ({ dbMetrics }: AnalyticsDatabaseTabProps) => {
  return (
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
                <div className="font-semibold text-dark-900 dark:text-white">{formatNumber(table.queryCount)}</div>
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
  );
};

export default AnalyticsDatabaseTab;
