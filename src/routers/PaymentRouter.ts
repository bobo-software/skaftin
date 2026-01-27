/**
 * Payment Router
 * 
 * Routes for payment operations:
 * - Admin routes (SuperTokens auth): Provider management, transaction viewing
 * - Client routes (API Key auth): Payment initiation, status checking
 * - Webhook routes (Public): Payment gateway callbacks
 */

import express, { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import PaymentController from '../controllers/PaymentController';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';
import { hybridAuth, HybridAuthRequest } from '../middleware/hybridAuthMiddleware';

// Debug middleware for payment routes
const debugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log('\n💳 [PaymentRouter] Incoming Request:');
  console.log('  └─ Method:', req.method);
  console.log('  └─ URL:', req.originalUrl);
  console.log('  └─ Path:', req.path);
  console.log('  └─ Params:', req.params);
  next();
};

/**
 * Create the admin payment router (SuperTokens authentication)
 * Base path: /api/payments
 */
export function createPaymentRouter(pool: Pool): Router {
  const router = express.Router();
  const controller = new PaymentController(pool);

  // Add debug middleware
  router.use(debugMiddleware);

  // Auth middleware for admin routes
  const authMiddleware = [...authenticateAndAttachUser, verifyProjectAccess];

  // ============================================================================
  // PROVIDER MANAGEMENT
  // ============================================================================

  // List all payment providers for a project
  router.get('/:projectId/providers', authMiddleware, controller.listProviders);

  // Get a specific payment provider
  router.get('/:projectId/providers/:providerId', authMiddleware, controller.getProvider);

  // Create a new payment provider
  router.post('/:projectId/providers', authMiddleware, controller.createProvider);

  // Update a payment provider
  router.put('/:projectId/providers/:providerId', authMiddleware, controller.updateProvider);

  // Delete a payment provider
  router.delete('/:projectId/providers/:providerId', authMiddleware, controller.deleteProvider);

  // Test payment provider connection
  router.post('/:projectId/providers/:providerId/test', authMiddleware, controller.testProvider);

  // ============================================================================
  // TRANSACTION MANAGEMENT
  // ============================================================================

  // List transactions for a project
  router.get('/:projectId/transactions', authMiddleware, controller.listTransactions);

  // Get a specific transaction
  router.get('/:projectId/transactions/:transactionId', authMiddleware, controller.getTransaction);

  return router;
}

/**
 * Create the client payment router (API Key authentication)
 * Base path: /app-api/payments
 */
export function createClientPaymentRouter(pool: Pool): Router {
  const router = express.Router();
  const controller = new PaymentController(pool);

  // Add debug middleware
  router.use(debugMiddleware);

  // Hybrid auth middleware (API Key or Access Token)
  const authMiddleware = hybridAuth;

  // Initiate a payment
  router.post('/initiate', authMiddleware, controller.initiatePayment);

  // Get transaction status
  router.get('/transaction/:transactionId', authMiddleware, controller.getTransactionStatus);

  // Cancel a subscription
  router.post('/subscription/cancel', authMiddleware, controller.cancelSubscription);

  return router;
}

/**
 * Create the webhook router (Public - no auth, signature verification)
 * Base path: /api/payments/webhook
 */
export function createPaymentWebhookRouter(pool: Pool): Router {
  const router = express.Router();
  const controller = new PaymentController(pool);

  // PayFast webhooks need URL-encoded body parsing
  router.use(express.urlencoded({ extended: true }));
  router.use(express.text({ type: 'application/x-www-form-urlencoded' }));

  // PayFast ITN webhook
  router.post('/payfast/:projectId', controller.payfastWebhook);

  // Generic webhook for other providers (placeholder)
  router.post('/:providerType/:projectId', controller.genericWebhook);

  return router;
}
