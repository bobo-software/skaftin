import axios from 'axios';
import { BaseSmsProvider, SmsMessage, SendSmsResult } from './BaseSmsProvider';

export interface MyMobileApiConfig {
  apiKey: string;
  apiSecret: string;
  postUrl: string;
}

export class MyMobileApiProvider implements BaseSmsProvider {
  private readonly config: MyMobileApiConfig;

  constructor(config: MyMobileApiConfig) {
    this.config = config;
  }

  async send(messages: SmsMessage[]): Promise<SendSmsResult> {
    const credentials = `${this.config.apiKey}:${this.config.apiSecret}`;
    const base64Credentials = Buffer.from(credentials).toString('base64');

    const headers = {
      Authorization: `Basic ${base64Credentials}`,
      'Content-Type': 'application/json',
    };

    const payload = {
      messages: messages.map((m) => ({
        content: m.content,
        destination: m.destination,
      })),
    };

    try {
      const response = await axios.post(this.config.postUrl, JSON.stringify(payload), { headers });
      return { success: true, providerResponse: response.data };
    } catch (error: any) {
      if (axios.isAxiosError(error) && error.response) {
        return { success: false, error: error.response.data };
      }
      return { success: false, error };
    }
  }
}


