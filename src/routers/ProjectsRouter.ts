import express from 'express';
import ProjectsController from '../controllers/ProjectsController';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// All project routes require authentication
router.use(authenticateAndAttachUser);

// Routes that don't need project verification (user-level)
router.get('/list', ProjectsController.getAllProjects);
router.get('/dashboard-stats', ProjectsController.getUserDashboardStats);
router.post('/create', ProjectsController.createProject);

// Routes that need project access verification (projectId as :id)
router.get('/:id', verifyProjectAccess, ProjectsController.getProjectById);
router.put('/update/:id', verifyProjectAccess, ProjectsController.updateProject);
router.delete('/delete/:id', verifyProjectAccess, ProjectsController.deleteProject);
router.post('/reset/:id', verifyProjectAccess, ProjectsController.resetProject);
router.get('/:id/stats', verifyProjectAccess, ProjectsController.getProjectStats);

export { router };
