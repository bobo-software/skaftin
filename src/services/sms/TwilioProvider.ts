import axios from 'axios';
import { BaseSmsProvider, SmsMessage, SendSmsResult } from './BaseSmsProvider';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  phoneNumber?: string;
}

export class TwilioProvider implements BaseSmsProvider {
  private readonly config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  async send(messages: SmsMessage[]): Promise<SendSmsResult> {
    const { accountSid, authToken, messagingServiceSid, phoneNumber } = this.config;

    // Twilio requires either MessagingServiceSid or From phone number
    if (!messagingServiceSid && !phoneNumber) {
      return {
        success: false,
        error: 'Twilio requires either a Messaging Service SID or a From phone number',
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const results: any[] = [];
    const errors: any[] = [];

    for (const message of messages) {
      try {
        // Build form data for Twilio API
        const params = new URLSearchParams();
        params.append('To', message.destination);
        params.append('Body', message.content);

        // Use MessagingServiceSid if available, otherwise use From phone number
        if (messagingServiceSid) {
          params.append('MessagingServiceSid', messagingServiceSid);
        } else if (phoneNumber) {
          params.append('From', phoneNumber);
        }

        const response = await axios.post(url, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: accountSid,
            password: authToken,
          },
        });

        results.push({
          to: message.destination,
          sid: response.data.sid,
          status: response.data.status,
        });
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response) {
          errors.push({
            to: message.destination,
            error: error.response.data,
          });
        } else {
          errors.push({
            to: message.destination,
            error: error.message || error,
          });
        }
      }
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: errors,
        providerResponse: results,
      };
    }

    return {
      success: true,
      providerResponse: results,
    };
  }
}
