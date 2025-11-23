import { Request, Response } from 'express';
import { Pool } from 'pg';
import nodemailer from 'nodemailer';
import crypto from 'crypto';

interface Invitation {
  id?: number;
  project_id: number;
  email: string;
  invite_code: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  invited_by: string;
  expires_at: Date;
  created_at?: Date;
  accepted_at?: Date;
}

class InvitationsController {
  private pool: Pool;
  private frontendUrl: string;

  constructor(pool: Pool) {
    this.pool = pool;
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3005';
  }

  /**
   * Generate a unique invite code
   */
  private generateInviteCode(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * List all invitations for a project
   */
  listInvitations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { status } = req.query;

      let query = `
        SELECT i.*, p.name as project_name
        FROM skaftin_system_project_invitations i
        JOIN projects p ON i.project_id = p.id
        WHERE i.project_id = $1
      `;
      
      const params: any[] = [projectId];

      if (status) {
        query += ` AND i.status = $2`;
        params.push(status);
      }

      query += ` ORDER BY i.created_at DESC`;

      const result = await this.pool.query(query, params);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error listing invitations:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list invitations',
        message: error.message,
      });
    }
  };

  /**
   * Get project members
   */
  listMembers = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;

      const query = `
        SELECT pm.*, p.name as project_name
        FROM skaftin_system_project_members pm
        JOIN projects p ON pm.project_id = p.id
        WHERE pm.project_id = $1
        ORDER BY pm.joined_at DESC
      `;

      const result = await this.pool.query(query, [projectId]);

      res.json({
        success: true,
        data: result.rows,
        count: result.rows.length,
      });
    } catch (error: any) {
      console.error('Error listing members:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list members',
        message: error.message,
      });
    }
  };

  /**
   * Create and send invitation
   */
  createInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId } = req.params;
      const { email, role = 'member', email_provider_id } = req.body;
      const invitedBy = (req as any).user?.userId;

      console.log('\n📧 [createInvitation] Creating invitation');
      console.log('  └─ Request body:', JSON.stringify(req.body, null, 2));
      console.log('  └─ projectId (from params):', projectId, typeof projectId);
      console.log('  └─ email:', email);
      console.log('  └─ role:', role);
      console.log('  └─ email_provider_id:', email_provider_id, typeof email_provider_id);
      console.log('  └─ invitedBy:', invitedBy);

      if (!email) {
        console.log('  └─ ❌ Email is required');
        res.status(400).json({
          success: false,
          error: 'Email is required',
        });
        return;
      }

      // Check if invitation already exists (pending only)
      const existingCheck = await this.pool.query(
        'SELECT id, status FROM skaftin_system_project_invitations WHERE project_id = $1 AND email = $2 AND status = $3',
        [projectId, email, 'pending']
      );

      if (existingCheck.rows.length > 0) {
        console.log('  └─ ❌ Pending invitation already exists');
        res.status(409).json({
          success: false,
          error: 'Invitation already exists for this email',
        });
        return;
      }

      // Delete any old non-pending invitations for this email (allow re-invitation)
      console.log('  └─ Cleaning up old invitations...');
      await this.pool.query(
        'DELETE FROM skaftin_system_project_invitations WHERE project_id = $1 AND email = $2 AND status != $3',
        [projectId, email, 'pending']
      );

      // Check if user is already a member
      const memberCheck = await this.pool.query(
        'SELECT id FROM skaftin_system_project_members WHERE project_id = $1 AND user_id IN (SELECT user_id FROM skaftin_system_users WHERE email = $2)',
        [projectId, email]
      );

      if (memberCheck.rows.length > 0) {
        res.status(409).json({
          success: false,
          error: 'User is already a member of this project',
        });
        return;
      }

      // Generate invite code and expiration (7 days)
      const inviteCode = this.generateInviteCode();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Get project details
      const projectResult = await this.pool.query(
        'SELECT name FROM skaftin_system_projects WHERE id = $1',
        [projectId]
      );

      if (projectResult.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Project not found',
        });
        return;
      }

      const projectName = projectResult.rows[0].name;

      // Create invitation
      const insertQuery = `
        INSERT INTO skaftin_system_project_invitations 
        (project_id, email, invite_code, role, invited_by, expires_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await this.pool.query(insertQuery, [
        projectId,
        email,
        inviteCode,
        role,
        invitedBy,
        expiresAt,
      ]);

      const invitation = result.rows[0];
      console.log('  └─ ✅ Invitation created with ID:', invitation.id);

      // Send email if provider specified
      if (email_provider_id) {
        console.log('  └─ Sending invitation email via provider:', email_provider_id);
        try {
          await this.sendInvitationEmail(email_provider_id, email, projectName, inviteCode, projectId);
          console.log('  └─ ✅ Email sent successfully');
        } catch (emailError: any) {
          console.error('  └─ ❌ Failed to send invitation email:', emailError.message);
          console.error('     └─ Error details:', emailError);
          // Don't fail the request if email fails - invitation is still created
        }
      } else {
        console.log('  └─ ℹ️  No email provider specified - invitation created without email');
      }

      res.status(201).json({
        success: true,
        data: invitation,
        message: 'Invitation created successfully',
        invite_link: `${this.frontendUrl}/invite/${inviteCode}`,
      });
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create invitation',
        message: error.message,
      });
    }
  };

  /**
   * Send invitation email
   */
  private async sendInvitationEmail(
    providerId: number,
    recipientEmail: string,
    projectName: string,
    inviteCode: string,
    projectId: string
  ): Promise<void> {
    console.log('     📨 [sendInvitationEmail] Starting email send process');
    console.log('        └─ providerId:', providerId);
    console.log('        └─ recipientEmail:', recipientEmail);
    console.log('        └─ projectName:', projectName);
    console.log('        └─ projectId:', projectId);

    // Get email provider
    const providerQuery = `
      SELECT smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, 
             from_email, from_name, is_active
      FROM email_providers
      WHERE id = $1 AND project_id = $2 AND is_active = true
    `;

    console.log('        └─ Fetching email provider...');
    const providerResult = await this.pool.query(providerQuery, [providerId, projectId]);

    if (providerResult.rows.length === 0) {
      console.log('        └─ ❌ Email provider not found or inactive');
      throw new Error('Email provider not found or inactive');
    }

    const provider = providerResult.rows[0];
    console.log('        └─ ✅ Provider found:');
    console.log('           └─ Host:', provider.smtp_host);
    console.log('           └─ Port:', provider.smtp_port);
    console.log('           └─ From:', provider.from_email);

    console.log('        └─ Creating nodemailer transporter...');
    const transporter = nodemailer.createTransport({
      host: provider.smtp_host,
      port: provider.smtp_port,
      secure: provider.smtp_secure,
      auth: {
        user: provider.smtp_user,
        pass: provider.smtp_password,
      },
    });

    const inviteLink = `${this.frontendUrl}/invite/${inviteCode}`;
    console.log('        └─ Invite link:', inviteLink);

    console.log('        └─ Preparing email...');
    const mailOptions = {
      from: provider.from_name 
        ? `"${provider.from_name}" <${provider.from_email}>`
        : provider.from_email,
      to: recipientEmail,
      subject: `You've been invited to join ${projectName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4F46E5;">You've been invited! 🎉</h1>
          <p>You've been invited to join the project <strong>${projectName}</strong> on Skaftin Platform.</p>
          
          <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Invite Code:</strong></p>
            <p style="font-size: 24px; font-weight: bold; color: #4F46E5; margin: 10px 0;">${inviteCode}</p>
          </div>
          
          <p>Click the button below to accept the invitation:</p>
          
          <a href="${inviteLink}" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Accept Invitation</a>
          
          <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
            This invitation will expire in 7 days.<br/>
            If you didn't expect this invitation, you can safely ignore this email.
          </p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
          
          <p style="color: #6B7280; font-size: 12px;">
            Skaftin Platform - Project Collaboration Made Easy
          </p>
        </div>
      `,
      text: `You've been invited to join ${projectName}!\n\nInvite Code: ${inviteCode}\n\nClick this link to accept: ${inviteLink}\n\nThis invitation expires in 7 days.`,
    };

    console.log('        └─ Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log('        └─ ✅ Email sent successfully!');
    console.log('           └─ Message ID:', info.messageId);
    console.log('           └─ Accepted:', info.accepted);
    console.log('           └─ Rejected:', info.rejected);
  }

  /**
   * Get invitation by code
   */
  getInvitationByCode = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.params;

      const query = `
        SELECT i.*, p.name as project_name, p.description as project_description
        FROM skaftin_system_project_invitations i
        JOIN projects p ON i.project_id = p.id
        WHERE i.invite_code = $1
      `;

      const result = await this.pool.query(query, [inviteCode]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Invitation not found',
        });
        return;
      }

      const invitation = result.rows[0];

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        // Update status to expired
        await this.pool.query(
          'UPDATE skaftin_system_project_invitations SET status = $1 WHERE id = $2',
          ['expired', invitation.id]
        );

        res.status(410).json({
          success: false,
          error: 'Invitation has expired',
        });
        return;
      }

      // Check if already accepted
      if (invitation.status === 'accepted') {
        res.status(409).json({
          success: false,
          error: 'Invitation has already been accepted',
        });
        return;
      }

      res.json({
        success: true,
        data: invitation,
      });
    } catch (error: any) {
      console.error('Error getting invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get invitation',
        message: error.message,
      });
    }
  };

  /**
   * Accept invitation
   */
  acceptInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { inviteCode } = req.params;
      const userId = (req as any).user?.userId;

      console.log('\n✅ [acceptInvitation] Processing invitation acceptance');
      console.log('  └─ inviteCode:', inviteCode);
      console.log('  └─ userId:', userId);
      console.log('  └─ user email:', (req as any).user?.email);

      if (!userId) {
        console.log('  └─ ❌ User not authenticated');
        res.status(401).json({
          success: false,
          error: 'User not authenticated',
        });
        return;
      }

      // Get invitation
      console.log('  └─ Fetching invitation from database...');
      const inviteQuery = await this.pool.query(
        'SELECT * FROM skaftin_system_project_invitations WHERE invite_code = $1',
        [inviteCode]
      );

      if (inviteQuery.rows.length === 0) {
        console.log('  └─ ❌ Invitation not found');
        res.status(404).json({
          success: false,
          error: 'Invitation not found',
        });
        return;
      }

      const invitation = inviteQuery.rows[0];
      console.log('  └─ ✅ Invitation found:');
      console.log('     └─ Project ID:', invitation.project_id);
      console.log('     └─ Email:', invitation.email);
      console.log('     └─ Status:', invitation.status);

      // Check if expired
      if (new Date(invitation.expires_at) < new Date()) {
        await this.pool.query(
          'UPDATE skaftin_system_project_invitations SET status = $1 WHERE id = $2',
          ['expired', invitation.id]
        );

        res.status(410).json({
          success: false,
          error: 'Invitation has expired',
        });
        return;
      }

      // Check if already accepted
      if (invitation.status === 'accepted') {
        res.status(409).json({
          success: false,
          error: 'Invitation has already been accepted',
        });
        return;
      }

      // For SuperTokens, get the email from the session (already attached by middleware)
      const userEmail = (req as any).user?.email;

      console.log('  └─ User email from session:', userEmail);
      console.log('  └─ Invitation email:', invitation.email);

      if (userEmail && userEmail.toLowerCase() !== invitation.email.toLowerCase()) {
        console.log('  └─ ❌ Email mismatch');
        res.status(403).json({
          success: false,
          error: 'This invitation is for a different email address',
        });
        return;
      }

      // Check if already a member
      console.log('  └─ Checking if user is already a member...');
      const memberCheck = await this.pool.query(
        'SELECT id FROM skaftin_system_project_members WHERE project_id = $1 AND user_id = $2',
        [invitation.project_id, userId]
      );

      if (memberCheck.rows.length > 0) {
        console.log('  └─ ⚠️  User is already a member');
        res.status(409).json({
          success: false,
          error: 'You are already a member of this project',
        });
        return;
      }

      // Add user to skaftin_system_project_members
      console.log('  └─ Adding user to skaftin_system_project_members...');
      const insertMember = await this.pool.query(
        `INSERT INTO skaftin_system_project_members (project_id, user_id, role, invited_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [invitation.project_id, userId, invitation.role, invitation.invited_by]
      );

      console.log('  └─ ✅ User added to skaftin_system_project_members with ID:', insertMember.rows[0].id);

      // Delete the invitation (no need to keep it after acceptance)
      console.log('  └─ Deleting invitation from database...');
      await this.pool.query(
        'DELETE FROM skaftin_system_project_invitations WHERE id = $1',
        [invitation.id]
      );

      console.log('  └─ ✅ Invitation deleted successfully!');
      console.log('  └─ ✅ Invitation acceptance complete!');

      res.json({
        success: true,
        message: 'Invitation accepted successfully',
        data: insertMember.rows[0],
      });
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to accept invitation',
        message: error.message,
      });
    }
  };

  /**
   * Revoke/cancel invitation
   */
  revokeInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, invitationId } = req.params;

      const query = `
        UPDATE skaftin_system_project_invitations
        SET status = 'rejected'
        WHERE id = $1 AND project_id = $2 AND status = 'pending'
        RETURNING *
      `;

      const result = await this.pool.query(query, [invitationId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Invitation not found or already processed',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Invitation revoked successfully',
      });
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to revoke invitation',
        message: error.message,
      });
    }
  };

  /**
   * Remove member from project
   */
  removeMember = async (req: Request, res: Response): Promise<void> => {
    try {
      const { projectId, memberId } = req.params;

      const query = `
        DELETE FROM skaftin_system_project_members
        WHERE id = $1 AND project_id = $2
        RETURNING *
      `;

      const result = await this.pool.query(query, [memberId, projectId]);

      if (result.rows.length === 0) {
        res.status(404).json({
          success: false,
          error: 'Member not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Member removed successfully',
      });
    } catch (error: any) {
      console.error('Error removing member:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove member',
        message: error.message,
      });
    }
  };
}

export default InvitationsController;

