import express from 'express';
import ProjectsController from '../controllers/ProjectsController';
import { authenticateToken, verifyProjectAccess } from '../middleware/authMiddleware';

const router = express.Router();

// All project routes require authentication
router.use(authenticateToken);

// Routes that don't need project verification (user-level)
router.get('/list', ProjectsController.getAllProjects);
router.post('/create', ProjectsController.createProject);

// Routes that need project access verification (projectId as :id)
router.get('/:id', verifyProjectAccess, ProjectsController.getProjectById);
router.put('/update/:id', verifyProjectAccess, ProjectsController.updateProject);
router.delete('/delete/:id', verifyProjectAccess, ProjectsController.deleteProject);
router.get('/:id/stats', verifyProjectAccess, ProjectsController.getProjectStats);

export { router };
