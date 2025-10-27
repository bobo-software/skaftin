import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

interface ApiKey {
  id: number;
  user_id: string;
  project_id: string;
  key_name: string;
  key_hash: string;
  key_prefix: string;
  permissions: any;
  is_active: boolean;
  expires_at?: Date;
  last_used_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface CreateApiKeyInput {
  userId: string;
  projectId: string;
  keyName: string;
  permissions: any;
  expiresAt?: Date;
}

interface ApiKeyWithPlainKey {
  id: number;
  keyName: string;
  plainKey: string; // Only returned once on creation
  keyPrefix: string;
  permissions: any;
  expiresAt?: Date;
  createdAt: Date;
}

export class ApiKeyService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });
  }

  /**
   * Generate a secure API key
   */
  private generateApiKey(): { prefix: string; plainKey: string; hash: string } {
    // Generate a secure random key (64 bytes = 128 hex characters)
    const randomBytes = crypto.randomBytes(64);
    const plainKey = `ska_${randomBytes.toString('hex')}`;
    
    // Store only the last 8 characters as prefix for identification
    const prefix = plainKey.slice(-8);
    
    // Hash the full key for storage
    const saltRounds = 10;
    const hash = bcrypt.hashSync(plainKey, saltRounds);
    
    return { prefix, plainKey, hash };
  }

  /**
   * Create a new API key
   */
  async createApiKey(input: CreateApiKeyInput): Promise<ApiKeyWithPlainKey> {
    const { prefix, plainKey, hash } = this.generateApiKey();
    
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      const result = await client.query(
        `INSERT INTO api_keys (user_id, project_id, key_name, key_hash, key_prefix, permissions, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, key_name, key_prefix, permissions, expires_at, created_at`,
        [input.userId, input.projectId, input.keyName, hash, prefix, JSON.stringify(input.permissions), input.expiresAt]
      );
      
      await client.query('COMMIT');
      
      const row = result.rows[0];
      return {
        id: row.id,
        keyName: row.key_name,
        plainKey, // Return the plain key only once
        keyPrefix: row.key_prefix,
        permissions: row.permissions,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * List all API keys for a user
   */
  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const result = await this.pool.query(
      `SELECT * FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Get an API key by ID
   */
  async getApiKey(id: number, userId: string): Promise<ApiKey | null> {
    const result = await this.pool.query(
      `SELECT * FROM api_keys WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rows[0] || null;
  }

  /**
   * Validate and authenticate an API key
   */
  async validateApiKey(plainKey: string): Promise<ApiKey | null> {
    const client = await this.pool.connect();
    try {
      // Get all active API keys
      const result = await client.query(
        `SELECT * FROM api_keys WHERE is_active = true`
      );
      
      // Try to match the provided key with any stored hash
      for (const key of result.rows) {
        try {
          if (bcrypt.compareSync(plainKey, key.key_hash)) {
            // Update last used timestamp
            await client.query(
              `UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`,
              [key.id]
            );
            
            // Check if expired
            if (key.expires_at && new Date(key.expires_at) < new Date()) {
              return null; // Key has expired
            }
            
            return key;
          }
        } catch (error) {
          // Continue to next key if comparison fails
          continue;
        }
      }
      
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Update API key permissions or metadata
   */
  async updateApiKey(id: number, userId: string, updates: Partial<ApiKey>): Promise<ApiKey> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      
      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;
      
      if (updates.key_name !== undefined) {
        updateFields.push(`key_name = $${paramIndex++}`);
        values.push(updates.key_name);
      }
      if (updates.permissions !== undefined) {
        updateFields.push(`permissions = $${paramIndex++}`);
        values.push(JSON.stringify(updates.permissions));
      }
      if (updates.is_active !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        values.push(updates.is_active);
      }
      if (updates.expires_at !== undefined) {
        updateFields.push(`expires_at = $${paramIndex++}`);
        values.push(updates.expires_at);
      }
      
      values.push(id, userId);
      
      const result = await client.query(
        `UPDATE api_keys 
         SET ${updateFields.join(', ')} 
         WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
         RETURNING *`,
        values
      );
      
      if (result.rows.length === 0) {
        throw new Error('API key not found or access denied');
      }
      
      await client.query('COMMIT');
      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete/Revoke an API key
   */
  async deleteApiKey(id: number, userId: string): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM api_keys WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    return result.rowCount !== undefined && result?.rowCount !== null && result?.rowCount > 0;
  }

  /**
   * Get usage statistics for an API key
   */
  async getApiKeyStats(id: number, userId: string, days: number = 30): Promise<any> {
    // Verify ownership
    const key = await this.getApiKey(id, userId);
    if (!key) {
      throw new Error('API key not found or access denied');
    }
    
    const result = await this.pool.query(
      `SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
        COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
        AVG(response_time) as avg_response_time,
        MAX(response_time) as max_response_time
       FROM api_key_usage
       WHERE api_key_id = $1 
       AND created_at >= NOW() - INTERVAL '${days} days'`,
      [id]
    );
    
    return result.rows[0];
  }

  /**
   * Track API key usage
   */
  async trackUsage(apiKeyId: number, endpoint: string, method: string, statusCode: number, responseTime: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO api_key_usage (api_key_id, endpoint, method, status_code, response_time)
       VALUES ($1, $2, $3, $4, $5)`,
      [apiKeyId, endpoint, method, statusCode, responseTime]
    );
  }

  /**
   * Clean up expired keys (can be run as a cron job)
   */
  async cleanupExpiredKeys(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE api_keys SET is_active = false WHERE expires_at < NOW() AND is_active = true`
    );
    return result.rowCount || 0;
  }
}

export default new ApiKeyService();
