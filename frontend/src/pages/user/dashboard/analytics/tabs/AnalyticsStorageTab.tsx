import { AnalyticsStorageTabProps } from './AnalyticsTabTypes';
import { AnalyticsChart } from './AnalyticsTabShared';
import { formatBytes, formatNumber } from './AnalyticsTabUtils';

const AnalyticsStorageTab = ({ storageMetrics }: AnalyticsStorageTabProps) => {
  return (
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
              <div className="text-[10px] text-dark-500">{formatBytes(op.totalBytes)} total • {formatBytes(op.avgFileSize)} avg</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyticsStorageTab;
