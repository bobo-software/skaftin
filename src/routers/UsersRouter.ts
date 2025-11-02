import express from 'express';
import UsersController from '../controllers/UsersController';
import { authenticateAndAttachUser, requireAdmin } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// All user management routes require authentication and admin role
router.use(authenticateAndAttachUser);
router.use(requireAdmin);

router.get('/list', UsersController.getAll);
router.post('/create', UsersController.create);

export { router };
