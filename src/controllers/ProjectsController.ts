import { Response } from 'express';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import { projects } from '../db/schemas/ProjectsSchema';
import { organizations, organization_members } from '../db/schemas/OrganizationsSchema';
import ResponseUtils from '../utils/ResponseUtils';
import { emitProjectEvent } from '../utils/websocketEmitter';
import { S3Client, CreateBucketCommand } from '@aws-sdk/client-s3';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';

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

  // Get all projects for authenticated user (from their organizations)
  static async getAllProjects(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const userId = req.user.userId;

      // Get all organizations the user is a member of
      const userOrgs = await db
        .select({ organization_id: organization_members.organization_id })
        .from(organization_members)
        .where(eq(organization_members.user_id, userId));

      if (userOrgs.length === 0) {
        // User is not a member of any organization
        return ResponseUtils.success(res, 'Projects fetched successfully', []);
      }

      const orgIds = userOrgs.map(org => org.organization_id);

      // Get all projects from those organizations
      const results = await db
        .select()
        .from(projects)
        .where(inArray(projects.organization_id, orgIds))
        .orderBy(projects.created_at);

      ResponseUtils.success(res, 'Projects fetched successfully', results);
    } catch (error) {
      console.error('Error fetching projects:', error);
      ResponseUtils.error(res, 'Failed to fetch projects', error);
    }
  }

  // Get project by ID
  static async getProjectById(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const projectId = parseInt(id!);

      const result = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (result.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if user has access to this project through organization membership
      const access = await ProjectsController.checkProjectAccess(projectId, req.user.userId);
      
      if (!access.hasAccess) {
        return res.status(403).json({ success: false, message: 'You do not have access to this project' });
      }

      ResponseUtils.success(res, 'Project fetched successfully', result[0]);
    } catch (error) {
      console.error('Error fetching project:', error);
      ResponseUtils.error(res, 'Failed to fetch project', error);
    }
  }

  // Get project statistics
  static async getProjectStats(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const projectId = parseInt(id);
      
      // Get project
      const projectResult = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (projectResult.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if user has access to this project
      const access = await ProjectsController.checkProjectAccess(projectId, req.user.userId);
      
      if (!access.hasAccess) {
        return res.status(403).json({ success: false, message: 'You do not have access to this project' });
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
  static async createProject(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const userId = req.user.userId; // SuperTokens user ID (string)
      const { name, description, organization_id } = req.body;

      // Validation
      if (!name || name.trim() === '') {
        return ResponseUtils.error(res, 'Project name is required', null, null, 400);
      }

      if (!organization_id) {
        return ResponseUtils.error(res, 'Organization ID is required', null, null, 400);
      }

      // Check if user is a member of the organization (and has permission to create projects)
      const membership = await db
        .select()
        .from(organization_members)
        .where(
          and(
            eq(organization_members.organization_id, organization_id),
            eq(organization_members.user_id, userId)
          )
        );

      if (membership.length === 0) {
        return ResponseUtils.error(res, 'You are not a member of this organization', null, null, 403);
      }

      // Check if user has permission (admin or dev can create projects)
      const role = membership[0].role;
      if (role !== 'admin' && role !== 'dev') {
        return ResponseUtils.error(res, 'You do not have permission to create projects in this organization', null, null, 403);
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
          organization_id: organization_id,
          user_id: userId, // Store creator for audit purposes
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
  static async updateProject(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const projectId = parseInt(id);
      const { name, description } = req.body;

      // Get existing project
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (existing.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if user has access and permission (admin or dev can update)
      const access = await ProjectsController.checkProjectAccess(projectId, req.user.userId);
      
      if (!access.hasAccess) {
        return res.status(403).json({ success: false, message: 'You do not have access to this project' });
      }

      if (access.role !== 'admin' && access.role !== 'dev') {
        return res.status(403).json({ success: false, message: 'You do not have permission to update this project' });
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
  static async deleteProject(req: SuperTokensAuthenticatedRequest, res: Response) {
    // User info is attached by SuperTokens middleware
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { id } = req.params;
      const projectId = parseInt(id);

      // Get existing project
      const existing = await db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId));

      if (existing.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      // Check if user has access and permission (only admin can delete)
      const access = await ProjectsController.checkProjectAccess(projectId, req.user.userId);
      
      if (!access.hasAccess) {
        return res.status(403).json({ success: false, message: 'You do not have access to this project' });
      }

      if (access.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Only admins can delete projects' });
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

