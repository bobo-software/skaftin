import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Mail, AlertCircle, CheckCircle } from 'lucide-react';
import AuthSettingsService, { AuthSettings, EmailProvider } from '../../../../../services/AuthSettingsService';
import RolesService, { Role } from '../../../../../services/RolesService';
import { AppButton } from '../../../../../components/ComponentsIndex';

const AuthGeneralSettingsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  const [emailProviders, setEmailProviders] = useState<EmailProvider[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const data = await AuthSettingsService.getAuthSettings(projectId);
      setSettings(data);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchEmailProviders = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const providers = await AuthSettingsService.getEmailProviders(projectId);
      setEmailProviders(providers);
    } catch (error) {
      console.error('Error fetching email providers:', error);
    }
  }, [projectId]);

  const fetchRoles = useCallback(async () => {
    if (!projectId) return;
    
    try {
      const rolesData = await RolesService.listRoles(projectId);
      setRoles(rolesData);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  }, [projectId]);

  useEffect(() => {
    if (projectId) {
      fetchSettings();
      fetchEmailProviders();
      fetchRoles();
    }
  }, [projectId, fetchSettings, fetchEmailProviders, fetchRoles]);

  const handleSave = async () => {
    if (!projectId || !settings) return;

    setSaving(true);
    setMessage(null);

    try {
      await AuthSettingsService.updateAuthSettings(projectId, {
        allow_duplicate_emails: settings.allow_duplicate_emails,
        require_email_verification: settings.require_email_verification,
        require_phone_verification: settings.require_phone_verification,
        enable_password_reset: settings.enable_password_reset,
        enable_mfa: settings.enable_mfa,
        registration_enabled: settings.registration_enabled,
        auth_enabled: settings.auth_enabled,
        default_role_id: settings.default_role_id,
        email_provider_id: settings.email_provider_id,
      });
      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <div className="max-w-4xl">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <p className="text-red-600 dark:text-red-400">Failed to load auth settings.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">General Settings</h1>
          <p className="text-dark-600 dark:text-dark-400">
            Configure authentication settings and feature toggles for your application.
          </p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border ${
            message.type === 'success'
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600 dark:text-green-400'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
          }`}>
            <div className="flex items-center">
              {message.type === 'success' ? (
                <CheckCircle className="w-5 h-5 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 mr-2" />
              )}
              {message.text}
            </div>
          </div>
        )}

        {/* Settings Form */}
        <div className="space-y-6">
          {/* Auth System */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Authentication System</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Enable Authentication</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Turn on/off the entire authentication system
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.auth_enabled}
                    onChange={(e) => setSettings({ ...settings, auth_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Enable Registration</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Allow new users to register
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.registration_enabled}
                    onChange={(e) => setSettings({ ...settings, registration_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Email Settings */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Email Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-dark-900 dark:text-white mb-2">
                  Email Provider
                </label>
                {emailProviders.length === 0 ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-start">
                      <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">No email provider configured</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Please configure an email provider in the Communications section to send auth emails.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <select
                    value={settings.email_provider_id || ''}
                    onChange={(e) => setSettings({ ...settings, email_provider_id: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                  >
                    <option value="">No provider selected</option>
                    {emailProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} ({provider.from_email})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                  Select the email provider to use for sending authentication emails
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Require Email Verification</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Users must verify their email before accessing the app
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.require_email_verification}
                    onChange={(e) => setSettings({ ...settings, require_email_verification: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* User Policies */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">User Policies</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Allow Duplicate Emails</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Allow multiple users with the same email address
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.allow_duplicate_emails}
                    onChange={(e) => setSettings({ ...settings, allow_duplicate_emails: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Password & Security */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Password & Security</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Enable Password Reset</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Allow users to reset their password via email
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enable_password_reset}
                    onChange={(e) => setSettings({ ...settings, enable_password_reset: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Enable Multi-Factor Authentication (MFA)</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Require additional verification step (Coming soon)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked={settings.enable_mfa}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Require Phone Verification</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Users must verify their phone number (Coming soon)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer opacity-50">
                  <input
                    type="checkbox"
                    checked={settings.require_phone_verification}
                    disabled
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600"></div>
                </label>
              </div>
            </div>
          </div>

          {/* Default Role */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Default Role</h3>
            
            <div>
              <label className="block font-medium text-dark-900 dark:text-white mb-2">
                Default Role for New Users
              </label>
              <select
                value={settings.default_role_id || ''}
                onChange={(e) => setSettings({ ...settings, default_role_id: e.target.value ? parseInt(e.target.value) : undefined })}
                className="w-full px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
              >
                <option value="">No default role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.role_name}
                  </option>
                ))}
              </select>
              <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                Automatically assign this role to new users upon registration
              </p>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <AppButton
              onClick={handleSave}
              disabled={saving}
              icon={<Save className="w-5 h-5" />}
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </AppButton>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthGeneralSettingsTab;
