import express from 'express';
import UsersController from '../controllers/UsersController';
import { authenticateAndAttachUser, requireAdmin } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// Get current user info (requires authentication only)
router.get('/me', authenticateAndAttachUser, UsersController.getCurrentUser);

// Update current user profile (requires authentication only)
router.put('/me', authenticateAndAttachUser, UsersController.updateProfile);

// Change current user password (requires authentication only)
router.put('/me/password', authenticateAndAttachUser, UsersController.changePassword);

// Delete current user account (requires authentication only)
router.delete('/me', authenticateAndAttachUser, UsersController.deleteAccount);

// Admin-only routes
router.get('/list', authenticateAndAttachUser, requireAdmin, UsersController.getAll);
router.post('/create', authenticateAndAttachUser, requireAdmin, UsersController.create);

export { router };
