export interface SmsMessage {
  content: string;
  destination: string;
}

export interface WhatsAppTemplateMessage {
  destination: string;
  contentSid: string;
  contentVariables?: Record<string, string> | string;
}

export interface SendSmsResult {
  success: boolean;
  providerResponse?: any;
  error?: any;
}

export interface MessageStatusResult {
  messageSid: string;
  status: string;
  to: string;
  from: string;
  body?: string;
  errorCode: number | null;
  errorMessage: string | null;
  errorCodeExplanation?: string | null;
  dateCreated: string | null;
  dateSent: string | null;
  dateUpdated: string | null;
  price: string | null;
  priceUnit: string | null;
  statusExplanation?: string;
  troubleshooting?: string | null;
}

export interface BaseSmsProvider {
  send(messages: SmsMessage[]): Promise<SendSmsResult>;
  sendWhatsApp?(messages: SmsMessage[]): Promise<SendSmsResult>;
  sendWhatsAppTemplate?(messages: WhatsAppTemplateMessage[]): Promise<SendSmsResult>;
  getMessageStatus?(messageSid: string): Promise<MessageStatusResult>;
}


