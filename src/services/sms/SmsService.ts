import { Pool } from 'pg';
import { BaseSmsProvider, SmsMessage, SendSmsResult } from './BaseSmsProvider';
import { MyMobileApiProvider } from './MyMobileApiProvider';

export interface SmsProviderRecord {
  id: number;
  project_id: string;
  name: string;
  provider_type: 'mymobileapi' | 'sa_mobile_sms';
  api_key: string;
  api_secret: string;
  post_url: string;
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
      SELECT id, project_id, name, provider_type, api_key, api_secret, post_url, is_active
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
}


