import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/StoresIndex';
import RequestLogsService, { RequestLogSettings } from '../../services/RequestLogsService';
import ToastUtils from '../../utils/ToastUtils';
import { Loader2, Settings, Save } from 'lucide-react';

const RequestLogsSettingsTab = () => {
  const { currentProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<RequestLogSettings>({
    request_logging_enabled: false,
    request_log_retention: 'weekly'
  });

  useEffect(() => {
    if (currentProject?.id) {
      loadSettings();
    }
  }, [currentProject?.id]);

  const loadSettings = async () => {
    if (!currentProject?.id) return;
    
    setLoading(true);
    try {
      const settingsData = await RequestLogsService.getSettings(String(currentProject.id));
      setSettings(settingsData);
    } catch (error: any) {
      console.error('Error loading settings:', error);
      ToastUtils.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!currentProject?.id) return;
    
    setSaving(true);
    try {
      const updatedSettings = await RequestLogsService.updateSettings(
        String(currentProject.id),
        settings
      );
      setSettings(updatedSettings);
      ToastUtils.success('Request logging settings saved');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      ToastUtils.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable/Disable Card */}
      <div className="card">
        <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Logging Configuration
        </h3>
        
        <div className="space-y-6">
          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between p-4 bg-dark-50 dark:bg-dark-800 rounded-lg">
            <div>
              <label className="font-medium text-dark-900 dark:text-white">Enable Request Logging</label>
              <p className="text-sm text-dark-500 dark:text-dark-400 mt-1">
                Automatically log all API requests made through this project's endpoints
              </p>
            </div>
            <button
              onClick={() => setSettings({ ...settings, request_logging_enabled: !settings.request_logging_enabled })}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                settings.request_logging_enabled ? 'bg-primary-600' : 'bg-dark-300 dark:bg-dark-600'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                  settings.request_logging_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Retention Period */}
          <div>
            <label className="block font-medium text-dark-900 dark:text-white mb-2">
              Log Retention Period
            </label>
            <p className="text-sm text-dark-500 dark:text-dark-400 mb-3">
              Logs older than this period will be automatically deleted daily at 3 AM UTC
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'daily', label: '1 Day', desc: 'Delete after 24 hours' },
                { value: 'weekly', label: '7 Days', desc: 'Delete after 1 week' },
                { value: 'monthly', label: '30 Days', desc: 'Delete after 1 month' },
                { value: 'disabled', label: 'Manual Only', desc: 'No auto-delete' },
              ].map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSettings({ ...settings, request_log_retention: option.value as any })}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    settings.request_log_retention === option.value
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-dark-200 dark:border-dark-700 hover:border-dark-300 dark:hover:border-dark-600'
                  }`}
                >
                  <div className={`font-medium ${
                    settings.request_log_retention === option.value
                      ? 'text-primary-700 dark:text-primary-400'
                      : 'text-dark-900 dark:text-white'
                  }`}>
                    {option.label}
                  </div>
                  <div className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                    {option.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-800 dark:text-blue-300 mb-2">How it works</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-400 space-y-1">
              <li>• All requests to <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">/app-api/*</code> endpoints are logged</li>
              <li>• Logs include method, URL, status code, duration, and payload data</li>
              <li>• Large payloads are automatically truncated to save storage</li>
              <li>• Use the Logs tab to view and filter request history</li>
            </ul>
          </div>

          <button
            onClick={handleSaveSettings}
            disabled={saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestLogsSettingsTab;
