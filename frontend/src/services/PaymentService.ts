import RequestUtils from '../utils/RequestUtils';
import ApiRoutes from '../constants/ApiRoutes';

// ============================================================================
// TYPES
// ============================================================================

export type PaymentProviderType = 'payfast' | 'fnb_pay';
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

export interface TransactionListOptions {
  status?: TransactionStatus;
  payment_type?: PaymentType;
  limit?: number;
  offset?: number;
  start_date?: string;
  end_date?: string;
}

export interface InitiatePaymentRequest {
  provider_id?: number;
  provider_name?: string;
  amount: number;
  item_name: string;
  item_description?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  payment_type?: PaymentType;
  subscription_type?: number;
  frequency?: number;
  cycles?: number;
  billing_date?: number;
  metadata?: Record<string, any>;
  return_url?: string;
  cancel_url?: string;
  notify_url?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  transactionId: string;
  paymentUrl: string;
  paymentData?: Record<string, any>;
  error?: string;
}

/** FNB payment initiation success response */
export interface FNBInitiatePaymentSuccessResponse {
  success: true;
  transactionId: string;
  paymentUrl: string;
  paymentData: { reference: string };
}

// ============================================================================
// SERVICE
// ============================================================================

class PaymentService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  // ============================================================================
  // PROVIDER MANAGEMENT
  // ============================================================================

  /**
   * List all payment providers for a project
   */
  async listProviders(projectId: string): Promise<PaymentProvider[]> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.PAYMENTS.LIST_PROVIDERS(projectId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list payment providers');
    } catch (error: any) {
      console.error('Error listing payment providers:', error);
      throw new Error(error.message || 'Failed to list payment providers');
    }
  }

  /**
   * Get a specific payment provider
   */
  async getProvider(projectId: string, providerId: string): Promise<PaymentProvider> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.PAYMENTS.GET_PROVIDER(projectId, providerId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get payment provider');
    } catch (error: any) {
      console.error('Error getting payment provider:', error);
      throw new Error(error.message || 'Failed to get payment provider');
    }
  }

  /**
   * Create a new payment provider
   */
  async createProvider(projectId: string, data: CreatePaymentProviderRequest): Promise<PaymentProvider> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.PAYMENTS.CREATE_PROVIDER(projectId),
        this.getToken(),
        data
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to create payment provider');
    } catch (error: any) {
      console.error('Error creating payment provider:', error);
      throw new Error(error.message || 'Failed to create payment provider');
    }
  }

  /**
   * Update a payment provider
   */
  async updateProvider(
    projectId: string,
    providerId: string,
    data: UpdatePaymentProviderRequest
  ): Promise<PaymentProvider> {
    try {
      const response = await RequestUtils.put(
        ApiRoutes.PAYMENTS.UPDATE_PROVIDER(projectId, providerId),
        this.getToken(),
        data
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update payment provider');
    } catch (error: any) {
      console.error('Error updating payment provider:', error);
      throw new Error(error.message || 'Failed to update payment provider');
    }
  }

  /**
   * Delete a payment provider
   */
  async deleteProvider(projectId: string, providerId: string): Promise<void> {
    try {
      const response = await RequestUtils.delete(
        ApiRoutes.PAYMENTS.DELETE_PROVIDER(projectId, providerId),
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete payment provider');
      }
    } catch (error: any) {
      console.error('Error deleting payment provider:', error);
      throw new Error(error.message || 'Failed to delete payment provider');
    }
  }

  /**
   * Test payment provider connection
   */
  async testProvider(projectId: string, providerId: string): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.PAYMENTS.TEST_PROVIDER(projectId, providerId),
        this.getToken(),
        {}
      );

      return response;
    } catch (error: any) {
      console.error('Error testing payment provider:', error);
      return { success: false, error: error.message || 'Connection test failed' };
    }
  }

  // ============================================================================
  // TRANSACTION MANAGEMENT
  // ============================================================================

  /**
   * List transactions for a project
   */
  async listTransactions(
    projectId: string,
    options: TransactionListOptions = {}
  ): Promise<{ transactions: PaymentTransaction[]; total: number }> {
    try {
      const queryParams = new URLSearchParams();
      if (options.status) queryParams.append('status', options.status);
      if (options.payment_type) queryParams.append('payment_type', options.payment_type);
      if (options.limit) queryParams.append('limit', options.limit.toString());
      if (options.offset) queryParams.append('offset', options.offset.toString());
      if (options.start_date) queryParams.append('start_date', options.start_date);
      if (options.end_date) queryParams.append('end_date', options.end_date);

      const url = `${ApiRoutes.PAYMENTS.LIST_TRANSACTIONS(projectId)}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      const response = await RequestUtils.get(url, this.getToken());

      if (response.success) {
        return {
          transactions: response.data,
          total: response.total || response.data.length,
        };
      }

      throw new Error(response.error || 'Failed to list transactions');
    } catch (error: any) {
      console.error('Error listing transactions:', error);
      throw new Error(error.message || 'Failed to list transactions');
    }
  }

  /**
   * Get a specific transaction
   */
  async getTransaction(projectId: string, transactionId: string): Promise<PaymentTransaction> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.PAYMENTS.GET_TRANSACTION(projectId, transactionId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get transaction');
    } catch (error: any) {
      console.error('Error getting transaction:', error);
      throw new Error(error.message || 'Failed to get transaction');
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get provider type display name
   */
  getProviderDisplayName(providerType: PaymentProviderType): string {
    const names: Record<PaymentProviderType, string> = {
      payfast: 'PayFast',
      fnb_pay: 'FNB Payment',
    };
    return names[providerType] || providerType;
  }

  /**
   * Get transaction status badge color
   */
  getStatusColor(status: TransactionStatus): string {
    const colors: Record<TransactionStatus, string> = {
      pending: 'yellow',
      processing: 'blue',
      complete: 'green',
      failed: 'red',
      cancelled: 'gray',
      refunded: 'purple',
    };
    return colors[status] || 'gray';
  }

  /**
   * Format amount as currency
   */
  formatAmount(amount: number, currency: string = 'ZAR'): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency,
    }).format(amount);
  }
}

export default new PaymentService();
