import { Request, Response } from 'express';
import { Pool } from 'pg';
import crypto from 'crypto';

interface ApiCredential {
  id?: number;
  project_id: number;
  name: string;
  credential_type: 'api_key' | 'access_token' | 'mcp_key';
  token: string;
  permissions: string[];
  is_active: boolean;
  last_used_at?: Date;
  created_by: string;
  created_at?: Date;
  expires_at?: Date;
}

// Available permissions
export const AVAILABLE_PERMISSIONS = {
  database: ['database:read', 'database:write', 'database:delete'],
  storage: ['storage:read', 'storage:write', 'storage:delete'],
  communications: ['communications:send', 'communications:manage'],
  projects: ['projects:read', 'projects:write'],
  invitations: ['invitations:send', 'invitations:manage'],
  mcp: ['mcp:full_access'], // MCP keys have full access
};

class CredentialsController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): string {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Generate a secure access token
   */
  private generateAccessToken(): string {
    return `sat_${crypto.randomBytes(40).toString('hex')}`;
  }

  /**
   * Generate a secure MCP key
   */
  private generateMcpKey(): string {
    return `mcp_${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * List all credentials for a project
   */
  listCredentials = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      const query = `
        SELECT id, project_id, name, credential_type, token, permissions, 
               is_active, last_used_at, created_by, created_at, expires_at
        FROM skaftin_system_api_credentials
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [projectId]);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error listing credentials:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list credentials',
        message: error.message,
      });
    }
  };

  /**
   * Get available permissions
   */
  getAvailablePermissions = async (req: Request, res: Response): Promise<void> => {
    try {
      res.json({
        success: true,
        data: AVAILABLE_PERMISSIONS,
      });
    } catch (error: any) {
      console.error('Error getting permissions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get permissions',
        message: error.message,
      });
    }
  };

  /**
   * Create new API credential
   */
  createCredential = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { name, credential_type, permissions = [], expires_in_days } = req.body;
      const createdBy = (req as any).user?.userId;

      console.log('🔑 [createCredential] Creating new credential');
      console.log('  └─ projectId:', projectId);
      console.log('  └─ name:', name);
      console.log('  └─ type:', credential_type);
      console.log('  └─ permissions:', permissions);

      // Validate required fields
      if (!name || !credential_type) {
        res.status(400).json({
          success: false,
          error: 'Name and credential_type are required',
        });
        return;
      }

      // Validate credential type
      if (!['api_key', 'access_token', 'mcp_key'].includes(credential_type)) {
        res.status(400).json({
          success: false,
          error: 'Invalid credential_type. Must be api_key, access_token, or mcp_key',
        });
        return;
      }

      // For MCP keys, check if one already exists
      if (credential_type === 'mcp_key') {
        const existingMcpKey = await this.pool.query(
          'SELECT id FROM api_credentials WHERE project_id = $1 AND credential_type = $2',
          [projectId, 'mcp_key']
        );
        
        if (existingMcpKey.rows.length > 0) {
          res.status(409).json({
            success: false,
            error: 'An MCP key already exists for this project. Please regenerate it instead.',
          });
          return;
        }
      }

      // Generate token based on type
      let token: string;
      if (credential_type === 'api_key') {
        token = this.generateApiKey();
      } else if (credential_type === 'access_token') {
        token = this.generateAccessToken();
      } else {
        token = this.generateMcpKey();
      }

      // Calculate expiration if specified
      let expiresAt = null;
      if (expires_in_days) {
        expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expires_in_days);
      }

      const query = `
        INSERT INTO skaftin_system_api_credentials 
        (project_id, name, credential_type, token, permissions, created_by, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id, project_id, name, credential_type, token, permissions, 
                  is_active, last_used_at, created_by, created_at, expires_at
      `;

      const result = await this.pool.query(query, [
        projectId,
        name,
        credential_type,
        token,
        JSON.stringify(permissions),
        createdBy,
        expiresAt,
      ]);

      console.log('  └─ ✅ Credential created:', result.rows[0].id);

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Credential created successfully',
      });
    } catch (error: any) {
      console.error('Error creating credential:', error);
      
      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'Credential with this name already exists',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create credential',
        message: error.message,
      });
    }
  };

  /**
   * Update credential permissions
   */
  updateCredential = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, credentialId } = req.params;
      const { name, permissions, is_active } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (permissions !== undefined) {
        updates.push(`permissions = $${paramIndex++}`);
        values.push(JSON.stringify(permissions));
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIndex++}`);
        values.push(is_active);
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update',
        });
        return;
      }

      values.push(credentialId, projectId);

      const query = `
        UPDATE skaftin_system_api_credentials
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND project_id = $${paramIndex++}
        RETURNING id, project_id, name, credential_type, token, permissions, 
                  is_active, last_used_at, created_by, created_at, expires_at
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Credential not found',
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Credential updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating credential:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update credential',
        message: error.message,
      });
    }
  };

  /**
   * Delete/revoke credential
   */
  deleteCredential = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, credentialId } = req.params;

      const query = `
        DELETE FROM skaftin_system_api_credentials
        WHERE id = $1 AND project_id = $2
        RETURNING id
      `;

      const result = await this.pool.query(query, [credentialId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Credential not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Credential revoked successfully',
      });
    } catch (error: any) {
      console.error('Error deleting credential:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke credential',
        message: error.message,
      });
    }
  };

  /**
   * Get MCP key for a project
   * GET /api/credentials/:projectId/mcp-key
   */
  getMcpKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      const query = `
        SELECT id, project_id, name, credential_type, token, permissions, 
               is_active, last_used_at, created_by, created_at, expires_at
        FROM skaftin_system_api_credentials
        WHERE project_id = $1 AND credential_type = 'mcp_key'
      `;

      const result = await this.pool.query(query, [projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'No MCP key found for this project',
          data: null,
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error getting MCP key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get MCP key',
        message: error.message,
      });
    }
  };

  /**
   * Regenerate MCP key for a project
   * POST /api/credentials/:projectId/mcp-key/regenerate
   */
  regenerateMcpKey = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const createdBy = (req as any).user?.userId;

      console.log('🔄 [regenerateMcpKey] Regenerating MCP key for project:', projectId);

      // Check if MCP key exists
      const existingQuery = `
        SELECT id FROM api_credentials
        WHERE project_id = $1 AND credential_type = 'mcp_key'
      `;

      const existing = await this.pool.query(existingQuery, [projectId]);

      const newToken = this.generateMcpKey();

      if (existing.rows.length > 0) {
        // Update existing key
        const updateQuery = `
          UPDATE skaftin_system_api_credentials
          SET token = $1, created_at = CURRENT_TIMESTAMP, last_used_at = NULL
          WHERE project_id = $2 AND credential_type = 'mcp_key'
          RETURNING id, project_id, name, credential_type, token, permissions, 
                    is_active, last_used_at, created_by, created_at, expires_at
        `;

        const result = await this.pool.query(updateQuery, [newToken, projectId]);

        console.log('  └─ ✅ MCP key regenerated');

        res.json({
          success: true,
          data: result.rows[0],
          message: 'MCP key regenerated successfully',
        });
      } else {
        // Create new MCP key
        const insertQuery = `
          INSERT INTO skaftin_system_api_credentials 
          (project_id, name, credential_type, token, permissions, created_by)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id, project_id, name, credential_type, token, permissions, 
                    is_active, last_used_at, created_by, created_at, expires_at
        `;

        const result = await this.pool.query(insertQuery, [
          projectId,
          'MCP Integration Key',
          'mcp_key',
          newToken,
          JSON.stringify(['mcp:full_access']),
          createdBy,
        ]);

        console.log('  └─ ✅ MCP key created');

        res.status(201).json({
          success: true,
          data: result.rows[0],
          message: 'MCP key created successfully',
        });
      }
    } catch (error: any) {
      console.error('Error regenerating MCP key:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to regenerate MCP key',
        message: error.message,
      });
    }
  };

  /**
   * Update last used timestamp (called by API key middleware)
   */
  static async updateLastUsed(pool: Pool, token: string): Promise<void> {
    try {
      await pool.query(
        'UPDATE skaftin_system_api_credentials SET last_used_at = CURRENT_TIMESTAMP WHERE token = $1',
        [token]
      );
    } catch (error) {
      console.error('Error updating last_used_at:', error);
    }
  }

  /**
   * Verify API credential and check permissions
   */
  static async verifyCredential(
    pool: Pool,
    token: string,
    requiredPermission?: string
  ): Promise<{ valid: boolean; credential?: ApiCredential; error?: string }> {
    try {
      const query = `
        SELECT id, project_id, name, credential_type, token, permissions, 
               is_active, expires_at, created_at
        FROM api_credentials
        WHERE token = $1
      `;

      const result = await pool.query(query, [token]);

      if (result.rows.length === 0) {
        return { valid: false, error: 'Invalid credential' };
      }

      const credential = result.rows[0];

      // Check if active
      if (!credential.is_active) {
        return { valid: false, error: 'Credential is inactive' };
      }

      // Check if expired
      if (credential.expires_at && new Date(credential.expires_at) < new Date()) {
        return { valid: false, error: 'Credential has expired' };
      }

      // Check permission if required
      if (requiredPermission) {
        const permissions = credential.permissions || [];
        if (!permissions.includes(requiredPermission)) {
          return { valid: false, error: 'Insufficient permissions' };
        }
      }

      // Update last used
      await CredentialsController.updateLastUsed(pool, token);

      return { valid: true, credential };
    } catch (error: any) {
      console.error('Error verifying credential:', error);
      return { valid: false, error: 'Verification failed' };
    }
  }
}

export default CredentialsController;

