import { Pool } from 'pg';
import { BaseSmsProvider, SmsMessage, WhatsAppTemplateMessage, SendSmsResult, MessageStatusResult } from './BaseSmsProvider';
import { MyMobileApiProvider } from './MyMobileApiProvider';
import { TwilioProvider } from './TwilioProvider';

export interface SmsProviderRecord {
  id: number;
  project_id: string;
  name: string;
  provider_type: 'mymobileapi' | 'sa_mobile_sms' | 'twilio';
  api_key: string;
  api_secret: string;
  post_url: string;
  messaging_service_sid?: string;
  phone_number?: string;
  whatsapp_from?: string;
  is_active: boolean;
}

export class SmsService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  private async getActiveProvider(projectId: string): Promise<SmsProviderRecord | null> {
    const result = await this.pool.query(
      `
      SELECT id, project_id, name, provider_type, api_key, api_secret, post_url, 
             messaging_service_sid, phone_number, whatsapp_from, is_active
      FROM public.sms_providers
      WHERE project_id = $1 AND is_active = true
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
      `,
      [projectId]
    );
    return result.rows[0] ?? null;
  }

  private buildProvider(record: SmsProviderRecord): BaseSmsProvider {
    // Treat 'sa_mobile_sms' as alias for 'mymobileapi' wire protocol
    if (record.provider_type === 'mymobileapi' || record.provider_type === 'sa_mobile_sms') {
      return new MyMobileApiProvider({
        apiKey: record.api_key,
        apiSecret: record.api_secret,
        postUrl: record.post_url,
      });
    }

    // Twilio provider
    if (record.provider_type === 'twilio') {
      return new TwilioProvider({
        accountSid: record.api_key,
        authToken: record.api_secret,
        messagingServiceSid: record.messaging_service_sid,
        phoneNumber: record.phone_number,
        whatsappFrom: record.whatsapp_from,
      });
    }

    throw new Error(`Unsupported SMS provider_type: ${record.provider_type}`);
  }

  async send(projectId: string, messages: SmsMessage[]): Promise<SendSmsResult> {
    const providerRecord = await this.getActiveProvider(projectId);
    if (!providerRecord) {
      return { success: false, error: 'No active SMS provider configured for project' };
    }
    const provider = this.buildProvider(providerRecord);
    return provider.send(messages);
  }

  async sendWhatsApp(projectId: string, messages: SmsMessage[]): Promise<SendSmsResult> {
    const providerRecord = await this.getActiveProvider(projectId);
    if (!providerRecord) {
      return { success: false, error: 'No active SMS provider configured for project' };
    }

    const provider = this.buildProvider(providerRecord);

    if (!provider.sendWhatsApp) {
      return {
        success: false,
        error: `Provider type '${providerRecord.provider_type}' does not support WhatsApp messaging. Only Twilio providers support WhatsApp.`,
      };
    }

    return provider.sendWhatsApp(messages);
  }

  async sendWhatsAppTemplate(projectId: string, messages: WhatsAppTemplateMessage[]): Promise<SendSmsResult> {
    const providerRecord = await this.getActiveProvider(projectId);
    if (!providerRecord) {
      return { success: false, error: 'No active SMS provider configured for project' };
    }

    const provider = this.buildProvider(providerRecord);

    if (!provider.sendWhatsAppTemplate) {
      return {
        success: false,
        error: `Provider type '${providerRecord.provider_type}' does not support WhatsApp template messaging. Only Twilio providers support this feature.`,
      };
    }

    return provider.sendWhatsAppTemplate(messages);
  }

  async getMessageStatus(projectId: string, messageSid: string): Promise<MessageStatusResult> {
    const providerRecord = await this.getActiveProvider(projectId);
    if (!providerRecord) {
      throw new Error('No active SMS provider configured for project');
    }

    const provider = this.buildProvider(providerRecord);

    if (!provider.getMessageStatus) {
      throw new Error(
        `Provider type '${providerRecord.provider_type}' does not support message status tracking. Only Twilio providers support this feature.`
      );
    }

    return provider.getMessageStatus(messageSid);
  }
}
