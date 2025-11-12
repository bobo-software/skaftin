import { Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';
import crypto from 'crypto';

interface AuthSettings {
  id: number;
  project_id: number;
  allow_duplicate_emails: boolean;
  require_email_verification: boolean;
  require_phone_verification: boolean;
  enable_password_reset: boolean;
  enable_mfa: boolean;
  registration_enabled: boolean;
  auth_enabled: boolean;
  default_role_id?: number;
  email_provider_id?: number;
  sms_provider_id?: number;
  settings_json: any;
  created_at: Date;
  updated_at: Date;
}

interface UpdateAuthSettingsRequest {
  allow_duplicate_emails?: boolean;
  require_email_verification?: boolean;
  require_phone_verification?: boolean;
  enable_password_reset?: boolean;
  enable_mfa?: boolean;
  registration_enabled?: boolean;
  auth_enabled?: boolean;
  default_role_id?: number;
  email_provider_id?: number;
  sms_provider_id?: number;
  settings_json?: any;
}

interface VerificationToken {
  token: string;
  expires_at: Date;
}

class AuthSettingsController {
  private static pool: Pool;

  static initialize(pool: Pool) {
    AuthSettingsController.pool = pool;
  }

  /**
   * Get auth settings for a project
   * GET /api/auth/:projectId/settings
   */
  static async getAuthSettings(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;

      const result = await AuthSettingsController.pool.query(
        'SELECT * FROM auth_settings WHERE project_id = $1',
        [parseInt(projectId)]
      );

      if (result.rows.length === 0) {
        // Create default settings if they don't exist
        const createResult = await AuthSettingsController.pool.query(
          `INSERT INTO auth_settings (project_id, allow_duplicate_emails, registration_enabled, auth_enabled)
           VALUES ($1, false, true, true)
           RETURNING *`,
          [parseInt(projectId)]
        );

        return ResponseUtils.success(res, 'Auth settings created', createResult.rows[0], 201);
      }

      ResponseUtils.success(res, 'Auth settings fetched successfully', result.rows[0]);
    } catch (error) {
      console.error('Error fetching auth settings:', error);
      ResponseUtils.error(res, 'Failed to fetch auth settings', error);
    }
  }

  /**
   * Update auth settings for a project
   * PUT /api/auth/:projectId/settings
   */
  static async updateAuthSettings(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;
      const updates: UpdateAuthSettingsRequest = req.body;

      // Build update query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.allow_duplicate_emails !== undefined) {
        updateFields.push(`allow_duplicate_emails = $${paramIndex++}`);
        values.push(updates.allow_duplicate_emails);
      }

      if (updates.require_email_verification !== undefined) {
        updateFields.push(`require_email_verification = $${paramIndex++}`);
        values.push(updates.require_email_verification);
      }

      if (updates.require_phone_verification !== undefined) {
        updateFields.push(`require_phone_verification = $${paramIndex++}`);
        values.push(updates.require_phone_verification);
      }

      if (updates.enable_password_reset !== undefined) {
        updateFields.push(`enable_password_reset = $${paramIndex++}`);
        values.push(updates.enable_password_reset);
      }

      if (updates.enable_mfa !== undefined) {
        updateFields.push(`enable_mfa = $${paramIndex++}`);
        values.push(updates.enable_mfa);
      }

      if (updates.registration_enabled !== undefined) {
        updateFields.push(`registration_enabled = $${paramIndex++}`);
        values.push(updates.registration_enabled);
      }

      if (updates.auth_enabled !== undefined) {
        updateFields.push(`auth_enabled = $${paramIndex++}`);
        values.push(updates.auth_enabled);
      }

      if (updates.default_role_id !== undefined) {
        updateFields.push(`default_role_id = $${paramIndex++}`);
        values.push(updates.default_role_id);
      }

      if (updates.email_provider_id !== undefined) {
        updateFields.push(`email_provider_id = $${paramIndex++}`);
        values.push(updates.email_provider_id);
      }

      if (updates.sms_provider_id !== undefined) {
        updateFields.push(`sms_provider_id = $${paramIndex++}`);
        values.push(updates.sms_provider_id);
      }

      if (updates.settings_json !== undefined) {
        updateFields.push(`settings_json = $${paramIndex++}`);
        values.push(JSON.stringify(updates.settings_json));
      }

      if (updateFields.length === 0) {
        return ResponseUtils.error(res, 'No fields to update', null, null, 400);
      }

      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(parseInt(projectId));

      const updateQuery = `
        UPDATE auth_settings
        SET ${updateFields.join(', ')}
        WHERE project_id = $${paramIndex}
        RETURNING *
      `;

      const result = await AuthSettingsController.pool.query(updateQuery, values);

      if (result.rows.length === 0) {
        // Settings don't exist, create them
        const createResult = await AuthSettingsController.pool.query(
          `INSERT INTO auth_settings (project_id, allow_duplicate_emails, registration_enabled, auth_enabled)
           VALUES ($1, false, true, true)
           RETURNING *`,
          [parseInt(projectId)]
        );

        return ResponseUtils.success(res, 'Auth settings created', createResult.rows[0], 201);
      }

      ResponseUtils.success(res, 'Auth settings updated successfully', result.rows[0]);
    } catch (error) {
      console.error('Error updating auth settings:', error);
      ResponseUtils.error(res, 'Failed to update auth settings', error);
    }
  }

  /**
   * Get session configuration for a specific role
   * GET /api/auth/:projectId/settings/session-config/:roleId
   */
  static async getSessionConfig(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId, roleId } = req.params;

      // Get project schema
      const projectResult = await AuthSettingsController.pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [parseInt(projectId)]
      );

      if (projectResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const schemaName = projectResult.rows[0].schema_name;

      // Get role session duration
      const roleResult = await AuthSettingsController.pool.query(
        `SELECT role_name, role_key, session_duration_minutes FROM ${schemaName}.app_roles WHERE id = $1`,
        [parseInt(roleId)]
      );

      if (roleResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Role not found', null, null, 404);
      }

      ResponseUtils.success(res, 'Session config fetched successfully', {
        role: roleResult.rows[0],
        session_duration_minutes: roleResult.rows[0].session_duration_minutes,
        session_duration_hours: Math.floor(roleResult.rows[0].session_duration_minutes / 60),
        session_duration_days: Math.floor(roleResult.rows[0].session_duration_minutes / 1440),
      });
    } catch (error) {
      console.error('Error fetching session config:', error);
      ResponseUtils.error(res, 'Failed to fetch session config', error);
    }
  }

  /**
   * Send verification email to a user
   * POST /api/auth/:projectId/settings/send-verification
   */
  static async sendVerificationEmail(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;
      const { user_id, email } = req.body;

      if (!user_id && !email) {
        return ResponseUtils.error(res, 'User ID or email is required', null, null, 400);
      }

      // Check if email provider is configured
      const settingsResult = await AuthSettingsController.pool.query(
        'SELECT email_provider_id FROM auth_settings WHERE project_id = $1',
        [parseInt(projectId)]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].email_provider_id) {
        return ResponseUtils.error(
          res,
          'Email provider not configured. Please configure an email provider first.',
          null,
          null,
          400
        );
      }

      // Generate verification token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      // Store verification token (you would implement this in your database)
      // For now, we'll just return the token

      // TODO: Integrate with AuthEmailService to send actual email

      ResponseUtils.success(res, 'Verification email sent successfully', {
        token,
        expires_at: expiresAt,
        message: 'Email sending will be implemented with AuthEmailService',
      });
    } catch (error) {
      console.error('Error sending verification email:', error);
      ResponseUtils.error(res, 'Failed to send verification email', error);
    }
  }

  /**
   * Send password reset email
   * POST /api/auth/:projectId/settings/send-reset
   */
  static async sendPasswordResetEmail(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;
      const { email } = req.body;

      if (!email) {
        return ResponseUtils.error(res, 'Email is required', null, null, 400);
      }

      // Check if password reset is enabled
      const settingsResult = await AuthSettingsController.pool.query(
        'SELECT enable_password_reset, email_provider_id FROM auth_settings WHERE project_id = $1',
        [parseInt(projectId)]
      );

      if (settingsResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Auth settings not found', null, null, 404);
      }

      const settings = settingsResult.rows[0];

      if (!settings.enable_password_reset) {
        return ResponseUtils.error(res, 'Password reset is disabled for this project', null, null, 403);
      }

      if (!settings.email_provider_id) {
        return ResponseUtils.error(
          res,
          'Email provider not configured. Please configure an email provider first.',
          null,
          null,
          400
        );
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // TODO: Integrate with AuthEmailService to send actual email

      ResponseUtils.success(res, 'Password reset email sent successfully', {
        token,
        expires_at: expiresAt,
        message: 'Email sending will be implemented with AuthEmailService',
      });
    } catch (error) {
      console.error('Error sending password reset email:', error);
      ResponseUtils.error(res, 'Failed to send password reset email', error);
    }
  }

  /**
   * Verify OTP code
   * POST /api/auth/:projectId/settings/verify-otp
   */
  static async verifyOTP(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;
      const { user_id, code } = req.body;

      if (!user_id || !code) {
        return ResponseUtils.error(res, 'User ID and OTP code are required', null, null, 400);
      }

      // TODO: Implement OTP verification logic
      // This would involve:
      // 1. Checking if OTP is valid and not expired
      // 2. Marking user's email/phone as verified
      // 3. Deleting the OTP token

      ResponseUtils.success(res, 'OTP verification will be implemented', {
        message: 'OTP verification logic to be implemented',
      });
    } catch (error) {
      console.error('Error verifying OTP:', error);
      ResponseUtils.error(res, 'Failed to verify OTP', error);
    }
  }

  /**
   * Get all session durations for roles in a project
   * GET /api/auth/:projectId/settings/session-durations
   */
  static async getAllSessionDurations(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;

      // Get project schema
      const projectResult = await AuthSettingsController.pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [parseInt(projectId)]
      );

      if (projectResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const schemaName = projectResult.rows[0].schema_name;

      // Get all roles with their session durations
      const rolesResult = await AuthSettingsController.pool.query(
        `SELECT 
           id,
           role_name,
           role_key,
           session_duration_minutes,
           is_system_role
         FROM ${schemaName}.app_roles
         ORDER BY is_system_role DESC, role_name ASC`
      );

      const rolesWithDurations = rolesResult.rows.map((role) => ({
        ...role,
        session_duration_hours: Math.floor(role.session_duration_minutes / 60),
        session_duration_days: Math.floor(role.session_duration_minutes / 1440),
      }));

      ResponseUtils.success(res, 'Session durations fetched successfully', rolesWithDurations);
    } catch (error) {
      console.error('Error fetching session durations:', error);
      ResponseUtils.error(res, 'Failed to fetch session durations', error);
    }
  }

  /**
   * Test email provider configuration
   * POST /api/auth/:projectId/settings/test-email-provider
   */
  static async testEmailProvider(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;
      const { test_email } = req.body;

      if (!test_email) {
        return ResponseUtils.error(res, 'Test email address is required', null, null, 400);
      }

      // Get email provider configuration
      const settingsResult = await AuthSettingsController.pool.query(
        'SELECT email_provider_id FROM auth_settings WHERE project_id = $1',
        [parseInt(projectId)]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].email_provider_id) {
        return ResponseUtils.error(
          res,
          'Email provider not configured. Please configure an email provider first.',
          null,
          null,
          400
        );
      }

      // TODO: Send test email using AuthEmailService

      ResponseUtils.success(res, 'Test email sent successfully', {
        message: 'Test email functionality will be implemented with AuthEmailService',
        test_email,
      });
    } catch (error) {
      console.error('Error testing email provider:', error);
      ResponseUtils.error(res, 'Failed to test email provider', error);
    }
  }

  /**
   * Get available email providers for the project
   * GET /api/auth/:projectId/settings/email-providers
   */
  static async getEmailProviders(req: SuperTokensAuthenticatedRequest, res: Response) {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
      const { projectId } = req.params;

      const providersResult = await AuthSettingsController.pool.query(
        `SELECT id, name, provider_type, from_email, is_active
         FROM email_providers
         WHERE project_id = $1 AND is_active = true
         ORDER BY created_at ASC`,
        [projectId]
      );

      ResponseUtils.success(res, 'Email providers fetched successfully', providersResult.rows);
    } catch (error) {
      console.error('Error fetching email providers:', error);
      ResponseUtils.error(res, 'Failed to fetch email providers', error);
    }
  }
}

export default AuthSettingsController;

