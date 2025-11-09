import { Response } from 'express';
import { eq, and, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/drizzle.config';
import { projects } from '../db/schemas/ProjectsSchema';
import { organizations, organization_members } from '../db/schemas/OrganizationsSchema';
import ResponseUtils from '../utils/ResponseUtils';
import { emitProjectEvent } from '../utils/websocketEmitter';
import { S3Client, CreateBucketCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import { Pool } from 'pg';

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
  private static pool: Pool;

  static initialize(pool: Pool) {
    ProjectsController.pool = pool;
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

  // Get all projects for authenticated user (from their organizations + direct membership)
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

      const orgIds = userOrgs.map(org => org.organization_id);

      // Get projects from organizations
      let orgProjects: any[] = [];
      if (orgIds.length > 0) {
        orgProjects = await db
          .select()
          .from(projects)
          .where(inArray(projects.organization_id, orgIds))
          .orderBy(projects.created_at);
      }

      // Get projects where user is a direct member (via invitations)
      const memberProjects = await db.execute(sql`
        SELECT DISTINCT p.* 
        FROM projects p
        INNER JOIN project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = ${userId}
        ORDER BY p.created_at
      `);

      // Combine and deduplicate projects by ID
      const projectMap = new Map();
      
      [...orgProjects, ...(memberProjects.rows as any[])].forEach((project) => {
        if (!projectMap.has(project.id)) {
          projectMap.set(project.id, project);
        }
      });

      const results = Array.from(projectMap.values());

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

  /**
   * Reset project database and storage
   * POST /api/projects/reset/:id
   */
  static async resetProject(req: SuperTokensAuthenticatedRequest, res: Response) {
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

      // Check if user has access and permission (admin or dev can reset)
      const access = await ProjectsController.checkProjectAccess(projectId, req.user.userId);
      
      if (!access.hasAccess) {
        return res.status(403).json({ success: false, message: 'You do not have access to this project' });
      }

      if (access.role !== 'admin' && access.role !== 'dev') {
        return res.status(403).json({ success: false, message: 'You do not have permission to reset this project' });
      }

      const project = existing[0];
      const schemaName = project.schema_name;
      const bucketName = project.bucket_name;

      let droppedTables = 0;
      let deletedFiles = 0;
      const errors: string[] = [];

      console.log(`🔄 Starting reset for project ${project.name} (ID: ${projectId})`);

      // 1. Drop all tables in the schema
      try {
        const client = await ProjectsController.pool.connect();
        try {
          await client.query(`SET search_path TO ${schemaName}, public`);
          
          // Get all tables in the schema
          const tablesResult = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = $1 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
          `, [schemaName]);

          console.log(`📊 Found ${tablesResult.rows.length} tables to drop in schema ${schemaName}`);

          // Drop each table
          for (const row of tablesResult.rows) {
            try {
              await client.query(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE`);
              droppedTables++;
              console.log(`  ✓ Dropped table: ${row.table_name}`);
            } catch (err: any) {
              const errorMsg = `Failed to drop table ${row.table_name}: ${err.message}`;
              errors.push(errorMsg);
              console.error(`  ✗ ${errorMsg}`);
            }
          }
        } finally {
          client.release();
        }
      } catch (error: any) {
        const errorMsg = `Database reset error: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // 2. Delete all files from MinIO bucket
      try {
        console.log(`🗑️  Clearing bucket ${bucketName}`);
        
        // List all objects in the bucket
        let continuationToken: string | undefined;
        let hasMore = true;

        while (hasMore) {
          const listCommand = new ListObjectsV2Command({
            Bucket: bucketName,
            ContinuationToken: continuationToken,
          });

          const listResponse = await s3Client.send(listCommand);
          
          if (listResponse.Contents && listResponse.Contents.length > 0) {
            // Delete objects in batches
            const deleteCommand = new DeleteObjectsCommand({
              Bucket: bucketName,
              Delete: {
                Objects: listResponse.Contents.map(obj => ({ Key: obj.Key })),
                Quiet: false,
              },
            });

            const deleteResponse = await s3Client.send(deleteCommand);
            const deletedCount = deleteResponse.Deleted?.length || 0;
            deletedFiles += deletedCount;
            
            console.log(`  ✓ Deleted ${deletedCount} files from bucket`);

            if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
              deleteResponse.Errors.forEach(err => {
                const errorMsg = `Failed to delete ${err.Key}: ${err.Message}`;
                errors.push(errorMsg);
                console.error(`  ✗ ${errorMsg}`);
              });
            }
          }

          hasMore = listResponse.IsTruncated || false;
          continuationToken = listResponse.NextContinuationToken;
        }

        console.log(`🗑️  Cleared ${deletedFiles} files from bucket ${bucketName}`);
      } catch (error: any) {
        const errorMsg = `Storage reset error: ${error.message}`;
        errors.push(errorMsg);
        console.error(`❌ ${errorMsg}`);
      }

      // Emit WebSocket event
      emitProjectEvent(project.id.toString(), 'project_reset', {
        droppedTables,
        deletedFiles,
        errorCount: errors.length,
      });

      const responseData = {
        droppedTables,
        deletedFiles,
        errorCount: errors.length,
        errors: errors.slice(0, 10), // Return first 10 errors
      };

      if (errors.length === 0) {
        console.log(`✅ Project reset completed successfully`);
        ResponseUtils.success(
          res,
          `Project reset successfully. Dropped ${droppedTables} tables and deleted ${deletedFiles} files.`,
          responseData
        );
      } else {
        console.log(`⚠️  Project reset completed with ${errors.length} errors`);
        ResponseUtils.success(
          res,
          `Project reset completed with warnings. Dropped ${droppedTables} tables, deleted ${deletedFiles} files, ${errors.length} errors occurred.`,
          responseData
        );
      }
    } catch (error) {
      console.error('❌ Error resetting project:', error);
      ResponseUtils.error(res, 'Failed to reset project', error);
    }
  }
}

export default ProjectsController;

