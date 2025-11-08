import express, { Router, Request, Response, NextFunction } from 'express';
import CommunicationsController from '../controllers/CommunicationsController';
import { Pool } from 'pg';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

// Debug middleware for communications routes
const debugMiddleware = (req: Request, res: Response, next: NextFunction) => {
  console.log('\n🔍 [CommunicationsRouter] Incoming Request:');
  console.log('  └─ Method:', req.method);
  console.log('  └─ URL:', req.originalUrl);
  console.log('  └─ Path:', req.path);
  console.log('  └─ Params:', req.params);
  console.log('  └─ Headers:');
  console.log('     └─ Authorization:', req.headers.authorization);
  console.log('     └─ Content-Type:', req.headers['content-type']);
  next();
};

export function createCommunicationsRouter(pool: Pool): Router {
  const router = express.Router();
  const controller = new CommunicationsController(pool);

  // Add debug middleware to all routes
  router.use(debugMiddleware);

  // All routes require SuperTokens authentication and project access verification
  const authMiddleware = [...authenticateAndAttachUser, verifyProjectAccess];

  // Email Provider Management Routes
  router.get('/:projectId/email/providers', authMiddleware, controller.listProviders);
  router.get('/:projectId/email/providers/:providerId', authMiddleware, controller.getProvider);
  router.post('/:projectId/email/providers', authMiddleware, controller.createProvider);
  router.put('/:projectId/email/providers/:providerId', authMiddleware, controller.updateProvider);
  router.delete('/:projectId/email/providers/:providerId', authMiddleware, controller.deleteProvider);

  // Email Provider Testing
  router.post('/:projectId/email/providers/:providerId/test', authMiddleware, controller.testConnection);

  // Email Sending
  router.post('/:projectId/email/send', authMiddleware, controller.sendEmail);

  return router;
}

// Export a default router for backward compatibility
export const router = Router();

