import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';
import { PaymentService, CreateProviderRequest, UpdateProviderRequest, InitiatePaymentServiceRequest } from '../../services/payments/PaymentService';

// Legacy export for backward compatibility during migration
export interface PaymentToolsConfig {
  pool: Pool;
}

export function createPaymentTools(config: PaymentToolsConfig): Tool[] {
  return [
    // Payment Provider Management
    {
      name: 'list_payment_providers',
      description: 'List all payment providers configured for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' }
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_payment_provider',
      description: 'Get a specific payment provider by ID',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string', description: 'Project ID' },
          providerId: { type: 'string', description: 'Payment provider ID' }
        },
        required: ['projectId', 'providerId'],
      },
    },
    {
      name: 'create_payment_provider',
      description: 'Create a new payment provider (PayFast, Yoco, Paystack, etc.)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          name: { type: 'string', description: 'Provider name (e.g., "PayFast Production")' },
          provider_type: { 
            type: 'string', 
            enum: ['payfast', 'fnb_pay'],
            description: 'Payment gateway type'
          },
          merchant_id: { type: 'string', description: 'PayFast merchant ID' },
          merchant_key: { type: 'string', description: 'PayFast merchant key' },
          passphrase: { type: 'string', description: 'PayFast passphrase' },
          api_key: { type: 'string', description: 'Generic API key for other providers' },
          api_secret: { type: 'string', description: 'Generic API secret for other providers' },
          public_key: { type: 'string', description: 'Public key for some providers' },
          return_url: { type: 'string', description: 'URL to redirect after successful payment' },
          cancel_url: { type: 'string', description: 'URL to redirect if payment is cancelled' },
          notify_url: { type: 'string', description: 'Webhook URL for payment notifications' },
          sandbox_mode: { type: 'boolean', description: 'Use sandbox/test mode', default: true },
          is_active: { type: 'boolean', description: 'Activate provider immediately', default: true },
          metadata: { type: 'object', description: 'Additional metadata' }
        },
        required: ['projectId', 'name', 'provider_type'],
      },
    },
    {
      name: 'update_payment_provider',
      description: 'Update an existing payment provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          providerId: { type: 'string' },
          name: { type: 'string' },
          merchant_id: { type: 'string' },
          merchant_key: { type: 'string' },
          passphrase: { type: 'string' },
          api_key: { type: 'string' },
          api_secret: { type: 'string' },
          public_key: { type: 'string' },
          return_url: { type: 'string' },
          cancel_url: { type: 'string' },
          notify_url: { type: 'string' },
          sandbox_mode: { type: 'boolean' },
          is_active: { type: 'boolean' },
          metadata: { type: 'object' }
        },
        required: ['projectId', 'providerId'],
      },
    },
    {
      name: 'delete_payment_provider',
      description: 'Delete a payment provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          providerId: { type: 'string' }
        },
        required: ['projectId', 'providerId'],
      },
    },
    {
      name: 'test_payment_provider',
      description: 'Test connection to a payment provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          providerId: { type: 'string' }
        },
        required: ['projectId', 'providerId'],
      },
    },
    
    // Transaction Management
    {
      name: 'list_payment_transactions',
      description: 'List payment transactions for a project with optional filters',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          status: { 
            type: 'string', 
            enum: ['pending', 'processing', 'complete', 'failed', 'cancelled', 'refunded'],
            description: 'Filter by transaction status'
          },
          payment_type: { 
            type: 'string', 
            enum: ['once_off', 'subscription'],
            description: 'Filter by payment type'
          },
          limit: { type: 'number', description: 'Maximum number of transactions to return', default: 50 },
          offset: { type: 'number', description: 'Number of transactions to skip', default: 0 },
          start_date: { type: 'string', description: 'Start date (ISO format)' },
          end_date: { type: 'string', description: 'End date (ISO format)' }
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_payment_transaction',
      description: 'Get a specific payment transaction by transaction ID',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          transactionId: { type: 'string', description: 'Transaction ID (UUID)' }
        },
        required: ['projectId', 'transactionId'],
      },
    },
    
    // Client-Safe Tools (can be used from client endpoints)
    {
      name: 'client_initiate_payment',
      description: 'Client-safe: Initiate a payment (once-off or subscription)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          provider_id: { type: 'number', description: 'Specific provider ID (optional - if not provided, uses first active provider)' },
          amount: { type: 'number', description: 'Payment amount (e.g., 99.99)' },
          item_name: { type: 'string', description: 'Product/service name' },
          item_description: { type: 'string', description: 'Product/service description' },
          customer_email: { type: 'string', description: 'Customer email address' },
          customer_name: { type: 'string', description: 'Customer full name' },
          customer_phone: { type: 'string', description: 'Customer phone number' },
          payment_type: { 
            type: 'string', 
            enum: ['once_off', 'subscription'],
            description: 'Payment type',
            default: 'once_off'
          },
          subscription_type: { 
            type: 'number', 
            description: 'PayFast: 1=subscription, 2=tokenization'
          },
          frequency: { 
            type: 'number', 
            description: 'PayFast: 3=monthly, 4=quarterly, 5=biannual, 6=annual'
          },
          cycles: { 
            type: 'number', 
            description: 'Number of billing cycles (0 = infinite)',
            default: 0
          },
          return_url: { type: 'string', description: 'Override return URL for this transaction' },
          cancel_url: { type: 'string', description: 'Override cancel URL for this transaction' },
          metadata: { type: 'object', description: 'Custom metadata to store with transaction' }
        },
        required: ['projectId', 'amount', 'item_name'],
      },
    },
    {
      name: 'client_get_transaction_status',
      description: 'Client-safe: Get payment transaction status',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          transactionId: { type: 'string', description: 'Transaction ID (UUID)' }
        },
        required: ['projectId', 'transactionId'],
      },
    },
    {
      name: 'client_cancel_subscription',
      description: 'Client-safe: Cancel an active subscription',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          transactionId: { type: 'string', description: 'Original subscription transaction ID' }
        },
        required: ['projectId', 'transactionId'],
      },
    },
  ];
}

// Legacy export for backward compatibility during migration
export async function handlePaymentTool(
  name: string,
  args: any,
  config: PaymentToolsConfig
): Promise<any> {
  const { pool } = config;
  const paymentService = new PaymentService(pool);

  const projectId = parseInt(args.projectId, 10);
  if (isNaN(projectId)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: false, error: 'Invalid project ID' }, null, 2)
      }],
      isError: true
    };
  }

  switch (name) {
    case 'list_payment_providers': {
      try {
        const providers = await paymentService.listProviders(projectId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, data: providers, count: providers.length }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'get_payment_provider': {
      const providerId = parseInt(args.providerId, 10);
      if (isNaN(providerId)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Invalid provider ID' }, null, 2)
          }],
          isError: true
        };
      }

      try {
        const provider = await paymentService.getProvider(projectId, providerId);
        if (!provider) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: 'Payment provider not found' }, null, 2)
            }],
            isError: true
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, data: provider }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'create_payment_provider': {
      const createRequest: CreateProviderRequest = {
        projectId,
        name: args.name,
        providerType: args.provider_type,
        merchantId: args.merchant_id,
        merchantKey: args.merchant_key,
        passphrase: args.passphrase,
        apiKey: args.api_key,
        apiSecret: args.api_secret,
        publicKey: args.public_key,
        returnUrl: args.return_url,
        cancelUrl: args.cancel_url,
        notifyUrl: args.notify_url,
        sandboxMode: args.sandbox_mode ?? true,
        isActive: args.is_active ?? true,
        metadata: args.metadata
      };

      try {
        const provider = await paymentService.createProvider(createRequest);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, data: provider }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'update_payment_provider': {
      const providerId = parseInt(args.providerId, 10);
      if (isNaN(providerId)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Invalid provider ID' }, null, 2)
          }],
          isError: true
        };
      }

      const updateRequest: UpdateProviderRequest = {
        name: args.name,
        merchantId: args.merchant_id,
        merchantKey: args.merchant_key,
        passphrase: args.passphrase,
        apiKey: args.api_key,
        apiSecret: args.api_secret,
        publicKey: args.public_key,
        returnUrl: args.return_url,
        cancelUrl: args.cancel_url,
        notifyUrl: args.notify_url,
        sandboxMode: args.sandbox_mode,
        isActive: args.is_active,
        metadata: args.metadata
      };

      try {
        const provider = await paymentService.updateProvider(projectId, providerId, updateRequest);
        if (!provider) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: 'Payment provider not found' }, null, 2)
            }],
            isError: true
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, data: provider }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'delete_payment_provider': {
      const providerId = parseInt(args.providerId, 10);
      if (isNaN(providerId)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Invalid provider ID' }, null, 2)
          }],
          isError: true
        };
      }

      try {
        const deleted = await paymentService.deleteProvider(projectId, providerId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: deleted }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'test_payment_provider': {
      const providerId = parseInt(args.providerId, 10);
      if (isNaN(providerId)) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Invalid provider ID' }, null, 2)
          }],
          isError: true
        };
      }

      try {
        const result = await paymentService.testProvider(projectId, providerId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'list_payment_transactions': {
      try {
        const options = {
          status: args.status,
          paymentType: args.payment_type,
          limit: args.limit || 50,
          offset: args.offset || 0,
          startDate: args.start_date ? new Date(args.start_date) : undefined,
          endDate: args.end_date ? new Date(args.end_date) : undefined
        };

        const result = await paymentService.listTransactions(projectId, options);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ 
              success: true, 
              data: result.transactions, 
              total: result.total 
            }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'get_payment_transaction':
    case 'client_get_transaction_status': {
      try {
        const transaction = await paymentService.getTransaction(projectId, args.transactionId);
        if (!transaction) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ success: false, error: 'Transaction not found' }, null, 2)
            }],
            isError: true
          };
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: true, data: transaction }, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'client_initiate_payment': {
      const initiateRequest: InitiatePaymentServiceRequest = {
        providerId: args.provider_id,
        amount: parseFloat(args.amount),
        itemName: args.item_name,
        itemDescription: args.item_description,
        customerEmail: args.customer_email,
        customerName: args.customer_name,
        customerPhone: args.customer_phone,
        paymentType: args.payment_type || 'once_off',
        subscriptionType: args.subscription_type,
        frequency: args.frequency,
        cycles: args.cycles || 0,
        returnUrl: args.return_url,
        cancelUrl: args.cancel_url,
        metadata: args.metadata
      };

      if (isNaN(initiateRequest.amount) || initiateRequest.amount <= 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: 'Invalid amount' }, null, 2)
          }],
          isError: true
        };
      }

      try {
        const result = await paymentService.initiatePayment(projectId, initiateRequest);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    case 'client_cancel_subscription': {
      try {
        const result = await paymentService.cancelSubscription(projectId, args.transactionId);
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error: any) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ success: false, error: error.message }, null, 2)
          }],
          isError: true
        };
      }
    }

    default:
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Unknown payment tool: ${name}` }, null, 2)
        }],
        isError: true
      };
  }
}

/**
 * Internal handler that works with MCPToolsConfig
 */
async function handlePaymentToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  return handlePaymentTool(toolName, args, config);
}

/**
 * Payment tools module
 */
export const paymentToolModule: ToolModule = {
  category: ToolCategory.PAYMENTS,
  metadata: {
    name: 'payments',
    description: 'Payment gateway and transaction management tools',
    category: ToolCategory.PAYMENTS,
  },
  createTools: (config: MCPToolsConfig): Tool[] => createPaymentTools(config),
  handleTool: handlePaymentToolInternal,
  getToolNames: (): string[] => [
    'list_payment_providers',
    'get_payment_provider',
    'create_payment_provider',
    'update_payment_provider',
    'delete_payment_provider',
    'test_payment_provider',
    'list_payment_transactions',
    'get_payment_transaction',
    'client_initiate_payment',
    'client_get_transaction_status',
    'client_cancel_subscription',
  ],
  getClientSafeTools: (): string[] => [
    'client_initiate_payment',
    'client_get_transaction_status',
    'client_cancel_subscription',
  ],
};
