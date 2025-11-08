import express, { Router } from 'express';
import InvitationsController from '../controllers/InvitationsController';
import { Pool } from 'pg';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

export function createInvitationsRouter(pool: Pool): Router {
  const router = express.Router();
  const controller = new InvitationsController(pool);

  // Public route - get invitation by code (no auth required)
  router.get('/code/:inviteCode', controller.getInvitationByCode);

  // Protected route - accept invitation (requires auth, no project access needed)
  router.post('/accept/:inviteCode', authenticateAndAttachUser, controller.acceptInvitation);

  // Project-specific routes (require auth + project access)
  const projectAuthMiddleware = [...authenticateAndAttachUser, verifyProjectAccess];

  router.get('/:projectId/invitations', projectAuthMiddleware, controller.listInvitations);
  router.get('/:projectId/members', projectAuthMiddleware, controller.listMembers);
  router.post('/:projectId/invitations', projectAuthMiddleware, controller.createInvitation);
  router.delete('/:projectId/invitations/:invitationId', projectAuthMiddleware, controller.revokeInvitation);
  router.delete('/:projectId/members/:memberId', projectAuthMiddleware, controller.removeMember);

  return router;
}

export const router = Router();

