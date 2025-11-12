import { Pool, PoolClient } from 'pg';
import { deleteUser, listUsersByAccountInfo } from 'supertokens-node';
import EmailPassword from 'supertokens-node/recipe/emailpassword';
import bcrypt from 'bcrypt';

/**
 * Utility functions for authentication operations
 * Provides transaction-safe operations and proper cleanup
 */

export interface CleanupResult {
  success: boolean;
  deletedFromSuperTokens: boolean;
  deletedFromAppUsers: boolean;
  deletedRoleAssignments: number;
  errors: string[];
}

export class AuthUtils {
  /**
   * Completely remove a user from SuperTokens and all project databases
   * This is a destructive operation that should be used carefully
   */
  static async completeUserCleanup(
    pool: Pool,
    email: string,
    projectId?: number
  ): Promise<CleanupResult> {
    const result: CleanupResult = {
      success: true,
      deletedFromSuperTokens: false,
      deletedFromAppUsers: false,
      deletedRoleAssignments: 0,
      errors: [],
    };

    try {
      // 1. Find user in SuperTokens
      const superTokensUsers = await listUsersByAccountInfo('public', { email });
      
      if (superTokensUsers.length > 0) {
        for (const user of superTokensUsers) {
          try {
            await deleteUser(user.id);
            result.deletedFromSuperTokens = true;
            console.log(`✅ Deleted SuperTokens user: ${user.id} (${email})`);
          } catch (error: any) {
            result.errors.push(`Failed to delete SuperTokens user ${user.id}: ${error.message}`);
            result.success = false;
          }
        }
      }

      // 2. Delete from app_users tables (either specific project or all)
      if (projectId) {
        // Delete from specific project only
        const schemaResult = await pool.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [projectId]
        );
        
        if (schemaResult.rows.length > 0) {
          const schemaName = schemaResult.rows[0].schema_name;
          const deleteResult = await this.deleteUserFromProjectSchema(pool, schemaName, email);
          result.deletedFromAppUsers = deleteResult.deletedUser;
          result.deletedRoleAssignments = deleteResult.deletedRoleAssignments;
          if (deleteResult.error) {
            result.errors.push(deleteResult.error);
          }
        }
      } else {
        // Delete from all projects
        const schemasResult = await pool.query(
          `SELECT schema_name FROM information_schema.schemata 
           WHERE schema_name LIKE 'project_%'`
        );

        for (const row of schemasResult.rows) {
          const schemaName = row.schema_name;
          const deleteResult = await this.deleteUserFromProjectSchema(pool, schemaName, email);
          if (deleteResult.deletedUser) {
            result.deletedFromAppUsers = true;
          }
          result.deletedRoleAssignments += deleteResult.deletedRoleAssignments;
          if (deleteResult.error) {
            result.errors.push(deleteResult.error);
          }
        }
      }

      if (result.errors.length > 0) {
        result.success = false;
      }

      return result;
    } catch (error: any) {
      result.success = false;
      result.errors.push(`Cleanup failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Delete user from a specific project schema
   */
  private static async deleteUserFromProjectSchema(
    pool: Pool,
    schemaName: string,
    email: string
  ): Promise<{ deletedUser: boolean; deletedRoleAssignments: number; error?: string }> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if user exists
      const userCheck = await client.query(
        `SELECT id FROM ${schemaName}.app_users WHERE email = $1`,
        [email]
      );

      if (userCheck.rows.length === 0) {
        await client.query('COMMIT');
        return { deletedUser: false, deletedRoleAssignments: 0 };
      }

      const userId = userCheck.rows[0].id;

      // Delete role assignments
      const roleDeleteResult = await client.query(
        `DELETE FROM ${schemaName}.app_user_roles WHERE app_user_id = $1`,
        [userId]
      );

      // Delete user
      await client.query(
        `DELETE FROM ${schemaName}.app_users WHERE id = $1`,
        [userId]
      );

      await client.query('COMMIT');
      console.log(`✅ Deleted user from ${schemaName}: ${email}`);

      return {
        deletedUser: true,
        deletedRoleAssignments: roleDeleteResult.rowCount || 0,
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      return {
        deletedUser: false,
        deletedRoleAssignments: 0,
        error: `Failed to delete from ${schemaName}: ${error.message}`,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Create a user with transaction safety
   * Ensures that if any step fails, everything is rolled back
   */
  static async createUserWithTransaction(
    pool: Pool,
    schemaName: string,
    userData: {
      name: string;
      email: string;
      password: string;
      phone?: string;
      metadata?: any;
      role_ids?: number[];
    },
    createInSuperTokens: boolean = true
  ): Promise<{
    success: boolean;
    user?: any;
    superTokensUserId?: string;
    error?: string;
  }> {
    const client = await pool.connect();
    let superTokensUserId: string | undefined;

    try {
      await client.query('BEGIN');

      // 1. Create in SuperTokens if requested
      if (createInSuperTokens) {
        try {
          const signUpResponse = await EmailPassword.signUp('public', userData.email, userData.password);
          
          if (signUpResponse.status === 'OK') {
            superTokensUserId = signUpResponse.user.id;
          } else if (signUpResponse.status === 'EMAIL_ALREADY_EXISTS_ERROR') {
            await client.query('ROLLBACK');
            return {
              success: false,
              error: 'Email already exists in SuperTokens',
            };
          }
        } catch (stError: any) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: `SuperTokens error: ${stError.message}`,
          };
        }
      }

      // 2. Hash password if not using SuperTokens
      let hashedPassword: string | null = null;
      if (!createInSuperTokens && userData.password) {
        hashedPassword = await bcrypt.hash(userData.password, 10);
      }

      // 3. Create in app_users table
      const insertQuery = `
        INSERT INTO ${schemaName}.app_users 
        (supertokens_user_id, name, email, password, phone, metadata, is_active, email_verified, phone_verified)
        VALUES ($1, $2, $3, $4, $5, $6, true, false, false)
        RETURNING *
      `;

      const userResult = await client.query(insertQuery, [
        superTokensUserId || null,
        userData.name,
        userData.email,
        hashedPassword,
        userData.phone || null,
        JSON.stringify(userData.metadata || {}),
      ]);

      const newUser = userResult.rows[0];

      // 4. Assign roles if provided
      if (userData.role_ids && userData.role_ids.length > 0) {
        for (const roleId of userData.role_ids) {
          await client.query(
            `INSERT INTO ${schemaName}.app_user_roles (app_user_id, role_id)
             VALUES ($1, $2)
             ON CONFLICT (app_user_id, role_id) DO NOTHING`,
            [newUser.id, roleId]
          );
        }
      }

      await client.query('COMMIT');

      return {
        success: true,
        user: newUser,
        superTokensUserId,
      };
    } catch (error: any) {
      await client.query('ROLLBACK');

      // If we created in SuperTokens but database failed, clean up SuperTokens
      if (superTokensUserId) {
        try {
          await deleteUser(superTokensUserId);
          console.log(`🧹 Cleaned up SuperTokens user after failed database insert: ${superTokensUserId}`);
        } catch (cleanupError) {
          console.error('Failed to cleanup SuperTokens user:', cleanupError);
        }
      }

      return {
        success: false,
        error: `Database error: ${error.message}`,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Delete a user with transaction safety and cascade cleanup
   */
  static async deleteUserWithTransaction(
    pool: Pool,
    schemaName: string,
    userId: number,
    permanent: boolean = true
  ): Promise<{
    success: boolean;
    deletedFromSuperTokens: boolean;
    error?: string;
  }> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Get user info
      const userResult = await client.query(
        `SELECT * FROM ${schemaName}.app_users WHERE id = $1`,
        [userId]
      );

      if (userResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          deletedFromSuperTokens: false,
          error: 'User not found',
        };
      }

      const user = userResult.rows[0];
      let deletedFromSuperTokens = false;

      if (permanent) {
        // 2. Delete role assignments
        await client.query(
          `DELETE FROM ${schemaName}.app_user_roles WHERE app_user_id = $1`,
          [userId]
        );

        // 3. Delete user from database
        await client.query(
          `DELETE FROM ${schemaName}.app_users WHERE id = $1`,
          [userId]
        );

        // 4. Delete from SuperTokens if they have an ID
        if (user.supertokens_user_id) {
          try {
            await deleteUser(user.supertokens_user_id);
            deletedFromSuperTokens = true;
            console.log(`✅ Deleted SuperTokens user: ${user.supertokens_user_id}`);
          } catch (stError: any) {
            console.error('Error deleting SuperTokens user:', stError);
            // Continue anyway - user is gone from database
          }
        }
      } else {
        // Soft delete
        await client.query(
          `UPDATE ${schemaName}.app_users 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP 
           WHERE id = $1`,
          [userId]
        );
      }

      await client.query('COMMIT');

      return {
        success: true,
        deletedFromSuperTokens,
      };
    } catch (error: any) {
      await client.query('ROLLBACK');
      return {
        success: false,
        deletedFromSuperTokens: false,
        error: `Delete failed: ${error.message}`,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Check if email exists in SuperTokens
   */
  static async emailExistsInSuperTokens(email: string): Promise<boolean> {
    try {
      const users = await listUsersByAccountInfo('public', { email });
      return users.length > 0;
    } catch (error) {
      console.error('Error checking SuperTokens email:', error);
      return false;
    }
  }

  /**
   * Check if email exists in project's app_users
   */
  static async emailExistsInProject(
    pool: Pool,
    schemaName: string,
    email: string,
    excludeUserId?: number
  ): Promise<boolean> {
    try {
      let query = `SELECT id FROM ${schemaName}.app_users WHERE email = $1`;
      const params: any[] = [email];

      if (excludeUserId) {
        query += ` AND id != $2`;
        params.push(excludeUserId);
      }

      const result = await pool.query(query, params);
      return result.rows.length > 0;
    } catch (error) {
      console.error('Error checking project email:', error);
      return false;
    }
  }

  /**
   * Validate email format
   */
  static isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  static isValidPassword(password: string): { valid: boolean; message?: string } {
    if (password.length < 8) {
      return { valid: false, message: 'Password must be at least 8 characters long' };
    }
    
    // Check for at least one number
    if (!/\d/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    
    // Check for at least one letter
    if (!/[a-zA-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one letter' };
    }

    return { valid: true };
  }

  /**
   * Sanitize metadata to prevent injection
   */
  static sanitizeMetadata(metadata: any): any {
    if (!metadata || typeof metadata !== 'object') {
      return {};
    }

    const sanitized: any = {};
    for (const [key, value] of Object.entries(metadata)) {
      // Only allow certain types
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null
      ) {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        // Allow arrays of primitives
        sanitized[key] = value.filter(
          (item) =>
            typeof item === 'string' ||
            typeof item === 'number' ||
            typeof item === 'boolean'
        );
      }
    }
    return sanitized;
  }
}

