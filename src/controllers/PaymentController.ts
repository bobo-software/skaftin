/**
 * Payment Controller
 * 
 * Handles HTTP endpoints for payment operations:
 * - Provider management (CRUD)
 * - Payment initiation
 * - Transaction management
 * - Webhook handling
 */

import { Request, Response } from 'express';
import { Pool } from 'pg';
import { PaymentService, CreateProviderRequest, UpdateProviderRequest } from '../services/payments/PaymentService';
import { HybridAuthRequest } from '../middleware/hybridAuthMiddleware';
import { PaymentProviderType, WebhookPayload } from '../services/payments/BasePaymentProvider';

export default class PaymentController {
  private pool: Pool;
  private paymentService: PaymentService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.paymentService = new PaymentService(pool);
  }

  // ============================================================================
  // PROVIDER MANAGEMENT (Admin routes - SuperTokens auth)
  // ============================================================================

  /**
   * List all payment providers for a project
   * GET /api/payments/:projectId/providers
   */
  listProviders = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);

      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID' });
        return;
      }

      const providers = await this.paymentService.listProviders(projectId);

      res.json({
        success: true,
        data: providers,
        count: providers.length,
      });
    } catch (error: any) {
      console.error('Error listing payment providers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list payment providers',
        message: error.message,
      });
    }
  };

  /**
   * Get a specific payment provider
   * GET /api/payments/:projectId/providers/:providerId
   */
  getProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const providerId = parseInt(req.params.providerId, 10);

      if (isNaN(projectId) || isNaN(providerId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID or provider ID' });
        return;
      }

      const provider = await this.paymentService.getProvider(projectId, providerId);

      if (!provider) {
        res.status(404).json({ success: false, error: 'Payment provider not found' });
        return;
      }

      res.json({
        success: true,
        data: provider,
      });
    } catch (error: any) {
      console.error('Error getting payment provider:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get payment provider',
        message: error.message,
      });
    }
  };

  /**
   * Create a new payment provider
   * POST /api/payments/:projectId/providers
   */
  createProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);

      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID' });
        return;
      }

      const {
        name,
        provider_type,
        merchant_id,
        merchant_key,
        passphrase,
        api_key,
        api_secret,
        public_key,
        return_url,
        cancel_url,
        notify_url,
        sandbox_mode,
        is_active,
        metadata,
      } = req.body;

      // Validate required fields
      if (!name || !provider_type) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: name and provider_type are required',
        });
        return;
      }

      const validTypes: PaymentProviderType[] = ['payfast', 'yoco', 'paystack', 'peach_payments', 'ozow', 'flutterwave'];
      if (!validTypes.includes(provider_type)) {
        res.status(400).json({
          success: false,
          error: `Invalid provider_type. Must be one of: ${validTypes.join(', ')}`,
        });
        return;
      }

      const request: CreateProviderRequest = {
        projectId,
        name,
        providerType: provider_type,
        merchantId: merchant_id,
        merchantKey: merchant_key,
        passphrase,
        apiKey: api_key,
        apiSecret: api_secret,
        publicKey: public_key,
        returnUrl: return_url,
        cancelUrl: cancel_url,
        notifyUrl: notify_url,
        sandboxMode: sandbox_mode,
        isActive: is_active,
        metadata,
      };

      const provider = await this.paymentService.createProvider(request);

      res.status(201).json({
        success: true,
        data: provider,
        message: 'Payment provider created successfully',
      });
    } catch (error: any) {
      console.error('Error creating payment provider:', error);

      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'A payment provider with this name already exists for this project',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create payment provider',
        message: error.message,
      });
    }
  };

  /**
   * Update a payment provider
   * PUT /api/payments/:projectId/providers/:providerId
   */
  updateProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const providerId = parseInt(req.params.providerId, 10);

      if (isNaN(projectId) || isNaN(providerId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID or provider ID' });
        return;
      }

      const {
        name,
        merchant_id,
        merchant_key,
        passphrase,
        api_key,
        api_secret,
        public_key,
        return_url,
        cancel_url,
        notify_url,
        sandbox_mode,
        is_active,
        metadata,
      } = req.body;

      const request: UpdateProviderRequest = {};
      if (name !== undefined) request.name = name;
      if (merchant_id !== undefined) request.merchantId = merchant_id;
      if (merchant_key !== undefined) request.merchantKey = merchant_key;
      if (passphrase !== undefined) request.passphrase = passphrase;
      if (api_key !== undefined) request.apiKey = api_key;
      if (api_secret !== undefined) request.apiSecret = api_secret;
      if (public_key !== undefined) request.publicKey = public_key;
      if (return_url !== undefined) request.returnUrl = return_url;
      if (cancel_url !== undefined) request.cancelUrl = cancel_url;
      if (notify_url !== undefined) request.notifyUrl = notify_url;
      if (sandbox_mode !== undefined) request.sandboxMode = sandbox_mode;
      if (is_active !== undefined) request.isActive = is_active;
      if (metadata !== undefined) request.metadata = metadata;

      const provider = await this.paymentService.updateProvider(projectId, providerId, request);

      if (!provider) {
        res.status(404).json({ success: false, error: 'Payment provider not found' });
        return;
      }

      res.json({
        success: true,
        data: provider,
        message: 'Payment provider updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating payment provider:', error);

      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'A payment provider with this name already exists for this project',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update payment provider',
        message: error.message,
      });
    }
  };

  /**
   * Delete a payment provider
   * DELETE /api/payments/:projectId/providers/:providerId
   */
  deleteProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const providerId = parseInt(req.params.providerId, 10);

      if (isNaN(projectId) || isNaN(providerId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID or provider ID' });
        return;
      }

      const deleted = await this.paymentService.deleteProvider(projectId, providerId);

      if (!deleted) {
        res.status(404).json({ success: false, error: 'Payment provider not found' });
        return;
      }

      res.json({
        success: true,
        message: 'Payment provider deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting payment provider:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete payment provider',
        message: error.message,
      });
    }
  };

  /**
   * Test payment provider connection
   * POST /api/payments/:projectId/providers/:providerId/test
   */
  testProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const providerId = parseInt(req.params.providerId, 10);

      if (isNaN(projectId) || isNaN(providerId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID or provider ID' });
        return;
      }

      const result = await this.paymentService.testProvider(projectId, providerId);

      res.json(result);
    } catch (error: any) {
      console.error('Error testing payment provider:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test payment provider',
        message: error.message,
      });
    }
  };

  // ============================================================================
  // TRANSACTION MANAGEMENT (Admin routes - SuperTokens auth)
  // ============================================================================

  /**
   * List transactions for a project
   * GET /api/payments/:projectId/transactions
   */
  listTransactions = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);

      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID' });
        return;
      }

      const { status, payment_type, limit, offset, start_date, end_date } = req.query;

      const result = await this.paymentService.listTransactions(projectId, {
        status: status as string,
        paymentType: payment_type as string,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        startDate: start_date ? new Date(start_date as string) : undefined,
        endDate: end_date ? new Date(end_date as string) : undefined,
      });

      res.json({
        success: true,
        data: result.transactions,
        total: result.total,
        count: result.transactions.length,
      });
    } catch (error: any) {
      console.error('Error listing transactions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list transactions',
        message: error.message,
      });
    }
  };

  /**
   * Get a specific transaction
   * GET /api/payments/:projectId/transactions/:transactionId
   */
  getTransaction = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);
      const { transactionId } = req.params;

      if (isNaN(projectId)) {
        res.status(400).json({ success: false, error: 'Invalid project ID' });
        return;
      }

      const transaction = await this.paymentService.getTransaction(projectId, transactionId);

      if (!transaction) {
        res.status(404).json({ success: false, error: 'Transaction not found' });
        return;
      }

      res.json({
        success: true,
        data: transaction,
      });
    } catch (error: any) {
      console.error('Error getting transaction:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction',
        message: error.message,
      });
    }
  };

  // ============================================================================
  // CLIENT API ROUTES (API Key auth - for React/React Native apps)
  // ============================================================================

  /**
   * Initiate a payment (Client API)
   * POST /app-api/payments/initiate
   */
  initiatePayment = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      // Get project ID from middleware (extracted from API key)
      const projectId = (req as HybridAuthRequest).projectId;

      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }

      const {
        provider_id,
        provider_name,
        amount,
        item_name,
        item_description,
        customer_email,
        customer_name,
        customer_phone,
        payment_type,
        subscription_type,
        frequency,
        cycles,
        billing_date,
        metadata,
        return_url,
        cancel_url,
        notify_url,
      } = req.body;

      // Validate required fields
      if (!amount || !item_name) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: amount and item_name are required',
        });
        return;
      }

      if (typeof amount !== 'number' || amount <= 0) {
        res.status(400).json({
          success: false,
          error: 'Invalid amount: must be a positive number',
        });
        return;
      }

      const result = await this.paymentService.initiatePayment(projectId, {
        providerId: provider_id,
        providerName: provider_name,
        amount,
        itemName: item_name,
        itemDescription: item_description,
        customerEmail: customer_email,
        customerName: customer_name,
        customerPhone: customer_phone,
        paymentType: payment_type,
        subscriptionType: subscription_type,
        frequency,
        cycles,
        billingDate: billing_date,
        metadata,
        returnUrl: return_url,
        cancelUrl: cancel_url,
        notifyUrl: notify_url,
      });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to initiate payment',
        message: error.message,
      });
    }
  };

  /**
   * Get transaction status (Client API)
   * GET /app-api/payments/transaction/:transactionId
   */
  getTransactionStatus = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      const projectId = (req as HybridAuthRequest).projectId;
      const { transactionId } = req.params;

      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }

      const transaction = await this.paymentService.getTransaction(projectId, transactionId);

      if (!transaction) {
        res.status(404).json({ success: false, error: 'Transaction not found' });
        return;
      }

      // Return only relevant fields for client apps
      res.json({
        success: true,
        data: {
          transaction_id: transaction.transaction_id,
          status: transaction.status,
          amount: transaction.amount,
          currency: transaction.currency,
          item_name: transaction.item_name,
          payment_type: transaction.payment_type,
          paid_at: transaction.paid_at,
          created_at: transaction.created_at,
        },
      });
    } catch (error: any) {
      console.error('Error getting transaction status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get transaction status',
        message: error.message,
      });
    }
  };

  /**
   * Cancel a subscription (Client API)
   * POST /app-api/payments/subscription/cancel
   */
  cancelSubscription = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      const projectId = (req as HybridAuthRequest).projectId;
      const { transaction_id } = req.body;

      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }

      if (!transaction_id) {
        res.status(400).json({ success: false, error: 'transaction_id is required' });
        return;
      }

      const result = await this.paymentService.cancelSubscription(projectId, transaction_id);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json(result);
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel subscription',
        message: error.message,
      });
    }
  };

  // ============================================================================
  // WEBHOOK HANDLERS (Public routes - signature verification)
  // ============================================================================

  /**
   * PayFast ITN (Instant Transaction Notification) webhook
   * POST /api/payments/webhook/payfast/:projectId
   */
  payfastWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);

      if (isNaN(projectId)) {
        console.error('PayFast webhook: Invalid project ID');
        res.status(400).send('Invalid project ID');
        return;
      }

      console.log('📥 PayFast ITN received for project:', projectId);

      // Get IP address
      const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
        || req.socket.remoteAddress
        || '';

      // Parse the form data
      let parsedData: Record<string, any>;

      if (typeof req.body === 'string') {
        // URL-encoded string
        const params = new URLSearchParams(req.body);
        parsedData = Object.fromEntries(params.entries());
      } else if (typeof req.body === 'object') {
        // Already parsed object
        parsedData = req.body;
      } else {
        console.error('PayFast webhook: Invalid request body');
        res.status(400).send('Invalid request body');
        return;
      }

      const payload: WebhookPayload = {
        rawBody: typeof req.body === 'string' ? req.body : JSON.stringify(req.body),
        parsedData,
        headers: req.headers as Record<string, string>,
        ipAddress,
      };

      const result = await this.paymentService.processWebhook(projectId, 'payfast', payload);

      if (result.valid) {
        console.log('✅ PayFast ITN validated successfully:', {
          transactionId: result.transactionId,
          status: result.status,
        });
        res.status(200).send('OK');
      } else {
        console.error('❌ PayFast ITN validation failed:', result.error);
        res.status(400).send(result.error || 'Validation failed');
      }
    } catch (error: any) {
      console.error('Error processing PayFast webhook:', error);
      res.status(500).send('Internal server error');
    }
  };

  /**
   * Generic webhook handler for other providers (placeholder)
   * POST /api/payments/webhook/:providerType/:projectId
   */
  genericWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      const { providerType, projectId: projectIdStr } = req.params;
      const projectId = parseInt(projectIdStr, 10);

      if (isNaN(projectId)) {
        res.status(400).send('Invalid project ID');
        return;
      }

      const validTypes: PaymentProviderType[] = ['yoco', 'paystack', 'peach_payments', 'ozow', 'flutterwave'];
      if (!validTypes.includes(providerType as PaymentProviderType)) {
        res.status(400).send('Invalid provider type');
        return;
      }

      // For now, just acknowledge - implement when adding other providers
      console.log(`📥 Webhook received for ${providerType}, project ${projectId}`);
      res.status(200).send('OK');
    } catch (error: any) {
      console.error('Error processing webhook:', error);
      res.status(500).send('Internal server error');
    }
  };

  // ============================================================================
  // RETURN/CANCEL URL HANDLERS (Public routes - redirects to frontend)
  // ============================================================================

  /**
   * Handle PayFast return URL (successful payment)
   * GET /api/payments/return/payfast/:projectId
   */
  payfastReturn = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);

      if (isNaN(projectId)) {
        res.status(400).send('Invalid project ID');
        return;
      }

      // Get transaction ID from query params (PayFast sends m_payment_id)
      const transactionId = req.query.m_payment_id as string || req.query.custom_str2 as string;

      if (!transactionId) {
        console.error('PayFast return: Missing transaction ID');
        // Redirect to frontend with error
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
        res.redirect(`${frontendUrl}/payments/return?error=missing_transaction_id&projectId=${projectId}`);
        return;
      }

      // Update transaction status if needed (PayFast may send payment_status)
      const paymentStatus = req.query.payment_status as string;
      if (paymentStatus === 'COMPLETE') {
        try {
          const transaction = await this.paymentService.getTransaction(projectId, transactionId);
          if (transaction && (transaction.status === 'pending' || transaction.status === 'processing')) {
            // Update transaction to complete using PaymentService's pool access
            const schemaName = await this.paymentService.getProjectSchema(projectId);
            if (schemaName) {
              const client = await this.pool.connect();
              try {
                await client.query(`SET search_path TO ${schemaName}, public`);
                await client.query(
                  `UPDATE skaftin_system_payment_transactions 
                   SET status = 'complete', 
                       external_payment_id = $1,
                       paid_at = CURRENT_TIMESTAMP,
                       updated_at = CURRENT_TIMESTAMP
                   WHERE transaction_id = $2 AND project_id = $3`,
                  [req.query.pf_payment_id as string || null, transactionId, projectId]
                );
                console.log(`✅ Updated transaction ${transactionId} to complete`);
              } finally {
                client.release();
              }
            }
          }
        } catch (error) {
          console.error('Error updating transaction on return:', error);
          // Continue with redirect even if update fails
        }
      }

      // Redirect to frontend with transaction info
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
      const redirectUrl = `${frontendUrl}/payments/return?projectId=${projectId}&transactionId=${transactionId}&status=${paymentStatus || 'complete'}`;
      res.redirect(redirectUrl);
    } catch (error: any) {
      console.error('Error processing PayFast return:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
      res.redirect(`${frontendUrl}/payments/return?error=processing_error`);
    }
  };

  /**
   * Handle PayFast cancel URL (user cancelled payment)
   * GET /api/payments/cancel/payfast/:projectId
   */
  payfastCancel = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = parseInt(req.params.projectId, 10);

      if (isNaN(projectId)) {
        res.status(400).send('Invalid project ID');
        return;
      }

      // Get transaction ID from query params
      const transactionId = req.query.m_payment_id as string || req.query.custom_str2 as string;

      if (transactionId) {
        // Update transaction status to cancelled
        try {
          const schemaName = await this.paymentService.getProjectSchema(projectId);
          if (schemaName) {
            const client = await this.pool.connect();
            try {
              await client.query(`SET search_path TO ${schemaName}, public`);
              await client.query(
                `UPDATE skaftin_system_payment_transactions 
                 SET status = 'cancelled', 
                     status_message = 'Payment cancelled by user',
                     updated_at = CURRENT_TIMESTAMP
                 WHERE transaction_id = $1 AND project_id = $2 AND status IN ('pending', 'processing')`,
                [transactionId, projectId]
              );
              console.log(`✅ Updated transaction ${transactionId} to cancelled`);
            } finally {
              client.release();
            }
          }
        } catch (error) {
          console.error('Error updating transaction on cancel:', error);
          // Continue with redirect even if update fails
        }
      }

      // Redirect to frontend with cancellation info
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
      const redirectUrl = transactionId
        ? `${frontendUrl}/payments/cancel?projectId=${projectId}&transactionId=${transactionId}`
        : `${frontendUrl}/payments/cancel?projectId=${projectId}`;
      res.redirect(redirectUrl);
    } catch (error: any) {
      console.error('Error processing PayFast cancel:', error);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
      res.redirect(`${frontendUrl}/payments/cancel?error=processing_error`);
    }
  };
}
