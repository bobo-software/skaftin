import ApiRoutes from '../constants/ApiRoutes';
import RequestUtils from '../utils/RequestUtils';
import {
  Organization,
  OrganizationWithMembers,
  CreateOrganizationDto,
  UpdateOrganizationDto,
  AddMemberByIdDto,
  OrganizationRole,
  ApiResponse,
} from '../types/Types';

class OrganizationService {
  private getToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  /**
   * Get all organizations for the current user
   */
  async getUserOrganizations(): Promise<{ success: boolean; organizations?: Organization[]; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.get<ApiResponse<Organization[]>>(
        ApiRoutes.ORGANIZATIONS.LIST,
        token
      );

      if (response.success && response.data) {
        return { success: true, organizations: response.data };
      } else {
        return { success: false, error: response.message || 'Failed to fetch organizations' };
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Get a specific organization by ID
   */
  async getOrganizationById(id: number): Promise<{ success: boolean; organization?: OrganizationWithMembers; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.get<ApiResponse<OrganizationWithMembers>>(
        ApiRoutes.ORGANIZATIONS.GET(id),
        token
      );

      if (response.success && response.data) {
        return { success: true, organization: response.data };
      } else {
        return { success: false, error: response.message || 'Failed to fetch organization' };
      }
    } catch (error) {
      console.error('Error fetching organization:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Create a new organization
   */
  async createOrganization(data: CreateOrganizationDto): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.post<ApiResponse<Organization>>(
        ApiRoutes.ORGANIZATIONS.CREATE,
        token,
        data
      );

      if (response.success && response.data) {
        return { success: true, organization: response.data };
      } else {
        return { success: false, error: response.message || 'Failed to create organization' };
      }
    } catch (error) {
      console.error('Error creating organization:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Update an organization
   */
  async updateOrganization(id: number, data: UpdateOrganizationDto): Promise<{ success: boolean; organization?: Organization; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.put<ApiResponse<Organization>>(
        ApiRoutes.ORGANIZATIONS.UPDATE(id),
        token,
        data
      );

      if (response.success && response.data) {
        return { success: true, organization: response.data };
      } else {
        return { success: false, error: response.message || 'Failed to update organization' };
      }
    } catch (error) {
      console.error('Error updating organization:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Delete an organization
   */
  async deleteOrganization(id: number): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.delete<ApiResponse>(
        ApiRoutes.ORGANIZATIONS.DELETE(id),
        token
      );

      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.message || 'Failed to delete organization' };
      }
    } catch (error) {
      console.error('Error deleting organization:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Add a member to an organization by user ID
   */
  async addMemberById(orgId: number, data: AddMemberByIdDto): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.post<ApiResponse>(
        ApiRoutes.ORGANIZATIONS.ADD_MEMBER_BY_ID(orgId),
        token,
        data
      );

      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.message || 'Failed to add member' };
      }
    } catch (error) {
      console.error('Error adding member:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Update a member's role
   */
  async updateMemberRole(orgId: number, memberId: number, role: OrganizationRole): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.put<ApiResponse>(
        ApiRoutes.ORGANIZATIONS.UPDATE_MEMBER(orgId, memberId),
        token,
        { role }
      );

      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.message || 'Failed to update member role' };
      }
    } catch (error) {
      console.error('Error updating member role:', error);
      return { success: false, error: 'Network error' };
    }
  }

  /**
   * Remove a member from an organization
   */
  async removeMember(orgId: number, memberId: number): Promise<{ success: boolean; error?: string }> {
    try {
      const token = this.getToken();
      if (!token) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await RequestUtils.delete<ApiResponse>(
        ApiRoutes.ORGANIZATIONS.REMOVE_MEMBER(orgId, memberId),
        token
      );

      if (response.success) {
        return { success: true };
      } else {
        return { success: false, error: response.message || 'Failed to remove member' };
      }
    } catch (error) {
      console.error('Error removing member:', error);
      return { success: false, error: 'Network error' };
    }
  }
}

export default new OrganizationService();

