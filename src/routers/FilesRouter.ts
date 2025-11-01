import express from 'express';
import FilesController, { uploadMiddleware } from '../controllers/FilesController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

// All file routes require authentication
router.use(authenticateToken);

// GET routes
router.get('/list', FilesController.list);
router.get('/:fileName', FilesController.download);

// POST routes
router.post('/upload', uploadMiddleware.single('file'), FilesController.upload);

// DELETE routes
router.delete('/:fileName', FilesController.delete);

export { router };

