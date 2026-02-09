import axios from 'axios';
import { BaseSmsProvider, SmsMessage, SendSmsResult, MessageStatusResult } from './BaseSmsProvider';

export interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
  phoneNumber?: string;
  whatsappFrom?: string;
}

/**
 * Map of common Twilio error codes to human-readable explanations and troubleshooting tips.
 */
export const TWILIO_ERROR_CODE_MAP: Record<number, { explanation: string; troubleshooting?: string }> = {
  63016: {
    explanation: 'Recipient has not opted-in to receive WhatsApp messages. They must send a message to your Twilio WhatsApp number first.',
    troubleshooting:
      'To fix this:\n1. Have the recipient send a WhatsApp message to your Twilio WhatsApp number\n2. If using Twilio Sandbox, they need to send: join [your-sandbox-code]\n3. Check your Twilio Console → Messaging → Try it out for the exact opt-in code',
  },
  63007: {
    explanation: 'Invalid WhatsApp number format. Ensure number is in E.164 format (+[country][number]).',
  },
  21608: {
    explanation: 'Recipient has unsubscribed / opted out of messages from this number.',
  },
  21610: {
    explanation: 'The destination number is not a valid WhatsApp number.',
  },
  30003: {
    explanation: 'Unreachable destination handset. The phone may be off or out of coverage area.',
  },
  30004: {
    explanation: 'Message blocked by carrier or recipient filtering.',
  },
  30005: {
    explanation: 'Unknown destination. The phone number is invalid or does not exist.',
  },
  21704: {
    explanation: 'The Messaging Service contains no phone numbers in its sender pool.',
    troubleshooting:
      'To fix this:\n1. Go to Twilio Console → Messaging → Services → [Your Service] → Senders\n2. Add at least one phone number to the service\n3. Or switch to using a direct From phone number instead of a Messaging Service SID',
  },
};

/**
 * Map of Twilio message statuses to human-readable explanations.
 */
const STATUS_EXPLANATION_MAP: Record<string, string> = {
  queued: 'Message is queued for sending',
  sending: 'Message is being sent',
  sent: 'Message was sent to the carrier/provider',
  delivered: 'Message was delivered to recipient',
  undelivered: 'Message could not be delivered',
  failed: 'Message failed to send',
  received: 'Inbound message was received',
  read: 'Message was read by the recipient (WhatsApp only)',
};

export class TwilioProvider implements BaseSmsProvider {
  private readonly config: TwilioConfig;

  constructor(config: TwilioConfig) {
    this.config = config;
  }

  /**
   * Format a phone number to E.164 format.
   * Handles South African numbers starting with '0' (converts to +27...).
   */
  static formatPhoneNumber(phone: string): string {
    let formatted = phone.trim();
    if (formatted.startsWith('0')) {
      formatted = `+27${formatted.replace(/^0/, '')}`;
    } else if (!formatted.startsWith('+')) {
      formatted = `+${formatted}`;
    }
    return formatted;
  }

  /**
   * Look up the explanation for a Twilio error code.
   */
  static getErrorCodeExplanation(errorCode: number | null): { explanation: string; troubleshooting?: string } | null {
    if (errorCode == null) return null;
    return TWILIO_ERROR_CODE_MAP[errorCode] ?? null;
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
        const formattedTo = TwilioProvider.formatPhoneNumber(message.destination);

        // Build form data for Twilio API
        const params = new URLSearchParams();
        params.append('To', formattedTo);
        params.append('Body', message.content);

        // Prefer direct From phone number (more reliable); fall back to MessagingServiceSid
        // Using MessagingServiceSid alone can fail with error 21704 if the service
        // has no phone numbers in its sender pool.
        if (phoneNumber) {
          params.append('From', phoneNumber);
        } else if (messagingServiceSid) {
          params.append('MessagingServiceSid', messagingServiceSid);
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
          to: formattedTo,
          from: phoneNumber || messagingServiceSid || null,
          sid: response.data.sid,
          status: response.data.status,
          errorCode: response.data.error_code ?? null,
          errorMessage: response.data.error_message ?? null,
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

  async sendWhatsApp(messages: SmsMessage[]): Promise<SendSmsResult> {
    const { accountSid, authToken, whatsappFrom, phoneNumber } = this.config;

    // Determine WhatsApp sender
    const from = whatsappFrom || (phoneNumber ? `whatsapp:${phoneNumber}` : null);
    if (!from) {
      return {
        success: false,
        error: 'Twilio WhatsApp requires a whatsapp_from number or a phone_number configured on the provider',
      };
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const results: any[] = [];
    const errors: any[] = [];

    for (const message of messages) {
      try {
        const formattedPhone = TwilioProvider.formatPhoneNumber(message.destination);
        const whatsappTo = `whatsapp:${formattedPhone}`;

        const params = new URLSearchParams();
        params.append('To', whatsappTo);
        params.append('From', from);
        params.append('Body', message.content);

        const response = await axios.post(url, params.toString(), {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          auth: {
            username: accountSid,
            password: authToken,
          },
        });

        const errorCode = response.data.error_code ?? null;
        const errorInfo = TwilioProvider.getErrorCodeExplanation(errorCode);

        results.push({
          to: whatsappTo,
          from,
          sid: response.data.sid,
          status: response.data.status,
          errorCode,
          errorMessage: response.data.error_message ?? null,
          errorCodeExplanation: errorInfo?.explanation ?? null,
          troubleshooting: errorInfo?.troubleshooting ?? null,
          dateCreated: response.data.date_created ?? null,
          dateSent: response.data.date_sent ?? null,
          dateUpdated: response.data.date_updated ?? null,
        });
      } catch (error: any) {
        if (axios.isAxiosError(error) && error.response) {
          const code = error.response.data?.code ?? null;
          const errorInfo = TwilioProvider.getErrorCodeExplanation(code);
          errors.push({
            to: message.destination,
            error: error.response.data,
            errorCodeExplanation: errorInfo?.explanation ?? null,
            troubleshooting: errorInfo?.troubleshooting ?? null,
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

  async getMessageStatus(messageSid: string): Promise<MessageStatusResult> {
    const { accountSid, authToken } = this.config;
    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}.json`;

    const response = await axios.get(url, {
      auth: {
        username: accountSid,
        password: authToken,
      },
    });

    const data = response.data;
    const errorCode = data.error_code ?? null;
    const errorInfo = TwilioProvider.getErrorCodeExplanation(errorCode);

    return {
      messageSid: data.sid,
      status: data.status,
      to: data.to,
      from: data.from,
      body: data.body ?? null,
      errorCode,
      errorMessage: data.error_message ?? null,
      errorCodeExplanation: errorInfo?.explanation ?? null,
      dateCreated: data.date_created ?? null,
      dateSent: data.date_sent ?? null,
      dateUpdated: data.date_updated ?? null,
      price: data.price ?? null,
      priceUnit: data.price_unit ?? null,
      statusExplanation: STATUS_EXPLANATION_MAP[data.status] ?? undefined,
      troubleshooting: errorInfo?.troubleshooting ?? null,
    };
  }
}
