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
import { FNBService } from '../services/payments/FNBService';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';

export default class PaymentController {
  private pool: Pool;
  private paymentService: PaymentService;
  private fnbService: FNBService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.paymentService = new PaymentService(pool);
    this.fnbService = new FNBService(pool);
  }

  // ============================================================================
  // FNB PAYMENT (SuperTokens session - uses payment provider credentials)
  // ============================================================================

  /**
   * Handle FNB payment initiation
   * POST /api/payments/handle_fnb_payment
   * Body: { project_id, description, amount, provider_id? }
   * Uses credentials from the FNB payment provider for the project.
   */
  handleFnbPayment = async (req: SuperTokensAuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const { project_id, provider_id, description, amount } = req.body;

      const projectId = parseInt(String(project_id), 10);
      if (isNaN(projectId) || projectId <= 0) {
        res.status(400).json({
          success: false,
          message: 'project_id (positive integer) is required',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      // Look up FNB provider for the project
      let provider: { metadata?: Record<string, unknown>; return_url?: string; provider_type?: string } | null;
      if (provider_id != null) {
        provider = await this.paymentService.getProvider(projectId, parseInt(String(provider_id), 10));
      } else {
        provider = await this.paymentService.getProviderByType(projectId, 'fnb_pay');
      }

      if (!provider || provider.provider_type !== 'fnb_pay') {
        res.status(400).json({
          success: false,
          message: 'No active FNB payment provider found for this project. Add an FNB provider in the dashboard.',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const meta = provider.metadata || {};
      const baseUrl = String(meta.fnb_base_url || '').trim();
      const apiKey3d = String(meta.fnb_api_key_3d || '').trim();
      const apiInst3d = String(meta.fnb_api_inst_3d || '').trim();
      const secretKey = String(meta.fnb_secret_key || '').trim() || undefined;
      const returnUrl = String(provider.return_url || '').trim();

      const providerConfig = {
        baseUrl,
        apiKey3d,
        apiInst3d,
        secretKey,
        returnUrl,
      };

      const result = await this.fnbService.initiatePayment(userId, description, amount, providerConfig);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Redirect to complete payment',
          data: { url: result.url, reference: result.reference },
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const statusCode =
        result.code === 'DUPLICATE' ? 409 :
        result.code === 'VALIDATION_ERROR' ? 400 :
        500;

      res.status(statusCode).json({
        success: false,
        message: result.error,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error handling FNB payment:', error);
      res.status(500).json({
        success: false,
        message: error?.message ?? 'Server error',
        timestamp: new Date().toISOString(),
      });
    }
  };

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

      const validTypes: PaymentProviderType[] = ['payfast', 'fnb_pay'];
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
        provider_id,      // Optional: If not provided, uses first active provider
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

      const validTypes: PaymentProviderType[] = ['fnb_pay'];
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
}
