import { Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import { projects } from '../db/schemas/ProjectsSchema';
import ResponseUtils from '../utils/ResponseUtils';
import CommonUtils from '../utils/CommonUtils';
import { emitProjectEvent } from '../utils/websocketEmitter';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';

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

class ProjectsController {
  // Get all projects for authenticated user
  static async getAllProjects(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const results = await db
        .select()
        .from(projects)
        .where(eq(projects.user_id, decodedToken.userId))
        .orderBy(projects.created_at);

      ResponseUtils.success(res, 'Projects fetched successfully', results);
    } catch (error) {
      console.error('Error fetching projects:', error);
      ResponseUtils.error(res, 'Failed to fetch projects', error);
    }
  }

  // Get project by ID
  static async getProjectById(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const result = await db
        .select()
        .from(projects)
        .where(eq(projects.id, parseInt(id)));

      if (result.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Verify ownership
      if (result[0].user_id !== decodedToken.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      ResponseUtils.success(res, 'Project fetched successfully', result[0]);
    } catch (error) {
      console.error('Error fetching project:', error);
      ResponseUtils.error(res, 'Failed to fetch project', error);
    }
  }

  // Get project statistics
  static async getProjectStats(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      
      // Get project to verify ownership
      const projectResult = await db
        .select()
        .from(projects)
        .where(eq(projects.id, parseInt(id)));

      if (projectResult.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      if (projectResult[0].user_id !== decodedToken.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const project = projectResult[0];

      // TODO: Get table count from project schema
      // TODO: Get file count from MinIO bucket
      // TODO: Get API call count from logs

      const stats = {
        projectId: project.id,
        projectName: project.name,
        tableCount: 0,
        fileCount: 0,
        apiCalls: 0,
        createdAt: project.created_at,
      };

      ResponseUtils.success(res, 'Project statistics fetched successfully', stats);
    } catch (error) {
      console.error('Error fetching project stats:', error);
      ResponseUtils.error(res, 'Failed to fetch project statistics', error);
    }
  }

  // Create new project
  static async createProject(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { name, description } = req.body;

      // Validation
      if (!name || name.trim() === '') {
        return ResponseUtils.error(res, 'Project name is required', null, null, 400);
      }

      // Generate unique schema and bucket names
      const timestamp = Date.now();
      const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const schemaName = `project_${sanitizedName}_${timestamp}`;
      const bucketName = `project-${sanitizedName}-${timestamp}`;

      // Create project in database
      const result = await db
        .insert(projects)
        .values({
          name: name.trim(),
          description: description?.trim() || null,
          user_id: decodedToken.userId,
          schema_name: schemaName,
          bucket_name: bucketName,
        })
        .returning();

      const newProject = result[0];

      // Create PostgreSQL schema
      try {
        await db.execute(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
        console.log(`✅ Created PostgreSQL schema: ${schemaName}`);
      } catch (schemaError) {
        console.error('❌ Error creating PostgreSQL schema:', schemaError);
        // Continue even if schema creation fails
      }

      // Create MinIO bucket
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: bucketName }));
        console.log(`✅ Created MinIO bucket: ${bucketName}`);
      } catch (bucketError: any) {
        if (bucketError.name !== 'BucketAlreadyOwnedByYou' && bucketError.name !== 'BucketAlreadyExists') {
          console.error('❌ Error creating MinIO bucket:', bucketError);
        }
        // Continue even if bucket creation fails
      }

      // Emit WebSocket event
      emitProjectEvent(newProject.id.toString(), 'project_created', newProject);

      ResponseUtils.success(res, 'Project created successfully', newProject, 201);
    } catch (error) {
      console.error('Error creating project:', error);
      ResponseUtils.error(res, 'Failed to create project', error);
    }
  }

  // Update project
  static async updateProject(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const { name, description } = req.body;

      // Get existing project to verify ownership
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.id, parseInt(id)));

      if (existing.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      if (existing[0].user_id !== decodedToken.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      // Update project
      const updateData: any = {
        updated_at: new Date(),
      };

      if (name !== undefined) {
        updateData.name = name.trim();
      }

      if (description !== undefined) {
        updateData.description = description?.trim() || null;
      }

      const result = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, parseInt(id)))
        .returning();

      // Emit WebSocket event
      emitProjectEvent(result[0].id.toString(), 'project_updated', result[0]);

      ResponseUtils.success(res, 'Project updated successfully', result[0]);
    } catch (error) {
      console.error('Error updating project:', error);
      ResponseUtils.error(res, 'Failed to update project', error);
    }
  }

  // Delete project
  static async deleteProject(req: Request, res: Response) {
    const decodedToken = CommonUtils.handleAuthHeader(req);
    if (!decodedToken) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;

      // Get existing project to verify ownership
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.id, parseInt(id)));

      if (existing.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      if (existing[0].user_id !== decodedToken.userId) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

      const project = existing[0];

      // Delete project from database
      await db
        .delete(projects)
        .where(eq(projects.id, parseInt(id)));

      // TODO: Drop PostgreSQL schema (be careful with this)
      // TODO: Delete MinIO bucket (be careful with this)

      // Emit WebSocket event
      emitProjectEvent(project.id.toString(), 'project_deleted', { id: project.id });

      ResponseUtils.success(res, 'Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      ResponseUtils.error(res, 'Failed to delete project', error);
    }
  }
}

export default ProjectsController;

