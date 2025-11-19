import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';
import nodemailer from 'nodemailer';

/**
 * EmailNodeExecutor - Sends emails using email templates
 */
export class EmailNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { templateId, recipientEmail, providerId, projectId, variableMappings } = node.data;

      if (!templateId) {
        return this.fail('Email template ID is required', Date.now() - startTime);
      }

      if (!recipientEmail) {
        return this.fail('Recipient email is required', Date.now() - startTime);
      }

      if (!providerId) {
        return this.fail('Email provider ID is required', Date.now() - startTime);
      }

      // Resolve recipient email (may contain variables)
      const resolvedRecipientEmail = this.substituteVariables(recipientEmail);
      
      console.log('[EmailNodeExecutor] Variable mappings:', variableMappings);

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(resolvedRecipientEmail)) {
        return this.fail(`Invalid email address: ${resolvedRecipientEmail}`, Date.now() - startTime);
      }

      // Get email template from public schema
      const templateQuery = `
        SELECT id, project_id, name, subject, html_content, text_content, variables
        FROM public.email_templates
        WHERE id = $1 AND project_id = $2
      `;
      const templateResult = await this.client.query(templateQuery, [templateId, projectId]);

      if (templateResult.rows.length === 0) {
        return this.fail(`Email template with ID ${templateId} not found`, Date.now() - startTime);
      }

      const template = templateResult.rows[0];

      // Get email provider from public schema
      const providerQuery = `
        SELECT id, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, 
               from_email, from_name, is_active
        FROM public.email_providers
        WHERE id = $1 AND project_id = $2
      `;
      const providerResult = await this.client.query(providerQuery, [providerId, projectId]);

      if (providerResult.rows.length === 0) {
        return this.fail(`Email provider with ID ${providerId} not found`, Date.now() - startTime);
      }

      const provider = providerResult.rows[0];

      if (!provider.is_active) {
        return this.fail('Email provider is not active', Date.now() - startTime);
      }

      // Resolve variables in template subject and content
      // First, replace template variables with their mapped values
      let subjectWithMappings = template.subject;
      let htmlContentWithMappings = template.html_content || '';
      let textContentWithMappings = template.text_content || '';
      
      if (variableMappings && typeof variableMappings === 'object') {
        // Replace each template variable with its mapped value
        Object.keys(variableMappings).forEach((templateVar) => {
          const mappedValue = variableMappings[templateVar];
          if (mappedValue) {
            const templateVarPattern = new RegExp(`\\{\\{${templateVar}\\}\\}`, 'g');
            subjectWithMappings = subjectWithMappings.replace(templateVarPattern, mappedValue);
            htmlContentWithMappings = htmlContentWithMappings.replace(templateVarPattern, mappedValue);
            textContentWithMappings = textContentWithMappings.replace(templateVarPattern, mappedValue);
          }
        });
      }
      
      // Then resolve any remaining workflow variables (like {{nodeId.field}})
      const resolvedSubject = this.substituteVariables(subjectWithMappings);
      const resolvedHtmlContent = htmlContentWithMappings
        ? this.substituteVariables(htmlContentWithMappings)
        : undefined;
      const resolvedTextContent = textContentWithMappings
        ? this.substituteVariables(textContentWithMappings)
        : undefined;
      
      console.log('[EmailNodeExecutor] Resolved template content:', {
        subject: resolvedSubject,
        hasHtml: !!resolvedHtmlContent,
        hasText: !!resolvedTextContent,
      });

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
        to: resolvedRecipientEmail,
        subject: resolvedSubject,
      };

      if (resolvedHtmlContent) {
        mailOptions.html = resolvedHtmlContent;
      }
      if (resolvedTextContent) {
        mailOptions.text = resolvedTextContent;
      }

      // Send email
      this.log(`Sending email to ${resolvedRecipientEmail} using template "${template.name}"`);
      const info = await transporter.sendMail(mailOptions);

      this.log(`Email sent successfully`, { messageId: info.messageId });

      return this.success(
        {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          recipient: resolvedRecipientEmail,
          template: template.name,
        },
        Date.now() - startTime
      );
    } catch (error) {
      return this.fail(
        error instanceof Error ? error.message : String(error),
        Date.now() - startTime
      );
    }
  }
}

