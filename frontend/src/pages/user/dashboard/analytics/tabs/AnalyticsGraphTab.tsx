import { Cloud, Database } from 'lucide-react';
import { AnalyticsGraphTabProps } from './AnalyticsTabTypes';
import { AnalyticsChart } from './AnalyticsTabShared';

const AnalyticsGraphTab = ({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  apiMetrics,
  dbMetrics,
  storageMetrics,
}: AnalyticsGraphTabProps) => {
  const today = new Date().toISOString().split('T')[0];

  const handleStartDateChange = (nextStartDate: string) => {
    onStartDateChange(nextStartDate);
    // Keep range valid so parent fetch always receives coherent bounds.
    if (nextStartDate > endDate) {
      onEndDateChange(nextStartDate);
    }
  };

  const handleEndDateChange = (nextEndDate: string) => {
    onEndDateChange(nextEndDate);
    // Keep range valid so parent fetch always receives coherent bounds.
    if (nextEndDate < startDate) {
      onStartDateChange(nextEndDate);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={startDate}
          max={endDate}
          onChange={(e) => handleStartDateChange(e.target.value)}
          className="px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
        />
        <span className="text-xs text-dark-400">to</span>
        <input
          type="date"
          value={endDate}
          min={startDate}
          max={today}
          onChange={(e) => handleEndDateChange(e.target.value)}
          className="px-2 py-1 text-xs border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
        />
      </div>

      <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="w-4 h-4 text-sky-600" />
          <h3 className="text-sm font-semibold text-dark-900 dark:text-white">API Request Logs</h3>
        </div>
        {apiMetrics?.timeSeries?.length ? (
          <AnalyticsChart
            data={apiMetrics.timeSeries}
            series={[
              { key: 'requestCount', label: 'Requests', color: '#0ea5e9' },
              { key: 'errorCount', label: 'Errors', color: '#ef4444' },
            ]}
          />
        ) : (
          <p className="text-xs text-dark-500 py-8 text-center">No API log data for this period</p>
        )}
      </div>

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

      <div className="p-4 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="flex items-center gap-2 mb-4">
          <Cloud className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-dark-900 dark:text-white">Storage Bytes Transferred</h3>
        </div>
        {storageMetrics?.timeSeries?.length ? (
          <AnalyticsChart
            data={storageMetrics.timeSeries}
            series={[{ key: 'totalBytes', label: 'Bytes', color: '#0ea5e9' }]}
          />
        ) : (
          <p className="text-xs text-dark-500 py-8 text-center">No storage data for this period</p>
        )}
      </div>
    </div>
  );
};

export default AnalyticsGraphTab;
