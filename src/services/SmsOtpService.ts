import { Pool } from 'pg';
import { SmsService } from './sms/SmsService';

export class SmsOtpService {
  private pool: Pool;
  private smsService: SmsService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.smsService = new SmsService(pool);
  }

  /**
   * Send OTP via SMS (for registration/verification)
   */
  async sendOTP(projectId: string, phone: string, otp: string, userName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get project name for the SMS message
      const projectResult = await this.pool.query(
        'SELECT name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );

      const projectName = projectResult.rows.length > 0 ? projectResult.rows[0].name : 'Skaftin';

      // Construct OTP message
      const message = `Hi ${userName}, your verification code is: ${otp}. Valid for 10 minutes. - ${projectName}`;

      // Send SMS using SmsService
      const result = await this.smsService.send(projectId, [
        {
          content: message,
          destination: phone,
        },
      ]);

      if (result.success) {
        console.log(`✅ OTP SMS sent to ${phone}`);
        return { success: true };
      } else {
        console.error(`❌ Failed to send OTP SMS: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('Error sending OTP SMS:', error);
      return { success: false, error: error.message || 'Failed to send OTP SMS' };
    }
  }

  /**
   * Send password reset OTP via SMS
   */
  async sendPasswordResetOTP(projectId: string, phone: string, otp: string, userName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get project name for the SMS message
      const projectResult = await this.pool.query(
        'SELECT name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );

      const projectName = projectResult.rows.length > 0 ? projectResult.rows[0].name : 'Skaftin';

      // Construct password reset OTP message
      const message = `Hi ${userName}, your password reset code is: ${otp}. Valid for 10 minutes. If you didn't request this, ignore this message. - ${projectName}`;

      // Send SMS using SmsService
      const result = await this.smsService.send(projectId, [
        {
          content: message,
          destination: phone,
        },
      ]);

      if (result.success) {
        console.log(`✅ Password reset OTP SMS sent to ${phone}`);
        return { success: true };
      } else {
        console.error(`❌ Failed to send password reset OTP SMS: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('Error sending password reset OTP SMS:', error);
      return { success: false, error: error.message || 'Failed to send password reset OTP SMS' };
    }
  }

  /**
   * Send password change OTP via SMS (for logged-in users changing their password)
   */
  async sendPasswordChangeOTP(projectId: string, phone: string, otp: string, userName: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get project name for the SMS message
      const projectResult = await this.pool.query(
        'SELECT name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );

      const projectName = projectResult.rows.length > 0 ? projectResult.rows[0].name : 'Skaftin';

      // Construct password change OTP message
      const message = `Hi ${userName}, your password change code is: ${otp}. Valid for 10 minutes. If you didn't request this, contact support immediately. - ${projectName}`;

      // Send SMS using SmsService
      const result = await this.smsService.send(projectId, [
        {
          content: message,
          destination: phone,
        },
      ]);

      if (result.success) {
        console.log(`✅ Password change OTP SMS sent to ${phone}`);
        return { success: true };
      } else {
        console.error(`❌ Failed to send password change OTP SMS: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error: any) {
      console.error('Error sending password change OTP SMS:', error);
      return { success: false, error: error.message || 'Failed to send password change OTP SMS' };
    }
  }
}

