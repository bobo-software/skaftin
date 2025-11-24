import RequestUtils from '../utils/RequestUtils';

export interface Role {
  id: number;
  role_name: string;
  role_key: string;
  description?: string;
  permissions: any[];
  session_duration_minutes: number;
  is_system_role: boolean;
  organisation_field_name?: string | null;
  organisation_lookup_table?: string | null;
  organisation_lookup_field?: string | null;
  created_at: string;
  updated_at: string;
  user_count?: number;
}

export interface CreateRoleRequest {
  role_name: string;
  role_key: string;
  description?: string;
  permissions?: any[];
  session_duration_minutes?: number;
  organisation_field_name?: string;
  organisation_lookup_table?: string;
  organisation_lookup_field?: string;
}

export interface UpdateRoleRequest {
  role_name?: string;
  description?: string;
  permissions?: any[];
  session_duration_minutes?: number;
  organisation_field_name?: string;
  organisation_lookup_table?: string;
  organisation_lookup_field?: string;
}

class RolesService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  /**
   * List all roles for a project
   */
  async listRoles(projectId: string, includeUserCount: boolean = false): Promise<Role[]> {
    try {
      const url = `/api/auth/${projectId}/roles${includeUserCount ? '?include_user_count=true' : ''}`;
      const response = await RequestUtils.get(url, this.getToken());

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list roles');
    } catch (error: any) {
      console.error('Error listing roles:', error);
      throw new Error(error.message || 'Failed to list roles');
    }
  }

  /**
   * Get a single role by ID
   */
  async getRole(projectId: string, roleId: string): Promise<Role> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/roles/${roleId}`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get role');
    } catch (error: any) {
      console.error('Error getting role:', error);
      throw new Error(error.message || 'Failed to get role');
    }
  }

  /**
   * Create a new role
   */
  async createRole(projectId: string, roleData: CreateRoleRequest): Promise<Role> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/roles`,
        this.getToken(),
        roleData
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to create role');
    } catch (error: any) {
      console.error('Error creating role:', error);
      throw new Error(error.message || 'Failed to create role');
    }
  }

  /**
   * Update a role
   */
  async updateRole(projectId: string, roleId: string, updates: UpdateRoleRequest): Promise<Role> {
    try {
      const response = await RequestUtils.put(
        `/api/auth/${projectId}/roles/${roleId}`,
        this.getToken(),
        updates
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update role');
    } catch (error: any) {
      console.error('Error updating role:', error);
      throw new Error(error.message || 'Failed to update role');
    }
  }

  /**
   * Delete a role
   */
  async deleteRole(projectId: string, roleId: string): Promise<void> {
    try {
      const response = await RequestUtils.delete(
        `/api/auth/${projectId}/roles/${roleId}`,
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete role');
      }
    } catch (error: any) {
      console.error('Error deleting role:', error);
      throw new Error(error.message || 'Failed to delete role');
    }
  }

  /**
   * Get role permissions
   */
  async getRolePermissions(projectId: string, roleId: string): Promise<any[]> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/roles/${roleId}/permissions`,
        this.getToken()
      );

      if (response.success) {
        return response.data.permissions;
      }

      throw new Error(response.error || 'Failed to get role permissions');
    } catch (error: any) {
      console.error('Error getting role permissions:', error);
      throw new Error(error.message || 'Failed to get role permissions');
    }
  }

  /**
   * Update role permissions
   */
  async updateRolePermissions(projectId: string, roleId: string, permissions: any[]): Promise<Role> {
    try {
      const response = await RequestUtils.put(
        `/api/auth/${projectId}/roles/${roleId}/permissions`,
        this.getToken(),
        { permissions }
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update role permissions');
    } catch (error: any) {
      console.error('Error updating role permissions:', error);
      throw new Error(error.message || 'Failed to update role permissions');
    }
  }

  /**
   * Update session duration for a role
   */
  async updateSessionDuration(projectId: string, roleId: string, sessionDurationMinutes: number): Promise<Role> {
    try {
      const response = await RequestUtils.put(
        `/api/auth/${projectId}/roles/${roleId}/session-duration`,
        this.getToken(),
        { session_duration_minutes: sessionDurationMinutes }
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update session duration');
    } catch (error: any) {
      console.error('Error updating session duration:', error);
      throw new Error(error.message || 'Failed to update session duration');
    }
  }
}

export default new RolesService();

