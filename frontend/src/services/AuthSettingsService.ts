import RequestUtils from '../utils/RequestUtils';

export interface AuthSettings {
  id: number;
  project_id: number;
  allow_duplicate_emails: boolean;
  require_email_verification: boolean;
  require_phone_verification: boolean;
  enable_password_reset: boolean;
  enable_mfa: boolean;
  registration_enabled: boolean;
  auth_enabled: boolean;
  default_role_id?: number;
  email_provider_id?: number;
  sms_provider_id?: number;
  send_registration_email: boolean;
  send_registration_sms?: boolean;
  send_verification_email: boolean;
  send_verification_sms?: boolean;
  send_password_reset_email: boolean;
  send_password_reset_sms?: boolean;
  send_welcome_email: boolean;
  send_welcome_sms?: boolean;
  require_otp_for_password_change?: boolean;
  require_otp_for_account_deletion?: boolean;
  otp_length?: number;
  settings_json: any;
  created_at: string;
  updated_at: string;
}

export interface UpdateAuthSettingsRequest {
  allow_duplicate_emails?: boolean;
  require_email_verification?: boolean;
  require_phone_verification?: boolean;
  enable_password_reset?: boolean;
  enable_mfa?: boolean;
  registration_enabled?: boolean;
  auth_enabled?: boolean;
  default_role_id?: number;
  email_provider_id?: number;
  sms_provider_id?: number;
  send_registration_email?: boolean;
  send_registration_sms?: boolean;
  send_verification_email?: boolean;
  send_verification_sms?: boolean;
  send_password_reset_email?: boolean;
  send_password_reset_sms?: boolean;
  send_welcome_email?: boolean;
  send_welcome_sms?: boolean;
  require_otp_for_password_change?: boolean;
  require_otp_for_account_deletion?: boolean;
  otp_length?: number;
  settings_json?: any;
}

export interface EmailProvider {
  id: number;
  name: string;
  provider_type: string;
  from_email: string;
  is_active: boolean;
}

export interface SmsProvider {
  id: number;
  name: string;
  provider_type: string;
  post_url: string;
  is_active: boolean;
}

export interface SessionDuration {
  id: number;
  role_name: string;
  role_key: string;
  session_duration_minutes: number;
  is_system_role: boolean;
  session_duration_hours: number;
  session_duration_days: number;
}

class AuthSettingsService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  /**
   * Get auth settings for a project
   */
  async getAuthSettings(projectId: string): Promise<AuthSettings> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/settings`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get auth settings');
    } catch (error: any) {
      console.error('Error getting auth settings:', error);
      throw new Error(error.message || 'Failed to get auth settings');
    }
  }

  /**
   * Update auth settings for a project
   */
  async updateAuthSettings(projectId: string, updates: UpdateAuthSettingsRequest): Promise<AuthSettings> {
    try {
      const response = await RequestUtils.put(
        `/api/auth/${projectId}/settings`,
        this.getToken(),
        updates
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update auth settings');
    } catch (error: any) {
      console.error('Error updating auth settings:', error);
      throw new Error(error.message || 'Failed to update auth settings');
    }
  }

  /**
   * Get session configuration for a specific role
   */
  async getSessionConfig(projectId: string, roleId: string): Promise<any> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/settings/session-config/${roleId}`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get session config');
    } catch (error: any) {
      console.error('Error getting session config:', error);
      throw new Error(error.message || 'Failed to get session config');
    }
  }

  /**
   * Send verification email to a user
   */
  async sendVerificationEmail(projectId: string, userId?: string, email?: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/settings/send-verification`,
        this.getToken(),
        { user_id: userId, email }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to send verification email');
      }
    } catch (error: any) {
      console.error('Error sending verification email:', error);
      throw new Error(error.message || 'Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(projectId: string, email: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/settings/send-reset`,
        this.getToken(),
        { email }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to send password reset email');
      }
    } catch (error: any) {
      console.error('Error sending password reset email:', error);
      throw new Error(error.message || 'Failed to send password reset email');
    }
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(projectId: string, userId: string, code: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/settings/verify-otp`,
        this.getToken(),
        { user_id: userId, code }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to verify OTP');
      }
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      throw new Error(error.message || 'Failed to verify OTP');
    }
  }

  /**
   * Get all session durations for roles in a project
   */
  async getAllSessionDurations(projectId: string): Promise<SessionDuration[]> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/settings/session-durations`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get session durations');
    } catch (error: any) {
      console.error('Error getting session durations:', error);
      throw new Error(error.message || 'Failed to get session durations');
    }
  }

  /**
   * Test email provider configuration
   */
  async testEmailProvider(projectId: string, testEmail: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/settings/test-email-provider`,
        this.getToken(),
        { test_email: testEmail }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to test email provider');
      }
    } catch (error: any) {
      console.error('Error testing email provider:', error);
      throw new Error(error.message || 'Failed to test email provider');
    }
  }

  /**
   * Get available email providers for the project
   */
  async getEmailProviders(projectId: string): Promise<EmailProvider[]> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/settings/email-providers`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get email providers');
    } catch (error: any) {
      console.error('Error getting email providers:', error);
      throw new Error(error.message || 'Failed to get email providers');
    }
  }

  /**
   * Get available SMS providers for the project
   */
  async getSmsProviders(projectId: string): Promise<SmsProvider[]> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/settings/sms-providers`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get SMS providers');
    } catch (error: any) {
      console.error('Error getting SMS providers:', error);
      throw new Error(error.message || 'Failed to get SMS providers');
    }
  }

  /**
   * Test SMS provider configuration
   */
  async testSmsProvider(projectId: string, destination: string, message?: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/settings/test-sms-provider`,
        this.getToken(),
        { test_destination: destination, message }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to test SMS provider');
      }
    } catch (error: any) {
      console.error('Error testing SMS provider:', error);
      throw new Error(error.message || 'Failed to test SMS provider');
    }
  }
}

export default new AuthSettingsService();

