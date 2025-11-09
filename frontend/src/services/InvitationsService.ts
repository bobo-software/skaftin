import RequestUtils from '../utils/RequestUtils';
import ApiRoutes from '../constants/ApiRoutes';

export interface ProjectInvitation {
  id: number;
  project_id: number;
  email: string;
  invite_code: string;
  role: string;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  invited_by: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string;
  project_name?: string;
  project_description?: string;
}

export interface ProjectMember {
  id: number;
  project_id: number;
  user_id: string;
  role: string;
  invited_by?: string;
  joined_at: string;
  project_name?: string;
}

export interface CreateInvitationRequest {
  email: string;
  role?: string;
  email_provider_id?: number;
}

class InvitationsService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  /**
   * List all invitations for a project
   */
  async listInvitations(projectId: string, status?: string): Promise<ProjectInvitation[]> {
    try {
      const url = status 
        ? `${ApiRoutes.INVITATIONS.LIST(projectId)}?status=${status}`
        : ApiRoutes.INVITATIONS.LIST(projectId);

      const response = await RequestUtils.get(url, this.getToken());

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list invitations');
    } catch (error: any) {
      console.error('Error listing invitations:', error);
      throw new Error(error.message || 'Failed to list invitations');
    }
  }

  /**
   * List all members of a project
   */
  async listMembers(projectId: string): Promise<ProjectMember[]> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.INVITATIONS.LIST_MEMBERS(projectId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list members');
    } catch (error: any) {
      console.error('Error listing members:', error);
      throw new Error(error.message || 'Failed to list members');
    }
  }

  /**
   * Create and send invitation
   */
  async createInvitation(projectId: string, data: CreateInvitationRequest): Promise<{ invitation: ProjectInvitation; invite_link: string }> {
    try {
      console.log('🚀 [InvitationsService] Creating invitation');
      console.log('  └─ projectId:', projectId);
      console.log('  └─ data:', data);
      console.log('  └─ URL:', ApiRoutes.INVITATIONS.CREATE(projectId));

      const response = await RequestUtils.post(
        ApiRoutes.INVITATIONS.CREATE(projectId),
        this.getToken(),
        data
      );

      console.log('  └─ Response:', response);

      if (response.success) {
        return {
          invitation: response.data,
          invite_link: response.invite_link,
        };
      }

      throw new Error(response.error || 'Failed to create invitation');
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      throw new Error(error.message || 'Failed to create invitation');
    }
  }

  /**
   * Get invitation by code (public - no auth required)
   */
  async getInvitationByCode(inviteCode: string): Promise<ProjectInvitation> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.INVITATIONS.GET_BY_CODE(inviteCode),
        ''
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get invitation');
    } catch (error: any) {
      console.error('Error getting invitation:', error);
      throw new Error(error.message || 'Failed to get invitation');
    }
  }

  /**
   * Accept invitation (requires auth)
   */
  async acceptInvitation(inviteCode: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.INVITATIONS.ACCEPT(inviteCode),
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to accept invitation');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      throw new Error(error.message || 'Failed to accept invitation');
    }
  }

  /**
   * Revoke/cancel invitation
   */
  async revokeInvitation(projectId: string, invitationId: string): Promise<void> {
    try {
      const response = await RequestUtils.delete(
        ApiRoutes.INVITATIONS.REVOKE(projectId, invitationId),
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to revoke invitation');
      }
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      throw new Error(error.message || 'Failed to revoke invitation');
    }
  }

  /**
   * Remove member from project
   */
  async removeMember(projectId: string, memberId: string): Promise<void> {
    try {
      const response = await RequestUtils.delete(
        ApiRoutes.INVITATIONS.REMOVE_MEMBER(projectId, memberId),
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to remove member');
      }
    } catch (error: any) {
      console.error('Error removing member:', error);
      throw new Error(error.message || 'Failed to remove member');
    }
  }
}

export default new InvitationsService();

