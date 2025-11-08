import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Mail, Plus, Edit2, Trash2, TestTube, Power, PowerOff, X } from 'lucide-react';
import CommunicationsService, {
  EmailProvider,
  CreateEmailProviderRequest,
  UpdateEmailProviderRequest,
} from '../../../../services/CommunicationsService';
import ToastUtils from '../../../../utils/ToastUtils';

interface EmailProviderFormData {
  name: string;
  provider_type: 'nodemailer' | 'mailtrap';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  is_active: boolean;
}

const ProjectCommunicationsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [providers, setProviders] = useState<EmailProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<EmailProvider | null>(null);
  const [formData, setFormData] = useState<EmailProviderFormData>({
    name: '',
    provider_type: 'nodemailer',
    smtp_host: '',
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: '',
    smtp_password: '',
    from_email: '',
    from_name: '',
    is_active: true,
  });

  useEffect(() => {
    if (projectId) {
      loadProviders();
    }
  }, [projectId]);

  const loadProviders = async () => {
    try {
      setLoading(true);
      const data = await CommunicationsService.listEmailProviders(projectId!);
      setProviders(data);
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load email providers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (provider?: EmailProvider) => {
    if (provider) {
      setEditingProvider(provider);
      setFormData({
        name: provider.name,
        provider_type: provider.provider_type,
        smtp_host: provider.smtp_host,
        smtp_port: provider.smtp_port,
        smtp_secure: provider.smtp_secure,
        smtp_user: provider.smtp_user,
        smtp_password: '', // Don't populate password for security
        from_email: provider.from_email,
        from_name: provider.from_name || '',
        is_active: provider.is_active,
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '',
        provider_type: 'nodemailer',
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
        smtp_user: '',
        smtp_password: '',
        from_email: '',
        from_name: '',
        is_active: true,
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProvider(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingProvider) {
        // Update existing provider
        const updateData: UpdateEmailProviderRequest = {
          name: formData.name,
          provider_type: formData.provider_type,
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_secure: formData.smtp_secure,
          smtp_user: formData.smtp_user,
          from_email: formData.from_email,
          from_name: formData.from_name,
          is_active: formData.is_active,
        };

        // Only include password if it was changed
        if (formData.smtp_password) {
          updateData.smtp_password = formData.smtp_password;
        }

        await CommunicationsService.updateEmailProvider(
          projectId!,
          editingProvider.id!.toString(),
          updateData
        );
        ToastUtils.success('Email provider updated successfully');
      } else {
        // Create new provider
        const createData: CreateEmailProviderRequest = {
          name: formData.name,
          provider_type: formData.provider_type,
          smtp_host: formData.smtp_host,
          smtp_port: formData.smtp_port,
          smtp_secure: formData.smtp_secure,
          smtp_user: formData.smtp_user,
          smtp_password: formData.smtp_password,
          from_email: formData.from_email,
          from_name: formData.from_name,
          is_active: formData.is_active,
        };

        await CommunicationsService.createEmailProvider(projectId!, createData);
        ToastUtils.success('Email provider created successfully');
      }

      handleCloseModal();
      loadProviders();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to save email provider');
    }
  };

  const handleDelete = async (providerId: number) => {
    if (!window.confirm('Are you sure you want to delete this email provider?')) {
      return;
    }

    try {
      await CommunicationsService.deleteEmailProvider(projectId!, providerId.toString());
      ToastUtils.success('Email provider deleted successfully');
      loadProviders();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to delete email provider');
    }
  };

  const handleTestConnection = async (providerId: number) => {
    try {
      await CommunicationsService.testConnection(projectId!, providerId.toString());
      ToastUtils.success('Connection test successful!');
    } catch (error: any) {
      ToastUtils.error(error.message || 'Connection test failed');
    }
  };

  const handleToggleActive = async (provider: EmailProvider) => {
    try {
      await CommunicationsService.updateEmailProvider(
        projectId!,
        provider.id!.toString(),
        { is_active: !provider.is_active }
      );
      ToastUtils.success(`Provider ${!provider.is_active ? 'activated' : 'deactivated'}`);
      loadProviders();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to toggle provider status');
    }
  };

  const applyProviderPreset = (type: 'nodemailer' | 'mailtrap') => {
    if (type === 'mailtrap') {
      setFormData((prev) => ({
        ...prev,
        provider_type: 'mailtrap',
        smtp_host: 'sandbox.smtp.mailtrap.io',
        smtp_port: 2525,
        smtp_secure: false,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        provider_type: 'nodemailer',
        smtp_host: '',
        smtp_port: 587,
        smtp_secure: false,
      }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-dark-900 dark:text-white flex items-center gap-2">
            <Mail className="w-7 h-7 text-primary-600" />
            Communications
          </h1>
          <p className="text-dark-600 dark:text-dark-400 mt-1">
            Manage email providers and communication settings
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Provider
        </button>
      </div>

      {/* Email Providers List */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Email Providers</h2>
        </div>

        {providers.length === 0 ? (
          <div className="p-8 text-center">
            <Mail className="w-12 h-12 text-dark-400 mx-auto mb-3" />
            <p className="text-dark-600 dark:text-dark-400 mb-4">No email providers configured yet</p>
            <button
              onClick={() => handleOpenModal()}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Add your first provider
            </button>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="p-4 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                        {provider.name}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${
                          provider.provider_type === 'mailtrap'
                            ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
                        }`}
                      >
                        {provider.provider_type}
                      </span>
                      {provider.is_active ? (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="space-y-1 text-sm text-dark-600 dark:text-dark-400">
                      <p>
                        <span className="font-medium">Host:</span> {provider.smtp_host}:
                        {provider.smtp_port}
                      </p>
                      <p>
                        <span className="font-medium">User:</span> {provider.smtp_user}
                      </p>
                      <p>
                        <span className="font-medium">From:</span> {provider.from_name || provider.from_email}{' '}
                        {provider.from_name && `<${provider.from_email}>`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(provider)}
                      className={`p-2 rounded-lg transition-colors ${
                        provider.is_active
                          ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                          : 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20'
                      }`}
                      title={provider.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {provider.is_active ? <Power className="w-5 h-5" /> : <PowerOff className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={() => handleTestConnection(provider.id!)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Test Connection"
                    >
                      <TestTube className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleOpenModal(provider)}
                      className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(provider.id!)}
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-white">
                {editingProvider ? 'Edit Email Provider' : 'Add Email Provider'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Provider Type Selection */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Provider Type
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => applyProviderPreset('nodemailer')}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      formData.provider_type === 'nodemailer'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700'
                    }`}
                  >
                    <div className="font-semibold text-dark-900 dark:text-white">Nodemailer</div>
                    <div className="text-xs text-dark-600 dark:text-dark-400 mt-1">
                      Custom SMTP server
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyProviderPreset('mailtrap')}
                    className={`p-4 border-2 rounded-lg transition-colors ${
                      formData.provider_type === 'mailtrap'
                        ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-dark-200 dark:border-dark-700'
                    }`}
                  >
                    <div className="font-semibold text-dark-900 dark:text-white">Mailtrap</div>
                    <div className="text-xs text-dark-600 dark:text-dark-400 mt-1">
                      Email testing service
                    </div>
                  </button>
                </div>
              </div>

              {/* Provider Name */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Provider Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                  placeholder="e.g., Primary Mail Server"
                />
              </div>

              {/* SMTP Host */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  SMTP Host *
                </label>
                <input
                  type="text"
                  value={formData.smtp_host}
                  onChange={(e) => setFormData({ ...formData, smtp_host: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                  placeholder="smtp.example.com"
                />
              </div>

              {/* SMTP Port & Secure */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    SMTP Port *
                  </label>
                  <select
                    value={formData.smtp_port}
                    onChange={(e) => {
                      const port = parseInt(e.target.value);
                      setFormData({ 
                        ...formData, 
                        smtp_port: port,
                        // Auto-adjust secure setting based on port
                        smtp_secure: port === 465 ? true : false
                      });
                    }}
                    className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                    required
                  >
                    <option value={587}>587 (STARTTLS - Recommended)</option>
                    <option value={465}>465 (SSL/TLS)</option>
                    <option value={2525}>2525 (Alternative - Mailtrap)</option>
                    <option value={25}>25 (Unencrypted - Often Blocked)</option>
                  </select>
                  <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                    {formData.smtp_port === 587 && 'Uses STARTTLS encryption'}
                    {formData.smtp_port === 465 && 'Uses direct SSL/TLS encryption'}
                    {formData.smtp_port === 2525 && 'Alternative port (common for testing)'}
                    {formData.smtp_port === 25 && 'Unencrypted - may be blocked by ISP'}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    Use TLS/SSL
                  </label>
                  <label className="flex items-center gap-2 px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900">
                    <input
                      type="checkbox"
                      checked={formData.smtp_secure}
                      onChange={(e) => setFormData({ ...formData, smtp_secure: e.target.checked })}
                      className="w-4 h-4"
                    />
                    <span className="text-dark-900 dark:text-white">Secure Connection</span>
                  </label>
                </div>
              </div>

              {/* SMTP User */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  SMTP Username *
                </label>
                <input
                  type="text"
                  value={formData.smtp_user}
                  onChange={(e) => setFormData({ ...formData, smtp_user: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                  placeholder="username or email"
                />
              </div>

              {/* SMTP Password */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  SMTP Password {editingProvider ? '' : '*'}
                </label>
                <input
                  type="password"
                  value={formData.smtp_password}
                  onChange={(e) => setFormData({ ...formData, smtp_password: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required={!editingProvider}
                  placeholder={editingProvider ? 'Leave blank to keep current password' : ''}
                />
              </div>

              {/* From Email */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  From Email *
                </label>
                <input
                  type="email"
                  value={formData.from_email}
                  onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                  placeholder="noreply@example.com"
                />
              </div>

              {/* From Name */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  From Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.from_name}
                  onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  placeholder="My App Name"
                />
              </div>

              {/* Active Status */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-700 dark:text-dark-300">Active</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-dark-200 dark:border-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingProvider ? 'Update' : 'Create'} Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectCommunicationsTab;

