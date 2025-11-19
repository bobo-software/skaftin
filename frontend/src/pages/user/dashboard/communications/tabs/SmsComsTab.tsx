import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare, Plus, Edit2, Trash2, TestTube, Power, PowerOff, X } from 'lucide-react';
import CommunicationsService, {
  SmsProvider,
  CreateSmsProviderRequest,
  UpdateSmsProviderRequest,
} from '../../../../../services/CommunicationsService';
import ToastUtils from '../../../../../utils/ToastUtils';

const SmsComsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [smsProviders, setSmsProviders] = useState<SmsProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [editingSmsProvider, setEditingSmsProvider] = useState<SmsProvider | null>(null);
  const [showSmsTestModal, setShowSmsTestModal] = useState(false);
  const [smsTestDestination, setSmsTestDestination] = useState('');
  const [smsTestMessage, setSmsTestMessage] = useState('Hello from Skaftin!');
  const [smsFormData, setSmsFormData] = useState({
    name: '',
    provider_type: 'sa_mobile_sms' as 'mymobileapi' | 'sa_mobile_sms',
    api_key: '',
    api_secret: '',
    post_url: 'https://rest.mymobileapi.com/bulkmessages',
    is_active: true,
  });

  useEffect(() => {
    if (projectId) {
      loadSmsProviders();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadSmsProviders = async () => {
    try {
      setLoading(true);
      const data = await CommunicationsService.listSmsProviders(projectId!);
      setSmsProviders(data);
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load SMS providers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSmsModal = (provider?: SmsProvider) => {
    if (provider) {
      setEditingSmsProvider(provider);
      setSmsFormData({
        name: provider.name,
        provider_type: provider.provider_type,
        api_key: '',
        api_secret: '',
        post_url: provider.post_url,
        is_active: provider.is_active,
      });
    } else {
      setEditingSmsProvider(null);
      setSmsFormData({
        name: '',
        provider_type: 'sa_mobile_sms',
        api_key: '',
        api_secret: '',
        post_url: 'https://rest.mymobileapi.com/bulkmessages',
        is_active: true,
      });
    }
    setShowSmsModal(true);
  };

  const handleCloseSmsModal = () => {
    setShowSmsModal(false);
    setEditingSmsProvider(null);
  };

  const handleSubmitSms = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingSmsProvider) {
        const updateData: UpdateSmsProviderRequest = {
          name: smsFormData.name,
          provider_type: smsFormData.provider_type,
          post_url: smsFormData.post_url,
          is_active: smsFormData.is_active,
        };
        if (smsFormData.api_key) updateData.api_key = smsFormData.api_key;
        if (smsFormData.api_secret) updateData.api_secret = smsFormData.api_secret;
        await CommunicationsService.updateSmsProvider(projectId!, editingSmsProvider.id!.toString(), updateData);
        ToastUtils.success('SMS provider updated successfully');
      } else {
        const createData: CreateSmsProviderRequest = {
          name: smsFormData.name,
          provider_type: smsFormData.provider_type,
          api_key: smsFormData.api_key,
          api_secret: smsFormData.api_secret,
          post_url: smsFormData.post_url,
          is_active: smsFormData.is_active,
        };
        await CommunicationsService.createSmsProvider(projectId!, createData);
        ToastUtils.success('SMS provider created successfully');
      }
      handleCloseSmsModal();
      loadSmsProviders();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to save SMS provider');
    }
  };

  const handleDeleteSms = async (providerId: number) => {
    if (!window.confirm('Are you sure you want to delete this SMS provider?')) {
      return;
    }
    try {
      await CommunicationsService.deleteSmsProvider(projectId!, providerId.toString());
      ToastUtils.success('SMS provider deleted successfully');
      loadSmsProviders();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to delete SMS provider');
    }
  };

  const handleToggleSmsActive = async (provider: SmsProvider) => {
    try {
      await CommunicationsService.updateSmsProvider(
        projectId!,
        provider.id!.toString(),
        { is_active: !provider.is_active }
      );
      ToastUtils.success(`Provider ${!provider.is_active ? 'activated' : 'deactivated'}`);
      loadSmsProviders();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to toggle provider status');
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
      {/* SMS Providers List */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            SMS Providers
          </h2>
          <button
            onClick={() => handleOpenSmsModal()}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add SMS Provider
          </button>
        </div>

        {smsProviders.length === 0 ? (
          <div className="p-8 text-center">
            <MessageSquare className="w-12 h-12 text-dark-400 mx-auto mb-3" />
            <p className="text-dark-600 dark:text-dark-400 mb-4">No SMS providers configured yet</p>
            <button
              onClick={() => handleOpenSmsModal()}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Add your first SMS provider
            </button>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {smsProviders.map((provider) => (
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
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
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
                        <span className="font-medium">POST URL:</span> {provider.post_url}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleSmsActive(provider)}
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
                      onClick={() => setShowSmsTestModal(true)}
                      className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="Send Test SMS"
                    >
                      <TestTube className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleOpenSmsModal(provider)}
                      className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSms(provider.id!)}
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

      {/* SMS Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-white">
                {editingSmsProvider ? 'Edit SMS Provider' : 'Add SMS Provider'}
              </h2>
              <button
                onClick={handleCloseSmsModal}
                className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitSms} className="p-6 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Provider Name *
                </label>
                <input
                  type="text"
                  value={smsFormData.name}
                  onChange={(e) => setSmsFormData({ ...smsFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                  placeholder="e.g., SA Mobile SMS"
                />
              </div>

              {/* Provider Type */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Provider Type
                </label>
                <select
                  value={smsFormData.provider_type}
                  onChange={(e) => setSmsFormData({ ...smsFormData, provider_type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                >
                  <option value="sa_mobile_sms">SA Mobile SMS</option>
                  <option value="mymobileapi">MyMobileAPI</option>
                </select>
              </div>

              {/* API Key/Secret */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    API Key {editingSmsProvider ? '(leave blank to keep)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={smsFormData.api_key}
                    onChange={(e) => setSmsFormData({ ...smsFormData, api_key: e.target.value })}
                    className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                    required={!editingSmsProvider}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    API Secret {editingSmsProvider ? '(leave blank to keep)' : '*'}
                  </label>
                  <input
                    type="password"
                    value={smsFormData.api_secret}
                    onChange={(e) => setSmsFormData({ ...smsFormData, api_secret: e.target.value })}
                    className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                    required={!editingSmsProvider}
                  />
                </div>
              </div>

              {/* POST URL */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  POST URL *
                </label>
                <input
                  type="text"
                  value={smsFormData.post_url}
                  onChange={(e) => setSmsFormData({ ...smsFormData, post_url: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                  placeholder="https://rest.mymobileapi.com/bulkmessages"
                />
              </div>

              {/* Active */}
              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={smsFormData.is_active}
                    onChange={(e) => setSmsFormData({ ...smsFormData, is_active: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-dark-700 dark:text-dark-300">Active</span>
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseSmsModal}
                  className="flex-1 px-4 py-2 border border-dark-200 dark:border-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingSmsProvider ? 'Update' : 'Create'} SMS Provider
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SMS Test Modal */}
      {showSmsTestModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-md w-full">
            <div className="p-4 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                Send Test SMS
              </h3>
              <button
                onClick={() => setShowSmsTestModal(false)}
                className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  if (!smsTestDestination || !smsTestMessage) {
                    ToastUtils.error('Enter destination and message');
                    return;
                  }
                  await CommunicationsService.sendSms(projectId!, [
                    { destination: smsTestDestination, content: smsTestMessage },
                  ]);
                  ToastUtils.success('Test SMS sent');
                  setShowSmsTestModal(false);
                } catch (err: any) {
                  ToastUtils.error(err.message || 'Failed to send SMS');
                }
              }}
              className="p-4 space-y-4"
            >
              <div>
                <label className="block text-sm font-medium mb-1">Destination (E.164)</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 rounded-md border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900"
                  placeholder="+27..."
                  value={smsTestDestination}
                  onChange={(e) => setSmsTestDestination(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Message</label>
                <textarea
                  className="w-full px-3 py-2 rounded-md border border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900"
                  rows={3}
                  value={smsTestMessage}
                  onChange={(e) => setSmsTestMessage(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSmsTestModal(false)}
                  className="px-4 py-2 rounded-md border border-dark-200 dark:border-dark-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-md bg-primary-600 text-white hover:bg-primary-700"
                >
                  Send
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmsComsTab;
