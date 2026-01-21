/**
 * Payment Service
 * 
 * Main service for handling payments across different payment gateways.
 * Routes requests to the appropriate provider (PayFast, Yoco, etc.)
 */

import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import {
  BasePaymentProvider,
  PaymentProviderConfig,
  PaymentProviderRecord,
  PaymentTransactionRecord,
  PaymentProviderType,
  InitiatePaymentRequest,
  InitiatePaymentResponse,
  WebhookPayload,
  WebhookValidationResult,
  recordToConfig,
  PingResponse,
} from './BasePaymentProvider';
import { PayFastProvider } from './PayFastProvider';

export interface CreateProviderRequest {
  projectId: number;
  name: string;
  providerType: PaymentProviderType;
  merchantId?: string;
  merchantKey?: string;
  passphrase?: string;
  apiKey?: string;
  apiSecret?: string;
  publicKey?: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
  sandboxMode?: boolean;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface UpdateProviderRequest {
  name?: string;
  merchantId?: string;
  merchantKey?: string;
  passphrase?: string;
  apiKey?: string;
  apiSecret?: string;
  publicKey?: string;
  returnUrl?: string;
  cancelUrl?: string;
  notifyUrl?: string;
  sandboxMode?: boolean;
  isActive?: boolean;
  metadata?: Record<string, any>;
}

export interface InitiatePaymentServiceRequest extends InitiatePaymentRequest {
  providerId?: number;
  providerName?: string;
}

export interface TransactionListOptions {
  status?: string;
  paymentType?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export class PaymentService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get the schema name for a project
   */
  async getProjectSchema(projectId: number): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
      [projectId]
    );
    return result.rows.length > 0 ? result.rows[0].schema_name : null;
  }

  /**
   * Ensure payment tables exist in the project schema
   * Creates them if they don't exist (for backward compatibility with existing projects)
   */
  private async ensurePaymentTablesExist(schemaName: string, projectId: number): Promise<void> {
    const client = await this.pool.connect();
    try {
      // Check if payment_providers table exists
      const tableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'skaftin_system_payment_providers'
        );
      `, [schemaName]);

      if (!tableCheck.rows[0].exists) {
        // Create payment_providers table
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_payment_providers (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            name VARCHAR(255) NOT NULL,
            provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('payfast', 'yoco', 'paystack', 'peach_payments', 'ozow', 'flutterwave')),
            merchant_id VARCHAR(255),
            merchant_key VARCHAR(255),
            passphrase VARCHAR(255),
            api_key TEXT,
            api_secret TEXT,
            public_key TEXT,
            return_url VARCHAR(500),
            cancel_url VARCHAR(500),
            notify_url VARCHAR(500),
            sandbox_mode BOOLEAN DEFAULT true,
            is_active BOOLEAN DEFAULT true,
            metadata JSONB DEFAULT '{}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(project_id, name)
          );
        `);

        // Create indexes
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_payment_providers_project_id ON ${schemaName}.skaftin_system_payment_providers(project_id);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_payment_providers_is_active ON ${schemaName}.skaftin_system_payment_providers(is_active);
        `);

        console.log(`✅ Created skaftin_system_payment_providers table in schema: ${schemaName}`);
      }

      // Check if payment_transactions table exists
      const transactionsTableCheck = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = $1 
          AND table_name = 'skaftin_system_payment_transactions'
        );
      `, [schemaName]);

      if (!transactionsTableCheck.rows[0].exists) {
        // Create payment_transactions table
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${schemaName}.skaftin_system_payment_transactions (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            provider_id INTEGER NOT NULL REFERENCES ${schemaName}.skaftin_system_payment_providers(id) ON DELETE RESTRICT,
            transaction_id VARCHAR(100) NOT NULL UNIQUE,
            external_payment_id VARCHAR(255),
            amount DECIMAL(15, 2) NOT NULL,
            currency VARCHAR(3) NOT NULL DEFAULT 'ZAR',
            item_name VARCHAR(255) NOT NULL,
            item_description TEXT,
            customer_email VARCHAR(255),
            customer_name VARCHAR(255),
            customer_phone VARCHAR(50),
            payment_type VARCHAR(20) NOT NULL DEFAULT 'once' CHECK (payment_type IN ('once', 'subscription')),
            subscription_type VARCHAR(20) CHECK (subscription_type IN ('subscription', 'tokenization')),
            frequency VARCHAR(20) CHECK (frequency IN ('monthly', 'quarterly', 'biannually', 'annual')),
            cycles INTEGER,
            return_url VARCHAR(500),
            cancel_url VARCHAR(500),
            payment_url TEXT,
            status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'complete', 'failed', 'cancelled', 'refunded')),
            status_message TEXT,
            webhook_data JSONB,
            metadata JSONB DEFAULT '{}',
            paid_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `);

        // Create indexes for transactions
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_payment_transactions_project_id ON ${schemaName}.skaftin_system_payment_transactions(project_id);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_payment_transactions_provider_id ON ${schemaName}.skaftin_system_payment_transactions(provider_id);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_payment_transactions_transaction_id ON ${schemaName}.skaftin_system_payment_transactions(transaction_id);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON ${schemaName}.skaftin_system_payment_transactions(status);
        `);
        await client.query(`
          CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_email ON ${schemaName}.skaftin_system_payment_transactions(customer_email);
        `);

        console.log(`✅ Created skaftin_system_payment_transactions table in schema: ${schemaName}`);
      }
    } finally {
      client.release();
    }
  }

  /**
   * Create a payment provider instance based on type
   */
  private createProviderInstance(config: PaymentProviderConfig): BasePaymentProvider {
    switch (config.providerType) {
      case 'payfast':
        return new PayFastProvider(config);
      // Add more providers here as they're implemented
      // case 'yoco':
      //   return new YocoProvider(config);
      // case 'paystack':
      //   return new PaystackProvider(config);
      default:
        throw new Error(`Unsupported payment provider type: ${config.providerType}`);
    }
  }

  // ============================================================================
  // PROVIDER MANAGEMENT
  // ============================================================================

  /**
   * List all payment providers for a project
   */
  async listProviders(projectId: number): Promise<PaymentProviderRecord[]> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        SELECT id, project_id, name, provider_type, merchant_id, 
               return_url, cancel_url, notify_url, sandbox_mode, is_active, 
               metadata, created_at, updated_at
        FROM skaftin_system_payment_providers
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;
      const result = await client.query(query, [projectId]);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Get a specific provider by ID
   */
  async getProvider(projectId: number, providerId: number): Promise<PaymentProviderRecord | null> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        SELECT * FROM skaftin_system_payment_providers
        WHERE id = $1 AND project_id = $2
      `;
      const result = await client.query(query, [providerId, projectId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get a provider by name
   */
  async getProviderByName(projectId: number, name: string): Promise<PaymentProviderRecord | null> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        SELECT * FROM skaftin_system_payment_providers
        WHERE project_id = $1 AND name = $2
      `;
      const result = await client.query(query, [projectId, name]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Get the active provider for a project (first active one)
   */
  async getActiveProvider(projectId: number): Promise<PaymentProviderRecord | null> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        SELECT * FROM skaftin_system_payment_providers
        WHERE project_id = $1 AND is_active = true
        ORDER BY created_at ASC
        LIMIT 1
      `;
      const result = await client.query(query, [projectId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new payment provider
   */
  async createProvider(request: CreateProviderRequest): Promise<PaymentProviderRecord> {
    const schemaName = await this.getProjectSchema(request.projectId);
    if (!schemaName) {
      throw new Error(`Project ${request.projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, request.projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        INSERT INTO skaftin_system_payment_providers (
          project_id, name, provider_type, merchant_id, merchant_key, passphrase,
          api_key, api_secret, public_key, return_url, cancel_url, notify_url,
          sandbox_mode, is_active, metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `;

      const result = await client.query(query, [
        request.projectId,
        request.name,
        request.providerType,
        request.merchantId || null,
        request.merchantKey || null,
        request.passphrase || null,
        request.apiKey || null,
        request.apiSecret || null,
        request.publicKey || null,
        request.returnUrl || null,
        request.cancelUrl || null,
        request.notifyUrl || null,
        request.sandboxMode ?? true,
        request.isActive ?? true,
        JSON.stringify(request.metadata || {}),
      ]);

      return result.rows[0];
    } finally {
      client.release();
    }
  }

  /**
   * Update a payment provider
   */
  async updateProvider(
    projectId: number,
    providerId: number,
    request: UpdateProviderRequest
  ): Promise<PaymentProviderRecord | null> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }
    if (request.merchantId !== undefined) {
      updates.push(`merchant_id = $${paramIndex++}`);
      values.push(request.merchantId);
    }
    if (request.merchantKey !== undefined) {
      updates.push(`merchant_key = $${paramIndex++}`);
      values.push(request.merchantKey);
    }
    if (request.passphrase !== undefined) {
      updates.push(`passphrase = $${paramIndex++}`);
      values.push(request.passphrase);
    }
    if (request.apiKey !== undefined) {
      updates.push(`api_key = $${paramIndex++}`);
      values.push(request.apiKey);
    }
    if (request.apiSecret !== undefined) {
      updates.push(`api_secret = $${paramIndex++}`);
      values.push(request.apiSecret);
    }
    if (request.publicKey !== undefined) {
      updates.push(`public_key = $${paramIndex++}`);
      values.push(request.publicKey);
    }
    if (request.returnUrl !== undefined) {
      updates.push(`return_url = $${paramIndex++}`);
      values.push(request.returnUrl);
    }
    if (request.cancelUrl !== undefined) {
      updates.push(`cancel_url = $${paramIndex++}`);
      values.push(request.cancelUrl);
    }
    if (request.notifyUrl !== undefined) {
      updates.push(`notify_url = $${paramIndex++}`);
      values.push(request.notifyUrl);
    }
    if (request.sandboxMode !== undefined) {
      updates.push(`sandbox_mode = $${paramIndex++}`);
      values.push(request.sandboxMode);
    }
    if (request.isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(request.isActive);
    }
    if (request.metadata !== undefined) {
      updates.push(`metadata = $${paramIndex++}`);
      values.push(JSON.stringify(request.metadata));
    }

    if (updates.length === 0) {
      return this.getProvider(projectId, providerId);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(providerId, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        UPDATE skaftin_system_payment_providers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND project_id = $${paramIndex++}
        RETURNING *
      `;

      const result = await client.query(query, values);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a payment provider
   */
  async deleteProvider(projectId: number, providerId: number): Promise<boolean> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        DELETE FROM skaftin_system_payment_providers
        WHERE id = $1 AND project_id = $2
        RETURNING id
      `;
      const result = await client.query(query, [providerId, projectId]);
      return result.rows.length > 0;
    } finally {
      client.release();
    }
  }

  /**
   * Test provider connection
   */
  async testProvider(projectId: number, providerId: number): Promise<PingResponse> {
    const providerRecord = await this.getProvider(projectId, providerId);
    if (!providerRecord) {
      return { success: false, error: 'Provider not found' };
    }

    const config = recordToConfig(providerRecord);
    const provider = this.createProviderInstance(config);
    return provider.ping();
  }

  // ============================================================================
  // TRANSACTION MANAGEMENT
  // ============================================================================

  /**
   * Initiate a payment
   */
  async initiatePayment(
    projectId: number,
    request: InitiatePaymentServiceRequest
  ): Promise<InitiatePaymentResponse> {
    // Get the provider
    let providerRecord: PaymentProviderRecord | null = null;

    if (request.providerId) {
      providerRecord = await this.getProvider(projectId, request.providerId);
    } else if (request.providerName) {
      providerRecord = await this.getProviderByName(projectId, request.providerName);
    } else {
      providerRecord = await this.getActiveProvider(projectId);
    }

    if (!providerRecord) {
      return {
        success: false,
        transactionId: '',
        paymentUrl: '',
        error: 'Payment provider not found or not configured',
      };
    }

    if (!providerRecord.is_active) {
      return {
        success: false,
        transactionId: '',
        paymentUrl: '',
        error: 'Payment provider is not active',
      };
    }

    // Generate transaction ID
    const transactionId = uuidv4();

    // Create the provider instance
    const config = recordToConfig(providerRecord);
    const provider = this.createProviderInstance(config);

    // Get project schema
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      return {
        success: false,
        transactionId: '',
        paymentUrl: '',
        error: `Project ${projectId} not found`,
      };
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    // Build return and cancel URLs if not provided
    const backendUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:4006';
    const defaultReturnUrl = `${backendUrl}/api/payments/return/payfast/${projectId}`;
    const defaultCancelUrl = `${backendUrl}/api/payments/cancel/payfast/${projectId}`;

    const returnUrl = request.returnUrl || providerRecord.return_url || defaultReturnUrl;
    const cancelUrl = request.cancelUrl || providerRecord.cancel_url || defaultCancelUrl;

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);

      // Create transaction record first
      const insertQuery = `
        INSERT INTO skaftin_system_payment_transactions (
          project_id, provider_id, transaction_id, amount, currency, item_name,
          item_description, customer_email, customer_name, customer_phone,
          payment_type, subscription_type, frequency, cycles, return_url, 
          cancel_url, metadata, status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, 'pending')
        RETURNING *
      `;

      // Normalize payment_type: 'once_off' -> 'once' (to match database constraint)
      let normalizedPaymentType = request.paymentType || 'once';
      if (normalizedPaymentType === 'once_off') {
        normalizedPaymentType = 'once';
      }

      await client.query(insertQuery, [
        projectId,
        providerRecord.id,
        transactionId,
        request.amount,
        'ZAR',
        request.itemName,
        request.itemDescription || null,
        request.customerEmail || null,
        request.customerName || null,
        request.customerPhone || null,
        normalizedPaymentType,
        request.subscriptionType || null,
        request.frequency || null,
        request.cycles || null,
        returnUrl,
        cancelUrl,
        JSON.stringify(request.metadata || {}),
      ]);

      // Initiate payment with the provider (pass return/cancel URLs)
      const paymentRequest = {
        ...request,
        returnUrl,
        cancelUrl,
      };
      const result = await provider.initiatePayment(paymentRequest, transactionId);

      // Update transaction with payment URL
      if (result.success) {
        await client.query(
          `UPDATE skaftin_system_payment_transactions 
           SET payment_url = $1, status = 'processing', updated_at = CURRENT_TIMESTAMP
           WHERE transaction_id = $2`,
          [result.paymentUrl, transactionId]
        );
      } else {
        await client.query(
          `UPDATE skaftin_system_payment_transactions 
           SET status = 'failed', status_message = $1, updated_at = CURRENT_TIMESTAMP
           WHERE transaction_id = $2`,
          [result.error, transactionId]
        );
      }

      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Process a webhook callback
   */
  async processWebhook(
    projectId: number,
    providerType: PaymentProviderType,
    payload: WebhookPayload
  ): Promise<WebhookValidationResult> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      return { valid: false, error: `Project ${projectId} not found` };
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);

      // Get the active provider of this type for the project
      const query = `
        SELECT * FROM skaftin_system_payment_providers
        WHERE project_id = $1 AND provider_type = $2 AND is_active = true
        LIMIT 1
      `;
      const result = await client.query(query, [projectId, providerType]);
      const providerRecord = result.rows[0];

      if (!providerRecord) {
        return { valid: false, error: 'Provider not found for this project' };
      }

      // Create provider and validate webhook
      const config = recordToConfig(providerRecord);
      const provider = this.createProviderInstance(config);
      const validationResult = await provider.validateWebhook(payload);

      if (validationResult.valid && validationResult.transactionId) {
        // Update transaction status
        const updateQuery = `
          UPDATE skaftin_system_payment_transactions
          SET 
            status = $1,
            external_payment_id = $2,
            webhook_data = $3,
            paid_at = CASE WHEN $1 = 'complete' THEN CURRENT_TIMESTAMP ELSE paid_at END,
            updated_at = CURRENT_TIMESTAMP
          WHERE transaction_id = $4 AND project_id = $5
          RETURNING *
        `;

        await client.query(updateQuery, [
          validationResult.status,
          validationResult.externalPaymentId,
          JSON.stringify(validationResult.rawData),
          validationResult.transactionId,
          projectId,
        ]);
      }

      return validationResult;
    } finally {
      client.release();
    }
  }

  /**
   * Get a transaction by ID
   */
  async getTransaction(projectId: number, transactionId: string): Promise<PaymentTransactionRecord | null> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);
      const query = `
        SELECT * FROM skaftin_system_payment_transactions
        WHERE transaction_id = $1 AND project_id = $2
      `;
      const result = await client.query(query, [transactionId, projectId]);
      return result.rows[0] || null;
    } finally {
      client.release();
    }
  }

  /**
   * List transactions for a project
   */
  async listTransactions(
    projectId: number,
    options: TransactionListOptions = {}
  ): Promise<{ transactions: PaymentTransactionRecord[]; total: number }> {
    const schemaName = await this.getProjectSchema(projectId);
    if (!schemaName) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Ensure payment tables exist (for backward compatibility)
    await this.ensurePaymentTablesExist(schemaName, projectId);

    const client = await this.pool.connect();
    try {
      await client.query(`SET search_path TO ${schemaName}, public`);

      const conditions: string[] = ['project_id = $1'];
      const values: any[] = [projectId];
      let paramIndex = 2;

      if (options.status) {
        conditions.push(`status = $${paramIndex++}`);
        values.push(options.status);
      }
      if (options.paymentType) {
        conditions.push(`payment_type = $${paramIndex++}`);
        values.push(options.paymentType);
      }
      if (options.startDate) {
        conditions.push(`created_at >= $${paramIndex++}`);
        values.push(options.startDate);
      }
      if (options.endDate) {
        conditions.push(`created_at <= $${paramIndex++}`);
        values.push(options.endDate);
      }

      const whereClause = conditions.join(' AND ');
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      // Get total count
      const countQuery = `SELECT COUNT(*) FROM skaftin_system_payment_transactions WHERE ${whereClause}`;
      const countResult = await client.query(countQuery, values);
      const total = parseInt(countResult.rows[0].count, 10);

      // Get transactions
      const query = `
        SELECT * FROM skaftin_system_payment_transactions
        WHERE ${whereClause}
        ORDER BY created_at DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      values.push(limit, offset);

      const result = await client.query(query, values);

      return {
        transactions: result.rows,
        total,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    projectId: number,
    transactionId: string
  ): Promise<{ success: boolean; error?: string }> {
    // Get the transaction
    const transaction = await this.getTransaction(projectId, transactionId);
    if (!transaction) {
      return { success: false, error: 'Transaction not found' };
    }

    if (!transaction.subscription_token) {
      return { success: false, error: 'Transaction is not a subscription or has no token' };
    }

    // Get the provider
    const providerRecord = await this.getProvider(projectId, transaction.provider_id);
    if (!providerRecord) {
      return { success: false, error: 'Provider not found' };
    }

    // Create provider and cancel subscription
    const config = recordToConfig(providerRecord);
    const provider = this.createProviderInstance(config);

    if (!provider.cancelSubscription) {
      return { success: false, error: 'Provider does not support subscription cancellation' };
    }

    const result = await provider.cancelSubscription(transaction.subscription_token);

    if (result.success) {
      const schemaName = await this.getProjectSchema(projectId);
      if (schemaName) {
        const client = await this.pool.connect();
        try {
          await client.query(`SET search_path TO ${schemaName}, public`);
          // Update transaction status
          await client.query(
            `UPDATE skaftin_system_payment_transactions
             SET status = 'cancelled', status_message = 'Subscription cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE transaction_id = $1`,
            [transactionId]
          );
        } finally {
          client.release();
        }
      }
    }

    return result;
  }
}
