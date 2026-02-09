import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import { ToolModule, ToolCategory, MCPToolsConfig, MCPToolResult, ToolExecutionContext } from '../registry/types';
import { SmsService } from '../../services/sms/SmsService';

// Legacy export for backward compatibility during migration
export interface CommunicationsToolsConfig {
  pool: Pool;
}

export function createCommunicationsTools(config: CommunicationsToolsConfig): Tool[] {
  // Keep tool surface small to stay well under admin tool limit.
  return [
    // Email (essential only)
    {
      name: 'list_skaftin_system_email_providers',
      description: 'List all email providers configured for a project',
      inputSchema: {
        type: 'object',
        properties: { projectId: { type: 'string', description: 'Project ID' } },
        required: ['projectId'],
      },
    },
    {
      name: 'create_email_provider',
      description: 'Create a new email provider (SMTP configuration)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          name: { type: 'string' },
          provider_type: { type: 'string', enum: ['nodemailer', 'mailtrap'] },
          smtp_host: { type: 'string' },
          smtp_port: { type: 'number' },
          smtp_secure: { type: 'boolean' },
          smtp_user: { type: 'string' },
          smtp_password: { type: 'string' },
          from_email: { type: 'string' },
          from_name: { type: 'string' },
          is_active: { type: 'boolean' },
        },
        required: ['projectId', 'name', 'provider_type', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_password', 'from_email'],
      },
    },
    {
      name: 'send_email',
      description: 'Send an email using a configured email provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          provider_id: { type: 'number' },
          to: { type: ['string', 'array'] },
          subject: { type: 'string' },
          text: { type: 'string' },
          html: { type: 'string' },
          cc: { type: ['string', 'array'] },
          bcc: { type: ['string', 'array'] },
          attachments: {
            type: 'array',
            items: { type: 'object', properties: { filename: { type: 'string' }, content: { type: 'string' }, encoding: { type: 'string' } } },
          },
        },
        required: ['projectId', 'provider_id', 'to', 'subject'],
      },
    },
    // SMS (essential only)
    {
      name: 'list_sms_providers',
      description: 'List all SMS providers configured for a project',
      inputSchema: {
        type: 'object',
        properties: { projectId: { type: 'string' } },
        required: ['projectId'],
      },
    },
    {
      name: 'create_sms_provider',
      description: 'Create a new SMS provider (SA Mobile SMS / MyMobileAPI / Twilio)',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          name: { type: 'string' },
          provider_type: { type: 'string', enum: ['mymobileapi', 'sa_mobile_sms', 'twilio'] },
          api_key: { type: 'string', description: 'API Key for MyMobileAPI/SA Mobile SMS, or Account SID for Twilio' },
          api_secret: { type: 'string', description: 'API Secret for MyMobileAPI/SA Mobile SMS, or Auth Token for Twilio' },
          post_url: { type: 'string', description: 'POST URL for MyMobileAPI/SA Mobile SMS (not required for Twilio)' },
          messaging_service_sid: { type: 'string', description: 'Twilio Messaging Service SID (optional, Twilio only)' },
          phone_number: { type: 'string', description: 'Twilio From phone number (optional, Twilio only)' },
          whatsapp_from: { type: 'string', description: 'Twilio WhatsApp sender number e.g. whatsapp:+14155238886 (optional, Twilio only)' },
          is_active: { type: 'boolean' },
        },
        required: ['projectId', 'name', 'provider_type', 'api_key', 'api_secret'],
      },
    },
    {
      name: 'send_sms',
      description: 'Send SMS messages using configured SMS provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: { content: { type: 'string' }, destination: { type: 'string' } },
              required: ['content', 'destination'],
            },
          },
        },
        required: ['projectId', 'messages'],
      },
    },
    {
      name: 'client_send_sms',
      description: 'Client-safe: send SMS within project scope using active provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: { content: { type: 'string' }, destination: { type: 'string' } },
              required: ['content', 'destination'],
            },
          },
        },
        required: ['projectId', 'messages'],
      },
    },
    // WhatsApp
    {
      name: 'send_whatsapp',
      description: 'Send WhatsApp messages using the active Twilio provider for the project',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: { content: { type: 'string' }, destination: { type: 'string' } },
              required: ['content', 'destination'],
            },
          },
        },
        required: ['projectId', 'messages'],
      },
    },
    {
      name: 'client_send_whatsapp',
      description: 'Client-safe: send WhatsApp messages within project scope using active Twilio provider',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: { content: { type: 'string' }, destination: { type: 'string' } },
              required: ['content', 'destination'],
            },
          },
        },
        required: ['projectId', 'messages'],
      },
    },
    // Message status
    {
      name: 'check_message_status',
      description: 'Check the delivery status of a sent SMS or WhatsApp message by its Twilio message SID',
      inputSchema: {
        type: 'object',
        properties: {
          projectId: { type: 'string' },
          messageSid: { type: 'string', description: 'The Twilio message SID (e.g. SM...)' },
        },
        required: ['projectId', 'messageSid'],
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
    case 'list_skaftin_system_email_providers': {
      const { projectId } = args;
      const query = `
        SELECT id, project_id, name, provider_type, smtp_host, smtp_port, 
               smtp_secure, smtp_user, from_email, from_name, is_active, 
               created_at, updated_at
        FROM skaftin_system_email_providers
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
        FROM skaftin_system_email_providers
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
        INSERT INTO skaftin_system_email_providers 
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
        UPDATE skaftin_system_email_providers
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
        DELETE FROM skaftin_system_email_providers
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
        FROM skaftin_system_email_providers
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
        FROM skaftin_system_email_providers
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

    // ====================== SMS PROVIDERS ======================
    case 'list_sms_providers': {
      const { projectId } = args;
      const query = `
        SELECT id, project_id, name, provider_type, post_url,
               messaging_service_sid, phone_number, whatsapp_from,
               is_active, created_at, updated_at
        FROM public.sms_providers
        WHERE project_id = $1
        ORDER BY created_at DESC
      `;
      const result = await pool.query(query, [projectId]);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, providers: result.rows, count: result.rows.length }, null, 2) }],
      };
    }

    case 'get_sms_provider': {
      const { projectId, providerId } = args;
      const query = `
        SELECT id, project_id, name, provider_type, post_url,
               messaging_service_sid, phone_number, whatsapp_from,
               is_active, created_at, updated_at
        FROM public.sms_providers
        WHERE id = $1 AND project_id = $2
      `;
      const result = await pool.query(query, [providerId, projectId]);
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'SMS provider not found' }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, provider: result.rows[0] }, null, 2) }] };
    }

    case 'create_sms_provider': {
      const { projectId, name, provider_type, api_key, api_secret, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active } = args;
      const query = `
        INSERT INTO public.sms_providers
        (project_id, name, provider_type, api_key, api_secret, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, true))
        RETURNING id, project_id, name, provider_type, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active, created_at, updated_at
      `;
      const result = await pool.query(query, [projectId, name, provider_type, api_key, api_secret, post_url || null, messaging_service_sid || null, phone_number || null, whatsapp_from || null, is_active]);
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: true, provider: result.rows[0] }, null, 2) }],
      };
    }

    case 'update_sms_provider': {
      const { projectId, providerId, ...updates } = args;
      const allowed = ['name', 'provider_type', 'api_key', 'api_secret', 'post_url', 'messaging_service_sid', 'phone_number', 'whatsapp_from', 'is_active'];
      const fields: string[] = [];
      const values: any[] = [];
      let idx = 1;
      for (const [k, v] of Object.entries(updates)) {
        if (allowed.includes(k) && v !== undefined && v !== null && v !== '') {
          fields.push(`${k} = $${idx++}`);
          values.push(v);
        }
      }
      if (fields.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'No fields to update' }, null, 2) }] };
      }
      fields.push('updated_at = CURRENT_TIMESTAMP');
      values.push(providerId, projectId);
      const query = `
        UPDATE public.sms_providers
        SET ${fields.join(', ')}
        WHERE id = $${idx++} AND project_id = $${idx++}
        RETURNING id, project_id, name, provider_type, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active, created_at, updated_at
      `;
      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'SMS provider not found' }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ success: true, provider: result.rows[0] }, null, 2) }] };
    }

    case 'delete_sms_provider': {
      const { projectId, providerId } = args;
      const query = `DELETE FROM public.sms_providers WHERE id = $1 AND project_id = $2 RETURNING id`;
      const result = await pool.query(query, [providerId, projectId]);
      if (result.rows.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'SMS provider not found' }, null, 2) }] };
      }
      return { content: [{ type: 'text', text: JSON.stringify({ success: true }, null, 2) }] };
    }

    case 'send_sms':
    case 'client_send_sms': {
      const { projectId, messages } = args;
      if (!Array.isArray(messages) || messages.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'messages[] is required' }, null, 2) }] };
      }
      try {
        const smsService = new SmsService(pool);
        const result = await smsService.send(projectId, messages);
        return { content: [{ type: 'text', text: JSON.stringify({ success: result.success, data: result.providerResponse, error: result.error }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error?.message ?? 'Failed to send SMS' }, null, 2) }] };
      }
    }

    case 'send_whatsapp':
    case 'client_send_whatsapp': {
      const { projectId, messages } = args;
      if (!Array.isArray(messages) || messages.length === 0) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'messages[] is required' }, null, 2) }] };
      }
      try {
        const smsService = new SmsService(pool);
        const result = await smsService.sendWhatsApp(projectId, messages);
        return { content: [{ type: 'text', text: JSON.stringify({ success: result.success, data: result.providerResponse, error: result.error }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error?.message ?? 'Failed to send WhatsApp message' }, null, 2) }] };
      }
    }

    case 'check_message_status': {
      const { projectId, messageSid } = args;
      if (!messageSid) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'messageSid is required' }, null, 2) }] };
      }
      try {
        const smsService = new SmsService(pool);
        const status = await smsService.getMessageStatus(projectId, messageSid);
        return { content: [{ type: 'text', text: JSON.stringify({ success: true, data: status }, null, 2) }] };
      } catch (error: any) {
        return { content: [{ type: 'text', text: JSON.stringify({ success: false, error: error?.message ?? 'Failed to check message status' }, null, 2) }] };
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
      'list_skaftin_system_email_providers',
      'get_email_provider',
      'create_email_provider',
      'update_email_provider',
      'delete_email_provider',
      'test_email_connection',
      'send_email',
      'list_sms_providers',
      'get_sms_provider',
      'create_sms_provider',
      'update_sms_provider',
      'delete_sms_provider',
      'send_sms',
      'client_send_sms',
      'send_whatsapp',
      'client_send_whatsapp',
      'check_message_status',
    ];
  },
  getClientSafeTools: (): string[] => {
    // Allow clients to send SMS/WhatsApp within their project scope using active provider
    return ['client_send_sms', 'client_send_whatsapp'];
  },
};

