/**
 * PayFast Payment Provider
 * 
 * Implements the BasePaymentProvider interface for PayFast payment gateway.
 * Supports both once-off and subscription payments.
 * 
 * PayFast Documentation: https://developers.payfast.co.za/
 */

import * as crypto from 'crypto';
import * as dns from 'dns';
import axios from 'axios';
import * as querystring from 'querystring';
import {
  BasePaymentProvider,
  PaymentProviderConfig,
  PaymentProviderType,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  WebhookPayload,
  WebhookValidationResult,
  TransactionStatusResponse,
  SubscriptionActionResponse,
  PingResponse,
} from './BasePaymentProvider';

// PayFast hosts
const PAYFAST_SANDBOX_HOST = 'sandbox.payfast.co.za';
const PAYFAST_PRODUCTION_HOST = 'www.payfast.co.za';
const PAYFAST_API_HOST = 'api.payfast.co.za';

// Valid PayFast IP hosts for ITN validation
const PAYFAST_VALID_HOSTS = [
  'www.payfast.co.za',
  'sandbox.payfast.co.za',
  'w1w.payfast.co.za',
  'w2w.payfast.co.za',
];

interface PayFastHeaders {
  'merchant-id': string;
  version: string;
  timestamp: string;
  signature?: string;
  [key: string]: string | undefined;
}

export class PayFastProvider implements BasePaymentProvider {
  private config: PaymentProviderConfig;
  private pfHost: string;

  constructor(config: PaymentProviderConfig) {
    this.config = config;
    this.pfHost = config.sandboxMode ? PAYFAST_SANDBOX_HOST : PAYFAST_PRODUCTION_HOST;
  }

  getProviderType(): PaymentProviderType {
    return 'payfast';
  }

  /**
   * Generate MD5 signature for PayFast payment data
   */
  private generatePaymentSignature(data: Record<string, string>, passphrase?: string): string {
    // Build param string in the order provided (PayFast is order-sensitive)
    let pfParamString = Object.entries(data)
      .filter(([_, value]) => value !== '' && value !== undefined && value !== null)
      .map(([key, value]) => `${key}=${encodeURIComponent(String(value).trim()).replace(/%20/g, '+')}`)
      .join('&');

    // Add passphrase if provided
    if (passphrase) {
      pfParamString += `&passphrase=${encodeURIComponent(passphrase.trim()).replace(/%20/g, '+')}`;
    }

    return crypto.createHash('md5').update(pfParamString).digest('hex');
  }

  /**
   * Generate signature for PayFast API calls
   */
  private generateApiSignature(data: Record<string, any>, passphrase: string): string {
    const payload = Object.entries({ ...data, passphrase })
      .filter(([key]) => key !== 'signature')
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([key, value]) => `${key}=${querystring.escape(String(value))}`)
      .join('&');

    return crypto.createHash('md5').update(payload).digest('hex');
  }

  /**
   * Lookup IP addresses for a domain
   */
  private async ipLookup(domain: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      dns.lookup(domain, { all: true }, (err, addresses) => {
        if (err) {
          console.error(`DNS lookup failed for ${domain}:`, err);
          resolve([]); // Don't reject, just return empty
        } else {
          resolve(addresses.map((item) => item.address));
        }
      });
    });
  }

  /**
   * Validate that the request comes from a valid PayFast IP
   */
  private async validateIP(ipAddress: string): Promise<boolean> {
    try {
      const validIps = await Promise.all(PAYFAST_VALID_HOSTS.map((host) => this.ipLookup(host))).then((results) =>
        results.flat()
      );
      return validIps.includes(ipAddress);
    } catch (error) {
      console.error('IP validation error:', error);
      return false;
    }
  }

  /**
   * Validate the signature from PayFast ITN
   */
  private validateSignature(pfData: Record<string, any>, pfParamString: string): boolean {
    const passphrase = this.config.passphrase || '';
    
    const fullParamString = passphrase
      ? `${pfParamString}&passphrase=${encodeURIComponent(passphrase)}`
      : pfParamString;

    const generatedSignature = crypto.createHash('md5').update(fullParamString).digest('hex');
    return pfData['signature'] === generatedSignature;
  }

  /**
   * Validate payment amount matches
   */
  private validatePaymentAmount(expectedAmount: number, pfData: Record<string, any>): boolean {
    const receivedAmount = parseFloat(pfData['amount_gross'] || '0');
    return Math.abs(expectedAmount - receivedAmount) <= 0.01;
  }

  /**
   * Validate payment with PayFast server
   */
  private async validateServerConfirmation(pfParamString: string): Promise<boolean> {
    try {
      const response = await axios.post(
        `https://${this.pfHost}/eng/query/validate`,
        pfParamString,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );
      return response.data === 'VALID';
    } catch (error) {
      console.error('PayFast server confirmation failed:', error);
      return false;
    }
  }

  /**
   * Test connection to PayFast API
   */
  async ping(): Promise<PingResponse> {
    try {
      if (!this.config.merchantId || !this.config.passphrase) {
        return {
          success: false,
          error: 'Missing merchant_id or passphrase',
        };
      }

      const timestamp = new Date().toISOString().split('.')[0];
      const headers: PayFastHeaders = {
        'merchant-id': this.config.merchantId,
        version: 'v1',
        timestamp,
      };

      headers['signature'] = this.generateApiSignature(headers, this.config.passphrase);

      const response = await axios.get(`https://${PAYFAST_API_HOST}/ping`, {
        headers: headers as Record<string, string>,
        timeout: 10000,
      });

      return {
        success: response.status === 200,
        message: 'PayFast connection successful',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to connect to PayFast',
      };
    }
  }

  /**
   * Initiate a payment and return the PayFast redirect URL
   */
  async initiatePayment(request: InitiatePaymentRequest, transactionId: string): Promise<InitiatePaymentResponse> {
    try {
      if (!this.config.merchantId || !this.config.merchantKey) {
        return {
          success: false,
          transactionId,
          paymentUrl: '',
          error: 'Missing merchant_id or merchant_key',
        };
      }

      // Build payment data in PayFast's required order
      const paymentData: Record<string, string> = {};

      // Merchant details (required)
      paymentData['merchant_id'] = this.config.merchantId;
      paymentData['merchant_key'] = this.config.merchantKey;

      // URLs
      paymentData['return_url'] = request.returnUrl || this.config.returnUrl || '';
      paymentData['cancel_url'] = request.cancelUrl || this.config.cancelUrl || '';
      paymentData['notify_url'] = request.notifyUrl || this.config.notifyUrl || '';

      // Customer details (optional but recommended)
      if (request.customerName) {
        const nameParts = request.customerName.split(' ');
        paymentData['name_first'] = nameParts[0] || '';
        paymentData['name_last'] = nameParts.slice(1).join(' ') || '';
      }
      if (request.customerEmail) {
        paymentData['email_address'] = request.customerEmail;
      }
      if (request.customerPhone) {
        paymentData['cell_number'] = request.customerPhone;
      }

      // Transaction details
      paymentData['m_payment_id'] = transactionId;
      paymentData['amount'] = request.amount.toFixed(2);
      paymentData['item_name'] = request.itemName.substring(0, 100); // Max 100 chars
      if (request.itemDescription) {
        paymentData['item_description'] = request.itemDescription.substring(0, 255); // Max 255 chars
      }

      // Custom fields for our own tracking
      paymentData['custom_str1'] = String(this.config.projectId);
      paymentData['custom_str2'] = transactionId;
      
      // Store metadata as JSON in custom field
      if (request.metadata) {
        paymentData['custom_str3'] = JSON.stringify(request.metadata).substring(0, 255);
      }

      // Subscription/recurring payment options
      if (request.paymentType === 'subscription') {
        paymentData['subscription_type'] = String(request.subscriptionType || 1);
        if (request.frequency) {
          paymentData['frequency'] = String(request.frequency);
        }
        if (request.cycles !== undefined) {
          paymentData['cycles'] = String(request.cycles);
        }
        if (request.billingDate) {
          paymentData['billing_date'] = String(request.billingDate);
        }
      }

      // Generate signature
      const signature = this.generatePaymentSignature(paymentData, this.config.passphrase);
      paymentData['signature'] = signature;

      // Build the payment URL
      const params = new URLSearchParams(paymentData).toString();
      const paymentUrl = `https://${this.pfHost}/eng/process?${params}`;

      return {
        success: true,
        transactionId,
        paymentUrl,
        paymentData,
      };
    } catch (error: any) {
      console.error('PayFast initiatePayment error:', error);
      return {
        success: false,
        transactionId,
        paymentUrl: '',
        error: error.message || 'Failed to initiate payment',
      };
    }
  }

  /**
   * Validate and process PayFast ITN (Instant Transaction Notification)
   */
  async validateWebhook(payload: WebhookPayload): Promise<WebhookValidationResult> {
    try {
      const { parsedData, ipAddress } = payload;

      // Build param string for signature validation (exclude signature field)
      const pfParamString = Object.entries(parsedData)
        .filter(([key]) => key !== 'signature')
        .map(([key, value]) => `${key}=${encodeURIComponent(String(value).trim())}`)
        .join('&');

      // 1. Validate IP address
      const validIP = await this.validateIP(ipAddress);
      if (!validIP) {
        console.warn('PayFast ITN: Invalid IP address:', ipAddress);
        // Don't fail on IP validation in sandbox mode
        if (!this.config.sandboxMode) {
          return {
            valid: false,
            error: 'Invalid source IP address',
          };
        }
      }

      // 2. Validate signature
      const validSignature = this.validateSignature(parsedData, pfParamString);
      if (!validSignature) {
        return {
          valid: false,
          error: 'Invalid signature',
        };
      }

      // 3. Validate with PayFast server
      const validServer = await this.validateServerConfirmation(pfParamString);
      if (!validServer) {
        return {
          valid: false,
          error: 'Server validation failed',
        };
      }

      // Extract transaction info
      const transactionId = parsedData['m_payment_id'] || parsedData['custom_str2'];
      const externalPaymentId = parsedData['pf_payment_id'];
      const paymentStatus = parsedData['payment_status'];
      const amount = parseFloat(parsedData['amount_gross'] || '0');

      // Map PayFast status to our status
      let status: 'complete' | 'failed' | 'cancelled' | 'pending';
      switch (paymentStatus) {
        case 'COMPLETE':
          status = 'complete';
          break;
        case 'FAILED':
          status = 'failed';
          break;
        case 'CANCELLED':
          status = 'cancelled';
          break;
        default:
          status = 'pending';
      }

      return {
        valid: true,
        transactionId,
        externalPaymentId,
        status,
        amount,
        rawData: parsedData,
      };
    } catch (error: any) {
      console.error('PayFast webhook validation error:', error);
      return {
        valid: false,
        error: error.message || 'Webhook validation failed',
      };
    }
  }

  /**
   * Get transaction history from PayFast API
   */
  async getTransactionStatus(externalPaymentId: string): Promise<TransactionStatusResponse> {
    try {
      if (!this.config.merchantId || !this.config.passphrase) {
        return {
          success: false,
          status: 'unknown',
          error: 'Missing merchant_id or passphrase',
        };
      }

      const timestamp = new Date().toISOString().split('.')[0];
      const headers: PayFastHeaders = {
        'merchant-id': this.config.merchantId,
        version: 'v1',
        timestamp,
      };

      headers['signature'] = this.generateApiSignature(headers, this.config.passphrase);

      const response = await axios.get(
        `https://${PAYFAST_API_HOST}/transactions/history/daily`,
        {
          headers: headers as Record<string, string>,
          timeout: 10000,
        }
      );

      // Search for the transaction in the response
      const transactions = response.data?.data || [];
      const transaction = transactions.find((t: any) => t.pf_payment_id === externalPaymentId);

      if (transaction) {
        return {
          success: true,
          status: transaction.status,
          externalPaymentId,
          amount: parseFloat(transaction.amount_gross || '0'),
        };
      }

      return {
        success: false,
        status: 'not_found',
        error: 'Transaction not found',
      };
    } catch (error: any) {
      return {
        success: false,
        status: 'error',
        error: error.message || 'Failed to get transaction status',
      };
    }
  }

  /**
   * Cancel a PayFast subscription
   */
  async cancelSubscription(subscriptionToken: string): Promise<SubscriptionActionResponse> {
    try {
      if (!this.config.merchantId || !this.config.passphrase) {
        return {
          success: false,
          error: 'Missing merchant_id or passphrase',
        };
      }

      const timestamp = new Date().toISOString().split('.')[0];
      const headers: PayFastHeaders = {
        'merchant-id': this.config.merchantId,
        version: 'v1',
        timestamp,
      };

      headers['signature'] = this.generateApiSignature(headers, this.config.passphrase);

      const response = await axios.put(
        `https://${PAYFAST_API_HOST}/subscriptions/${subscriptionToken}/cancel`,
        {},
        {
          headers: headers as Record<string, string>,
          timeout: 10000,
        }
      );

      return {
        success: response.status === 200,
        message: 'Subscription cancelled successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to cancel subscription',
      };
    }
  }

  /**
   * Pause a PayFast subscription
   */
  async pauseSubscription(subscriptionToken: string): Promise<SubscriptionActionResponse> {
    try {
      if (!this.config.merchantId || !this.config.passphrase) {
        return {
          success: false,
          error: 'Missing merchant_id or passphrase',
        };
      }

      const timestamp = new Date().toISOString().split('.')[0];
      const headers: PayFastHeaders = {
        'merchant-id': this.config.merchantId,
        version: 'v1',
        timestamp,
      };

      headers['signature'] = this.generateApiSignature(headers, this.config.passphrase);

      const response = await axios.put(
        `https://${PAYFAST_API_HOST}/subscriptions/${subscriptionToken}/pause`,
        {},
        {
          headers: headers as Record<string, string>,
          timeout: 10000,
        }
      );

      return {
        success: response.status === 200,
        message: 'Subscription paused successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to pause subscription',
      };
    }
  }

  /**
   * Resume a PayFast subscription
   */
  async resumeSubscription(subscriptionToken: string): Promise<SubscriptionActionResponse> {
    try {
      if (!this.config.merchantId || !this.config.passphrase) {
        return {
          success: false,
          error: 'Missing merchant_id or passphrase',
        };
      }

      const timestamp = new Date().toISOString().split('.')[0];
      const headers: PayFastHeaders = {
        'merchant-id': this.config.merchantId,
        version: 'v1',
        timestamp,
      };

      headers['signature'] = this.generateApiSignature(headers, this.config.passphrase);

      const response = await axios.put(
        `https://${PAYFAST_API_HOST}/subscriptions/${subscriptionToken}/unpause`,
        {},
        {
          headers: headers as Record<string, string>,
          timeout: 10000,
        }
      );

      return {
        success: response.status === 200,
        message: 'Subscription resumed successfully',
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to resume subscription',
      };
    }
  }
}
