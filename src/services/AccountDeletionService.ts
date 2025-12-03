import { Pool } from 'pg';
import { AuthEmailService } from './AuthEmailService';
import Session from "supertokens-node/recipe/session";

/**
 * Service for processing scheduled account deletions
 * Runs daily via cron job to soft-delete accounts that have reached their deletion_scheduled_at date
 */
export class AccountDeletionService {
  private pool: Pool;
  private emailService: AuthEmailService;

  constructor(pool: Pool) {
    this.pool = pool;
    this.emailService = new AuthEmailService(pool);
  }

  /**
   * Process pending account deletions
   * Finds users where deletion_scheduled_at <= NOW() and performs soft delete
   */
  async processPendingDeletions(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    try {
      console.log('🗑️ [AccountDeletionService] Starting scheduled account deletion processing...');

      // Get all project schemas
      const schemasResult = await this.pool.query(`
        SELECT DISTINCT table_schema 
        FROM information_schema.tables 
        WHERE table_name = 'skaftin_system_users'
        AND table_schema LIKE 'project_%'
      `);

      console.log(`   └─ Found ${schemasResult.rows.length} project schema(s)`);

      // Process each schema
      for (const schemaRow of schemasResult.rows) {
        const schemaName = schemaRow.table_schema;

        try {
          // Find users ready for deletion
          const usersResult = await this.pool.query(`
            SELECT 
              u.id, 
              u.name, 
              u.email, 
              u.supertokens_user_id,
              u.deletion_scheduled_at,
              p.id as project_id,
              p.name as project_name
            FROM ${schemaName}.skaftin_system_users u
            INNER JOIN skaftin_system_projects p ON p.schema_name = $1
            WHERE u.deletion_scheduled_at IS NOT NULL
            AND u.deletion_scheduled_at <= NOW()
            AND u.deleted_at IS NULL
            AND u.is_active = true
          `, [schemaName]);

          if (usersResult.rows.length === 0) {
            continue; // No users to process in this schema
          }

          console.log(`   └─ Schema ${schemaName}: Found ${usersResult.rows.length} user(s) ready for deletion`);

          // Process each user
          for (const user of usersResult.rows) {
            try {
              console.log(`      └─ Processing user: ${user.email} (ID: ${user.id})`);

              // Perform soft delete
              await this.pool.query(`
                UPDATE ${schemaName}.skaftin_system_users
                SET is_active = false,
                    deleted_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
              `, [user.id]);

              console.log('         ✅ User deactivated (soft deleted)');

              // Revoke all SuperTokens sessions for this user
              if (user.supertokens_user_id) {
                try {
                  await Session.revokeAllSessionsForUser(user.supertokens_user_id);
                  console.log('         ✅ All sessions revoked');
                } catch (sessionError) {
                  console.warn('         ⚠️ Failed to revoke sessions:', sessionError);
                  // Continue even if session revocation fails
                }
              }

              // Send final deletion confirmation email
              try {
                const emailResult = await this.sendFinalDeletionEmail(
                  user.project_id,
                  user.email,
                  user.name,
                  user.project_name
                );

                if (emailResult.success) {
                  console.log('         ✅ Final deletion email sent');
                } else {
                  console.warn('         ⚠️ Failed to send final deletion email:', emailResult.error);
                }
              } catch (emailError) {
                console.warn('         ⚠️ Error sending final deletion email:', emailError);
                // Continue even if email fails
              }

              processed++;
              console.log(`      └─ ✅ User deletion completed: ${user.email}`);

            } catch (userError) {
              console.error(`      └─ ❌ Error processing user ${user.email}:`, userError);
              errors++;
            }
          }

        } catch (schemaError) {
          console.error(`   └─ ❌ Error processing schema ${schemaName}:`, schemaError);
          errors++;
        }
      }

      console.log(`✅ [AccountDeletionService] Completed: ${processed} processed, ${errors} errors`);

      return { processed, errors };

    } catch (error) {
      console.error('❌ [AccountDeletionService] Fatal error during processing:', error);
      return { processed, errors: errors + 1 };
    }
  }

  /**
   * Send final deletion confirmation email
   */
  private async sendFinalDeletionEmail(
    projectId: number,
    userEmail: string,
    userName: string,
    projectName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const provider = await this.emailService['getEmailProvider'](projectId);
      if (!provider) {
        return {
          success: false,
          error: 'Email provider not configured.',
        };
      }

      const subject = `Account Deleted - ${projectName}`;
      const text = `
Hello ${userName},

Your account with ${projectName} has been permanently deleted as scheduled.

What this means:
- Your account is now deactivated
- You can no longer log in
- Your data has been retained for compliance purposes

If this deletion was made in error, please contact our support team immediately.

Thank you for using ${projectName}.

Best regards,
The ${projectName} Team
      `.trim();

      const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #6B7280; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
    .info-box { background-color: #fff; border: 2px solid #6B7280; padding: 20px; margin: 20px 0; border-radius: 5px; }
    .info { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; }
    .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Account Deleted</h1>
    </div>
    <div class="content">
      <p>Hello ${userName},</p>
      <div class="info-box">
        <p><strong>Your account with ${projectName} has been permanently deleted as scheduled.</strong></p>
      </div>
      <div class="info">
        <strong>What this means:</strong>
        <ul style="margin: 10px 0 0 0; padding-left: 20px;">
          <li>Your account is now deactivated</li>
          <li>You can no longer log in</li>
          <li>Your data has been retained for compliance purposes</li>
        </ul>
      </div>
      <p>If this deletion was made in error, please contact our support team immediately.</p>
      <p>Thank you for using ${projectName}.</p>
      <div class="footer">
        <p>Best regards,<br>The ${projectName} Team</p>
      </div>
    </div>
  </div>
</body>
</html>
      `.trim();

      const success = await this.emailService['sendEmail'](provider, {
        to: userEmail,
        subject,
        text,
        html,
      });

      return { success };
    } catch (error: any) {
      console.error('Error sending final deletion email:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get statistics about pending deletions
   */
  async getPendingDeletionsStats(): Promise<{
    total: number;
    by_schema: { schema: string; count: number; }[];
  }> {
    try {
      const schemasResult = await this.pool.query(`
        SELECT DISTINCT table_schema 
        FROM information_schema.tables 
        WHERE table_name = 'skaftin_system_users'
        AND table_schema LIKE 'project_%'
      `);

      let total = 0;
      const by_schema: { schema: string; count: number; }[] = [];

      for (const schemaRow of schemasResult.rows) {
        const schemaName = schemaRow.table_schema;

        const countResult = await this.pool.query(`
          SELECT COUNT(*) as count
          FROM ${schemaName}.skaftin_system_users
          WHERE deletion_scheduled_at IS NOT NULL
          AND deletion_scheduled_at <= NOW()
          AND deleted_at IS NULL
        `);

        const count = parseInt(countResult.rows[0].count);
        total += count;

        if (count > 0) {
          by_schema.push({ schema: schemaName, count });
        }
      }

      return { total, by_schema };
    } catch (error) {
      console.error('Error getting pending deletions stats:', error);
      return { total: 0, by_schema: [] };
    }
  }
}

