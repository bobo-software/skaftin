import express from 'express';
import ProjectBucketsController from '../controllers/ProjectBucketsController';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// All bucket routes require authentication
router.use(authenticateAndAttachUser);

// All routes need project access verification
router.get('/:projectId/buckets', verifyProjectAccess, ProjectBucketsController.listBuckets);
router.post('/:projectId/buckets', verifyProjectAccess, ProjectBucketsController.createBucket);
router.put('/:projectId/buckets/:bucketId', verifyProjectAccess, ProjectBucketsController.updateBucket);
router.delete('/:projectId/buckets/:bucketId', verifyProjectAccess, ProjectBucketsController.deleteBucket);

export { router };

