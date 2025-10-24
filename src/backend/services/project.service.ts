import { pool } from '../db/connection';

export class ProjectService {
  constructor() {
    // Storage service will be initialized when needed
  }

  async createProject(userId: string, name: string, description?: string): Promise<any> {
    try {
      const schemaName = `project_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
      const bucketName = `project-${name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

      // Create database schema
      await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
      
      // Create MinIO bucket (placeholder - will be implemented later)
      console.log(`Creating bucket: ${bucketName}`);

      // Insert project record
      const query = `
        INSERT INTO platform.projects (user_id, name, description, schema_name, bucket_name)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `;
      const result = await pool.query(query, [userId, name, description, schemaName, bucketName]);
      
      return result.rows[0];
    } catch (error) {
      console.error('Error creating project:', error);
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getUserProjects(userId: string): Promise<any[]> {
    try {
      const query = `
        SELECT * FROM platform.projects 
        WHERE user_id = $1 
        ORDER BY created_at DESC
      `;
      const result = await pool.query(query, [userId]);
      return result.rows;
    } catch (error) {
      console.error('Error getting user projects:', error);
      throw new Error(`Failed to get projects: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getProject(projectId: string): Promise<any> {
    try {
      const query = 'SELECT * FROM platform.projects WHERE id = $1';
      const result = await pool.query(query, [projectId]);
      
      if (result.rows.length === 0) {
        throw new Error('Project not found');
      }
      
      return result.rows[0];
    } catch (error) {
      console.error('Error getting project:', error);
      throw new Error(`Failed to get project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateProject(projectId: string, updates: any): Promise<any> {
    try {
      const allowedUpdates = ['name', 'description'];
      const updateFields = Object.keys(updates).filter(key => allowedUpdates.includes(key));
      
      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }
      
      const setClause = updateFields.map((field, index) => `${field} = $${index + 2}`).join(', ');
      const values = [projectId, ...updateFields.map(field => updates[field])];
      
      const query = `
        UPDATE platform.projects 
        SET ${setClause}, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;
      
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error updating project:', error);
      throw new Error(`Failed to update project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      const project = await this.getProject(projectId);
      
      // Drop database schema
      await pool.query(`DROP SCHEMA IF EXISTS ${project.schema_name} CASCADE`);
      
      // Delete MinIO bucket (this would need to be implemented in StorageService)
      // await this.storageService.deleteBucket(project.bucket_name);
      
      // Delete project record
      const query = 'DELETE FROM platform.projects WHERE id = $1';
      await pool.query(query, [projectId]);
    } catch (error) {
      console.error('Error deleting project:', error);
      throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async createBucket(bucketName: string): Promise<void> {
    try {
      // This is a placeholder - the actual implementation would be in StorageService
      console.log(`Creating bucket: ${bucketName}`);
    } catch (error) {
      console.error('Error creating bucket:', error);
      throw new Error(`Failed to create bucket: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
