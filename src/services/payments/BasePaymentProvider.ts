/**
 * Base Payment Provider Interface
 * 
 * All payment gateway providers (PayFast, Yoco, Paystack, etc.) must implement this interface.
 * This ensures a consistent API across different payment gateways.
 */

export interface PaymentProviderConfig {
  id: number;
  projectId: number;
  name: string;
  providerType: PaymentProviderType;
  sandboxMode: boolean;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
  // PayFast specific
  merchantId?: string;
  merchantKey?: string;
  passphrase?: string;
  // Generic credentials
  apiKey?: string;
  apiSecret?: string;
  publicKey?: string;
  metadata?: Record<string, any>;
}

export type PaymentProviderType = 'payfast' | 'fnb_pay';

export interface InitiatePaymentRequest {
  amount: number;
  itemName: string;
  itemDescription?: string;
  customerEmail?: string;
  customerName?: string;
  customerPhone?: string;
  paymentType?: 'once_off' | 'subscription';
  // Subscription options
  subscriptionType?: number;  // PayFast: 1=subscription, 2=tokenization
  frequency?: number;         // PayFast: 3=monthly, 4=quarterly, 5=biannual, 6=annual
  cycles?: number;            // 0 = infinite
  billingDate?: number;       // Day of month (1-31)
  // Custom data
  metadata?: Record<string, any>;
  // Override URLs for this transaction
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  transactionId: string;        // Our internal transaction ID
  paymentUrl: string;           // URL to redirect user to
  paymentData?: Record<string, any>;  // Raw data sent to gateway
  error?: string;
}

/** FNB payment initiation success response (e.g. from /app-api/payments/initiate) */
export interface FNBInitiatePaymentSuccessResponse {
  success: true;
  transactionId: string;
  paymentUrl: string;
  paymentData: {
    reference: string;
  };
}

export interface WebhookPayload {
  rawBody: string;
  parsedData: Record<string, any>;
  headers: Record<string, string>;
  ipAddress: string;
}

export interface WebhookValidationResult {
  valid: boolean;
  transactionId?: string;
  externalPaymentId?: string;
  status?: 'complete' | 'failed' | 'cancelled' | 'pending';
  amount?: number;
  error?: string;
  rawData?: Record<string, any>;
}

export interface TransactionStatusResponse {
  success: boolean;
  status: string;
  externalPaymentId?: string;
  amount?: number;
  paidAt?: Date;
  error?: string;
}

export interface SubscriptionActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface PingResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Base Payment Provider Interface
 * 
 * All payment providers must implement these methods.
 */
export interface BasePaymentProvider {
  /**
   * Get the provider type identifier
   */
  getProviderType(): PaymentProviderType;

  /**
   * Test the connection/credentials with the payment gateway
   */
  ping(): Promise<PingResponse>;

  /**
   * Initiate a payment and get the redirect URL
   */
  initiatePayment(request: InitiatePaymentRequest, transactionId: string): Promise<InitiatePaymentResponse>;

  /**
   * Validate and process a webhook/ITN callback
   */
  validateWebhook(payload: WebhookPayload): Promise<WebhookValidationResult>;

  /**
   * Get transaction status from the gateway (optional - not all gateways support this)
   */
  getTransactionStatus?(externalPaymentId: string): Promise<TransactionStatusResponse>;

  /**
   * Cancel a subscription (for subscription payments)
   */
  cancelSubscription?(subscriptionToken: string): Promise<SubscriptionActionResponse>;

  /**
   * Pause a subscription (for subscription payments)
   */
  pauseSubscription?(subscriptionToken: string): Promise<SubscriptionActionResponse>;

  /**
   * Resume a subscription (for subscription payments)
   */
  resumeSubscription?(subscriptionToken: string): Promise<SubscriptionActionResponse>;
}

/**
 * Payment Provider Record from database
 */
export interface PaymentProviderRecord {
  id: number;
  project_id: number;
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
  sandbox_mode: boolean;
  is_active: boolean;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * Payment Transaction Record from database
 */
export interface PaymentTransactionRecord {
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
  payment_type: 'once_off' | 'subscription';
  subscription_type?: number;
  frequency?: number;
  cycles?: number;
  subscription_token?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'cancelled' | 'refunded';
  status_message?: string;
  payment_url?: string;
  return_url?: string;
  cancel_url?: string;
  metadata?: Record<string, any>;
  webhook_data?: Record<string, any>;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
}

/**
 * Convert database record to provider config
 */
export function recordToConfig(record: PaymentProviderRecord): PaymentProviderConfig {
  return {
    id: record.id,
    projectId: record.project_id,
    name: record.name,
    providerType: record.provider_type,
    sandboxMode: record.sandbox_mode,
    returnUrl: record.return_url,
    cancelUrl: record.cancel_url,
    notifyUrl: record.notify_url,
    merchantId: record.merchant_id,
    merchantKey: record.merchant_key,
    passphrase: record.passphrase,
    apiKey: record.api_key,
    apiSecret: record.api_secret,
    publicKey: record.public_key,
    metadata: record.metadata,
  };
}
