import { Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import { project_buckets } from '../db/schemas/ProjectBucketsSchema';
import { projects } from '../db/schemas/ProjectsSchema';
import { organization_members } from '../db/schemas/OrganizationsSchema';
import ResponseUtils from '../utils/ResponseUtils';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { Pool } from 'pg';
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { 
  setBucketPublicRead, 
  setBucketAccessPolicy, 
  getBucketPolicy,
  BucketAccessPolicy 
} from '../utils/s3BucketPolicy';

// Initialize S3 client for MinIO
const s3Client = new S3Client({
  endpoint: process.env.MINIO_SERVER_URL || 'http://localhost:9000',
  region: process.env.MINIO_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || '',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || '',
  },
  forcePathStyle: true,
});

class ProjectBucketsController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    ProjectBucketsController.pool = pool;
  }

  /**
   * Check if user has access to a project through organization membership
   */
  private static async checkProjectAccess(projectId: number, userId: string): Promise<{ hasAccess: boolean; role?: string }> {
    try {
      // Get the project
      const project = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (project.length === 0) {
        return { hasAccess: false };
      }

      // Check if project has an organization_id
      if (!project[0].organization_id) {
        // Legacy project without organization - check user_id
        return { hasAccess: project[0].user_id === userId, role: 'admin' };
      }

      // Check if user is a member of the project's organization
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, project[0].organization_id),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return { hasAccess: false };
      }

      return { hasAccess: true, role: membership[0].role };
    } catch (error) {
      console.error('Error checking project access:', error);
      return { hasAccess: false };
    }
  }

  /**
   * List all buckets for a project
   * GET /api/projects/:projectId/buckets
   */
  static async listBuckets(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const userId = req.user.userId;

      if (isNaN(projectId)) {
        return ResponseUtils.error(res, 'Invalid project ID', null, null, 400);
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Get all buckets for the project
      const buckets = await db
        .select()
        .from(project_buckets)
        .where(eq(project_buckets.project_id, projectId))
        .orderBy(project_buckets.created_at);

      // Optionally include file counts and sizes
      const bucketsWithStats = await Promise.all(
        buckets.map(async (bucket) => {
          try {
            const listCommand = new ListObjectsV2Command({
              Bucket: bucket.bucket_name,
              MaxKeys: 1000,
            });
            const objects = await s3Client.send(listCommand);
            
            return {
              ...bucket,
              fileCount: objects.KeyCount || 0,
              totalSize: objects.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0,
            };
          } catch (error) {
            // Bucket might not exist in MinIO yet
            return {
              ...bucket,
              fileCount: 0,
              totalSize: 0,
            };
          }
        })
      );

      ResponseUtils.success(res, 'Buckets listed successfully', bucketsWithStats);
    } catch (error) {
      console.error('Error listing buckets:', error);
      ResponseUtils.error(res, 'Failed to list buckets', error);
    }
  }

  /**
   * Create a new bucket for a project
   * POST /api/projects/:projectId/buckets
   */
  static async createBucket(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const userId = req.user.userId;
      // Support both camelCase and snake_case
      const { bucketName, description, accessPolicy, access_policy } = req.body;
      const policy = accessPolicy || access_policy || 'public';

      if (isNaN(projectId)) {
        return ResponseUtils.error(res, 'Invalid project ID', null, null, 400);
      }

      if (!bucketName || bucketName.trim() === '') {
        return ResponseUtils.error(res, 'Bucket name is required', null, null, 400);
      }

      // Validate bucket name format (S3 bucket naming rules)
      const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
      if (!bucketNameRegex.test(bucketName) || bucketName.length < 3 || bucketName.length > 63) {
        return ResponseUtils.error(
          res,
          'Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens',
          null,
          null,
          400
        );
      }

      // Validate access policy
      if (policy && policy !== 'private' && policy !== 'public') {
        return ResponseUtils.error(
          res,
          'Access policy must be either "private" or "public"',
          null,
          null,
          400
        );
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Check if bucket name already exists
      // Use raw SQL to avoid Drizzle schema issues if column doesn't exist yet
      let existingBucket: any[] = [];
      try {
        existingBucket = await db
          .select()
          .from(project_buckets)
          .where(eq(project_buckets.bucket_name, bucketName.trim()));
      } catch (drizzleError: any) {
        // If column doesn't exist, use raw query
        if (drizzleError.message?.includes('access_policy')) {
          const rawResult = await ProjectBucketsController.pool.query(
            'SELECT id FROM skaftin_system_project_buckets WHERE bucket_name = $1',
            [bucketName.trim()]
          );
          existingBucket = rawResult.rows;
        } else {
          throw drizzleError;
        }
      }

      if (existingBucket.length > 0) {
        return ResponseUtils.error(res, 'Bucket name already exists', null, null, 409);
      }

      // Create bucket in MinIO
      try {
        // Check if bucket already exists
        try {
          await s3Client.send(new HeadBucketCommand({ Bucket: bucketName.trim() }));
          // Bucket already exists, that's okay
          console.log(`Bucket ${bucketName.trim()} already exists in MinIO`);
        } catch (headError: any) {
          // If bucket doesn't exist (404), create it
          if (headError.name === 'NotFound' || headError.$metadata?.httpStatusCode === 404) {
            const createCommand = new CreateBucketCommand({
              Bucket: bucketName.trim(),
            });
            await s3Client.send(createCommand);
            console.log(`Created MinIO bucket: ${bucketName.trim()}`);
          } else {
            // Some other error occurred
            throw headError;
          }
        }
      } catch (minioError: any) {
        // If bucket already exists in MinIO, that's okay
        if (minioError.name === 'BucketAlreadyOwnedByYou' || minioError.name === 'BucketAlreadyExists') {
          console.log(`Bucket ${bucketName.trim()} already exists in MinIO`);
        } else {
          console.error('Error creating MinIO bucket:', minioError);
          return ResponseUtils.error(res, `Failed to create bucket in storage: ${minioError.message}`, minioError);
        }
      }

      // Set bucket access policy
      const finalPolicy: BucketAccessPolicy = policy === 'public' ? 'public' : 'private';
      try {
        await setBucketAccessPolicy(s3Client, bucketName.trim(), finalPolicy);
        console.log(`Set ${finalPolicy} access policy on bucket: ${bucketName.trim()}`);
      } catch (policyError: any) {
        console.warn(`Could not set access policy on bucket ${bucketName.trim()}:`, policyError.message);
      }

      // Create bucket record in database
      // Use raw SQL to handle case where access_policy column doesn't exist yet
      let result;
      try {
        // Try with access_policy column first
        const insertResult = await ProjectBucketsController.pool.query(
          `INSERT INTO skaftin_system_project_buckets (project_id, bucket_name, description, access_policy)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [projectId, bucketName.trim(), description?.trim() || null, finalPolicy]
        );
        result = insertResult.rows;
      } catch (dbError: any) {
        // If column doesn't exist, insert without it (backward compatibility)
        if (dbError.message?.includes('access_policy') || dbError.code === '42703') {
          console.warn('access_policy column not found, inserting without it. Please run migration.');
          const insertResult = await ProjectBucketsController.pool.query(
            `INSERT INTO skaftin_system_project_buckets (project_id, bucket_name, description)
             VALUES ($1, $2, $3)
             RETURNING *`,
            [projectId, bucketName.trim(), description?.trim() || null]
          );
          result = insertResult.rows;
        } else {
          throw dbError;
        }
      }

      // Format result to match expected structure
      const bucketResult = Array.isArray(result) ? result[0] : result;
      ResponseUtils.success(res, 'Bucket created successfully', bucketResult, 201);
    } catch (error: any) {
      console.error('Error creating bucket:', error);
      
      if (error.code === '23505') {
        // Unique constraint violation
        return ResponseUtils.error(res, 'Bucket name already exists', null, null, 409);
      }
      
      ResponseUtils.error(res, 'Failed to create bucket', error);
    }
  }

  /**
   * Get a single bucket by ID
   * GET /api/projects/:projectId/buckets/:bucketId
   */
  static async getBucket(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const bucketId = parseInt(req.params.bucketId, 10);
      const userId = req.user.userId;

      if (isNaN(projectId) || isNaN(bucketId)) {
        return ResponseUtils.error(res, 'Invalid project ID or bucket ID', null, null, 400);
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Get the bucket
      const bucket = await db
        .select()
        .from(project_buckets)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        );

      if (bucket.length === 0) {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }

      // Get bucket statistics
      let stats = {
        fileCount: 0,
        totalSize: 0,
      };

      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket[0].bucket_name,
          MaxKeys: 1000,
        });
        const objects = await s3Client.send(listCommand);
        stats = {
          fileCount: objects.KeyCount || 0,
          totalSize: objects.Contents?.reduce((sum, obj) => sum + (obj.Size || 0), 0) || 0,
        };
      } catch (error) {
        // Bucket might not exist in MinIO yet
      }

      // Get actual policy from MinIO
      let actualPolicy: BucketAccessPolicy = 'private';
      try {
        actualPolicy = await getBucketPolicy(s3Client, bucket[0].bucket_name);
      } catch (error) {
        // Policy might not be set
      }

      ResponseUtils.success(res, 'Bucket retrieved successfully', {
        ...bucket[0],
        stats,
        actualPolicy,
      });
    } catch (error) {
      console.error('Error getting bucket:', error);
      ResponseUtils.error(res, 'Failed to get bucket', error);
    }
  }

  /**
   * Get bucket access policy
   * GET /api/projects/:projectId/buckets/:bucketId/policy
   */
  static async getBucketPolicy(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const bucketId = parseInt(req.params.bucketId, 10);
      const userId = req.user.userId;

      if (isNaN(projectId) || isNaN(bucketId)) {
        return ResponseUtils.error(res, 'Invalid project ID or bucket ID', null, null, 400);
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Get the bucket
      const bucket = await db
        .select()
        .from(project_buckets)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        );

      if (bucket.length === 0) {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }

      // Get actual policy from MinIO
      const actualPolicy = await getBucketPolicy(s3Client, bucket[0].bucket_name);

      ResponseUtils.success(res, 'Bucket policy retrieved successfully', {
        bucketId,
        bucketName: bucket[0].bucket_name,
        storedPolicy: bucket[0].access_policy,
        actualPolicy,
      });
    } catch (error) {
      console.error('Error getting bucket policy:', error);
      ResponseUtils.error(res, 'Failed to get bucket policy', error);
    }
  }

  /**
   * Set bucket access policy
   * PUT /api/projects/:projectId/buckets/:bucketId/policy
   */
  static async setBucketPolicy(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const bucketId = parseInt(req.params.bucketId, 10);
      const userId = req.user.userId;
      const { accessPolicy } = req.body;

      if (isNaN(projectId) || isNaN(bucketId)) {
        return ResponseUtils.error(res, 'Invalid project ID or bucket ID', null, null, 400);
      }

      if (!accessPolicy || (accessPolicy !== 'private' && accessPolicy !== 'public')) {
        return ResponseUtils.error(
          res,
          'Access policy must be either "private" or "public"',
          null,
          null,
          400
        );
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Get the bucket
      const bucket = await db
        .select()
        .from(project_buckets)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        );

      if (bucket.length === 0) {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }

      // Update MinIO policy
      await setBucketAccessPolicy(s3Client, bucket[0].bucket_name, accessPolicy as BucketAccessPolicy);

      // Update database
      const result = await db
        .update(project_buckets)
        .set({
          access_policy: accessPolicy,
          updated_at: new Date(),
        })
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        )
        .returning();

      ResponseUtils.success(res, 'Bucket policy updated successfully', {
        ...result[0],
        actualPolicy: accessPolicy,
      });
    } catch (error) {
      console.error('Error setting bucket policy:', error);
      ResponseUtils.error(res, 'Failed to set bucket policy', error);
    }
  }

  /**
   * Get bucket statistics
   * GET /api/projects/:projectId/buckets/:bucketId/stats
   */
  static async getBucketStats(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const bucketId = parseInt(req.params.bucketId, 10);
      const userId = req.user.userId;

      if (isNaN(projectId) || isNaN(bucketId)) {
        return ResponseUtils.error(res, 'Invalid project ID or bucket ID', null, null, 400);
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Get the bucket
      const bucket = await db
        .select()
        .from(project_buckets)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        );

      if (bucket.length === 0) {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }

      // Get bucket statistics from MinIO
      let stats = {
        fileCount: 0,
        totalSize: 0,
        largestFile: null as { key: string; size: number } | null,
        oldestFile: null as { key: string; lastModified: Date } | null,
        newestFile: null as { key: string; lastModified: Date } | null,
      };

      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucket[0].bucket_name,
          MaxKeys: 1000,
        });
        const objects = await s3Client.send(listCommand);

        if (objects.Contents && objects.Contents.length > 0) {
          stats.fileCount = objects.KeyCount || 0;
          stats.totalSize = objects.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);

          // Find largest file
          const largest = objects.Contents.reduce((max, obj) => 
            (obj.Size || 0) > (max.Size || 0) ? obj : max
          );
          stats.largestFile = {
            key: largest.Key || '',
            size: largest.Size || 0,
          };

          // Find oldest and newest files
          const sortedByDate = [...objects.Contents].sort((a, b) => 
            (a.LastModified?.getTime() || 0) - (b.LastModified?.getTime() || 0)
          );
          if (sortedByDate.length > 0) {
            stats.oldestFile = {
              key: sortedByDate[0].Key || '',
              lastModified: sortedByDate[0].LastModified || new Date(),
            };
            stats.newestFile = {
              key: sortedByDate[sortedByDate.length - 1].Key || '',
              lastModified: sortedByDate[sortedByDate.length - 1].LastModified || new Date(),
            };
          }
        }
      } catch (error) {
        // Bucket might not exist in MinIO yet
        console.warn('Error getting bucket stats:', error);
      }

      ResponseUtils.success(res, 'Bucket statistics retrieved successfully', {
        bucketId,
        bucketName: bucket[0].bucket_name,
        ...stats,
      });
    } catch (error) {
      console.error('Error getting bucket stats:', error);
      ResponseUtils.error(res, 'Failed to get bucket statistics', error);
    }
  }

  /**
   * Update a bucket
   * PUT /api/projects/:projectId/buckets/:bucketId
   */
  static async updateBucket(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const bucketId = parseInt(req.params.bucketId, 10);
      const userId = req.user.userId;
      const { bucketName, description, accessPolicy } = req.body;

      if (isNaN(projectId) || isNaN(bucketId)) {
        return ResponseUtils.error(res, 'Invalid project ID or bucket ID', null, null, 400);
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Get the bucket
      const bucket = await db
        .select()
        .from(project_buckets)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        );

      if (bucket.length === 0) {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }

      // Validate access policy if provided
      if (accessPolicy !== undefined) {
        if (accessPolicy !== 'private' && accessPolicy !== 'public') {
          return ResponseUtils.error(
            res,
            'Access policy must be either "private" or "public"',
            null,
            null,
            400
          );
        }
      }

      // Prepare update data
      const updateData: any = {};
      if (bucketName !== undefined) {
        if (bucketName.trim() === '') {
          return ResponseUtils.error(res, 'Bucket name cannot be empty', null, null, 400);
        }
        
        // Validate bucket name format
        const bucketNameRegex = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;
        if (!bucketNameRegex.test(bucketName) || bucketName.length < 3 || bucketName.length > 63) {
          return ResponseUtils.error(
            res,
            'Bucket name must be 3-63 characters, lowercase alphanumeric with hyphens',
            null,
            null,
            400
          );
        }

        // Check if new bucket name already exists
        const existingBucket = await db
          .select()
          .from(project_buckets)
          .where(eq(project_buckets.bucket_name, bucketName.trim()));

        if (existingBucket.length > 0 && existingBucket[0].id !== bucketId) {
          return ResponseUtils.error(res, 'Bucket name already exists', null, null, 409);
        }

        updateData.bucket_name = bucketName.trim();
      }
      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }
      if (accessPolicy !== undefined) {
        updateData.access_policy = accessPolicy;
        // Update MinIO policy if changed
        try {
          await setBucketAccessPolicy(s3Client, bucket[0].bucket_name, accessPolicy as BucketAccessPolicy);
          console.log(`Updated access policy to ${accessPolicy} for bucket: ${bucket[0].bucket_name}`);
        } catch (policyError: any) {
          console.warn(`Could not update access policy:`, policyError.message);
        }
      }
      updateData.updated_at = new Date();

      if (Object.keys(updateData).length === 0) {
        return ResponseUtils.error(res, 'No fields to update', null, null, 400);
      }

      // Update bucket
      const result = await db
        .update(project_buckets)
        .set(updateData)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        )
        .returning();

      ResponseUtils.success(res, 'Bucket updated successfully', result[0]);
    } catch (error: any) {
      console.error('Error updating bucket:', error);
      
      if (error.code === '23505') {
        return ResponseUtils.error(res, 'Bucket name already exists', null, null, 409);
      }
      
      ResponseUtils.error(res, 'Failed to update bucket', error);
    }
  }

  /**
   * Delete a bucket
   * DELETE /api/projects/:projectId/buckets/:bucketId
   */
  static async deleteBucket(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const projectId = parseInt(req.params.projectId, 10);
      const bucketId = parseInt(req.params.bucketId, 10);
      const userId = req.user.userId;
      const { force = 'false' } = req.query;

      if (isNaN(projectId) || isNaN(bucketId)) {
        return ResponseUtils.error(res, 'Invalid project ID or bucket ID', null, null, 400);
      }

      // Check project access
      const access = await ProjectBucketsController.checkProjectAccess(projectId, userId);
      if (!access.hasAccess) {
        return ResponseUtils.error(res, 'Project not found or access denied', null, null, 403);
      }

      // Get the bucket
      const bucket = await db
        .select()
        .from(project_buckets)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        );

      if (bucket.length === 0) {
        return ResponseUtils.error(res, 'Bucket not found', null, null, 404);
      }

      const bucketName = bucket[0].bucket_name;

      // Check if bucket has files
      try {
        const listCommand = new ListObjectsV2Command({
          Bucket: bucketName,
          MaxKeys: 1,
        });
        const objects = await s3Client.send(listCommand);

        if (objects.Contents && objects.Contents.length > 0) {
          if (force !== 'true') {
            return ResponseUtils.error(
              res,
              'Bucket is not empty. Use force=true to delete all files',
              null,
              null,
              400
            );
          }

          // Delete all objects
          const listAllCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            MaxKeys: 1000,
          });
          const allObjects = await s3Client.send(listAllCommand);

          if (allObjects.Contents && allObjects.Contents.length > 0) {
            const deleteCommand = new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: {
                Objects: allObjects.Contents.map((obj) => ({ Key: obj.Key! })),
              },
            });
            await s3Client.send(deleteCommand);
          }
        }
      } catch (minioError: any) {
        // Bucket might not exist in MinIO, that's okay
        if (minioError.name !== 'NoSuchBucket') {
          console.error('Error checking bucket contents:', minioError);
        }
      }

      // Delete bucket record from database
      await db
        .delete(project_buckets)
        .where(
          and(
            eq(project_buckets.id, bucketId),
            eq(project_buckets.project_id, projectId)
          )
        );

      ResponseUtils.success(res, 'Bucket deleted successfully', {
        bucketId,
        bucketName,
      });
    } catch (error) {
      console.error('Error deleting bucket:', error);
      ResponseUtils.error(res, 'Failed to delete bucket', error);
    }
  }
}

export default ProjectBucketsController;

