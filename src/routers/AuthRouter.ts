import express from 'express';
import AuthController from '../controllers/AuthController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// Public routes
router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refreshToken);

// Protected routes
router.post('/verify', authenticateToken, AuthController.verify);
router.post('/logout', authenticateToken, AuthController.logout);

export { router };
