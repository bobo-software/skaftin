import { RequestLogsListTab, RequestLogsSettingsTab, RequestLogsStatsTab } from '@components/ComponentsIndex';
import { AnalyticsApiTabProps, ApiSubTab } from './AnalyticsTabTypes';

const API_SUB_TABS: { id: ApiSubTab; label: string }[] = [
  { id: 'logs', label: 'Logs' },
  { id: 'stats', label: 'Stats' },
  { id: 'settings', label: 'Settings' },
];

const AnalyticsApiTab = ({ apiSubTab, setApiSubTab }: AnalyticsApiTabProps) => {
  return (
    <div className="space-y-3">
      <div className="flex gap-1 bg-dark-100 dark:bg-dark-800 rounded p-0.5 w-fit">
        {API_SUB_TABS.map((subTab) => (
          <button
            key={subTab.id}
            onClick={() => setApiSubTab(subTab.id)}
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
  );
};

export default AnalyticsApiTab;
