import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../../../stores/StoresIndex';
import RequestLogsService from '../../../../services/RequestLogsService';
import { History, BarChart3, List, Settings, AlertTriangle } from 'lucide-react';
import RequestLogsListTab from '../../../../components/request-logs/RequestLogsListTab';
import RequestLogsStatsTab from '../../../../components/request-logs/RequestLogsStatsTab';
import RequestLogsSettingsTab from '../../../../components/request-logs/RequestLogsSettingsTab';

type TabType = 'logs' | 'stats' | 'settings';

const ProjectRequestLogsTab = () => {
  const { currentProject } = useProjectStore();
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const [loggingEnabled, setLoggingEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    if (currentProject?.id) {
      checkLoggingStatus();
    }
  }, [currentProject?.id]);

  const checkLoggingStatus = async () => {
    if (!currentProject?.id) return;
    
    try {
      const settings = await RequestLogsService.getSettings(String(currentProject.id));
      setLoggingEnabled(settings.request_logging_enabled);
    } catch (error) {
      console.error('Error checking logging status:', error);
    }
  };

  const tabs = [
    { id: 'logs' as TabType, label: 'Request Logs', icon: List },
    { id: 'stats' as TabType, label: 'Statistics', icon: BarChart3 },
    { id: 'settings' as TabType, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-xl">
            <History className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-dark-900 dark:text-white">Request Logs</h1>
            <p className="text-dark-500 dark:text-dark-400 text-sm">
              Monitor and analyze API requests made to your project
            </p>
          </div>
        </div>
        
        {/* Status Badge */}
        {loggingEnabled !== null && (
          <div className={`px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 ${
            loggingEnabled 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
              : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
          }`}>
            <span className={`w-2 h-2 rounded-full ${loggingEnabled ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {loggingEnabled ? 'Logging Active' : 'Logging Disabled'}
          </div>
        )}
      </div>

      {/* Warning if logging disabled */}
      {loggingEnabled === false && activeTab !== 'settings' && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-yellow-800 dark:text-yellow-300">Request logging is disabled</h4>
            <p className="text-sm text-yellow-700 dark:text-yellow-400 mt-1">
              Enable logging in the Settings tab to start capturing API requests.
            </p>
            <button 
              onClick={() => setActiveTab('settings')}
              className="text-sm font-medium text-yellow-800 dark:text-yellow-300 hover:underline mt-2"
            >
              Go to Settings →
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-dark-200 dark:border-dark-700">
        <nav className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-dark-500 dark:text-dark-400 hover:text-dark-700 dark:hover:text-dark-300 hover:border-dark-300 dark:hover:border-dark-600'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {activeTab === 'logs' && <RequestLogsListTab />}
        {activeTab === 'stats' && <RequestLogsStatsTab />}
        {activeTab === 'settings' && (
          <RequestLogsSettingsTab />
        )}
      </div>
    </div>
  );
};

export default ProjectRequestLogsTab;
