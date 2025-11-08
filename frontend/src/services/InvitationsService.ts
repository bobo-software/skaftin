import axios from 'axios';
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
  private getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * List all invitations for a project
   */
  async listInvitations(projectId: string, status?: string): Promise<ProjectInvitation[]> {
    try {
      const url = status 
        ? `${ApiRoutes.INVITATIONS.LIST(projectId)}?status=${status}`
        : ApiRoutes.INVITATIONS.LIST(projectId);

      const response = await axios.get(url, {
        headers: this.getAuthHeaders(),
        withCredentials: true,
      });

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to list invitations');
    } catch (error: any) {
      console.error('Error listing invitations:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to list invitations');
    }
  }

  /**
   * List all members of a project
   */
  async listMembers(projectId: string): Promise<ProjectMember[]> {
    try {
      const response = await axios.get(ApiRoutes.INVITATIONS.LIST_MEMBERS(projectId), {
        headers: this.getAuthHeaders(),
        withCredentials: true,
      });

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to list members');
    } catch (error: any) {
      console.error('Error listing members:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to list members');
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

      const response = await axios.post(
        ApiRoutes.INVITATIONS.CREATE(projectId),
        data,
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
        }
      );

      console.log('  └─ Response:', response.data);

      if (response.data.success) {
        return {
          invitation: response.data.data,
          invite_link: response.data.invite_link,
        };
      }

      throw new Error(response.data.error || 'Failed to create invitation');
    } catch (error: any) {
      console.error('Error creating invitation:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to create invitation');
    }
  }

  /**
   * Get invitation by code (public - no auth required)
   */
  async getInvitationByCode(inviteCode: string): Promise<ProjectInvitation> {
    try {
      const response = await axios.get(ApiRoutes.INVITATIONS.GET_BY_CODE(inviteCode), {
        headers: this.getAuthHeaders(),
      });

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to get invitation');
    } catch (error: any) {
      console.error('Error getting invitation:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to get invitation');
    }
  }

  /**
   * Accept invitation (requires auth)
   */
  async acceptInvitation(inviteCode: string): Promise<void> {
    try {
      const response = await axios.post(
        ApiRoutes.INVITATIONS.ACCEPT(inviteCode),
        {},
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to accept invitation');
      }
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to accept invitation');
    }
  }

  /**
   * Revoke/cancel invitation
   */
  async revokeInvitation(projectId: string, invitationId: string): Promise<void> {
    try {
      const response = await axios.delete(
        ApiRoutes.INVITATIONS.REVOKE(projectId, invitationId),
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to revoke invitation');
      }
    } catch (error: any) {
      console.error('Error revoking invitation:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to revoke invitation');
    }
  }

  /**
   * Remove member from project
   */
  async removeMember(projectId: string, memberId: string): Promise<void> {
    try {
      const response = await axios.delete(
        ApiRoutes.INVITATIONS.REMOVE_MEMBER(projectId, memberId),
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to remove member');
      }
    } catch (error: any) {
      console.error('Error removing member:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to remove member');
    }
  }
}

export default new InvitationsService();

