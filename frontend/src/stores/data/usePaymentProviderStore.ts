import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import RequestUtils from '../../utils/RequestUtils';
import ApiRoutes from '../../constants/ApiRoutes';

// ---------- Types ----------

export type PaymentProviderType = 'payfast' | 'fnb_pay' | 'paystack';
export type PaymentType = 'once_off' | 'subscription';
export type TransactionStatus = 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled' | 'refunded';

export interface PaymentProvider {
  id: number;
  project_id: number;
  name: string;
  provider_type: PaymentProviderType;
  merchant_id?: string;
  return_url?: string;
  cancel_url?: string;
  notify_url?: string;
  sandbox_mode: boolean;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransaction {
  id: number;
  project_id: number;
  provider_id: number;
  transaction_id: string;
  external_payment_id?: string;
  amount: number;
  currency: string;
  item_name: string;
  item_description?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  payment_type: PaymentType;
  subscription_type?: number;
  frequency?: number;
  cycles?: number;
  subscription_token?: string;
  status: TransactionStatus;
  status_message?: string;
  payment_url?: string;
  return_url?: string;
  cancel_url?: string;
  metadata?: Record<string, any>;
  webhook_data?: Record<string, any>;
  paid_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreatePaymentProviderRequest {
  name: string;
  provider_type: PaymentProviderType;
  merchant_id?: string;
  merchant_key?: string;
  passphrase?: string;
  api_key?: string;
  api_secret?: string;
  public_key?: string;
  return_url?: string;
  cancel_url?: string;
  notify_url?: string;
  sandbox_mode?: boolean;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdatePaymentProviderRequest {
  name?: string;
  merchant_id?: string;
  merchant_key?: string;
  passphrase?: string;
  api_key?: string;
  api_secret?: string;
  public_key?: string;
  return_url?: string;
  cancel_url?: string;
  notify_url?: string;
  sandbox_mode?: boolean;
  is_active?: boolean;
  metadata?: Record<string, any>;
}

export interface TransactionListOptions {
  status?: TransactionStatus;
  payment_type?: PaymentType;
  limit?: number;
  offset?: number;
  start_date?: string;
  end_date?: string;
}

// ---------- Store Types ----------

interface PaymentProviderStoreState {
  // Payment providers state
  providers: PaymentProvider[];
  providersLoading: boolean;
  providersError: string | null;

  // Transactions state
  transactions: PaymentTransaction[];
  transactionsTotal: number;
  transactionsLoading: boolean;
  transactionsError: string | null;

  // Selected transaction for detail view
  selectedTransaction: PaymentTransaction | null;

  // Testing state
  testingProviderId: number | null;

  // Current project ID being tracked
  currentProjectId: string | null;
}

interface PaymentProviderStoreActions {
  // Provider actions
  fetchProviders: (projectId: string) => Promise<void>;
  getProvider: (projectId: string, providerId: string) => Promise<PaymentProvider | null>;
  createProvider: (projectId: string, data: CreatePaymentProviderRequest) => Promise<PaymentProvider | null>;
  updateProvider: (projectId: string, providerId: string, data: UpdatePaymentProviderRequest) => Promise<PaymentProvider | null>;
  deleteProvider: (projectId: string, providerId: string) => Promise<boolean>;
  testProvider: (projectId: string, providerId: string) => Promise<{ success: boolean; message?: string; error?: string }>;

  // Transaction actions
  fetchTransactions: (projectId: string, options?: TransactionListOptions) => Promise<void>;
  getTransaction: (projectId: string, transactionId: string) => Promise<PaymentTransaction | null>;
  setSelectedTransaction: (transaction: PaymentTransaction | null) => void;

  // Utility actions
  clearErrors: () => void;
  reset: () => void;
}

type PaymentProviderStore = PaymentProviderStoreState & PaymentProviderStoreActions;

// ---------- Helper ----------

const getToken = () => localStorage.getItem('skaftin-token') || '';

// ---------- Store ----------

const usePaymentProviderStore = create<PaymentProviderStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      providers: [],
      providersLoading: false,
      providersError: null,

      transactions: [],
      transactionsTotal: 0,
      transactionsLoading: false,
      transactionsError: null,

      selectedTransaction: null,
      testingProviderId: null,
      currentProjectId: null,

      // ---------- Provider Actions ----------

      fetchProviders: async (projectId: string) => {
        set({ providersLoading: true, providersError: null, currentProjectId: projectId });
        try {
          const response = await RequestUtils.get(
            ApiRoutes.PAYMENTS.LIST_PROVIDERS(projectId),
            getToken()
          );

          if (response.success) {
            set({ providers: response.data, providersLoading: false });
          } else {
            set({
              providersError: response.error || 'Failed to fetch payment providers',
              providersLoading: false,
            });
          }
        } catch (error: any) {
          console.error('Error fetching payment providers:', error);
          set({
            providersError: error.message || 'Network error while fetching payment providers',
            providersLoading: false,
          });
        }
      },

      getProvider: async (projectId: string, providerId: string) => {
        try {
          const response = await RequestUtils.get(
            ApiRoutes.PAYMENTS.GET_PROVIDER(projectId, providerId),
            getToken()
          );

          if (response.success) {
            return response.data;
          }
          return null;
        } catch (error: any) {
          console.error('Error getting payment provider:', error);
          return null;
        }
      },

      createProvider: async (projectId: string, data: CreatePaymentProviderRequest) => {
        set({ providersLoading: true, providersError: null });
        try {
          const response = await RequestUtils.post(
            ApiRoutes.PAYMENTS.CREATE_PROVIDER(projectId),
            getToken(),
            data
          );

          if (response.success) {
            const newProvider = response.data;
            set((state) => ({
              providers: [...state.providers, newProvider],
              providersLoading: false,
            }));
            return newProvider;
          } else {
            set({
              providersError: response.error || 'Failed to create payment provider',
              providersLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error creating payment provider:', error);
          set({
            providersError: error.message || 'Network error while creating payment provider',
            providersLoading: false,
          });
          return null;
        }
      },

      updateProvider: async (projectId: string, providerId: string, data: UpdatePaymentProviderRequest) => {
        set({ providersLoading: true, providersError: null });
        try {
          const response = await RequestUtils.put(
            ApiRoutes.PAYMENTS.UPDATE_PROVIDER(projectId, providerId),
            getToken(),
            data
          );

          if (response.success) {
            const updatedProvider = response.data;
            set((state) => ({
              providers: state.providers.map((p) =>
                p.id.toString() === providerId ? { ...p, ...updatedProvider } : p
              ),
              providersLoading: false,
            }));
            return updatedProvider;
          } else {
            set({
              providersError: response.error || 'Failed to update payment provider',
              providersLoading: false,
            });
            return null;
          }
        } catch (error: any) {
          console.error('Error updating payment provider:', error);
          set({
            providersError: error.message || 'Network error while updating payment provider',
            providersLoading: false,
          });
          return null;
        }
      },

      deleteProvider: async (projectId: string, providerId: string) => {
        set({ providersLoading: true, providersError: null });
        try {
          const response = await RequestUtils.delete(
            ApiRoutes.PAYMENTS.DELETE_PROVIDER(projectId, providerId),
            getToken(),
            {}
          );

          if (response.success) {
            set((state) => ({
              providers: state.providers.filter((p) => p.id.toString() !== providerId),
              providersLoading: false,
            }));
            return true;
          } else {
            set({
              providersError: response.error || 'Failed to delete payment provider',
              providersLoading: false,
            });
            return false;
          }
        } catch (error: any) {
          console.error('Error deleting payment provider:', error);
          set({
            providersError: error.message || 'Network error while deleting payment provider',
            providersLoading: false,
          });
          return false;
        }
      },

      testProvider: async (projectId: string, providerId: string) => {
        set({ testingProviderId: parseInt(providerId, 10) });
        try {
          const response = await RequestUtils.post(
            ApiRoutes.PAYMENTS.TEST_PROVIDER(projectId, providerId),
            getToken(),
            {}
          );
          set({ testingProviderId: null });
          return response;
        } catch (error: any) {
          console.error('Error testing payment provider:', error);
          set({ testingProviderId: null });
          return { success: false, error: error.message || 'Connection test failed' };
        }
      },

      // ---------- Transaction Actions ----------

      fetchTransactions: async (projectId: string, options: TransactionListOptions = {}) => {
        set({ transactionsLoading: true, transactionsError: null, currentProjectId: projectId });
        try {
          const queryParams = new URLSearchParams();
          if (options.status) queryParams.append('status', options.status);
          if (options.payment_type) queryParams.append('payment_type', options.payment_type);
          if (options.limit) queryParams.append('limit', options.limit.toString());
          if (options.offset) queryParams.append('offset', options.offset.toString());
          if (options.start_date) queryParams.append('start_date', options.start_date);
          if (options.end_date) queryParams.append('end_date', options.end_date);

          const url = `${ApiRoutes.PAYMENTS.LIST_TRANSACTIONS(projectId)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
          const response = await RequestUtils.get(url, getToken());

          if (response.success) {
            set({
              transactions: response.data,
              transactionsTotal: response.total || response.data.length,
              transactionsLoading: false,
            });
          } else {
            set({
              transactionsError: response.error || 'Failed to fetch transactions',
              transactionsLoading: false,
            });
          }
        } catch (error: any) {
          console.error('Error fetching transactions:', error);
          set({
            transactionsError: error.message || 'Network error while fetching transactions',
            transactionsLoading: false,
          });
        }
      },

      getTransaction: async (projectId: string, transactionId: string) => {
        try {
          const response = await RequestUtils.get(
            ApiRoutes.PAYMENTS.GET_TRANSACTION(projectId, transactionId),
            getToken()
          );

          if (response.success) {
            return response.data;
          }
          return null;
        } catch (error: any) {
          console.error('Error getting transaction:', error);
          return null;
        }
      },

      setSelectedTransaction: (transaction: PaymentTransaction | null) => {
        set({ selectedTransaction: transaction });
      },

      // ---------- Utility Actions ----------

      clearErrors: () => {
        set({ providersError: null, transactionsError: null });
      },

      reset: () => {
        set({
          providers: [],
          providersLoading: false,
          providersError: null,
          transactions: [],
          transactionsTotal: 0,
          transactionsLoading: false,
          transactionsError: null,
          selectedTransaction: null,
          testingProviderId: null,
          currentProjectId: null,
        });
      },
    }),
    {
      name: 'payment-provider-store',
    }
  )
);

// ---------- Helper Functions ----------

export const getProviderDisplayName = (providerType: PaymentProviderType): string => {
  const names: Record<PaymentProviderType, string> = {
    payfast: 'PayFast',
    fnb_pay: 'FNB Payment',
    paystack: 'Paystack',
  };
  return names[providerType] || providerType;
};

export const getStatusColor = (status: TransactionStatus): string => {
  const colors: Record<TransactionStatus, string> = {
    pending: 'yellow',
    processing: 'blue',
    complete: 'green',
    failed: 'red',
    cancelled: 'gray',
    refunded: 'purple',
  };
  return colors[status] || 'gray';
};

export const formatAmount = (amount: number, currency: string = 'ZAR'): string => {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency,
  }).format(amount);
};

export default usePaymentProviderStore;
