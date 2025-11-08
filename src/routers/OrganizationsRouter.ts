import { Router } from 'express';
import OrganizationsController from '../controllers/OrganizationsController';
import { authenticateAndAttachUser } from '../middleware/supertokensAuthMiddleware';

const router = Router();

// Apply SuperTokens authentication to all routes
router.use(authenticateAndAttachUser);

// Organization CRUD routes
router.get('/list', OrganizationsController.getUserOrganizations);
router.get('/:id', OrganizationsController.getOrganizationById);
router.post('/create', OrganizationsController.createOrganization);
router.put('/:id', OrganizationsController.updateOrganization);
router.delete('/:id', OrganizationsController.deleteOrganization);

// Member management routes
router.get('/:id/members', OrganizationsController.getOrganizationMembers);
router.post('/:id/members', OrganizationsController.addMember);
router.post('/:id/members/by-user-id', OrganizationsController.addMemberByUserId);
router.put('/:id/members/:memberId', OrganizationsController.updateMemberRole);
router.delete('/:id/members/:memberId', OrganizationsController.removeMember);

export default router;

