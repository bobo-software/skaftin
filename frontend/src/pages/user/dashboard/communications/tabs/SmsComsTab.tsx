import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { MessageSquare, Plus, Edit2, Trash2, TestTube, Power, PowerOff, X, FileText, AlertCircle, Eye, EyeOff } from 'lucide-react';
import CommunicationsService, {
  SmsTemplate,
  CreateSmsTemplateRequest,
  UpdateSmsTemplateRequest,
} from '../../../../../services/CommunicationsService';
import useComProviderStore, {
  SmsProvider,
  CreateSmsProviderRequest,
  UpdateSmsProviderRequest,
} from '../../../../../stores/data/useComProviderStore';
import ToastUtils from '../../../../../utils/ToastUtils';

const SmsComsTab = () => {
  const { projectId } = useParams<{ projectId: string }>();
  
  // Use Zustand store for SMS providers
  const {
    smsProviders,
    smsProvidersLoading,
    fetchSmsProviders,
    getSmsProvider,
    createSmsProvider,
    updateSmsProvider,
    deleteSmsProvider,
  } = useComProviderStore();

  const [smsTemplates, setSmsTemplates] = useState<SmsTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [editingSmsProvider, setEditingSmsProvider] = useState<SmsProvider | null>(null);
  const [showSmsTestModal, setShowSmsTestModal] = useState(false);
  const [smsTestDestination, setSmsTestDestination] = useState('');
  const [smsTestMessage, setSmsTestMessage] = useState('Hello from Skaftin!');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showApiSecret, setShowApiSecret] = useState(false);
  const [smsFormData, setSmsFormData] = useState({
    name: '',
    provider_type: 'sa_mobile_sms' as 'mymobileapi' | 'sa_mobile_sms' | 'twilio',
    api_key: '',
    api_secret: '',
    post_url: 'https://rest.mymobileapi.com/bulkmessages',
    messaging_service_sid: '',
    phone_number: '',
    is_active: true,
  });
  const [templateFormData, setTemplateFormData] = useState({
    name: '',
    content: '',
    variables: [] as string[],
  });

  useEffect(() => {
    if (projectId) {
      loadSmsProviders();
      loadSmsTemplates();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const loadSmsProviders = async () => {
    if (!projectId) return;
    try {
      await fetchSmsProviders(projectId);
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load SMS providers');
    }
  };

  const loadSmsTemplates = async () => {
    setTemplatesLoading(true);
    try {
      const data = await CommunicationsService.listSmsTemplates(projectId!);
      setSmsTemplates(data);
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to load SMS templates');
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleOpenSmsModal = async (provider?: SmsProvider) => {
    if (provider && provider.id) {
      try {
        // Fetch full provider details including api_key and api_secret using store
        const fullProvider = await getSmsProvider(projectId!, provider.id.toString());
        if (fullProvider) {
          setEditingSmsProvider(fullProvider);
          setSmsFormData({
            name: fullProvider.name,
            provider_type: fullProvider.provider_type,
            api_key: fullProvider.api_key || '',
            api_secret: fullProvider.api_secret || '',
            post_url: fullProvider.post_url || '',
            messaging_service_sid: fullProvider.messaging_service_sid || '',
            phone_number: fullProvider.phone_number || '',
            is_active: fullProvider.is_active,
          });
        } else {
          throw new Error('Provider not found');
        }
      } catch (error: any) {
        ToastUtils.error(error.message || 'Failed to load provider details');
        // Fallback to basic provider data if fetch fails
        setEditingSmsProvider(provider);
        setSmsFormData({
          name: provider.name,
          provider_type: provider.provider_type,
          api_key: '',
          api_secret: '',
          post_url: provider.post_url || '',
          messaging_service_sid: provider.messaging_service_sid || '',
          phone_number: provider.phone_number || '',
          is_active: provider.is_active,
        });
      }
    } else {
      setEditingSmsProvider(null);
      setSmsFormData({
        name: '',
        provider_type: 'sa_mobile_sms',
        api_key: '',
        api_secret: '',
        post_url: 'https://rest.mymobileapi.com/bulkmessages',
        messaging_service_sid: '',
        phone_number: '',
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
          is_active: smsFormData.is_active,
        };
        if (smsFormData.api_key) updateData.api_key = smsFormData.api_key;
        if (smsFormData.api_secret) updateData.api_secret = smsFormData.api_secret;
        if (smsFormData.provider_type === 'twilio') {
          if (smsFormData.messaging_service_sid) updateData.messaging_service_sid = smsFormData.messaging_service_sid;
          if (smsFormData.phone_number) updateData.phone_number = smsFormData.phone_number;
        } else {
          updateData.post_url = smsFormData.post_url;
        }
        const result = await updateSmsProvider(projectId!, editingSmsProvider.id!.toString(), updateData);
        if (result) {
          ToastUtils.success('SMS provider updated successfully');
        } else {
          throw new Error('Failed to update provider');
        }
      } else {
        const createData: CreateSmsProviderRequest = {
          name: smsFormData.name,
          provider_type: smsFormData.provider_type,
          api_key: smsFormData.api_key,
          api_secret: smsFormData.api_secret,
          is_active: smsFormData.is_active,
        };
        if (smsFormData.provider_type === 'twilio') {
          createData.messaging_service_sid = smsFormData.messaging_service_sid || undefined;
          createData.phone_number = smsFormData.phone_number || undefined;
        } else {
          createData.post_url = smsFormData.post_url;
        }
        const result = await createSmsProvider(projectId!, createData);
        if (result) {
          ToastUtils.success('SMS provider created successfully');
        } else {
          throw new Error('Failed to create provider');
        }
      }
      handleCloseSmsModal();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to save SMS provider');
    }
  };

  const handleDeleteSms = async (providerId: number) => {
    if (!window.confirm('Are you sure you want to delete this SMS provider?')) {
      return;
    }
    try {
      const success = await deleteSmsProvider(projectId!, providerId.toString());
      if (success) {
        ToastUtils.success('SMS provider deleted successfully');
      } else {
        throw new Error('Failed to delete provider');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to delete SMS provider');
    }
  };

  const handleToggleSmsActive = async (provider: SmsProvider) => {
    try {
      const result = await updateSmsProvider(
        projectId!,
        provider.id!.toString(),
        { is_active: !provider.is_active }
      );
      if (result) {
        ToastUtils.success(`Provider ${!provider.is_active ? 'activated' : 'deactivated'}`);
      } else {
        throw new Error('Failed to toggle provider status');
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to toggle provider status');
    }
  };

  const handleOpenTemplateModal = (template?: SmsTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setTemplateFormData({
        name: template.name,
        content: template.content,
        variables: template.variables || [],
      });
    } else {
      setEditingTemplate(null);
      setTemplateFormData({
        name: '',
        content: '',
        variables: [],
      });
    }
    setShowTemplateModal(true);
  };

  const handleCloseTemplateModal = () => {
    setShowTemplateModal(false);
    setEditingTemplate(null);
  };

  const handleSubmitTemplate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      // Automatically extract and save variables from template content
      const extractedVariables = requiredVariables;
      
      if (editingTemplate) {
        const updateData: UpdateSmsTemplateRequest = {
          name: templateFormData.name,
          content: templateFormData.content,
          variables: extractedVariables,
        };

        await CommunicationsService.updateSmsTemplate(
          projectId!,
          editingTemplate.id!.toString(),
          updateData
        );
        ToastUtils.success('SMS template updated successfully');
      } else {
        const createData: CreateSmsTemplateRequest = {
          name: templateFormData.name,
          content: templateFormData.content,
          variables: extractedVariables,
        };

        await CommunicationsService.createSmsTemplate(projectId!, createData);
        ToastUtils.success('SMS template created successfully');
      }

      handleCloseTemplateModal();
      loadSmsTemplates();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to save SMS template');
    }
  };

  const handleDeleteTemplate = async (templateId: number) => {
    if (!window.confirm('Are you sure you want to delete this SMS template?')) {
      return;
    }

    try {
      await CommunicationsService.deleteSmsTemplate(projectId!, templateId.toString());
      ToastUtils.success('SMS template deleted successfully');
      loadSmsTemplates();
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to delete SMS template');
    }
  };

  // Extract variables from template content
  const extractVariables = (text: string): string[] => {
    if (!text) return [];
    const regex = /\{\{([^}]+)\}\}/g;
    const variables = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (match[1]) {
        variables.add(match[1].trim());
      }
    }
    return Array.from(variables).sort();
  };

  // Get all unique variables from template content
  const requiredVariables = useMemo(() => {
    return extractVariables(templateFormData.content);
  }, [templateFormData.content]);

  if (smsProvidersLoading || templatesLoading) {
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

      {/* SMS Templates List */}
      <div className="bg-white dark:bg-dark-800 rounded-lg border border-dark-200 dark:border-dark-700">
        <div className="p-4 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            SMS Templates
          </h2>
          <button
            onClick={() => handleOpenTemplateModal()}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm"
          >
            <Plus className="w-4 h-4" />
            Add SMS Template
          </button>
        </div>

        {smsTemplates.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="w-12 h-12 text-dark-400 mx-auto mb-3" />
            <p className="text-dark-600 dark:text-dark-400 mb-4">No SMS templates configured yet</p>
            <button
              onClick={() => handleOpenTemplateModal()}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Create your first template
            </button>
          </div>
        ) : (
          <div className="divide-y divide-dark-200 dark:divide-dark-700">
            {smsTemplates.map((template) => (
              <div
                key={template.id}
                className="p-4 hover:bg-dark-50 dark:hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-dark-900 dark:text-white">
                        {template.name}
                      </h3>
                    </div>
                    <div className="space-y-1 text-sm text-dark-600 dark:text-dark-400">
                      <p className="text-xs text-dark-500 dark:text-dark-500">
                        <span className="font-medium">Content:</span> {template.content.length} characters
                      </p>
                      {template.variables && template.variables.length > 0 && (
                        <p className="text-xs text-dark-500 dark:text-dark-500">
                          <span className="font-medium">Variables:</span> {template.variables.join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-dark-500 dark:text-dark-500 font-mono mt-2 bg-dark-50 dark:bg-dark-900 p-2 rounded">
                        {template.content.substring(0, 100)}{template.content.length > 100 ? '...' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenTemplateModal(template)}
                      className="p-2 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id!)}
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
                  <option value="twilio">Twilio</option>
                </select>
              </div>

              {/* API Key/Secret (labels change based on provider) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    {smsFormData.provider_type === 'twilio' ? 'Account SID *' : 'API Key *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={smsFormData.api_key}
                      onChange={(e) => setSmsFormData({ ...smsFormData, api_key: e.target.value })}
                      className="w-full px-4 py-2 pr-10 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                      required={!editingSmsProvider}
                      placeholder={smsFormData.provider_type === 'twilio' ? 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' : ''}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                    >
                      {showApiKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                    {smsFormData.provider_type === 'twilio' ? 'Auth Token *' : 'API Secret *'}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiSecret ? 'text' : 'password'}
                      value={smsFormData.api_secret}
                      onChange={(e) => setSmsFormData({ ...smsFormData, api_secret: e.target.value })}
                      className="w-full px-4 py-2 pr-10 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                      required={!editingSmsProvider}
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiSecret(!showApiSecret)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300"
                    >
                      {showApiSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Twilio-specific fields */}
              {smsFormData.provider_type === 'twilio' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                      Messaging Service SID
                    </label>
                    <input
                      type="text"
                      value={smsFormData.messaging_service_sid}
                      onChange={(e) => setSmsFormData({ ...smsFormData, messaging_service_sid: e.target.value })}
                      className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                      placeholder="MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    />
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                      Optional if Phone Number is provided
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={smsFormData.phone_number}
                      onChange={(e) => setSmsFormData({ ...smsFormData, phone_number: e.target.value })}
                      className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                      placeholder="+1234567890"
                    />
                    <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                      Your Twilio phone number (required if no Messaging Service SID)
                    </p>
                  </div>
                </div>
              )}

              {/* POST URL - only for non-Twilio providers */}
              {smsFormData.provider_type !== 'twilio' && (
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
              )}

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

      {/* SMS Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-dark-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-dark-900 dark:text-white">
                {editingTemplate ? 'Edit SMS Template' : 'Add SMS Template'}
              </h2>
              <button
                onClick={handleCloseTemplateModal}
                className="p-2 text-dark-400 hover:text-dark-600 dark:hover:text-dark-300 rounded-lg hover:bg-dark-100 dark:hover:bg-dark-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitTemplate} className="p-6 space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Template Name *
                </label>
                <input
                  type="text"
                  value={templateFormData.name}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white"
                  required
                  placeholder="e.g., Welcome SMS"
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-2">
                  Message Content *
                </label>
                <textarea
                  value={templateFormData.content}
                  onChange={(e) => setTemplateFormData({ ...templateFormData, content: e.target.value })}
                  className="w-full px-4 py-2 border border-dark-200 dark:border-dark-700 rounded-lg bg-white dark:bg-dark-900 text-dark-900 dark:text-white font-mono text-sm"
                  rows={8}
                  required
                  placeholder="Hello {{name}}, welcome to {{appName}}! Your verification code is {{code}}."
                />
                <p className="text-xs text-dark-500 dark:text-dark-400 mt-1">
                  Use variables like {'{{variableName}}'} that will be replaced when sending. SMS messages are limited to 160 characters per message.
                </p>
              </div>

              {/* Required Variables Info */}
              {requiredVariables.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
                        Required Variables
                      </p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mb-2">
                        The following variables are used in your template and will need to be provided when sending SMS:
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {requiredVariables.map((variable) => (
                          <span
                            key={variable}
                            className="inline-flex items-center px-2.5 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 text-xs font-mono font-medium border border-amber-200 dark:border-amber-800"
                          >
                            {'{{'}{variable}{'}}'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Variables Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Note:</strong> Variables in templates (like {'{{name}}'}, {'{{code}}'}) will be automatically replaced with values from workflow context when the SMS is sent. Make sure all required variables are available in your workflow.
                </p>
              </div>

              {/* Character Count */}
              <div className="text-xs text-dark-500 dark:text-dark-400">
                Character count: {templateFormData.content.length} / 160
                {templateFormData.content.length > 160 && (
                  <span className="text-red-600 dark:text-red-400 ml-2">
                    (Message will be split into multiple parts)
                  </span>
                )}
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={handleCloseTemplateModal}
                  className="flex-1 px-4 py-2 border border-dark-200 dark:border-dark-700 text-dark-700 dark:text-dark-300 rounded-lg hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingTemplate ? 'Update' : 'Create'} Template
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
