import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Mail, CheckCircle, AlertCircle, Settings, ExternalLink, Send, Save } from 'lucide-react';
import AuthSettingsService, { AuthSettings, EmailProvider } from '../../../../../services/AuthSettingsService';
import { AppButton } from '../../../../../components/ComponentsIndex';

const AuthEmailSettingsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [settings, setSettings] = useState<AuthSettings | null>(null);
  const [emailProviders, setEmailProviders] = useState<EmailProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<number | undefined>();
  const [testEmail, setTestEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    try {
      const data = await AuthSettingsService.getAuthSettings(projectId);
      setSettings(data);
      setSelectedProvider(data.email_provider_id);
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

  useEffect(() => {
    if (projectId) {
      fetchSettings();
      fetchEmailProviders();
    }
  }, [projectId, fetchSettings, fetchEmailProviders]);

  const handleSaveProvider = async () => {
    if (!projectId || !settings) return;

    setSaving(true);
    setMessage(null);

    try {
      await AuthSettingsService.updateAuthSettings(projectId, {
        email_provider_id: selectedProvider,
      });
      setMessage({ type: 'success', text: 'Email provider updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!projectId || !testEmail) return;

    setTesting(true);
    setMessage(null);

    try {
      await AuthSettingsService.testEmailProvider(projectId, testEmail);
      setMessage({ type: 'success', text: 'Test email sent successfully! Check your inbox.' });
      setTimeout(() => setMessage(null), 5000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setTesting(false);
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

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white mb-2">Email Settings</h1>
          <p className="text-dark-600 dark:text-dark-400">
            Configure email templates and providers for authentication emails.
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

        {/* Email Provider Selection */}
        <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Email Provider</h3>
            <Link
              to={`/projects/${projectId}/communications`}
              className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
            >
              <Settings className="w-4 h-4" />
              Manage Providers
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {emailProviders.length === 0 ? (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start">
                <Mail className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-3 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-2">
                    No Email Provider Configured
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                    To send authentication emails, you need to configure an email provider first.
                  </p>
                  <Link
                    to={`/projects/${projectId}/communications`}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Configure Email Provider
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Select Provider for Auth Emails
                </label>
                <select
                  value={selectedProvider || ''}
                  onChange={(e) => setSelectedProvider(e.target.value ? parseInt(e.target.value) : undefined)}
                  className="w-full px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                >
                  <option value="">No provider selected</option>
                  {emailProviders.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} ({provider.from_email})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                  This provider will be used for registration, verification, and password reset emails.
                </p>
              </div>

              <div className="flex justify-end">
                <AppButton
                  onClick={handleSaveProvider}
                  disabled={saving || selectedProvider === settings?.email_provider_id}
                >
                  {saving ? 'Saving...' : 'Save Provider'}
                </AppButton>
              </div>
            </div>
          )}
        </div>

        {/* Test Email */}
        {emailProviders.length > 0 && selectedProvider && (
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6 mb-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Test Email</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Test Email Address
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Enter email to send test"
                    className="flex-1 px-4 py-2 border border-dark-300 dark:border-dark-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:bg-dark-700 dark:text-white"
                  />
                  <AppButton
                    onClick={handleTestEmail}
                    disabled={testing || !testEmail}
                    icon={<Send className="w-5 h-5" />}
                  >
                    {testing ? 'Sending...' : 'Send Test'}
                  </AppButton>
                </div>
                <p className="text-sm text-dark-600 dark:text-dark-400 mt-1">
                  Send a test email to verify your provider configuration.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Email Toggles */}
        {settings && (
          <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6 mb-6">
            <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Email Notifications</h3>
            <p className="text-sm text-dark-600 dark:text-dark-400 mb-6">
              Control which emails are automatically sent during user registration and authentication flows.
            </p>
            
            <div className="space-y-4">
              {/* Registration Email Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-dark-100 dark:border-dark-700">
                <div className="flex-1">
                  <label className="font-medium text-dark-900 dark:text-white">Send Registration Email</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Send welcome email with OTP code when users register
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.send_registration_email || false}
                    onChange={(e) => setSettings({ ...settings, send_registration_email: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Verification Email Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-dark-100 dark:border-dark-700">
                <div className="flex-1">
                  <label className="font-medium text-dark-900 dark:text-white">Send Verification Email</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Send email verification link to confirm email addresses
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.send_verification_email || false}
                    onChange={(e) => setSettings({ ...settings, send_verification_email: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Password Reset Email Toggle */}
              <div className="flex items-center justify-between py-3 border-b border-dark-100 dark:border-dark-700">
                <div className="flex-1">
                  <label className="font-medium text-dark-900 dark:text-white">Send Password Reset Email</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Send reset link when users request password reset
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.send_password_reset_email !== undefined ? settings.send_password_reset_email : true}
                    onChange={(e) => setSettings({ ...settings, send_password_reset_email: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>

              {/* Welcome Email Toggle */}
              <div className="flex items-center justify-between py-3">
                <div className="flex-1">
                  <label className="font-medium text-dark-900 dark:text-white">Send Welcome Email</label>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Send welcome message after successful registration
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.send_welcome_email || false}
                    onChange={(e) => setSettings({ ...settings, send_welcome_email: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-dark-200 dark:border-dark-700">
              <AppButton
                onClick={handleSaveProvider}
                disabled={saving}
                icon={<Save className="w-4 h-4" />}
              >
                {saving ? 'Saving...' : 'Save Email Settings'}
              </AppButton>
            </div>

            {!settings.email_provider_id && (
              <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                <p className="text-sm text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="w-4 h-4 inline mr-1" />
                  Configure an email provider above to enable email notifications.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Email Templates Info */}
        <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700 p-6">
          <h3 className="text-lg font-semibold text-dark-900 dark:text-white mb-4">Email Templates</h3>
          
          <div className="space-y-4">
            <div className="border border-dark-200 dark:border-dark-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-dark-900 dark:text-white">Registration Email</h4>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Welcome email with OTP code for new user registration
                  </p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Active
                </span>
              </div>
              <div className="text-sm text-dark-500 dark:text-dark-400">
                Includes: User name, OTP code, Project name
              </div>
            </div>

            <div className="border border-dark-200 dark:border-dark-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-dark-900 dark:text-white">Email Verification</h4>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Verification link for confirming email addresses
                  </p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Active
                </span>
              </div>
              <div className="text-sm text-dark-500 dark:text-dark-400">
                Includes: Verification link, Expiration time (24 hours)
              </div>
            </div>

            <div className="border border-dark-200 dark:border-dark-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-dark-900 dark:text-white">Password Reset</h4>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Reset link for forgotten passwords
                  </p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Active
                </span>
              </div>
              <div className="text-sm text-dark-500 dark:text-dark-400">
                Includes: Reset link, Expiration time (1 hour), Security notice
              </div>
            </div>

            <div className="border border-dark-200 dark:border-dark-700 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-medium text-dark-900 dark:text-white">Welcome Email</h4>
                  <p className="text-sm text-dark-600 dark:text-dark-400">
                    Welcome message after successful registration
                  </p>
                </div>
                <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                  Active
                </span>
              </div>
              <div className="text-sm text-dark-500 dark:text-dark-400">
                Includes: Welcome message, Getting started information
              </div>
            </div>
          </div>

          <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-1">
                  Professional Templates Included
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  All email templates are professionally designed with your project branding. Templates are managed
                  by the AuthEmailService and use the selected email provider automatically.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Template Variables Reference */}
        <div className="mt-6 bg-dark-50 dark:bg-dark-900 rounded-lg p-4 border border-dark-200 dark:border-dark-700">
          <h4 className="font-medium text-dark-900 dark:text-white mb-2">Available Template Variables</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-dark-600 dark:text-dark-400">
            <div><code className="px-2 py-1 bg-white dark:bg-dark-800 rounded">{'{{userName}}'}</code> - User's name</div>
            <div><code className="px-2 py-1 bg-white dark:bg-dark-800 rounded">{'{{userEmail}}'}</code> - User's email</div>
            <div><code className="px-2 py-1 bg-white dark:bg-dark-800 rounded">{'{{projectName}}'}</code> - Project name</div>
            <div><code className="px-2 py-1 bg-white dark:bg-dark-800 rounded">{'{{otpCode}}'}</code> - OTP/verification code</div>
            <div><code className="px-2 py-1 bg-white dark:bg-dark-800 rounded">{'{{verificationLink}}'}</code> - Verification URL</div>
            <div><code className="px-2 py-1 bg-white dark:bg-dark-800 rounded">{'{{resetLink}}'}</code> - Password reset URL</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthEmailSettingsTab;
