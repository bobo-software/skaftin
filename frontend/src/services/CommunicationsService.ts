import RequestUtils from '../utils/RequestUtils';
import ApiRoutes from '../constants/ApiRoutes';

export interface EmailProvider {
  id?: number;
  project_id: string;
  name: string;
  provider_type: 'nodemailer' | 'mailtrap';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password?: string; // Optional when reading (not returned from API)
  from_email: string;
  from_name?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateEmailProviderRequest {
  name: string;
  provider_type: 'nodemailer' | 'mailtrap';
  smtp_host: string;
  smtp_port: number;
  smtp_secure: boolean;
  smtp_user: string;
  smtp_password: string;
  from_email: string;
  from_name?: string;
  is_active?: boolean;
}

export interface UpdateEmailProviderRequest {
  name?: string;
  provider_type?: 'nodemailer' | 'mailtrap';
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_password?: string;
  from_email?: string;
  from_name?: string;
  is_active?: boolean;
}

export interface SendEmailRequest {
  provider_id: number;
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Array<{
    filename: string;
    content: string;
    encoding?: string;
  }>;
}

class CommunicationsService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  /**
   * List all email providers for a project
   */
  async listEmailProviders(projectId: string): Promise<EmailProvider[]> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.COMMUNICATIONS.LIST_PROVIDERS(projectId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list email providers');
    } catch (error: any) {
      console.error('Error listing email providers:', error);
      throw new Error(error.message || 'Failed to list email providers');
    }
  }

  /**
   * Get a specific email provider by ID
   */
  async getEmailProvider(projectId: string, providerId: string): Promise<EmailProvider> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.COMMUNICATIONS.GET_PROVIDER(projectId, providerId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get email provider');
    } catch (error: any) {
      console.error('Error getting email provider:', error);
      throw new Error(error.message || 'Failed to get email provider');
    }
  }

  /**
   * Create a new email provider
   */
  async createEmailProvider(projectId: string, data: CreateEmailProviderRequest): Promise<EmailProvider> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.COMMUNICATIONS.CREATE_PROVIDER(projectId),
        this.getToken(),
        data
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to create email provider');
    } catch (error: any) {
      console.error('Error creating email provider:', error);
      throw new Error(error.message || 'Failed to create email provider');
    }
  }

  /**
   * Update an existing email provider
   */
  async updateEmailProvider(
    projectId: string,
    providerId: string,
    data: UpdateEmailProviderRequest
  ): Promise<EmailProvider> {
    try {
      const response = await RequestUtils.put(
        ApiRoutes.COMMUNICATIONS.UPDATE_PROVIDER(projectId, providerId),
        this.getToken(),
        data
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update email provider');
    } catch (error: any) {
      console.error('Error updating email provider:', error);
      throw new Error(error.message || 'Failed to update email provider');
    }
  }

  /**
   * Delete an email provider
   */
  async deleteEmailProvider(projectId: string, providerId: string): Promise<void> {
    try {
      const response = await RequestUtils.delete(
        ApiRoutes.COMMUNICATIONS.DELETE_PROVIDER(projectId, providerId),
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete email provider');
      }
    } catch (error: any) {
      console.error('Error deleting email provider:', error);
      throw new Error(error.message || 'Failed to delete email provider');
    }
  }

  /**
   * Test email provider connection
   */
  async testConnection(projectId: string, providerId: string): Promise<boolean> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.COMMUNICATIONS.TEST_CONNECTION(projectId, providerId),
        this.getToken(),
        {}
      );

      return response.success;
    } catch (error: any) {
      console.error('Error testing email connection:', error);
      throw new Error(error.message || 'Connection test failed');
    }
  }

  /**
   * Send an email using a specific provider
   */
  async sendEmail(projectId: string, data: SendEmailRequest): Promise<any> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.COMMUNICATIONS.SEND_EMAIL(projectId),
        this.getToken(),
        data
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to send email');
    } catch (error: any) {
      console.error('Error sending email:', error);
      throw new Error(error.message || 'Failed to send email');
    }
  }
}

export default new CommunicationsService();

