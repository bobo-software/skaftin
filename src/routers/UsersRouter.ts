import express from 'express';
import UsersController from '../controllers/UsersController';
import { authenticateAndAttachUser, requireAdmin } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// Get current user info (requires authentication only)
router.get('/me', authenticateAndAttachUser, UsersController.getCurrentUser);

// Admin-only routes
router.get('/list', authenticateAndAttachUser, requireAdmin, UsersController.getAll);
router.post('/create', authenticateAndAttachUser, requireAdmin, UsersController.create);

export { router };
