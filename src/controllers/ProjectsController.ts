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
import { DatabaseInitializer } from '../services/DatabaseInitializer';

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

/** Strip encryption key from project before sending to client; add field_encryption_key_set indicator */
function sanitizeProjectForResponse(project: Record<string, unknown>): Record<string, unknown> {
  const { field_encryption_key, ...rest } = project;
  return {
    ...rest,
    field_encryption_key_set: Boolean(field_encryption_key && String(field_encryption_key).trim() !== ''),
  };
}

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
        FROM skaftin_system_projects p
        INNER JOIN skaftin_system_project_members pm ON p.id = pm.project_id
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

      const results = Array.from(projectMap.values()) as Record<string, unknown>[];
      const sanitized = results.map((p) => sanitizeProjectForResponse(p));

      ResponseUtils.success(res, 'Projects fetched successfully', sanitized);
    } catch (error) {
      console.error('Error fetching projects:', error);
      ResponseUtils.error(res, 'Failed to fetch projects', error);
    }
  }

  // Get user dashboard statistics (aggregated across all projects)
  static async getUserDashboardStats(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const userId = req.user.userId;

      // Get all projects the user has access to (same logic as getAllProjects)
      const userProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.user_id, userId));

      const orgProjects = await db.execute(sql`
        SELECT DISTINCT p.* 
        FROM skaftin_system_projects p
        INNER JOIN skaftin_system_organizations o ON p.organization_id = o.id
        INNER JOIN skaftin_system_organization_members om ON o.id = om.organization_id
        WHERE om.user_id = ${userId}
        ORDER BY p.created_at
      `);

      const memberProjects = await db.execute(sql`
        SELECT DISTINCT p.* 
        FROM skaftin_system_projects p
        INNER JOIN skaftin_system_project_members pm ON p.id = pm.project_id
        WHERE pm.user_id = ${userId}
        ORDER BY p.created_at
      `);

      const projectMap = new Map();
      [...userProjects, ...(orgProjects.rows as any[]), ...(memberProjects.rows as any[])].forEach((project) => {
        if (!projectMap.has(project.id)) {
          projectMap.set(project.id, project);
        }
      });

      const allProjects = Array.from(projectMap.values()) as any[];

      // Aggregate statistics
      let totalProjects = allProjects.length;
      let totalTables = 0;
      let totalFiles = 0;
      let totalApiCalls = 0;

      // Get stats for each project
      for (const project of allProjects) {
        try {
          // Get table count
          const client = await ProjectsController.pool.connect();
          try {
            await client.query(`SET search_path TO ${project.schema_name}, public`);
            const tableResult = await client.query(`
              SELECT COUNT(*) as count
              FROM information_schema.tables
              WHERE table_schema = $1
                AND table_type = 'BASE TABLE'
                AND table_name NOT LIKE 'skaftin_system_%'
            `, [project.schema_name]);
            totalTables += parseInt(tableResult.rows[0]?.count || '0', 10);
          } finally {
            client.release();
          }
        } catch (error) {
          // Continue if error
        }

        try {
          // Get file count from all buckets for this project
          const client = await ProjectsController.pool.connect();
          let buckets: { bucket_name: string }[] = [];

          try {
            // Get all buckets for the project
            const bucketsResult = await client.query(
              'SELECT bucket_name FROM skaftin_system_project_buckets WHERE project_id = $1',
              [project.id]
            );
            buckets = bucketsResult.rows;
          } finally {
            client.release();
          }

          // Count files in each bucket
          for (const bucket of buckets) {
            try {
              const command = new ListObjectsV2Command({
                Bucket: bucket.bucket_name,
              });
              const response = await s3Client.send(command);
              let bucketFileCount = response.KeyCount || (response.Contents?.length || 0);

              if (response.IsTruncated) {
                let continuationToken = response.NextContinuationToken;
                while (continuationToken) {
                  const nextCommand = new ListObjectsV2Command({
                    Bucket: bucket.bucket_name,
                    ContinuationToken: continuationToken,
                  });
                  const nextResponse = await s3Client.send(nextCommand);
                  bucketFileCount += nextResponse.KeyCount || (nextResponse.Contents?.length || 0);
                  continuationToken = nextResponse.NextContinuationToken;
                }
              }
              totalFiles += bucketFileCount;
            } catch (error: any) {
              // Continue if bucket doesn't exist
            }
          }
        } catch (error: any) {
          // Continue if error fetching buckets
        }

        try {
          // Get API call count (only app-api routes)
          const apiResult = await ProjectsController.pool.query(`
            SELECT COUNT(*) as count
            FROM public.skaftin_system_api_metrics
            WHERE project_id = $1
              AND endpoint LIKE '/app-api/%'
          `, [project.id]);
          totalApiCalls += parseInt(apiResult.rows[0]?.count || '0', 10);
        } catch (error) {
          // Continue if error
        }
      }

      const stats = {
        totalProjects,
        totalTables,
        totalFiles,
        totalApiCalls,
      };

      ResponseUtils.success(res, 'Dashboard statistics fetched successfully', stats);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      ResponseUtils.error(res, 'Failed to fetch dashboard statistics', error);
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

      ResponseUtils.success(res, 'Project fetched successfully', sanitizeProjectForResponse(result[0] as unknown as Record<string, unknown>));
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

      // Get table count from project schema
      let tableCount = 0;
      try {
        const client = await ProjectsController.pool.connect();
        try {
          await client.query(`SET search_path TO ${project.schema_name}, public`);
          const tableResult = await client.query(`
            SELECT COUNT(*) as count
            FROM information_schema.tables
            WHERE table_schema = $1
              AND table_type = 'BASE TABLE'
          `, [project.schema_name]);
          tableCount = parseInt(tableResult.rows[0]?.count || '0', 10);
        } finally {
          client.release();
        }
      } catch (error) {
        console.error('Error fetching table count:', error);
        // Continue with 0 if there's an error
      }

      // Get file count from all MinIO buckets for this project
      let fileCount = 0;
      try {
        const client = await ProjectsController.pool.connect();
        let buckets: { bucket_name: string }[] = [];

        try {
          // Get all buckets for the project
          const bucketsResult = await client.query(
            'SELECT bucket_name FROM skaftin_system_project_buckets WHERE project_id = $1',
            [projectId]
          );
          buckets = bucketsResult.rows;
        } finally {
          client.release();
        }

        // Count files in each bucket
        for (const bucket of buckets) {
          try {
            const command = new ListObjectsV2Command({
              Bucket: bucket.bucket_name,
            });
            const response = await s3Client.send(command);
            let bucketFileCount = response.KeyCount || (response.Contents?.length || 0);

            // If there are more files, count all of them
            if (response.IsTruncated) {
              let continuationToken = response.NextContinuationToken;
              while (continuationToken) {
                const nextCommand = new ListObjectsV2Command({
                  Bucket: bucket.bucket_name,
                  ContinuationToken: continuationToken,
                });
                const nextResponse = await s3Client.send(nextCommand);
                bucketFileCount += nextResponse.KeyCount || (nextResponse.Contents?.length || 0);
                continuationToken = nextResponse.NextContinuationToken;
              }
            }

            fileCount += bucketFileCount;
          } catch (error: any) {
            if (error.name !== 'NoSuchBucket') {
              console.error(`Error fetching file count for bucket ${bucket.bucket_name}:`, error);
            }
            // Continue with 0 if bucket doesn't exist or there's an error
          }
        }
      } catch (error: any) {
        console.error('Error fetching buckets for file count:', error);
        // Continue with 0 if there's an error
      }

      // Get API call count from api_metrics table (only app-api routes)
      let apiCalls = 0;
      try {
        const apiResult = await ProjectsController.pool.query(`
          SELECT COUNT(*) as count
          FROM public.skaftin_system_api_metrics
          WHERE project_id = $1
            AND endpoint LIKE '/app-api/%'
        `, [projectId]);
        apiCalls = parseInt(apiResult.rows[0]?.count || '0', 10);
      } catch (error) {
        console.error('Error fetching API call count:', error);
        // Continue with 0 if there's an error
      }

      const stats = {
        projectId: project.id,
        projectName: project.name,
        tableCount,
        fileCount,
        apiCalls,
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

      // Generate unique schema name
      const timestamp = Date.now();
      const sanitizedName = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
      const schemaName = `project_${sanitizedName}_${timestamp}`;

      // Create project in database
      const result = await db
        .insert(projects)
        .values({
          name: name.trim(),
          description: description?.trim() || null,
          organization_id: organization_id,
          user_id: userId, // Store creator for audit purposes
          schema_name: schemaName,
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

      // Initialize auth tables for the new project
      try {
        const dbInitializer = new DatabaseInitializer(ProjectsController.pool);
        await dbInitializer.initializeProjectAuthTables(schemaName, newProject.id);
        console.log(`✅ Initialized auth tables for project: ${schemaName}`);
      } catch (authError) {
        console.error('❌ Error initializing auth tables:', authError);
        // Continue even if auth table creation fails
      }

      // Create default auth settings for the project
      try {
        await db.execute(sql`
          INSERT INTO public.skaftin_system_auth_settings (project_id, allow_duplicate_emails, registration_enabled, auth_enabled)
          VALUES (${newProject.id}, false, true, true)
          ON CONFLICT (project_id) DO NOTHING
        `);
        console.log(`✅ Created default auth settings for project: ${newProject.id}`);
      } catch (authSettingsError) {
        console.error('❌ Error creating auth settings:', authSettingsError);
        // Continue even if auth settings creation fails
      }

      // Note: Buckets are now created manually via ProjectBucketsController
      // Projects start with no buckets

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
      const { name, description, field_encryption_key } = req.body;

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

      if (field_encryption_key !== undefined) {
        updateData.field_encryption_key = field_encryption_key === '' || field_encryption_key === null ? null : String(field_encryption_key);
      }

      const result = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, parseInt(id)))
        .returning();

      const project = result[0] as unknown as Record<string, unknown>;
      // Emit WebSocket event (sanitized)
      emitProjectEvent(project.id as string, 'project_updated', sanitizeProjectForResponse(project));

      ResponseUtils.success(res, 'Project updated successfully', sanitizeProjectForResponse(project));
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

      // 2. Delete all files from all MinIO buckets for this project
      try {
        const client = await ProjectsController.pool.connect();
        let buckets: { bucket_name: string }[] = [];

        try {
          // Get all buckets for the project
          const bucketsResult = await client.query(
            'SELECT bucket_name FROM skaftin_system_project_buckets WHERE project_id = $1',
            [projectId]
          );
          buckets = bucketsResult.rows;
        } finally {
          client.release();
        }

        if (buckets.length === 0) {
          console.log(`📦 No buckets found for project ${projectId}`);
        } else {
          console.log(`📦 Found ${buckets.length} bucket(s) to clear`);

          // Clear each bucket
          for (const bucket of buckets) {
            const bucketName = bucket.bucket_name;
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

                  console.log(`  ✓ Deleted ${deletedCount} files from bucket ${bucketName}`);

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
              const errorMsg = `Storage reset error for bucket ${bucketName}: ${error.message}`;
              errors.push(errorMsg);
              console.error(`❌ ${errorMsg}`);
            }
          }
        }
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

