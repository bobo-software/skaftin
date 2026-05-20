import { useState, useEffect, useCallback, useRef, KeyboardEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Save, Mail, AlertCircle, CheckCircle, X, Plus } from 'lucide-react';
import AuthSettingsService, { AuthSettings } from '../../../../../services/AuthSettingsService';
import RolesService, { Role } from '../../../../../services/RolesService';
import { AppButton } from '../../../../../components/ComponentsIndex';
import useComProviderStore from '../../../../../stores/data/useComProviderStore';

const AuthGeneralSettingsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [clientIdInput, setClientIdInput] = useState('');
  const clientIdInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Use Zustand store for providers
  const {
    emailProviders,
    smsProviders,
    fetchEmailProviders,
    fetchSmsProviders,
  } = useComProviderStore();

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
      fetchEmailProviders(projectId);
      fetchSmsProviders(projectId);
      fetchRoles();
    }
  }, [projectId, fetchSettings, fetchEmailProviders, fetchSmsProviders, fetchRoles]);

  const handleSave = async () => {
    if (!projectId || !settings) return;

    setSaving(true);
    setMessage(null);

    try {
      await AuthSettingsService.updateAuthSettings(projectId, {
        allow_duplicate_emails: settings.allow_duplicate_emails,
        require_email: settings.require_email,
        require_email_verification: settings.require_email_verification,
        require_phone_verification: settings.require_phone_verification,
        enable_password_reset: settings.enable_password_reset,
        enable_mfa: settings.enable_mfa,
        registration_enabled: settings.registration_enabled,
        auth_enabled: settings.auth_enabled,
        default_role_id: settings.default_role_id,
        email_provider_id: settings.email_provider_id,
        sms_provider_id: settings.sms_provider_id,
        otp_length: settings.otp_length,
        google_sign_in_enabled: settings.google_sign_in_enabled,
        google_web_client_ids: settings.google_web_client_ids,
        google_auto_register: settings.google_auto_register,
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

          {/* SMS Settings */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">SMS Settings</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block font-medium text-dark-900 dark:text-white mb-2">
                  SMS Provider
                </label>
                {smsProviders.length === 0 ? (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <div className="flex items-start">
                      <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2 mt-0.5" />
                      <div>
                        <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium">No SMS provider configured</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          Please configure an SMS provider in the Communications section to send OTP codes.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <select
                    value={settings.sms_provider_id || ''}
                    onChange={(e) => setSettings({ ...settings, sms_provider_id: e.target.value ? parseInt(e.target.value) : undefined })}
                    className="w-full px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                  >
                    <option value="">No provider selected</option>
                    {smsProviders.map((provider) => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} ({provider.provider_type})
                      </option>
                    ))}
                  </select>
                )}
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                  Select the SMS provider to use for sending OTP codes and notifications
                </p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Require Phone Verification</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Users must verify their phone via OTP before accessing the app
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.require_phone_verification}
                    onChange={(e) => setSettings({ ...settings, require_phone_verification: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div>
                <label className="block font-medium text-dark-900 dark:text-white mb-2">
                  OTP Code Length
                </label>
                <select
                  value={settings.otp_length || 6}
                  onChange={(e) => setSettings({ ...settings, otp_length: parseInt(e.target.value) })}
                  className="w-full px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                >
                  <option value={4}>4 digits</option>
                  <option value={5}>5 digits</option>
                  <option value={6}>6 digits</option>
                </select>
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                  Number of digits for OTP verification codes (4-6)
                </p>
              </div>
            </div>
          </div>

          {/* User Policies */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">User Policies</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Require Email for Registration</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    When disabled, users can register with just a phone number (no email required)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.require_email !== false}
                    onChange={(e) => setSettings({ ...settings, require_email: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

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

          {/* Google Sign-In */}
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
            <div className="flex items-center gap-3 mb-1">
              <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Google Sign-In</h3>
            </div>
            <p className="text-sm text-dark-600 dark:text-dark-400 mb-5">
              Allow users to sign in with their Google account. Requires a Google Cloud Web OAuth client ID.
            </p>

            <div className="space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Enable Google Sign-In</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Allow users to authenticate using a Google account
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.google_sign_in_enabled}
                    onChange={(e) => setSettings({ ...settings, google_sign_in_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Auto-register toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="font-medium text-dark-900 dark:text-white">Auto-register New Users</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Automatically create an account for first-time Google sign-ins. When off, only existing users can sign in with Google.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.google_auto_register}
                    onChange={(e) => setSettings({ ...settings, google_auto_register: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Web Client IDs */}
              <div>
                <label className="block font-medium text-dark-900 dark:text-white mb-1">
                  Allowed Web Client IDs
                </label>
                <p className="text-sm text-dark-600 dark:text-dark-400 mb-3">
                  Add the OAuth 2.0 Web client ID(s) from Google Cloud Console. The mobile app's <code className="px-1 py-0.5 bg-dark-100 dark:bg-dark-700 rounded text-xs font-mono">EXPO_PUBLIC_WEB_CLIENT_ID</code> must be listed here.
                </p>

                {/* Existing tags */}
                {settings.google_web_client_ids.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    {settings.google_web_client_ids.map((id) => (
                      <span
                        key={id}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 font-mono"
                      >
                        {id}
                        <button
                          type="button"
                          onClick={() => setSettings({
                            ...settings,
                            google_web_client_ids: settings.google_web_client_ids.filter((c) => c !== id),
                          })}
                          className="text-primary-500 hover:text-primary-700 dark:hover:text-primary-200 transition-colors"
                          aria-label={`Remove ${id}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Add new ID */}
                <div className="flex gap-2">
                  <input
                    ref={clientIdInputRef}
                    type="text"
                    value={clientIdInput}
                    onChange={(e) => setClientIdInput(e.target.value)}
                    onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const val = clientIdInput.trim();
                        if (val && !settings.google_web_client_ids.includes(val)) {
                          setSettings({ ...settings, google_web_client_ids: [...settings.google_web_client_ids, val] });
                        }
                        setClientIdInput('');
                      }
                    }}
                    placeholder="e.g. 123456789-abc.apps.googleusercontent.com"
                    className="flex-1 px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const val = clientIdInput.trim();
                      if (val && !settings.google_web_client_ids.includes(val)) {
                        setSettings({ ...settings, google_web_client_ids: [...settings.google_web_client_ids, val] });
                      }
                      setClientIdInput('');
                      clientIdInputRef.current?.focus();
                    }}
                    className="px-3 py-2 rounded-lg border border-dark-300 dark:border-dark-600 text-dark-600 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                    aria-label="Add client ID"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1.5">Press Enter or click + to add. Duplicates are ignored.</p>
              </div>
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
