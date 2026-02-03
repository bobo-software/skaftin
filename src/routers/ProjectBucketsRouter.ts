import express from 'express';
import ProjectBucketsController from '../controllers/ProjectBucketsController';
import { authenticateAndAttachUser, verifyProjectAccess } from '../middleware/supertokensAuthMiddleware';

const router = express.Router();

// All bucket routes require authentication
router.use(authenticateAndAttachUser);

// All routes need project access verification
router.get('/:projectId/buckets', verifyProjectAccess, ProjectBucketsController.listBuckets);
router.post('/:projectId/buckets', verifyProjectAccess, ProjectBucketsController.createBucket);
router.get('/:projectId/buckets/:bucketId', verifyProjectAccess, ProjectBucketsController.getBucket);
router.put('/:projectId/buckets/:bucketId', verifyProjectAccess, ProjectBucketsController.updateBucket);
router.delete('/:projectId/buckets/:bucketId', verifyProjectAccess, ProjectBucketsController.deleteBucket);
router.get('/:projectId/buckets/:bucketId/policy', verifyProjectAccess, ProjectBucketsController.getBucketPolicy);
router.put('/:projectId/buckets/:bucketId/policy', verifyProjectAccess, ProjectBucketsController.setBucketPolicy);
router.get('/:projectId/buckets/:bucketId/stats', verifyProjectAccess, ProjectBucketsController.getBucketStats);

export { router };

