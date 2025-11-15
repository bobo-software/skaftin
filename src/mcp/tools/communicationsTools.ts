import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';

// Legacy export for backward compatibility during migration
export interface CommunicationsToolsConfig {
  pool: Pool;
}

export function createCommunicationsTools(config: CommunicationsToolsConfig): Tool[] {
  return [
    {
      name: 'list_email_providers',
      description: 'List all email providers configured for a project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
        },
        required: ['projectId'],
      },
    },
    {
      name: 'get_email_provider',
      description: 'Get details of a specific email provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          providerId: {
            type: 'string',
            description: 'Email provider ID',
          },
        },
        required: ['projectId', 'providerId'],
      },
    },
    {
      name: 'create_email_provider',
      description: 'Create a new email provider (SMTP configuration)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          name: {
            type: 'string',
            description: 'Provider name',
          },
          provider_type: {
            type: 'string',
            enum: ['nodemailer', 'mailtrap'],
            description: 'Provider type',
          },
          smtp_host: {
            type: 'string',
            description: 'SMTP host',
          },
          smtp_port: {
            type: 'number',
            description: 'SMTP port (587, 465, 2525, or 25)',
          },
          smtp_secure: {
            type: 'boolean',
            description: 'Use SSL/TLS (true for port 465, false for 587)',
          },
          smtp_user: {
            type: 'string',
            description: 'SMTP username',
          },
          smtp_password: {
            type: 'string',
            description: 'SMTP password',
          },
          from_email: {
            type: 'string',
            description: 'From email address',
          },
          from_name: {
            type: 'string',
            description: 'From name (optional)',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether provider is active (default: true)',
          },
        },
        required: ['projectId', 'name', 'provider_type', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'from_email'],
      },
    },
    {
      name: 'update_email_provider',
      description: 'Update an existing email provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          providerId: {
            type: 'string',
            description: 'Email provider ID',
          },
          name: {
            type: 'string',
            description: 'Provider name',
          },
          smtp_host: {
            type: 'string',
            description: 'SMTP host',
          },
          smtp_port: {
            type: 'number',
            description: 'SMTP port',
          },
          smtp_secure: {
            type: 'boolean',
            description: 'Use SSL/TLS',
          },
          smtp_user: {
            type: 'string',
            description: 'SMTP username',
          },
          smtp_password: {
            type: 'string',
            description: 'SMTP password (leave empty to keep existing)',
          },
          from_email: {
            type: 'string',
            description: 'From email address',
          },
          from_name: {
            type: 'string',
            description: 'From name',
          },
          is_active: {
            type: 'boolean',
            description: 'Whether provider is active',
          },
        },
        required: ['projectId', 'providerId'],
      },
    },
    {
      name: 'delete_email_provider',
      description: 'Delete an email provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          providerId: {
            type: 'string',
            description: 'Email provider ID',
          },
        },
        required: ['projectId', 'providerId'],
      },
    },
    {
      name: 'test_email_connection',
      description: 'Test SMTP connection for an email provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          providerId: {
            type: 'string',
            description: 'Email provider ID',
          },
        },
        required: ['projectId', 'providerId'],
      },
    },
    {
      name: 'send_email',
      description: 'Send an email using a configured email provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Project ID',
          },
          provider_id: {
            type: 'number',
            description: 'Email provider ID to use',
          },
          to: {
            type: ['string', 'array'],
            description: 'Recipient email address(es)',
          },
          subject: {
            type: 'string',
            description: 'Email subject',
          },
          text: {
            type: 'string',
            description: 'Plain text email body',
          },
          html: {
            type: 'string',
            description: 'HTML email body',
          },
          cc: {
            type: ['string', 'array'],
            description: 'CC recipients',
          },
          bcc: {
            type: ['string', 'array'],
            description: 'BCC recipients',
          },
          attachments: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                filename: { type: 'string' },
                content: { type: 'string', description: 'Base64 encoded content' },
                encoding: { type: 'string' },
              },
            },
            description: 'Email attachments',
          },
        },
        required: ['projectId', 'provider_id', 'to', 'subject'],
      },
    },
  ];
}

// Legacy export for backward compatibility during migration
export async function handleCommunicationsTool(
  name: string,
  args: any,
  config: CommunicationsToolsConfig
): Promise<any> {
  const { pool } = config;

  switch (name) {
    case 'list_email_providers': {
      const { projectId } = args;
      const query = `
        SELECT id, project_id, name, provider_type, smtp_host, smtp_port, 
               smtp_secure, smtp_user, from_email, from_name, is_active, 
               created_at, updated_at
        FROM email_providers
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;
      const result = await pool.query(query, [projectId]);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              providers: result.rows,
              count: result.rows.length,
            }, null, 2),
          },
        ],
      };
    }

    case 'get_email_provider': {
      const { projectId, providerId } = args;
      const query = `
        SELECT id, project_id, name, provider_type, smtp_host, smtp_port, 
               smtp_secure, smtp_user, from_email, from_name, is_active, 
               created_at, updated_at
        FROM email_providers
        WHERE id = $1 AND project_id = $2
      `;
      const result = await pool.query(query, [providerId, projectId]);
      
      if (result.rows.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Email provider not found',
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              provider: result.rows[0],
            }, null, 2),
          },
        ],
      };
    }

    case 'create_email_provider': {
      const {
        projectId,
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
      } = args;

      const query = `
        INSERT INTO email_providers 
        (project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, 
         smtp_user, smtp_password, from_email, from_name, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, project_id, name, provider_type, smtp_host, smtp_port, 
                  smtp_secure, smtp_user, from_email, from_name, is_active, 
                  created_at, updated_at
      `;

      const result = await pool.query(query, [
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

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              provider: result.rows[0],
              message: 'Email provider created successfully',
            }, null, 2),
          },
        ],
      };
    }

    case 'update_email_provider': {
      const { projectId, providerId, ...updates } = args;

      const fields: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          fields.push(`${key} = $${paramIndex++}`);
          values.push(value);
        }
      });

      if (fields.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'No fields to update',
              }, null, 2),
            },
          ],
        };
      }

      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(providerId, projectId);

      const query = `
        UPDATE email_providers
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex++} AND project_id = $${paramIndex++}
        RETURNING id, project_id, name, provider_type, smtp_host, smtp_port, 
                  smtp_secure, smtp_user, from_email, from_name, is_active, 
                  created_at, updated_at
      `;

      const result = await pool.query(query, values);

      if (result.rows.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Email provider not found',
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              provider: result.rows[0],
              message: 'Email provider updated successfully',
            }, null, 2),
          },
        ],
      };
    }

    case 'delete_email_provider': {
      const { projectId, providerId } = args;

      const query = `
        DELETE FROM email_providers
        WHERE id = $1 AND project_id = $2
        RETURNING id
      `;

      const result = await pool.query(query, [providerId, projectId]);

      if (result.rows.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Email provider not found',
              }, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Email provider deleted successfully',
            }, null, 2),
          },
        ],
      };
    }

    case 'test_email_connection': {
      const { projectId, providerId } = args;

      const query = `
        SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password
        FROM email_providers
        WHERE id = $1 AND project_id = $2
      `;

      const result = await pool.query(query, [providerId, projectId]);

      if (result.rows.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Email provider not found',
              }, null, 2),
            },
          ],
        };
      }

      const provider = result.rows[0];

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

        await transporter.verify();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Connection successful',
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Connection failed',
                message: error.message,
              }, null, 2),
            },
          ],
        };
      }
    }

    case 'send_email': {
      const { projectId, provider_id, to, subject, text, html, cc, bcc, attachments } = args;

      // Get provider details
      const providerQuery = `
        SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, 
               from_email, from_name, is_active
        FROM email_providers
        WHERE id = $1 AND project_id = $2
      `;

      const providerResult = await pool.query(providerQuery, [provider_id, projectId]);

      if (providerResult.rows.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Email provider not found',
              }, null, 2),
            },
          ],
        };
      }

      const provider = providerResult.rows[0];

      if (!provider.is_active) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Email provider is not active',
              }, null, 2),
            },
          ],
        };
      }

      try {
        const transporter = nodemailer.createTransport({
          host: provider.smtp_host,
          port: provider.smtp_port,
          secure: provider.smtp_secure,
          auth: {
            user: provider.smtp_user,
            pass: provider.smtp_password,
          },
        });

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

        const info = await transporter.sendMail(mailOptions);

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: 'Email sent successfully',
                messageId: info.messageId,
                accepted: info.accepted,
                rejected: info.rejected,
              }, null, 2),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: 'Failed to send email',
                message: error.message,
              }, null, 2),
            },
          ],
        };
      }
    }

    default:
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ error: `Unknown communications tool: ${name}` }, null, 2)
        }],
        isError: true
      };
  }
}

/**
 * Internal handler that works with MCPToolsConfig
 */
async function handleCommunicationsToolInternal(
  toolName: string,
  args: any,
  config: MCPToolsConfig,
  context?: ToolExecutionContext
): Promise<MCPToolResult> {
  return handleCommunicationsTool(toolName, args, config);
}

/**
 * Communications tools module
 */
export const communicationsToolModule: ToolModule = {
  category: ToolCategory.COMMUNICATIONS,
  metadata: {
    name: 'communications',
    description: 'Email and communication management tools',
    category: ToolCategory.COMMUNICATIONS,
  },
  createTools: (config: MCPToolsConfig): Tool[] => createCommunicationsTools(config),
  handleTool: handleCommunicationsToolInternal,
  getToolNames: (): string[] => {
    return [
      'list_email_providers',
      'get_email_provider',
      'create_email_provider',
      'update_email_provider',
      'delete_email_provider',
      'test_email_connection',
      'send_email',
    ];
  },
  getClientSafeTools: (): string[] => {
    // No communications tools are client-safe (admin only)
    return [];
  },
};

