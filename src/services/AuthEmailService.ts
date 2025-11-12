import { Pool } from 'pg';
import nodemailer from 'nodemailer';

interface EmailProvider {
  id: number;
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name?: string;
  is_active: boolean;
}

interface SendEmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class AuthEmailService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Get the configured email provider for a project
   */
  private async getEmailProvider(projectId: number): Promise<EmailProvider | null> {
    try {
      // First, get the email provider ID from auth settings
      const settingsResult = await this.pool.query(
        'SELECT email_provider_id FROM auth_settings WHERE project_id = $1',
        [projectId]
      );

      if (settingsResult.rows.length === 0 || !settingsResult.rows[0].email_provider_id) {
        console.error('No email provider configured for this project');
        return null;
      }

      const emailProviderId = settingsResult.rows[0].email_provider_id;

      // Get the email provider details
      const providerResult = await this.pool.query(
        `SELECT id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, 
                from_email, from_name, is_active
         FROM email_providers
         WHERE id = $1 AND is_active = true`,
        [emailProviderId]
      );

      if (providerResult.rows.length === 0) {
        console.error('Email provider not found or inactive');
        return null;
      }

      return providerResult.rows[0];
    } catch (error) {
      console.error('Error fetching email provider:', error);
      return null;
    }
  }

  /**
   * Send an email using the configured provider
   */
  private async sendEmail(provider: EmailProvider, options: SendEmailOptions): Promise<boolean> {
    try {
      const transporter = nodemailer.createTransport({
        host: provider.smtp_host,
        port: provider.smtp_port,
        secure: provider.smtp_secure,
        auth: {
          user: provider.smtp_user,
          pass: provider.smtp_password,
        },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });

      const mailOptions: any = {
        from: provider.from_name
          ? `"${provider.from_name}" <${provider.from_email}>`
          : provider.from_email,
        to: options.to,
        subject: options.subject,
      };

      if (options.text) mailOptions.text = options.text;
      if (options.html) mailOptions.html = options.html;

      const info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Error sending email:', error);
      return false;
    }
  }

  /**
   * Get project name for email templates
   */
  private async getProjectName(projectId: number): Promise<string> {
    try {
      const result = await this.pool.query('SELECT name FROM projects WHERE id = $1', [projectId]);
      return result.rows.length > 0 ? result.rows[0].name : 'Application';
    } catch (error) {
      console.error('Error fetching project name:', error);
      return 'Application';
    }
  }

  /**
   * Send registration email with OTP code
   */
  async sendRegistrationEmail(
    projectId: number,
    userEmail: string,
    userName: string,
    otp: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = await this.getEmailProvider(projectId);
      if (!provider) {
        return {
          success: false,
          error: 'Email provider not configured. Please configure an email provider in project settings.',
        };
      }

      const projectName = await this.getProjectName(projectId);

      const subject = `Welcome to ${projectName} - Verify your email`;
      const text = `
Hello ${userName},

Welcome to ${projectName}!

Please verify your email address by entering the following code:

${otp}

This code will expire in 10 minutes.

If you didn't create an account, please ignore this email.

Best regards,
The ${projectName} Team
      `.trim();

      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #32A956; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .otp-code { font-size: 32px; font-weight: bold; color: #32A956; text-align: center; padding: 20px; background-color: white; border-radius: 5px; margin: 20px 0; letter-spacing: 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${projectName}</h1>
    </div>
    <div class="content">
      <p>Hello ${userName},</p>
      <p>Welcome to ${projectName}! Please verify your email address by entering the following code:</p>
      <div class="otp-code">${otp}</div>
      <p>This code will expire in 10 minutes.</p>
      <p>If you didn't create an account, please ignore this email.</p>
      <div class="footer">
        <p>Best regards,<br>The ${projectName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      const success = await this.sendEmail(provider, {
        to: userEmail,
        subject,
        text,
        html,
      });

      return { success };
    } catch (error: any) {
      console.error('Error sending registration email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send email verification link
   */
  async sendVerificationEmail(
    projectId: number,
    userEmail: string,
    userName: string,
    verificationToken: string,
    verificationUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = await this.getEmailProvider(projectId);
      if (!provider) {
        return {
          success: false,
          error: 'Email provider not configured. Please configure an email provider in project settings.',
        };
      }

      const projectName = await this.getProjectName(projectId);
      const verifyLink = verificationUrl || `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

      const subject = `Verify your email address - ${projectName}`;
      const text = `
Hello ${userName},

Please verify your email address by clicking the link below:

${verifyLink}

Or use this verification code: ${verificationToken}

This link will expire in 24 hours.

If you didn't request this verification, please ignore this email.

Best regards,
The ${projectName} Team
      `.trim();

      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #32A956; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background-color: #32A956; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Verify Your Email</h1>
    </div>
    <div class="content">
      <p>Hello ${userName},</p>
      <p>Please verify your email address by clicking the button below:</p>
      <div style="text-align: center;">
        <a href="${verifyLink}" class="button">Verify Email</a>
      </div>
      <p>Or use this verification code: <strong>${verificationToken}</strong></p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't request this verification, please ignore this email.</p>
      <div class="footer">
        <p>Best regards,<br>The ${projectName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      const success = await this.sendEmail(provider, {
        to: userEmail,
        subject,
        text,
        html,
      });

      return { success };
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    projectId: number,
    userEmail: string,
    userName: string,
    resetToken: string,
    resetUrl?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = await this.getEmailProvider(projectId);
      if (!provider) {
        return {
          success: false,
          error: 'Email provider not configured. Please configure an email provider in project settings.',
        };
      }

      const projectName = await this.getProjectName(projectId);
      const resetLink = resetUrl || `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

      const subject = `Reset your password - ${projectName}`;
      const text = `
Hello ${userName},

We received a request to reset your password. Click the link below to reset it:

${resetLink}

Or use this reset code: ${resetToken}

This link will expire in 1 hour.

If you didn't request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
The ${projectName} Team
      `.trim();

      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #32A956; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .button { display: inline-block; padding: 12px 30px; background-color: #32A956; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Reset Your Password</h1>
    </div>
    <div class="content">
      <p>Hello ${userName},</p>
      <p>We received a request to reset your password. Click the button below to reset it:</p>
      <div style="text-align: center;">
        <a href="${resetLink}" class="button">Reset Password</a>
      </div>
      <p>Or use this reset code: <strong>${resetToken}</strong></p>
      <p>This link will expire in 1 hour.</p>
      <div class="warning">
        <strong>Security Notice:</strong> If you didn't request a password reset, please ignore this email and your password will remain unchanged.
      </div>
      <div class="footer">
        <p>Best regards,<br>The ${projectName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      const success = await this.sendEmail(provider, {
        to: userEmail,
        subject,
        text,
        html,
      });

      return { success };
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send welcome email after successful registration
   */
  async sendWelcomeEmail(
    projectId: number,
    userEmail: string,
    userName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = await this.getEmailProvider(projectId);
      if (!provider) {
        return {
          success: false,
          error: 'Email provider not configured. Please configure an email provider in project settings.',
        };
      }

      const projectName = await this.getProjectName(projectId);

      const subject = `Welcome to ${projectName}!`;
      const text = `
Hello ${userName},

Welcome to ${projectName}! Your account has been successfully created.

We're excited to have you on board. If you have any questions or need assistance, please don't hesitate to reach out to our support team.

Best regards,
The ${projectName} Team
      `.trim();

      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #32A956; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to ${projectName}!</h1>
    </div>
    <div class="content">
      <p>Hello ${userName},</p>
      <p>Welcome to ${projectName}! Your account has been successfully created.</p>
      <p>We're excited to have you on board. If you have any questions or need assistance, please don't hesitate to reach out to our support team.</p>
      <div class="footer">
        <p>Best regards,<br>The ${projectName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      const success = await this.sendEmail(provider, {
        to: userEmail,
        subject,
        text,
        html,
      });

      return { success };
    } catch (error: any) {
      console.error('Error sending welcome email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Check if email provider is configured for a project
   */
  async isEmailProviderConfigured(projectId: number): Promise<boolean> {
    const provider = await this.getEmailProvider(projectId);
    return provider !== null;
  }
}

