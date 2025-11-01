import express from 'express';
import UsersController from '../controllers/UsersController';
import { authenticateToken, requireAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// All user management routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/list', UsersController.getAll);
router.post('/create', UsersController.create);

export { router };
