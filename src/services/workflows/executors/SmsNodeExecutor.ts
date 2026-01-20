import { PoolClient } from 'pg';
import { WorkflowNode, NodeExecutionResult } from '../../../types/workflow.types';
import { BaseNodeExecutor } from './BaseNodeExecutor';
import { BaseSmsProvider, SmsMessage } from '../../sms/BaseSmsProvider';
import { MyMobileApiProvider } from '../../sms/MyMobileApiProvider';
import { TwilioProvider } from '../../sms/TwilioProvider';

/**
 * SmsNodeExecutor - Sends SMS messages using SMS templates
 */
export class SmsNodeExecutor extends BaseNodeExecutor {
  protected async executeNode(node: WorkflowNode): Promise<NodeExecutionResult> {
    const startTime = Date.now();

    try {
      const { templateId, recipientPhone, providerId, projectId, variableMappings } = node.data;

      if (!templateId) {
        return this.fail('SMS template ID is required', Date.now() - startTime);
      }

      if (!recipientPhone) {
        return this.fail('Recipient phone number is required', Date.now() - startTime);
      }

      if (!providerId) {
        return this.fail('SMS provider ID is required', Date.now() - startTime);
      }

      // Resolve recipient phone (may contain variables)
      const resolvedRecipientPhone = this.substituteVariables(recipientPhone);
      
      console.log('[SmsNodeExecutor] Variable mappings:', variableMappings);

      // Validate phone format (basic validation - can be enhanced)
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(resolvedRecipientPhone.replace(/[\s\-\(\)]/g, ''))) {
        return this.fail(`Invalid phone number: ${resolvedRecipientPhone}`, Date.now() - startTime);
      }

      // Get SMS template from public schema
      const templateQuery = `
        SELECT id, project_id, name, content, variables
        FROM public.sms_templates
        WHERE id = $1 AND project_id = $2
      `;
      const templateResult = await this.client.query(templateQuery, [templateId, projectId]);

      if (templateResult.rows.length === 0) {
        return this.fail(`SMS template with ID ${templateId} not found`, Date.now() - startTime);
      }

      const template = templateResult.rows[0];

      // Resolve variables in template content
      // First, replace template variables with their mapped values
      let contentWithMappings = template.content;
      
      if (variableMappings && typeof variableMappings === 'object') {
        // Replace each template variable with its mapped value
        Object.keys(variableMappings).forEach((templateVar) => {
          const mappedValue = variableMappings[templateVar];
          if (mappedValue) {
            const templateVarPattern = new RegExp(`\\{\\{${templateVar}\\}\\}`, 'g');
            contentWithMappings = contentWithMappings.replace(templateVarPattern, mappedValue);
          }
        });
      }
      
      // Then resolve any remaining workflow variables (like {{nodeId.field}})
      const resolvedContent = this.substituteVariables(contentWithMappings);
      
      console.log('[SmsNodeExecutor] Resolved template content:', {
        content: resolvedContent,
      });

      // Get SMS provider from public schema
      const providerQuery = `
        SELECT id, project_id, name, provider_type, api_key, api_secret, post_url, 
               messaging_service_sid, phone_number, is_active
        FROM public.sms_providers
        WHERE id = $1 AND project_id = $2
      `;
      const providerResult = await this.client.query(providerQuery, [providerId, projectId]);

      if (providerResult.rows.length === 0) {
        return this.fail(`SMS provider with ID ${providerId} not found`, Date.now() - startTime);
      }

      const providerRecord = providerResult.rows[0];

      if (!providerRecord.is_active) {
        return this.fail('SMS provider is not active', Date.now() - startTime);
      }

      // Build provider instance
      let provider: BaseSmsProvider;
      if (providerRecord.provider_type === 'mymobileapi' || providerRecord.provider_type === 'sa_mobile_sms') {
        provider = new MyMobileApiProvider({
          apiKey: providerRecord.api_key,
          apiSecret: providerRecord.api_secret,
          postUrl: providerRecord.post_url,
        });
      } else if (providerRecord.provider_type === 'twilio') {
        provider = new TwilioProvider({
          accountSid: providerRecord.api_key,
          authToken: providerRecord.api_secret,
          messagingServiceSid: providerRecord.messaging_service_sid,
          phoneNumber: providerRecord.phone_number,
        });
      } else {
        return this.fail(`Unsupported SMS provider type: ${providerRecord.provider_type}`, Date.now() - startTime);
      }

      // Send SMS
      this.log(`Sending SMS to ${resolvedRecipientPhone} using template "${template.name}"`);
      const messages: SmsMessage[] = [
        {
          content: resolvedContent,
          destination: resolvedRecipientPhone,
        },
      ];
      
      const result = await provider.send(messages);

      if (!result.success) {
        return this.fail(
          result.error ? String(result.error) : 'Failed to send SMS',
          Date.now() - startTime
        );
      }

      this.log(`SMS sent successfully`);

      return this.success(
        {
          recipient: resolvedRecipientPhone,
          template: template.name,
          providerResponse: result.providerResponse,
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

