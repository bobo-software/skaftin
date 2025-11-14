import express, { Router } from 'express';
import CredentialsController from '../controllers/CredentialsController';
import { Pool } from 'pg';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

export function createCredentialsRouter(pool: Pool): Router {
  const router = express.Router();
  const controller = new CredentialsController(pool);

  // All routes require authentication and project access
  const authMiddleware = [...authenticateAndAttachUser, verifyProjectAccess];

  // Get available permissions (informational)
  router.get('/permissions', controller.getAvailablePermissions);

  // API Credentials Management Routes
  router.get('/:projectId/credentials', authMiddleware, controller.listCredentials);
  router.post('/:projectId/credentials', authMiddleware, controller.createCredential);
  router.put('/:projectId/credentials/:credentialId', authMiddleware, controller.updateCredential);
  router.delete('/:projectId/credentials/:credentialId', authMiddleware, controller.deleteCredential);

  // MCP Key Routes
  router.get('/:projectId/mcp-key', authMiddleware, controller.getMcpKey);
  router.post('/:projectId/mcp-key/regenerate', authMiddleware, controller.regenerateMcpKey);

  return router;
}

export const router = Router();

