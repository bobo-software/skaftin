export interface SmsMessage {
  content: string;
  destination: string;
}

export interface SendSmsResult {
  success: boolean;
  providerResponse?: any;
  error?: any;
}

export interface BaseSmsProvider {
  send(messages: SmsMessage[]): Promise<SendSmsResult>;
}


