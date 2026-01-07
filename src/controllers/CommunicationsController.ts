import { Request, Response } from 'express';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { HybridAuthRequest } from '../middleware/hybridAuthMiddleware';

interface EmailProvider {
  id?: number;
  project_id: string;
  name: string;
  provider_type: 'nodemailer' | 'mailtrap';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name?: string;
  is_active: boolean;
  created_at?: Date;
  updated_at?: Date;
}

interface SendEmailRequest {
  provider_id: number;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string;
    encoding?: string;
  }>;
}

class CommunicationsController {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Initialize the communications table in the database
   */
  async initializeTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS skaftin_system_email_providers (
        id SERIAL PRIMARY KEY,
        project_id VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        provider_type VARCHAR(50) NOT NULL CHECK (provider_type IN ('nodemailer', 'mailtrap')),
        smtp_host VARCHAR(255) NOT NULL,
        smtp_port INTEGER NOT NULL,
        smtp_secure BOOLEAN DEFAULT false,
        smtp_user VARCHAR(255) NOT NULL,
        smtp_password TEXT NOT NULL,
        from_email VARCHAR(255) NOT NULL,
        from_name VARCHAR(255),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(project_id, name)
      );

      CREATE INDEX IF NOT EXISTS idx_skaftin_system_email_providers_project_id ON skaftin_system_email_providers(project_id);
      CREATE INDEX IF NOT EXISTS idx_skaftin_system_email_providers_is_active ON skaftin_system_email_providers(is_active);
    `;

    try {
      await this.pool.query(createTableQuery);
      console.log('✅ Email providers table initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize email providers table:', error);
      throw error;
    }
  }

  /**
   * List all email providers for a project
   */
  listProviders = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      
      // Debug logging
      console.log('📧 [CommunicationsController] listProviders called');
      console.log('  └─ projectId:', projectId);
      console.log('  └─ Authorization header:', req.headers.authorization);
      console.log('  └─ User from token:', (req as any).user);

      const query = `
        SELECT id, project_id, name, provider_type, smtp_host, smtp_port, 
               smtp_secure, smtp_user, from_email, from_name, is_active, 
               created_at, updated_at
        FROM skaftin_system_email_providers
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
      console.error('Error listing email providers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list email providers',
        message: error.message,
      });
    }
  };

  /**
   * Get a specific email provider by ID
   */
  getProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, providerId } = req.params;

      const query = `
        SELECT id, project_id, name, provider_type, smtp_host, smtp_port, 
               smtp_secure, smtp_user, from_email, from_name, is_active, 
               created_at, updated_at
        FROM skaftin_system_email_providers
        WHERE id = $1 AND project_id = $2
      `;

      const result = await this.pool.query(query, [providerId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Email provider not found',
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
      });
    } catch (error: any) {
      console.error('Error getting email provider:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get email provider',
        message: error.message,
      });
    }
  };

  /**
   * Create a new email provider
   */
  createProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const {
        name,
        provider_type,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_password,
        from_email,
        from_name,
        is_active,
      } = req.body;

      // Validate required fields
      if (!name || !provider_type || !smtp_host || !smtp_port || !smtp_user || !smtp_password || !from_email) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields',
        });
        return;
      }

      const query = `
        INSERT INTO skaftin_system_email_providers 
        (project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, 
         smtp_user, smtp_password, from_email, from_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, project_id, name, provider_type, smtp_host, smtp_port, 
                  smtp_secure, smtp_user, from_email, from_name, is_active, 
                  created_at, updated_at
      `;

      const result = await this.pool.query(query, [
        projectId,
        name,
        provider_type,
        smtp_host,
        smtp_port,
        smtp_secure || false,
        smtp_user,
        smtp_password,
        from_email,
        from_name || null,
        is_active !== undefined ? is_active : true,
      ]);

      res.status(201).json({
        success: true,
        data: result.rows[0],
        message: 'Email provider created successfully',
      });
    } catch (error: any) {
      console.error('Error creating email provider:', error);
      
      if (error.code === '23505') { // Unique constraint violation
        res.status(409).json({
          success: false,
          error: 'Email provider with this name already exists for this project',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create email provider',
        message: error.message,
      });
    }
  };

  /**
   * Update an existing email provider
   */
  updateProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, providerId } = req.params;
      const {
        name,
        provider_type,
        smtp_host,
        smtp_port,
        smtp_secure,
        smtp_user,
        smtp_password,
        from_email,
        from_name,
        is_active,
      } = req.body;

      // Build dynamic update query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (provider_type !== undefined) {
        updates.push(`provider_type = $${paramIndex++}`);
        values.push(provider_type);
      }
      if (smtp_host !== undefined) {
        updates.push(`smtp_host = $${paramIndex++}`);
        values.push(smtp_host);
      }
      if (smtp_port !== undefined) {
        updates.push(`smtp_port = $${paramIndex++}`);
        values.push(smtp_port);
      }
      if (smtp_secure !== undefined) {
        updates.push(`smtp_secure = $${paramIndex++}`);
        values.push(smtp_secure);
      }
      if (smtp_user !== undefined) {
        updates.push(`smtp_user = $${paramIndex++}`);
        values.push(smtp_user);
      }
      if (smtp_password !== undefined) {
        updates.push(`smtp_password = $${paramIndex++}`);
        values.push(smtp_password);
      }
      if (from_email !== undefined) {
        updates.push(`from_email = $${paramIndex++}`);
        values.push(from_email);
      }
      if (from_name !== undefined) {
        updates.push(`from_name = $${paramIndex++}`);
        values.push(from_name);
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

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(providerId, projectId);

      const query = `
        UPDATE skaftin_system_email_providers
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex++} AND project_id = $${paramIndex++}
        RETURNING id, project_id, name, provider_type, smtp_host, smtp_port, 
                  smtp_secure, smtp_user, from_email, from_name, is_active, 
                  created_at, updated_at
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Email provider not found',
        });
        return;
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Email provider updated successfully',
      });
    } catch (error: any) {
      console.error('Error updating email provider:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update email provider',
        message: error.message,
      });
    }
  };

  /**
   * Delete an email provider
   */
  deleteProvider = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, providerId } = req.params;

      const query = `
        DELETE FROM skaftin_system_email_providers
        WHERE id = $1 AND project_id = $2
        RETURNING id
      `;

      const result = await this.pool.query(query, [providerId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Email provider not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Email provider deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting email provider:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete email provider',
        message: error.message,
      });
    }
  };

  /**
   * Test email provider connection
   */
  testConnection = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, providerId } = req.params;
      const { test_email } = req.body;
      
      console.log('🧪 [testConnection] Starting connection test');
      console.log('  └─ projectId:', projectId);
      console.log('  └─ providerId:', providerId);
      console.log('  └─ test_email:', test_email || 'N/A (verification only)');

      // Get provider details (include from_email and from_name for sending test email)
      const query = `
        SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, name
        FROM skaftin_system_email_providers
        WHERE id = $1 AND project_id = $2
      `;

      console.log('  └─ Fetching provider from database...');
      const result = await this.pool.query(query, [providerId, projectId]);

      if (result.rows.length === 0) {
        console.log('  └─ ❌ Provider not found');
        res.status(404).json({
          success: false,
          error: 'Email provider not found',
        });
        return;
      }

      const provider = result.rows[0];
      console.log('  └─ ✅ Provider found:');
      console.log('     └─ Host:', provider.smtp_host);
      console.log('     └─ Port:', provider.smtp_port);
      console.log('     └─ Secure:', provider.smtp_secure);
      console.log('     └─ User:', provider.smtp_user);

      // Validate common SMTP ports
      const validPorts = [25, 465, 587, 2525];
      if (!validPorts.includes(provider.smtp_port)) {
        console.log('     └─ ⚠️  WARNING: Port', provider.smtp_port, 'is not a standard SMTP port');
        console.log('     └─ Standard ports: 25, 465, 587, 2525');
        console.log('     └─ Did you mean port 465? (for SSL/TLS)');
      }

      // Check port/secure combination
      if (provider.smtp_port === 465 && !provider.smtp_secure) {
        console.log('     └─ ⚠️  WARNING: Port 465 should use secure: true');
      }
      if (provider.smtp_port === 587 && provider.smtp_secure) {
        console.log('     └─ ⚠️  WARNING: Port 587 should use secure: false (uses STARTTLS)');
      }

      // Create transporter with timeout settings
      console.log('  └─ Creating nodemailer transporter...');
      const transporter = nodemailer.createTransport({
        host: provider.smtp_host,
        port: provider.smtp_port,
        secure: provider.smtp_secure,
        auth: {
          user: provider.smtp_user,
          pass: provider.smtp_password,
        },
        connectionTimeout: 10000, // 10 seconds
        greetingTimeout: 10000,   // 10 seconds
        socketTimeout: 10000,     // 10 seconds
      });

      console.log('  └─ Attempting to verify SMTP connection...');
      
      // Verify connection with timeout
      const verifyPromise = transporter.verify();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      );

      await Promise.race([verifyPromise, timeoutPromise]);

      console.log('  └─ ✅ Connection verified successfully!');

      // If test_email is provided, send a test email
      if (test_email) {
        console.log('  └─ 📧 Sending test email to:', test_email);

        const mailOptions = {
          from: provider.from_name 
            ? `"${provider.from_name}" <${provider.from_email}>` 
            : provider.from_email,
          to: test_email,
          subject: `Test Email from ${provider.name || 'Email Provider'}`,
          text: `This is a test email to verify your email provider configuration.\n\nProvider: ${provider.name || 'Unknown'}\nSMTP Host: ${provider.smtp_host}\nSMTP Port: ${provider.smtp_port}\n\nIf you received this email, your email provider is configured correctly!`,
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #32A956; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
                .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
                .success-icon { font-size: 48px; text-align: center; margin: 20px 0; }
                .details { background-color: #fff; padding: 15px; border-left: 4px solid #32A956; margin: 20px 0; }
                .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Email Provider Test</h1>
                </div>
                <div class="content">
                  <div class="success-icon">📧</div>
                  <p><strong>Success!</strong> This is a test email to verify your email provider configuration.</p>
                  
                  <div class="details">
                    <p><strong>Provider:</strong> ${provider.name || 'Unknown'}</p>
                    <p><strong>SMTP Host:</strong> ${provider.smtp_host}</p>
                    <p><strong>SMTP Port:</strong> ${provider.smtp_port}</p>
                    <p><strong>Secure:</strong> ${provider.smtp_secure ? 'Yes (SSL/TLS)' : 'No (STARTTLS)'}</p>
                  </div>
                  
                  <p>If you received this email, your email provider is configured correctly and ready to send emails!</p>
                  
                  <div class="footer">
                    <p>This is an automated test email from Skaftin Platform.</p>
                  </div>
                </div>
              </div>
            </body>
            </html>
          `,
        };

        await transporter.sendMail(mailOptions);
        console.log('  └─ ✅ Test email sent successfully!');

        res.json({
          success: true,
          message: `Connection successful and test email sent to ${test_email}`,
          emailSent: true,
        });
      } else {
        res.json({
          success: true,
          message: 'Connection successful',
          emailSent: false,
        });
      }
    } catch (error: any) {
      console.error('  └─ ❌ Connection test failed:');
      console.error('     └─ Error name:', error.name);
      console.error('     └─ Error message:', error.message);
      console.error('     └─ Error code:', error.code);
      console.error('     └─ Full error:', error);
      
      res.status(500).json({
        success: false,
        error: 'Connection failed',
        message: error.message,
        details: {
          errorCode: error.code,
          errorName: error.name,
        },
      });
    }
  };

  /**
   * Send an email using a specific provider
   */
  sendEmail = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      const projectId = (req as HybridAuthRequest).projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      const { provider_id, to, subject, text, html, cc, bcc, attachments }: SendEmailRequest = req.body;

      // Validate project ID
      if (!projectId) {
        res.status(400).json({
          success: false,
          error: 'Project ID is required',
        });
        return;
      }

      // Validate required fields
      if (!provider_id || !to || !subject || (!text && !html)) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: provider_id, to, subject, and either text or html',
        });
        return;
      }

      // Get provider details
      const query = `
        SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, 
               from_email, from_name, is_active
        FROM skaftin_system_email_providers
        WHERE id = $1 AND project_id = $2
      `;

      const result = await this.pool.query(query, [provider_id, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Email provider not found',
        });
        return;
      }

      const provider = result.rows[0];

      if (!provider.is_active) {
        res.status(400).json({
          success: false,
          error: 'Email provider is not active',
        });
        return;
      }

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: provider.smtp_host,
        port: provider.smtp_port,
        secure: provider.smtp_secure,
        auth: {
          user: provider.smtp_user,
          pass: provider.smtp_password,
        },
      });

      // Prepare email options
      const mailOptions: any = {
        from: provider.from_name 
          ? `"${provider.from_name}" <${provider.from_email}>`
          : provider.from_email,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
      };

      if (text) mailOptions.text = text;
      if (html) mailOptions.html = html;
      if (cc) mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
      if (bcc) mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
      if (attachments) mailOptions.attachments = attachments;

      // Send email
      const info = await transporter.sendMail(mailOptions);

      res.json({
        success: true,
        message: 'Email sent successfully',
        data: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
        },
      });
    } catch (error: any) {
      console.error('Error sending email:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send email',
        message: error.message,
      });
    }
  };

  /**
   * List all email templates for a project
   */
  listEmailTemplates = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      console.log('[CommunicationsController] Listing email templates for project:', projectId);

      const query = `
        SELECT id, project_id, name, subject, html_content, text_content, variables, 
               created_at, updated_at
        FROM skaftin_system_email_templates
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [projectId]);

      // Parse variables from JSONB if needed
      const templates = result.rows.map((row) => {
        let variables = row.variables;
        if (typeof variables === 'string') {
          try {
            variables = JSON.parse(variables);
          } catch (e) {
            console.warn('[CommunicationsController] Failed to parse variables for template:', row.id, e);
            variables = [];
          }
        }
        if (!Array.isArray(variables)) {
          variables = [];
        }
        return {
          ...row,
          variables,
        };
      });

      console.log('[CommunicationsController] Returning templates:', templates.map(t => ({
        id: t.id,
        name: t.name,
        variables: t.variables,
        variablesType: typeof t.variables,
      })));

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error: any) {
      console.error('Error listing email templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list email templates',
        message: error.message,
      });
    }
  };

  /**
   * Get a specific email template by ID
   */
  getEmailTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, templateId } = req.params;

      const query = `
        SELECT id, project_id, name, subject, html_content, text_content, variables, 
               created_at, updated_at
        FROM skaftin_system_email_templates
        WHERE id = $1 AND project_id = $2
      `;

      const result = await this.pool.query(query, [templateId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Email template not found',
        });
        return;
      }

      // Parse variables from JSONB response
      const template = result.rows[0];
      let parsedVariables = template.variables;
      if (typeof parsedVariables === 'string') {
        try {
          parsedVariables = JSON.parse(parsedVariables);
        } catch (e) {
          console.warn('[CommunicationsController] Failed to parse variables:', e);
          parsedVariables = [];
        }
      }
      if (!Array.isArray(parsedVariables)) {
        parsedVariables = [];
      }

      res.json({
        success: true,
        data: {
          ...template,
          variables: parsedVariables,
        },
      });
    } catch (error: any) {
      console.error('Error getting email template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get email template',
        message: error.message,
      });
    }
  };

  /**
   * Create a new email template
   */
  createEmailTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { name, subject, html_content, text_content, variables } = req.body;

      if (!name || !subject) {
        res.status(400).json({
          success: false,
          error: 'Name and subject are required',
        });
        return;
      }

      const query = `
        INSERT INTO skaftin_system_email_templates (project_id, name, subject, html_content, text_content, variables)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, project_id, name, subject, html_content, text_content, variables, 
                  created_at, updated_at
      `;

      const variablesJson = JSON.stringify(variables || []);
      console.log('[CommunicationsController] Creating template with variables:', {
        name,
        variables,
        variablesJson,
      });

      const result = await this.pool.query(query, [
        projectId,
        name,
        subject,
        html_content || null,
        text_content || null,
        variablesJson,
      ]);

      // Parse variables from JSONB response
      const template = result.rows[0];
      let parsedVariables = template.variables;
      if (typeof parsedVariables === 'string') {
        try {
          parsedVariables = JSON.parse(parsedVariables);
        } catch (e) {
          console.warn('[CommunicationsController] Failed to parse variables:', e);
          parsedVariables = [];
        }
      }
      if (!Array.isArray(parsedVariables)) {
        parsedVariables = [];
      }

      console.log('[CommunicationsController] Template created, returning:', {
        id: template.id,
        name: template.name,
        variables: parsedVariables,
      });

      res.status(201).json({
        success: true,
        data: {
          ...template,
          variables: parsedVariables,
        },
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'Email template with this name already exists',
        });
        return;
      }
      console.error('Error creating email template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create email template',
        message: error.message,
      });
    }
  };

  /**
   * Update an existing email template
   */
  updateEmailTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, templateId } = req.params;
      const { name, subject, html_content, text_content, variables } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (subject !== undefined) {
        updates.push(`subject = $${paramCount++}`);
        values.push(subject);
      }
      if (html_content !== undefined) {
        updates.push(`html_content = $${paramCount++}`);
        values.push(html_content);
      }
      if (text_content !== undefined) {
        updates.push(`text_content = $${paramCount++}`);
        values.push(text_content);
      }
      if (variables !== undefined) {
        console.log('[CommunicationsController] Updating template variables:', {
          templateId,
          variables,
          variablesType: typeof variables,
          isArray: Array.isArray(variables),
        });
        updates.push(`variables = $${paramCount++}`);
        values.push(JSON.stringify(variables));
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update',
        });
        return;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(templateId, projectId);

      const query = `
        UPDATE skaftin_system_email_templates
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND project_id = $${paramCount++}
        RETURNING id, project_id, name, subject, html_content, text_content, variables, 
                  created_at, updated_at
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Email template not found',
        });
        return;
      }

      // Parse variables from JSONB response
      const template = result.rows[0];
      let parsedVariables = template.variables;
      console.log('[CommunicationsController] Update - Raw variables from DB:', {
        raw: template.variables,
        type: typeof template.variables,
        isArray: Array.isArray(template.variables),
      });
      
      if (typeof parsedVariables === 'string') {
        try {
          parsedVariables = JSON.parse(parsedVariables);
        } catch (e) {
          console.warn('[CommunicationsController] Failed to parse variables:', e);
          parsedVariables = [];
        }
      }
      if (!Array.isArray(parsedVariables)) {
        parsedVariables = [];
      }

      console.log('[CommunicationsController] Template updated, returning:', {
        id: template.id,
        name: template.name,
        variables: parsedVariables,
      });

      res.json({
        success: true,
        data: {
          ...template,
          variables: parsedVariables,
        },
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'Email template with this name already exists',
        });
        return;
      }
      console.error('Error updating email template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update email template',
        message: error.message,
      });
    }
  };

  /**
   * Delete an email template
   */
  deleteEmailTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, templateId } = req.params;

      const query = `
        DELETE FROM skaftin_system_email_templates
        WHERE id = $1 AND project_id = $2
        RETURNING id
      `;

      const result = await this.pool.query(query, [templateId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Email template not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Email template deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting email template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete email template',
        message: error.message,
      });
    }
  };

  /**
   * List all SMS templates for a project
   */
  listSmsTemplates = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      // Get projectId from middleware (extracted from API key) or params
      const projectId = (req as HybridAuthRequest).projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }

      console.log('[CommunicationsController] Listing SMS templates for project:', projectId);

      const query = `
        SELECT id, project_id, name, content, variables, 
               created_at, updated_at
        FROM skaftin_system_sms_templates
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;

      const result = await this.pool.query(query, [projectId]);

      // Parse variables from JSONB if needed
      const templates = result.rows.map((row) => {
        let variables = row.variables;
        if (typeof variables === 'string') {
          try {
            variables = JSON.parse(variables);
          } catch (e) {
            console.warn('[CommunicationsController] Failed to parse variables for SMS template:', row.id, e);
            variables = [];
          }
        }
        if (!Array.isArray(variables)) {
          variables = [];
        }
        return {
          ...row,
          variables,
        };
      });

      res.json({
        success: true,
        data: templates,
        count: templates.length,
      });
    } catch (error: any) {
      console.error('Error listing SMS templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list SMS templates',
        message: error.message,
      });
    }
  };

  /**
   * Get a single SMS template by ID
   */
  getSmsTemplate = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      // Get projectId from middleware (extracted from API key) or params
      const projectId = (req as HybridAuthRequest).projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }
      const { templateId } = req.params;

      const query = `
        SELECT id, project_id, name, content, variables, 
               created_at, updated_at
        FROM skaftin_system_sms_templates
        WHERE id = $1 AND project_id = $2
      `;

      const result = await this.pool.query(query, [templateId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'SMS template not found',
        });
        return;
      }

      // Parse variables from JSONB if needed
      let variables = result.rows[0].variables;
      if (typeof variables === 'string') {
        try {
          variables = JSON.parse(variables);
        } catch (e) {
          console.warn('[CommunicationsController] Failed to parse variables:', e);
          variables = [];
        }
      }
      if (!Array.isArray(variables)) {
        variables = [];
      }

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          variables,
        },
      });
    } catch (error: any) {
      console.error('Error getting SMS template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get SMS template',
        message: error.message,
      });
    }
  };

  /**
   * Create a new SMS template
   */
  createSmsTemplate = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      // Get projectId from middleware (extracted from API key) or params
      const projectId = (req as HybridAuthRequest).projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }
      const { name, content, variables } = req.body;

      if (!name || !content) {
        res.status(400).json({
          success: false,
          error: 'Name and content are required',
        });
        return;
      }

      const query = `
        INSERT INTO skaftin_system_sms_templates (project_id, name, content, variables)
        VALUES ($1, $2, $3, $4)
        RETURNING id, project_id, name, content, variables, 
                  created_at, updated_at
      `;

      const variablesJson = JSON.stringify(variables || []);

      const result = await this.pool.query(query, [
        projectId,
        name,
        content,
        variablesJson,
      ]);

      // Parse variables from JSONB response
      const template = result.rows[0];
      let parsedVariables = template.variables;
      if (typeof parsedVariables === 'string') {
        try {
          parsedVariables = JSON.parse(parsedVariables);
        } catch (e) {
          console.warn('[CommunicationsController] Failed to parse variables:', e);
          parsedVariables = [];
        }
      }
      if (!Array.isArray(parsedVariables)) {
        parsedVariables = [];
      }

      res.status(201).json({
        success: true,
        data: {
          ...template,
          variables: parsedVariables,
        },
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'SMS template with this name already exists',
        });
        return;
      }
      console.error('Error creating SMS template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create SMS template',
        message: error.message,
      });
    }
  };

  /**
   * Update an existing SMS template
   */
  updateSmsTemplate = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      // Get projectId from middleware (extracted from API key) or params
      const projectId = (req as HybridAuthRequest).projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }
      const { templateId } = req.params;
      const { name, content, variables } = req.body;

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramCount++}`);
        values.push(name);
      }
      if (content !== undefined) {
        updates.push(`content = $${paramCount++}`);
        values.push(content);
      }
      if (variables !== undefined) {
        updates.push(`variables = $${paramCount++}`);
        values.push(JSON.stringify(variables));
      }

      if (updates.length === 0) {
        res.status(400).json({
          success: false,
          error: 'No fields to update',
        });
        return;
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(templateId, projectId);

      const query = `
        UPDATE skaftin_system_sms_templates
        SET ${updates.join(', ')}
        WHERE id = $${paramCount++} AND project_id = $${paramCount++}
        RETURNING id, project_id, name, content, variables, 
                  created_at, updated_at
      `;

      const result = await this.pool.query(query, values);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'SMS template not found',
        });
        return;
      }

      // Parse variables from JSONB response
      const template = result.rows[0];
      let parsedVariables = template.variables;
      if (typeof parsedVariables === 'string') {
        try {
          parsedVariables = JSON.parse(parsedVariables);
        } catch (e) {
          console.warn('[CommunicationsController] Failed to parse variables:', e);
          parsedVariables = [];
        }
      }
      if (!Array.isArray(parsedVariables)) {
        parsedVariables = [];
      }

      res.json({
        success: true,
        data: {
          ...template,
          variables: parsedVariables,
        },
      });
    } catch (error: any) {
      if (error.code === '23505') {
        res.status(409).json({
          success: false,
          error: 'SMS template with this name already exists',
        });
        return;
      }
      console.error('Error updating SMS template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update SMS template',
        message: error.message,
      });
    }
  };

  /**
   * Delete an SMS template
   */
  deleteSmsTemplate = async (req: Request | HybridAuthRequest, res: Response): Promise<void> => {
    try {
      // Get projectId from middleware (extracted from API key) or params
      const projectId = (req as HybridAuthRequest).projectId || (req.params.projectId ? parseInt(req.params.projectId) : null);
      if (!projectId) {
        res.status(400).json({ success: false, error: 'Project ID is required' });
        return;
      }
      const { templateId } = req.params;

      const query = `
        DELETE FROM skaftin_system_sms_templates
        WHERE id = $1 AND project_id = $2
        RETURNING id
      `;

      const result = await this.pool.query(query, [templateId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'SMS template not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'SMS template deleted successfully',
      });
    } catch (error: any) {
      console.error('Error deleting SMS template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete SMS template',
        message: error.message,
      });
    }
  };
}

export default CommunicationsController;

