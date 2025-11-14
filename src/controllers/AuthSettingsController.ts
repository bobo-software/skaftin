import { Response } from 'express';
import { Pool } from 'pg';
import { SuperTokensAuthenticatedRequest } from '../middleware/supertokensAuthMiddleware';
import ResponseUtils from '../utils/ResponseUtils';
import crypto from 'crypto';
import { AuthEmailService } from '../services/AuthEmailService';

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
  send_registration_email: boolean;
  send_verification_email: boolean;
  send_password_reset_email: boolean;
  send_welcome_email: boolean;
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
  send_registration_email?: boolean;
  send_verification_email?: boolean;
  send_password_reset_email?: boolean;
  send_welcome_email?: boolean;
  settings_json?: any;
}

interface VerificationToken {
  token: string;
  expires_at: Date;
}

class AuthSettingsController {
  private static pool: Pool;
  private static emailService: AuthEmailService;

  static initialize(pool: Pool) {
    AuthSettingsController.pool = pool;
    AuthSettingsController.emailService = new AuthEmailService(pool);
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

      if (updates.send_registration_email !== undefined) {
        updateFields.push(`send_registration_email = $${paramIndex++}`);
        values.push(updates.send_registration_email);
      }

      if (updates.send_verification_email !== undefined) {
        updateFields.push(`send_verification_email = $${paramIndex++}`);
        values.push(updates.send_verification_email);
      }

      if (updates.send_password_reset_email !== undefined) {
        updateFields.push(`send_password_reset_email = $${paramIndex++}`);
        values.push(updates.send_password_reset_email);
      }

      if (updates.send_welcome_email !== undefined) {
        updateFields.push(`send_welcome_email = $${paramIndex++}`);
        values.push(updates.send_welcome_email);
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

      console.log('📧 [sendVerificationEmail] Checking settings...');

      // Check if verification email is enabled
      const settingsResult = await AuthSettingsController.pool.query(
        'SELECT send_verification_email, email_provider_id FROM auth_settings WHERE project_id = $1',
        [parseInt(projectId)]
      );

      if (settingsResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Auth settings not found', null, null, 404);
      }

      const settings = settingsResult.rows[0];

      if (!settings.send_verification_email) {
        return ResponseUtils.error(
          res,
          'Email verification is not enabled for this project. Enable it in Auth Settings.',
          null,
          null,
          403
        );
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

      // Get project schema
      const schemaResult = await AuthSettingsController.pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [parseInt(projectId)]
      );

      if (schemaResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const schemaName = schemaResult.rows[0].schema_name;

      // Get user details
      let userQuery = '';
      let queryParams: any[] = [];

      if (user_id) {
        userQuery = `SELECT id, name, email FROM ${schemaName}.app_users WHERE id = $1`;
        queryParams = [user_id];
      } else {
        userQuery = `SELECT id, name, email FROM ${schemaName}.app_users WHERE email = $1`;
        queryParams = [email];
      }

      const userResult = await AuthSettingsController.pool.query(userQuery, queryParams);

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      console.log(`   └─ Sending verification email to ${user.email}...`);

      // Send verification email
      const emailResult = await AuthSettingsController.emailService.sendVerificationEmail(
        parseInt(projectId),
        user.email,
        user.name,
        verificationToken
      );

      if (!emailResult.success) {
        return ResponseUtils.error(
          res,
          'Failed to send verification email',
          null,
          emailResult.error,
          500
        );
      }

      // Store verification token in user metadata
      await AuthSettingsController.pool.query(
        `UPDATE ${schemaName}.app_users 
         SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{verification_token}', $1::jsonb),
             metadata = jsonb_set(metadata, '{verification_expires_at}', $2::jsonb)
         WHERE id = $3`,
        [JSON.stringify(verificationToken), JSON.stringify(expiresAt.toISOString()), user.id]
      );

      console.log('   └─ ✅ Verification email sent successfully');

      ResponseUtils.success(res, 'Verification email sent successfully', {
        message: `Verification email sent to ${user.email}`,
        expires_at: expiresAt,
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

      console.log('📧 [sendPasswordResetEmail] Checking settings...');

      // Check if password reset email is enabled
      const settingsResult = await AuthSettingsController.pool.query(
        'SELECT send_password_reset_email, email_provider_id FROM auth_settings WHERE project_id = $1',
        [parseInt(projectId)]
      );

      if (settingsResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Auth settings not found', null, null, 404);
      }

      const settings = settingsResult.rows[0];

      if (!settings.send_password_reset_email) {
        return ResponseUtils.error(
          res,
          'Password reset emails are not enabled for this project. Enable it in Auth Settings.',
          null,
          null,
          403
        );
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

      // Get project schema
      const schemaResult = await AuthSettingsController.pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [parseInt(projectId)]
      );

      if (schemaResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const schemaName = schemaResult.rows[0].schema_name;

      // Check if user exists
      const userResult = await AuthSettingsController.pool.query(
        `SELECT id, name, email FROM ${schemaName}.app_users WHERE email = $1`,
        [email]
      );

      if (userResult.rows.length === 0) {
        // Don't reveal if email exists or not for security
        return ResponseUtils.success(res, 'If the email exists, a password reset link has been sent', {
          message: 'Password reset email sent (if email exists)',
        });
      }

      const user = userResult.rows[0];

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      console.log(`   └─ Sending password reset email to ${user.email}...`);

      // Send password reset email
      const emailResult = await AuthSettingsController.emailService.sendPasswordResetEmail(
        parseInt(projectId),
        user.email,
        user.name,
        resetToken
      );

      if (!emailResult.success) {
        return ResponseUtils.error(
          res,
          'Failed to send password reset email',
          null,
          emailResult.error,
          500
        );
      }

      // Store reset token in user metadata
      await AuthSettingsController.pool.query(
        `UPDATE ${schemaName}.app_users 
         SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{reset_token}', $1::jsonb),
             metadata = jsonb_set(metadata, '{reset_expires_at}', $2::jsonb)
         WHERE id = $3`,
        [JSON.stringify(resetToken), JSON.stringify(expiresAt.toISOString()), user.id]
      );

      console.log('   └─ ✅ Password reset email sent successfully');

      ResponseUtils.success(res, 'Password reset email sent successfully', {
        message: `Password reset instructions sent to ${email}`,
        expires_at: expiresAt,
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

      console.log('🔐 [verifyOTP] Verifying OTP...');
      console.log('   └─ projectId:', projectId);
      console.log('   └─ user_id:', user_id);

      // Get project schema
      const schemaResult = await AuthSettingsController.pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [parseInt(projectId)]
      );

      if (schemaResult.rows.length === 0) {
        return ResponseUtils.error(res, 'Project not found', null, null, 404);
      }

      const schemaName = schemaResult.rows[0].schema_name;

      // Get user with OTP data
      const userResult = await AuthSettingsController.pool.query(
        `SELECT id, name, email, metadata, is_active FROM ${schemaName}.app_users WHERE id = $1`,
        [parseInt(user_id)]
      );

      if (userResult.rows.length === 0) {
        return ResponseUtils.error(res, 'User not found', null, null, 404);
      }

      const user = userResult.rows[0];
      const metadata = user.metadata || {};

      console.log('   └─ User found:', user.email);
      console.log('   └─ User active status:', user.is_active);

      // Check if OTP exists
      if (!metadata.otp) {
        return ResponseUtils.error(
          res,
          'No OTP found for this user. Please request a new verification code.',
          null,
          null,
          400
        );
      }

      // Check if OTP is expired
      if (metadata.otp_expires_at) {
        const expiresAt = new Date(metadata.otp_expires_at);
        if (expiresAt < new Date()) {
          return ResponseUtils.error(
            res,
            'OTP code has expired. Please request a new verification code.',
            null,
            null,
          400
          );
        }
      }

      // Verify OTP code
      if (metadata.otp !== code) {
        return ResponseUtils.error(
          res,
          'Invalid OTP code. Please check the code and try again.',
          null,
          null,
          400
        );
      }

      console.log('   └─ ✅ OTP verified successfully');

      // Activate user and mark email as verified
      await AuthSettingsController.pool.query(
        `UPDATE ${schemaName}.app_users 
         SET is_active = true,
             email_verified = true,
             metadata = metadata - 'otp' - 'otp_expires_at',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [user.id]
      );

      console.log('   └─ ✅ User activated and email verified');

      // Check if welcome email should be sent
      const settingsResult = await AuthSettingsController.pool.query(
        'SELECT send_welcome_email, email_provider_id FROM auth_settings WHERE project_id = $1',
        [parseInt(projectId)]
      );

      if (settingsResult.rows.length > 0) {
        const emailSettings = settingsResult.rows[0];
        
        if (emailSettings.send_welcome_email && emailSettings.email_provider_id) {
          console.log('📧 Sending welcome email...');
          
          const welcomeResult = await AuthSettingsController.emailService.sendWelcomeEmail(
            parseInt(projectId),
            user.email,
            user.name
          );
          
          if (welcomeResult.success) {
            console.log('   └─ ✅ Welcome email sent');
          } else {
            console.warn('   └─ ⚠️ Failed to send welcome email:', welcomeResult.error);
          }
        }
      }

      ResponseUtils.success(res, 'OTP verified successfully', {
        message: 'Your account has been activated. You can now log in.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          is_active: true,
          email_verified: true,
        },
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

      console.log('📧 [testEmailProvider] Sending test email...');
      console.log('   └─ projectId:', projectId);
      console.log('   └─ test_email:', test_email);

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

      const providerId = settingsResult.rows[0].email_provider_id;
      console.log('   └─ providerId:', providerId);

      // Get email provider details
      const providerQuery = `
        SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, 
               from_email, from_name, is_active
        FROM email_providers
        WHERE id = $1 AND project_id = $2 AND is_active = true
      `;

      const providerResult = await AuthSettingsController.pool.query(providerQuery, [
        providerId,
        parseInt(projectId),
      ]);

      if (providerResult.rows.length === 0) {
        return ResponseUtils.error(
          res,
          'Email provider not found or inactive',
          null,
          null,
          404
        );
      }

      const provider = providerResult.rows[0];
      console.log('   └─ Provider found:', provider.smtp_host);

      // Get project name
      const projectResult = await AuthSettingsController.pool.query(
        'SELECT name FROM projects WHERE id = $1',
        [parseInt(projectId)]
      );
      const projectName = projectResult.rows[0]?.name || 'Skaftin Project';

      // Create nodemailer transporter
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: provider.smtp_host,
        port: provider.smtp_port,
        secure: provider.smtp_secure,
        auth: {
          user: provider.smtp_user,
          pass: provider.smtp_password,
        },
      });

      // Prepare test email
      const mailOptions = {
        from: provider.from_name
          ? `"${provider.from_name}" <${provider.from_email}>`
          : provider.from_email,
        to: test_email,
        subject: `Test Email from ${projectName} - Skaftin Platform`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4F46E5;">Email Configuration Test ✅</h1>
            <p>This is a test email from your Skaftin project: <strong>${projectName}</strong></p>
            
            <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Email Provider Details:</strong></p>
              <p style="margin: 5px 0;">Host: ${provider.smtp_host}</p>
              <p style="margin: 5px 0;">Port: ${provider.smtp_port}</p>
              <p style="margin: 5px 0;">Secure: ${provider.smtp_secure ? 'Yes' : 'No'}</p>
              <p style="margin: 5px 0;">From: ${provider.from_email}</p>
            </div>
            
            <div style="background-color: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #065F46;">
                <strong>✓ Success!</strong><br/>
                Your email provider is configured correctly and emails are being delivered successfully.
              </p>
            </div>
            
            <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
              If you received this email, your email configuration is working perfectly!<br/>
              You can now send authentication emails, invitations, and notifications from your project.
            </p>
            
            <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
            
            <p style="color: #6B7280; font-size: 12px;">
              Skaftin Platform - Email Testing Service
            </p>
          </div>
        `,
        text: `
Email Configuration Test

This is a test email from your Skaftin project: ${projectName}

Email Provider Details:
- Host: ${provider.smtp_host}
- Port: ${provider.smtp_port}
- Secure: ${provider.smtp_secure ? 'Yes' : 'No'}
- From: ${provider.from_email}

✓ Success!
Your email provider is configured correctly and emails are being delivered successfully.

If you received this email, your email configuration is working perfectly!
You can now send authentication emails, invitations, and notifications from your project.

Skaftin Platform - Email Testing Service
        `.trim(),
      };

      console.log('   └─ Sending test email...');

      // Send email
      await transporter.sendMail(mailOptions);

      console.log('   └─ ✅ Test email sent successfully!');

      ResponseUtils.success(res, 'Test email sent successfully', {
        message: `Test email has been sent to ${test_email}. Please check your inbox.`,
        test_email,
        provider: {
          host: provider.smtp_host,
          port: provider.smtp_port,
          from: provider.from_email,
        },
      });
    } catch (error: any) {
      console.error('❌ Error testing email provider:', error);
      ResponseUtils.error(
        res,
        'Failed to send test email',
        error,
        error.message || 'Unknown error occurred'
      );
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

