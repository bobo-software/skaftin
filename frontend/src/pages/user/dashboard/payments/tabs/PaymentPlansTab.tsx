import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Repeat, Plus, Trash2, X, RefreshCw, Power, PowerOff, Loader2 } from 'lucide-react';
import usePaymentPlanStore, {
  PaymentPlan,
  PlanInterval,
  PLAN_INTERVALS,
  CreatePaymentPlanRequest,
} from '../../../../../stores/data/usePaymentPlanStore';
import usePaymentProviderStore from '../../../../../stores/data/usePaymentProviderStore';
import ToastUtils from '../../../../../utils/ToastUtils';

interface PlanFormData {
  provider_id: string;
  name: string;
  description: string;
  amount: string;
  currency: string;
  interval: PlanInterval;
}

const emptyForm: PlanFormData = {
  provider_id: '',
  name: '',
  description: '',
  amount: '',
  currency: 'ZAR',
  interval: 'monthly',
};

const PaymentPlansTab = () => {
  const { projectId } = useParams<{ projectId: string }>();

  const { providers, fetchProviders } = usePaymentProviderStore();
  const {
    plans,
    plansLoading: loading,
    syncingProviderId,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    syncPlans,
  } = usePaymentPlanStore();

  const paystackProviders = useMemo(
    () => providers.filter((p) => p.provider_type === 'paystack'),
    [providers]
  );

  const [selectedProviderId, setSelectedProviderId] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<PlanFormData>(emptyForm);

  useEffect(() => {
    if (projectId) {
      fetchProviders(projectId);
      fetchPlans(projectId);
    }
  }, [projectId, fetchProviders, fetchPlans]);

  useEffect(() => {
    if (!selectedProviderId && paystackProviders.length > 0) {
      setSelectedProviderId(paystackProviders[0].id.toString());
    }
  }, [paystackProviders, selectedProviderId]);

  const visiblePlans = selectedProviderId
    ? plans.filter((p) => p.provider_id.toString() === selectedProviderId)
    : plans;

  const handleOpenModal = () => {
    setFormData({ ...emptyForm, provider_id: selectedProviderId || paystackProviders[0]?.id.toString() || '' });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !formData.provider_id) return;

    setSubmitting(true);
    try {
      const createData: CreatePaymentPlanRequest = {
        provider_id: parseInt(formData.provider_id, 10),
        name: formData.name,
        description: formData.description || undefined,
        amount: parseFloat(formData.amount),
        currency: formData.currency || undefined,
        interval: formData.interval,
      };
      const created = await createPlan(projectId, createData);
      if (created) {
        ToastUtils.success('Payment plan created successfully');
        handleCloseModal();
      } else {
        ToastUtils.error('Failed to create payment plan');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSync = async (providerId: string) => {
    if (!projectId) return;
    const result = await syncPlans(projectId, providerId);
    if (result) {
      ToastUtils.success(`Synced ${result.length} plan(s) from Paystack`);
    } else {
      ToastUtils.error('Failed to sync plans from Paystack');
    }
  };

  const handleToggleActive = async (plan: PaymentPlan) => {
    if (!projectId) return;
    const updated = await updatePlan(projectId, plan.id.toString(), { is_active: !plan.is_active });
    if (!updated) {
      ToastUtils.error('Failed to update plan');
    }
  };

  const handleDelete = async (plan: PaymentPlan) => {
    if (!projectId) return;
    if (!window.confirm(`Delete plan "${plan.name}"? This does not remove it from Paystack.`)) return;
    const deleted = await deletePlan(projectId, plan.id.toString());
    if (deleted) {
      ToastUtils.success('Payment plan deleted');
    } else {
      ToastUtils.error('Failed to delete payment plan');
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(amount);
    } catch {
      return `${currency} ${amount.toFixed(2)}`;
    }
  };

  if (loading && plans.length === 0) {
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
          <h2 className="text-lg font-semibold text-dark-900 dark:text-white">Subscription Plans</h2>
          <p className="text-sm text-dark-500 dark:text-dark-400">
            Manage Paystack recurring billing plans for your Paystack providers
          </p>
        </div>
        <button
          onClick={handleOpenModal}
          disabled={paystackProviders.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-4 h-4" />
          Create Plan
        </button>
      </div>

      {paystackProviders.length === 0 ? (
        <div className="text-center py-12 bg-dark-50 dark:bg-dark-800 rounded-lg">
          <Repeat className="w-12 h-12 mx-auto text-dark-400 mb-4" />
          <h3 className="text-lg font-medium text-dark-900 dark:text-white mb-2">No Paystack Providers</h3>
          <p className="text-dark-500 dark:text-dark-400">
            Add a Paystack payment provider first to create subscription plans
          </p>
        </div>
      ) : (
        <>
          {/* Provider selector + sync */}
          <div className="flex items-center gap-3">
            <select
              value={selectedProviderId}
              onChange={(e) => setSelectedProviderId(e.target.value)}
              className="px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
            >
              {paystackProviders.map((provider) => (
                <option key={provider.id} value={provider.id.toString()}>
                  {provider.name}
                </option>
              ))}
            </select>
            <button
              onClick={() => selectedProviderId && handleSync(selectedProviderId)}
              disabled={!selectedProviderId || syncingProviderId === parseInt(selectedProviderId, 10)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-dark-300 dark:border-dark-600 rounded-lg text-dark-700 dark:text-dark-300 hover:bg-dark-50 dark:hover:bg-dark-700 transition-colors disabled:opacity-50"
            >
              {syncingProviderId === parseInt(selectedProviderId || '0', 10) ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Sync from Paystack
            </button>
          </div>

          {/* Plans list */}
          {visiblePlans.length === 0 ? (
            <div className="text-center py-12 bg-dark-50 dark:bg-dark-800 rounded-lg">
              <Repeat className="w-12 h-12 mx-auto text-dark-400 mb-4" />
              <h3 className="text-lg font-medium text-dark-900 dark:text-white mb-2">No Plans Yet</h3>
              <p className="text-dark-500 dark:text-dark-400">
                Create a plan or sync existing plans from Paystack
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {visiblePlans.map((plan) => (
                <div
                  key={plan.id}
                  className={`bg-white dark:bg-dark-800 border rounded-lg p-4 ${
                    plan.is_active ? 'border-dark-200 dark:border-dark-700' : 'border-dark-200 dark:border-dark-700 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        plan.is_active ? 'bg-primary-100 dark:bg-primary-900/30' : 'bg-dark-100 dark:bg-dark-700'
                      }`}>
                        <Repeat className={`w-5 h-5 ${plan.is_active ? 'text-primary-600 dark:text-primary-400' : 'text-dark-400'}`} />
                      </div>
                      <div>
                        <h3 className="font-medium text-dark-900 dark:text-white">{plan.name}</h3>
                        <p className="text-sm text-dark-500 dark:text-dark-400">
                          {formatAmount(plan.amount, plan.currency)} / {plan.interval} • {plan.plan_code}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleActive(plan)}
                        className={`p-2 rounded-lg transition-colors ${
                          plan.is_active
                            ? 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20'
                            : 'text-dark-400 hover:bg-dark-100 dark:hover:bg-dark-700'
                        }`}
                        title={plan.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {plan.is_active ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(plan)}
                        className="p-2 text-dark-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Plan Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-4 border-b border-dark-200 dark:border-dark-700">
              <h3 className="text-lg font-semibold text-dark-900 dark:text-white">Create Plan</h3>
              <button onClick={handleCloseModal} className="text-dark-400 hover:text-dark-600 dark:hover:text-dark-300">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Provider</label>
                <select
                  value={formData.provider_id}
                  onChange={(e) => setFormData({ ...formData, provider_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
                >
                  {paystackProviders.map((provider) => (
                    <option key={provider.id} value={provider.id.toString()}>
                      {provider.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
                  placeholder="Pro Monthly"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Description</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
                  placeholder="Optional"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Currency</label>
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    maxLength={3}
                    className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-dark-700 dark:text-dark-300 mb-1">Interval</label>
                <select
                  value={formData.interval}
                  onChange={(e) => setFormData({ ...formData, interval: e.target.value as PlanInterval })}
                  className="w-full px-3 py-2 border border-dark-300 dark:border-dark-600 rounded-lg bg-white dark:bg-dark-800 text-dark-900 dark:text-white text-sm"
                >
                  {PLAN_INTERVALS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-sm text-dark-600 dark:text-dark-300 hover:bg-dark-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Plan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentPlansTab;
