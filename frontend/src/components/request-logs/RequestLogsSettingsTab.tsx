import React, { useState, useEffect } from 'react';
import { useProjectStore, useRequestLogsStore } from '../../stores/StoresIndex';
import ToastUtils from '../../utils/ToastUtils';
import { Loader2, Save, Trash2 } from 'lucide-react';

const RequestLogsSettingsTab = () => {
  const { currentProject } = useProjectStore();
  const {
    settings,
    settingsLoading,
    fetchSettings,
    updateSettings,
    cleanup,
    setProjectId,
  } = useRequestLogsStore();

  const [localSettings, setLocalSettings] = useState(settings);
  const [cleanupDays, setCleanupDays] = useState(7);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [saving, setSaving] = useState(false);

  // Set project ID when component mounts or project changes
  useEffect(() => {
    if (currentProject?.id) {
      setProjectId(String(currentProject.id));
    }
  }, [currentProject?.id]);

  // Fetch settings on mount
  useEffect(() => {
    if (currentProject?.id) {
      fetchSettings(String(currentProject.id));
    }
  }, [currentProject?.id]);

  // Sync local settings with store
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSaveSettings = async () => {
    if (!currentProject?.id) return;
    
    setSaving(true);
    const success = await updateSettings(String(currentProject.id), localSettings);
    setSaving(false);
    
    if (success) {
      ToastUtils.success('Settings saved');
    } else {
      ToastUtils.error('Failed to save settings');
    }
  };

  const handleCleanup = async () => {
    if (!currentProject?.id) return;
    
    setCleaningUp(true);
    const result = await cleanup(String(currentProject.id), cleanupDays);
    setCleaningUp(false);
    
    if (result) {
      ToastUtils.success(`Deleted ${result.deleted_count} logs older than ${cleanupDays} days`);
    } else {
      ToastUtils.error('Failed to cleanup logs');
    }
  };

  if (settingsLoading && !settings.request_logging_enabled && settings.request_log_retention === 'weekly') {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div>
          <div className="text-sm font-medium text-dark-900 dark:text-white">Enable Request Logging</div>
          <div className="text-xs text-dark-500 dark:text-dark-400">Log all API requests to this project</div>
        </div>
        <button
          onClick={() => setLocalSettings({ ...localSettings, request_logging_enabled: !localSettings.request_logging_enabled })}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
            localSettings.request_logging_enabled ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform`}
            style={{ transform: localSettings.request_logging_enabled ? 'translateX(18px)' : 'translateX(2px)' }}
          />
        </button>
      </div>

      {/* Retention Period */}
      <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="text-sm font-medium text-dark-900 dark:text-white mb-2">Retention Period</div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { value: 'daily', label: '1 Day' },
            { value: 'weekly', label: '7 Days' },
            { value: 'monthly', label: '30 Days' },
            { value: 'disabled', label: 'Manual' },
          ].map((option) => (
            <button
              key={option.value}
              onClick={() => setLocalSettings({ ...localSettings, request_log_retention: option.value as any })}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                localSettings.request_log_retention === option.value
                  ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 ring-1 ring-primary-500'
                  : 'bg-dark-100 dark:bg-dark-700 text-dark-600 dark:text-dark-300 hover:bg-dark-200 dark:hover:bg-dark-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-dark-500 dark:text-dark-400 mt-2">
          Logs are auto-deleted daily at 3 AM UTC based on this setting
        </p>
      </div>

      {/* Save Button */}
      <button
        onClick={handleSaveSettings}
        disabled={saving || settingsLoading}
        className="btn-primary text-sm px-4 py-1.5 flex items-center gap-1.5"
      >
        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
        Save Settings
      </button>

      {/* Manual Cleanup */}
      <div className="p-3 bg-white dark:bg-dark-800 rounded-lg border border-red-200 dark:border-red-900/50">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium text-dark-900 dark:text-white">Manual Cleanup</div>
            <div className="text-xs text-dark-500 dark:text-dark-400">Delete old logs manually</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={cleanupDays}
              onChange={(e) => setCleanupDays(Number(e.target.value))}
              min={1}
              max={365}
              className="w-14 px-2 py-1 text-sm border border-dark-200 dark:border-dark-700 rounded bg-white dark:bg-dark-700 text-dark-900 dark:text-white"
            />
            <span className="text-xs text-dark-500">days</span>
            <button
              onClick={handleCleanup}
              disabled={cleaningUp}
              className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded hover:bg-red-100 dark:hover:bg-red-900/30 flex items-center gap-1"
            >
              {cleaningUp ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequestLogsSettingsTab;
