import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  CreditCard, Plus, Edit2, Trash2, TestTube, Power, PowerOff, X,
  ExternalLink, AlertCircle, CheckCircle, Globe, Play, Loader2
} from 'lucide-react';
import usePaymentProviderStore, {
  PaymentProvider,
  PaymentProviderType,
  getProviderDisplayName,
  CreatePaymentProviderRequest,
} from '../../../../../stores/data/usePaymentProviderStore';
import ToastUtils from '../../../../../utils/ToastUtils';
import RequestUtils from '../../../../../utils/RequestUtils';
import ApiRoutes from '../../../../../constants/ApiRoutes';

interface PaymentProviderFormData {
  name: string;
  provider_type: PaymentProviderType;
  merchant_id: string;
  merchant_key: string;
  passphrase: string;
  api_key: string;
  api_secret: string;
  public_key: string;
  return_url: string;
  cancel_url: string;
  notify_url: string;
  sandbox_mode: boolean;
  is_active: boolean;
  // FNB fields (stored in metadata)
  fnb_base_url: string;
  fnb_api_key: string;
  fnb_api_inst: string;
  fnb_api_key_3d: string;
  fnb_api_inst_3d: string;
  fnb_secret_key: string;
}

interface TestPaymentFormData {
  amount: string;
  item_name: string;
  item_description: string;
  customer_email: string;
  customer_name: string;
  payment_type: 'once_off' | 'subscription';
}

// FNB-specific test form - just description and amount with defaults
interface FnbTestPaymentFormData {
  description: string;
  amount: string;
}

const PROVIDER_TYPES: { value: PaymentProviderType; label: string; description: string }[] = [
  { value: 'payfast', label: 'PayFast', description: 'South African payment gateway' },
  { value: 'fnb_pay', label: 'FNB Payment', description: 'FNB 3D Secure card payments' },
];

const PaymentProvidersTab = () => {
  const { projectId } = useParams<{ projectId: string }>();

  // Zustand store
  const {
    providers,
    providersLoading: loading,
    testingProviderId: testing,
    fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
  } = usePaymentProviderStore();

  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState<PaymentProvider | null>(null);
  const [formData, setFormData] = useState<PaymentProviderFormData>({
    name: '',
    provider_type: 'payfast',
    merchant_id: '',
    merchant_key: '',
    passphrase: '',
    api_key: '',
    api_secret: '',
    public_key: '',
    return_url: '',
    cancel_url: '',
    notify_url: '',
    sandbox_mode: true,
    is_active: true,
    fnb_base_url: '',
    fnb_api_key: '',
    fnb_api_inst: '',
    fnb_api_key_3d: '',
    fnb_api_inst_3d: '',
    fnb_secret_key: '',
  });

  // Test Payment Modal State
  const [showTestPaymentModal, setShowTestPaymentModal] = useState(false);
  const [testPaymentLoading, setTestPaymentLoading] = useState(false);
  const [testPaymentProvider, setTestPaymentProvider] = useState<PaymentProvider | null>(null);
  const [testPaymentFormData, setTestPaymentFormData] = useState<TestPaymentFormData>({
    amount: '10.00',
    item_name: 'Test Payment',
    item_description: 'Testing payment gateway integration',
    customer_email: '',
    customer_name: '',
    payment_type: 'once_off',
  });
  const [fnbTestFormData, setFnbTestFormData] = useState<FnbTestPaymentFormData>({
    description: 'Test Payment - FNB',
    amount: '10.00',
  });

  useEffect(() => {
    if (projectId) {
      fetchProviders(projectId);
    }
  }, [projectId, fetchProviders]);

  const handleOpenModal = (provider?: PaymentProvider) => {
    if (provider) {
      setEditingProvider(provider);
      const meta = provider.metadata || {};
      setFormData({
        name: provider.name,
        provider_type: provider.provider_type,
        merchant_id: provider.merchant_id || '',
        merchant_key: '',
        passphrase: '',
        api_key: '',
        api_secret: '',
        public_key: '',
        return_url: provider.return_url || '',
        cancel_url: provider.cancel_url || '',
        notify_url: provider.notify_url || '',
        sandbox_mode: provider.sandbox_mode,
        is_active: provider.is_active,
        fnb_base_url: meta.fnb_base_url || '',
        fnb_api_key: meta.fnb_api_key || '',
        fnb_api_inst: meta.fnb_api_inst || '',
        fnb_api_key_3d: meta.fnb_api_key_3d || '',
        fnb_api_inst_3d: meta.fnb_api_inst_3d || '',
        fnb_secret_key: meta.fnb_secret_key || '',
      });
    } else {
      setEditingProvider(null);
      setFormData({
        name: '',
        provider_type: 'payfast',
        merchant_id: '',
        merchant_key: '',
        passphrase: '',
        api_key: '',
        api_secret: '',
        public_key: '',
        return_url: '',
        cancel_url: '',
        notify_url: '',
        sandbox_mode: true,
        is_active: true,
        fnb_base_url: '',
        fnb_api_key: '',
        fnb_api_inst: '',
        fnb_api_key_3d: '',
        fnb_api_inst_3d: '',
        fnb_secret_key: '',
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
        const updateData: Record<string, any> = {
          name: formData.name,
          return_url: formData.return_url || undefined,
          cancel_url: formData.cancel_url || undefined,
          notify_url: formData.notify_url || undefined,
          sandbox_mode: formData.sandbox_mode,
          is_active: formData.is_active,
          merchant_id: formData.merchant_id || undefined,
          merchant_key: formData.merchant_key || undefined,
          passphrase: formData.passphrase || undefined,
          api_key: formData.api_key || undefined,
          api_secret: formData.api_secret || undefined,
          public_key: formData.public_key || undefined,
        };
        if (formData.provider_type === 'fnb_pay') {
          updateData.metadata = {
            fnb_base_url: formData.fnb_base_url || undefined,
            fnb_api_key: formData.fnb_api_key || undefined,
            fnb_api_inst: formData.fnb_api_inst || undefined,
            fnb_api_key_3d: formData.fnb_api_key_3d || undefined,
            fnb_api_inst_3d: formData.fnb_api_inst_3d || undefined,
            fnb_secret_key: formData.fnb_secret_key || undefined,
          };
        }

        const result = await updateProvider(
          projectId!,
          editingProvider.id.toString(),
          updateData
        );
        if (result) {
          ToastUtils.success('Payment provider updated successfully');
          handleCloseModal();
        } else {
          ToastUtils.error('Failed to update payment provider');
        }
      } else {
        const createData: CreatePaymentProviderRequest = {
          name: formData.name,
          provider_type: formData.provider_type,
          merchant_id: formData.merchant_id || undefined,
          merchant_key: formData.merchant_key || undefined,
          passphrase: formData.passphrase || undefined,
          api_key: formData.api_key || undefined,
          api_secret: formData.api_secret || undefined,
          public_key: formData.public_key || undefined,
          return_url: formData.return_url || undefined,
          cancel_url: formData.cancel_url || undefined,
          notify_url: formData.notify_url || undefined,
          sandbox_mode: formData.sandbox_mode,
          is_active: formData.is_active,
          ...(formData.provider_type === 'fnb_pay' && {
            metadata: {
              fnb_base_url: formData.fnb_base_url || undefined,
              fnb_api_key: formData.fnb_api_key || undefined,
              fnb_api_inst: formData.fnb_api_inst || undefined,
              fnb_api_key_3d: formData.fnb_api_key_3d || undefined,
              fnb_api_inst_3d: formData.fnb_api_inst_3d || undefined,
              fnb_secret_key: formData.fnb_secret_key || undefined,
            },
          }),
        };

        const result = await createProvider(projectId!, createData);
        if (result) {
          ToastUtils.success('Payment provider created successfully');
          handleCloseModal();
        } else {
          ToastUtils.error('Failed to create payment provider');
        }
      }
    } catch (error: any) {
      ToastUtils.error(error.message || 'Failed to save payment provider');
    }
  };

  const handleDelete = async (providerId: number) => {
    if (!window.confirm('Are you sure you want to delete this payment provider?')) {
      return;
    }

    const success = await deleteProvider(projectId!, providerId.toString());
    if (success) {
      ToastUtils.success('Payment provider deleted successfully');
    } else {
      ToastUtils.error('Failed to delete payment provider');
    }
  };

  const handleTestConnection = async (providerId: number) => {
    const result = await testProvider(projectId!, providerId.toString());

    if (result.success) {
      ToastUtils.success(result.message || 'Connection successful!');
    } else {
      ToastUtils.error(result.error || 'Connection test failed');
    }
  };

  const handleToggleActive = async (provider: PaymentProvider) => {
    const result = await updateProvider(
      projectId!,
      provider.id.toString(),
      { is_active: !provider.is_active }
    );
    if (result) {
      ToastUtils.success(`Provider ${!provider.is_active ? 'activated' : 'deactivated'} successfully`);
    } else {
      ToastUtils.error('Failed to update provider status');
    }
  };

  const getWebhookUrl = () => {
    const baseUrl = window.location.origin.replace(':3005', ':4006'); // Backend port
    return `${baseUrl}/api/payments/webhook/payfast/${projectId}`;
  };

  const openTestPaymentModal = (provider: PaymentProvider) => {
    setTestPaymentProvider(provider);
    if (provider.provider_type === 'fnb_pay') {
      setFnbTestFormData({
        description: 'Test Payment - FNB',
        amount: '10.00',
      });
    } else {
      setTestPaymentFormData({
        amount: '10.00',
        item_name: 'Test Payment',
        item_description: `Testing ${provider.name} integration`,
        customer_email: '',
        customer_name: '',
        payment_type: 'once_off',
      });
    }
    setShowTestPaymentModal(true);
  };

  const handleFnbTestPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPaymentProvider) return;
    setTestPaymentLoading(true);

    try {
      // FNB project provider: use /app-api/payments/initiate with provider_id
      const token = localStorage.getItem('skaftin-token') || '';
      const credentialsResponse = await RequestUtils.get(
        ApiRoutes.CREDENTIALS.LIST(projectId!),
        token
      );

      if (!credentialsResponse.success || !credentialsResponse.data?.length) {
        ToastUtils.error('No API credentials found. Please create an API key first in the API Credentials section.');
        setTestPaymentLoading(false);
        return;
      }

      const apiKey = credentialsResponse.data.find(
        (cred: any) => cred.credential_type === 'api_key' && cred.is_active
      );

      if (!apiKey) {
        ToastUtils.error('No active API key found. Please create one in the API Credentials section.');
        setTestPaymentLoading(false);
        return;
      }

      const backendUrl = window.location.origin.replace(':3005', ':4006');
      const response = await fetch(`${backendUrl}/app-api/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.token,
        },
        body: JSON.stringify({
          provider_id: testPaymentProvider.id,
          amount: parseFloat(fnbTestFormData.amount),
          item_name: fnbTestFormData.description,
          payment_type: 'once_off',
        }),
      });

      const result = await response.json();

      if (result.success && result.paymentUrl) {
        ToastUtils.success('FNB payment initiated! Opening payment page...');
        setShowTestPaymentModal(false);
        window.open(result.paymentUrl, '_blank');
      } else {
        ToastUtils.error(result.error || 'Failed to initiate FNB payment');
      }
    } catch (error: any) {
      console.error('FNB test payment error:', error);
      ToastUtils.error(error.message || 'Failed to initiate FNB test payment');
    } finally {
      setTestPaymentLoading(false);
    }
  };

  const handleTestPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (testPaymentProvider?.provider_type === 'fnb_pay') {
      return handleFnbTestPayment(e);
    }

    setTestPaymentLoading(true);

    try {
      const token = localStorage.getItem('skaftin-token') || '';
      const credentialsResponse = await RequestUtils.get(
        ApiRoutes.CREDENTIALS.LIST(projectId!),
        token
      );

      if (!credentialsResponse.success || !credentialsResponse.data?.length) {
        ToastUtils.error('No API credentials found. Please create an API key first in the API Credentials section.');
        setTestPaymentLoading(false);
        return;
      }

      const apiKey = credentialsResponse.data.find(
        (cred: any) => cred.credential_type === 'api_key' && cred.is_active
      );

      if (!apiKey) {
        ToastUtils.error('No active API key found. Please create one in the API Credentials section.');
        setTestPaymentLoading(false);
        return;
      }

      const backendUrl = window.location.origin.replace(':3005', ':4006');
      const response = await fetch(`${backendUrl}/app-api/payments/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey.token,
        },
        body: JSON.stringify({
          provider_id: testPaymentProvider?.id,
          amount: parseFloat(testPaymentFormData.amount),
          item_name: testPaymentFormData.item_name,
          item_description: testPaymentFormData.item_description || undefined,
          customer_email: testPaymentFormData.customer_email || undefined,
          customer_name: testPaymentFormData.customer_name || undefined,
          payment_type: testPaymentFormData.payment_type,
        }),
      });

      const result = await response.json();

      if (result.success && result.paymentUrl) {
        ToastUtils.success('Payment initiated! Opening payment page...');
        setShowTestPaymentModal(false);
        window.open(result.paymentUrl, '_blank');
      } else {
        ToastUtils.error(result.error || 'Failed to initiate payment');
      }
    } catch (error: any) {
      console.error('Test payment error:', error);
      ToastUtils.error(error.message || 'Failed to initiate test payment');
    } finally {
      setTestPaymentLoading(false);
    }
  };

  const renderPayFastFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            Merchant ID *
          </label>
          <input
            type="text"
            value={formData.merchant_id}
            onChange={(e) => setFormData({ ...formData, merchant_id: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder="e.g., 10000100"
            required={!editingProvider}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            Merchant Key {!editingProvider && '*'}
          </label>
          <input
            type="password"
            value={formData.merchant_key}
            onChange={(e) => setFormData({ ...formData, merchant_key: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder={editingProvider ? '(unchanged)' : 'Enter merchant key'}
            required={!editingProvider}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
          Passphrase {!editingProvider && '*'}
        </label>
        <input
          type="password"
          value={formData.passphrase}
          onChange={(e) => setFormData({ ...formData, passphrase: e.target.value })}
          className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
          placeholder={editingProvider ? '(unchanged)' : 'Enter passphrase'}
          required={!editingProvider}
        />
        <p className="text-xs text-dark-500 mt-1">
          Set in your PayFast dashboard under Settings &gt; Integration
        </p>
      </div>
    </>
  );

  const renderFnbFields = () => (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
          FNB Base URL (FNB_BASE_URL) *
        </label>
        <input
          type="url"
          value={formData.fnb_base_url}
          onChange={(e) => setFormData({ ...formData, fnb_base_url: e.target.value })}
          className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
          placeholder="https://sandbox.ms.fnb.co.za"
          required={!editingProvider}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            API Key (FNB_API_KEY, MOTO)
          </label>
          <input
            type="password"
            value={formData.fnb_api_key}
            onChange={(e) => setFormData({ ...formData, fnb_api_key: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder={editingProvider ? '(unchanged)' : ''}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            API Inst (FNB_API_INST, MOTO)
          </label>
          <input
            type="password"
            value={formData.fnb_api_inst}
            onChange={(e) => setFormData({ ...formData, fnb_api_inst: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder={editingProvider ? '(unchanged)' : ''}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            API Key 3D (FNB_API_KEY_3D) *
          </label>
          <input
            type="password"
            value={formData.fnb_api_key_3d}
            onChange={(e) => setFormData({ ...formData, fnb_api_key_3d: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder={editingProvider ? '(unchanged)' : ''}
            required={!editingProvider}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            Inst 3D (FNB_API_INST_3D) *
          </label>
          <input
            type="password"
            value={formData.fnb_api_inst_3d}
            onChange={(e) => setFormData({ ...formData, fnb_api_inst_3d: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder={editingProvider ? '(unchanged)' : ''}
            required={!editingProvider}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
          Secret Key (FNB_SECRET_KEY)
        </label>
        <input
          type="password"
          value={formData.fnb_secret_key}
          onChange={(e) => setFormData({ ...formData, fnb_secret_key: e.target.value })}
          className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
          placeholder={editingProvider ? '(unchanged)' : ''}
        />
      </div>
    </div>
  );

  const renderGenericFields = () => (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            API Key
          </label>
          <input
            type="password"
            value={formData.api_key}
            onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder={editingProvider ? '(unchanged)' : 'Enter API key'}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
            API Secret
          </label>
          <input
            type="password"
            value={formData.api_secret}
            onChange={(e) => setFormData({ ...formData, api_secret: e.target.value })}
            className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
            placeholder={editingProvider ? '(unchanged)' : 'Enter API secret'}
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
          Public Key
        </label>
        <input
          type="text"
          value={formData.public_key}
          onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
          className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
          placeholder="Enter public key"
        />
      </div>
    </>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Payment Providers</h2>
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Configure payment gateways for your application
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Provider
        </button>
      </div>

      {/* Webhook URL Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Webhook URL (ITN)</h3>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Configure this URL in your payment gateway dashboard for payment notifications:
            </p>
            <code className="block mt-2 p-2 bg-blue-100 dark:bg-blue-900/40 rounded text-xs text-blue-800 dark:text-blue-200 break-all">
              {getWebhookUrl()}
            </code>
          </div>
        </div>
      </div>

      {/* Providers List */}
      {providers.length === 0 ? (
        <div className="text-center py-12 bg-dark-50 dark:bg-dark-800 rounded-lg">
          <CreditCard className="w-12 h-12 mx-auto text-dark-400 mb-4" />
          <h3 className="text-lg font-medium text-dark-900 dark:text-white mb-2">
            No Payment Providers
          </h3>
          <p className="text-dark-500 dark:text-dark-400 mb-4">
            Add a payment provider to start accepting payments
          </p>
          <button
            onClick={() => handleOpenModal()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Payment Provider
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {providers.map((provider) => (
            <div
              key={provider.id}
              className={`bg-white dark:bg-dark-800 border rounded-lg p-4 ${provider.is_active
                ? 'border-dark-200 dark:border-dark-700'
                : 'border-dark-200 dark:border-dark-700 opacity-60'
                }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${provider.is_active
                    ? 'bg-primary-100 dark:bg-primary-900/30'
                    : 'bg-dark-100 dark:bg-dark-700'
                    }`}>
                    <CreditCard className={`w-5 h-5 ${provider.is_active
                      ? 'text-primary-600 dark:text-primary-400'
                      : 'text-dark-400'
                      }`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-dark-900 dark:text-white">
                        {provider.name}
                      </h3>
                      <span className={`px-2 py-0.5 text-xs rounded-full ${provider.sandbox_mode
                        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                        : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                        }`}>
                        {provider.sandbox_mode ? 'Sandbox' : 'Live'}
                      </span>
                      {provider.is_active ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-dark-400">
                          <AlertCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-dark-500 dark:text-dark-400">
                      {getProviderDisplayName(provider.provider_type)}
                      {provider.merchant_id && ` • ID: ${provider.merchant_id}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Test Payment Button */}
                  {provider.is_active && (
                    <button
                      onClick={() => openTestPaymentModal(provider)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                      title="Test Payment"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Test
                    </button>
                  )}
                  <button
                    onClick={() => handleTestConnection(provider.id)}
                    disabled={testing === provider.id}
                    className="p-2 text-dark-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
                    title="Test Connection"
                  >
                    {testing === provider.id ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500"></div>
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleToggleActive(provider)}
                    className={`p-2 rounded-lg transition-colors ${provider.is_active
                      ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                      : 'text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
                      }`}
                    title={provider.is_active ? 'Deactivate' : 'Activate'}
                  >
                    {provider.is_active ? (
                      <Power className="w-4 h-4" />
                    ) : (
                      <PowerOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleOpenModal(provider)}
                    className="p-2 text-dark-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                    title="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(provider.id)}
                    className="p-2 text-dark-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* URLs Preview */}
              {(provider.return_url || provider.cancel_url) && (
                <div className="mt-3 pt-3 border-t border-dark-100 dark:border-dark-700">
                  <div className="flex flex-wrap gap-4 text-xs text-dark-500">
                    {provider.return_url && (
                      <div className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        <span>Return: {provider.return_url}</span>
                      </div>
                    )}
                    {provider.cancel_url && (
                      <div className="flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" />
                        <span>Cancel: {provider.cancel_url}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-dark-900 dark:text-white">
                {editingProvider ? 'Edit Payment Provider' : 'Add Payment Provider'}
              </h2>
              <button
                onClick={handleCloseModal}
                className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-dark-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                    Provider Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                    placeholder="e.g., PayFast Production"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                    Provider Type *
                  </label>
                  <select
                    value={formData.provider_type}
                    onChange={(e) => setFormData({ ...formData, provider_type: e.target.value as PaymentProviderType })}
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                    disabled={!!editingProvider}
                  >
                    {PROVIDER_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Provider-specific fields */}
              {formData.provider_type === 'payfast' ? renderPayFastFields() : formData.provider_type === 'fnb_pay' ? renderFnbFields() : null}

              {/* URL Configuration */}
              <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Redirect URLs
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-dark-600 dark:text-dark-400 mb-1">
                      Return URL (after successful payment)
                    </label>
                    <input
                      type="url"
                      value={formData.return_url}
                      onChange={(e) => setFormData({ ...formData, return_url: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder="https://yourapp.com/payment/success"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-dark-600 dark:text-dark-400 mb-1">
                      Cancel URL (if user cancels)
                    </label>
                    <input
                      type="url"
                      value={formData.cancel_url}
                      onChange={(e) => setFormData({ ...formData, cancel_url: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder="https://yourapp.com/payment/cancelled"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-dark-600 dark:text-dark-400 mb-1">
                      Notify URL (webhook for payment notifications)
                    </label>
                    <input
                      type="url"
                      value={formData.notify_url}
                      onChange={(e) => setFormData({ ...formData, notify_url: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder={getWebhookUrl()}
                    />
                    <p className="text-xs text-dark-500 mt-1">
                      Leave empty to use the default webhook URL shown above
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="pt-4 border-t border-dark-200 dark:border-dark-700">
                <h3 className="text-sm font-medium text-dark-700 dark:text-dark-300 mb-3">
                  Settings
                </h3>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.sandbox_mode}
                      onChange={(e) => setFormData({ ...formData, sandbox_mode: e.target.checked })}
                      className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-dark-700 dark:text-dark-300">
                      Sandbox/Test Mode
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-dark-700 dark:text-dark-300">
                      Active
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-dark-200 dark:border-dark-700">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  {editingProvider ? 'Update Provider' : 'Create Provider'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Test Payment Modal */}
      {showTestPaymentModal && testPaymentProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-dark-800 rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
              <div>
                <h2 className="text-lg font-semibold text-dark-900 dark:text-white">
                  {testPaymentProvider.provider_type === 'fnb_pay' ? 'Test FNB Payment' : 'Test Payment'}
                </h2>
                <p className="text-sm text-dark-500 dark:text-dark-400">
                  Testing with <span className="font-medium text-primary-600 dark:text-primary-400">{testPaymentProvider.name}</span>
                  {testPaymentProvider.sandbox_mode && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 rounded">
                      Sandbox
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowTestPaymentModal(false);
                  setTestPaymentProvider(null);
                }}
                className="p-2 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-dark-500" />
              </button>
            </div>

            <form onSubmit={handleTestPayment} className="p-4 space-y-4">
              {testPaymentProvider.provider_type === 'fnb_pay' ? (
                <>
                  {/* FNB-specific: just description and amount */}
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                      Description *
                    </label>
                    <input
                      type="text"
                      value={fnbTestFormData.description}
                      onChange={(e) => setFnbTestFormData({ ...fnbTestFormData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder="Test Payment - FNB"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                      Amount (ZAR) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={fnbTestFormData.amount}
                      onChange={(e) => setFnbTestFormData({ ...fnbTestFormData, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder="10.00"
                      required
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                      Amount (ZAR) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={testPaymentFormData.amount}
                      onChange={(e) => setTestPaymentFormData({ ...testPaymentFormData, amount: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder="10.00"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                      Item Name *
                    </label>
                    <input
                      type="text"
                      value={testPaymentFormData.item_name}
                      onChange={(e) => setTestPaymentFormData({ ...testPaymentFormData, item_name: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder="Test Product"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                      Description
                    </label>
                    <input
                      type="text"
                      value={testPaymentFormData.item_description}
                      onChange={(e) => setTestPaymentFormData({ ...testPaymentFormData, item_description: e.target.value })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                      placeholder="Testing payment integration"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Customer Email
                      </label>
                      <input
                        type="email"
                        value={testPaymentFormData.customer_email}
                        onChange={(e) => setTestPaymentFormData({ ...testPaymentFormData, customer_email: e.target.value })}
                        className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                        placeholder="test@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                        Customer Name
                      </label>
                      <input
                        type="text"
                        value={testPaymentFormData.customer_name}
                        onChange={(e) => setTestPaymentFormData({ ...testPaymentFormData, customer_name: e.target.value })}
                        className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                        placeholder="John Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">
                      Payment Type
                    </label>
                    <select
                      value={testPaymentFormData.payment_type}
                      onChange={(e) => setTestPaymentFormData({ ...testPaymentFormData, payment_type: e.target.value as 'once_off' | 'subscription' })}
                      className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white"
                    >
                      <option value="once_off">Once-off Payment</option>
                      <option value="subscription">Subscription</option>
                    </select>
                  </div>
                </>
              )}

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {testPaymentProvider.provider_type === 'fnb_pay'
                    ? 'You will be redirected to FNB\'s hosted payment page to complete the test.'
                    : `The ${getProviderDisplayName(testPaymentProvider.provider_type)} payment page will open in a new tab.`}
                  {testPaymentProvider.sandbox_mode && ' This is a sandbox/test transaction.'}
                </p>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-dark-200 dark:border-dark-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowTestPaymentModal(false);
                    setTestPaymentProvider(null);
                  }}
                  className="px-4 py-2 text-dark-700 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={testPaymentLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {testPaymentLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Initiating...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      {testPaymentProvider.provider_type === 'fnb_pay' ? 'Test FNB Payment' : 'Start Test Payment'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentProvidersTab;
