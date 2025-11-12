import RequestUtils from '../utils/RequestUtils';

export interface AppUser {
  id: number;
  supertokens_user_id?: string;
  name: string;
  email: string;
  phone?: string;
  metadata?: any;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
  updated_at: string;
  roles?: Role[];
}

export interface Role {
  id: number;
  role_name: string;
  role_key: string;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  password: string;
  phone?: string;
  metadata?: any;
  role_ids?: number[];
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  phone?: string;
  metadata?: any;
  is_active?: boolean;
}

export interface UsersListResponse {
  users: AppUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class AuthUsersService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  /**
   * List all users for a project
   */
  async listUsers(
    projectId: string,
    options?: {
      search?: string;
      role_id?: string;
      is_active?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<UsersListResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.search) params.append('search', options.search);
      if (options?.role_id) params.append('role_id', options.role_id);
      if (options?.is_active !== undefined) params.append('is_active', String(options.is_active));
      if (options?.page) params.append('page', String(options.page));
      if (options?.limit) params.append('limit', String(options.limit));

      const queryString = params.toString();
      const url = `/api/auth/${projectId}/users${queryString ? `?${queryString}` : ''}`;

      const response = await RequestUtils.get(url, this.getToken());

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to list users');
    } catch (error: any) {
      console.error('Error listing users:', error);
      throw new Error(error.message || 'Failed to list users');
    }
  }

  /**
   * Get a single user by ID
   */
  async getUser(projectId: string, userId: string): Promise<AppUser> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/users/${userId}`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get user');
    } catch (error: any) {
      console.error('Error getting user:', error);
      throw new Error(error.message || 'Failed to get user');
    }
  }

  /**
   * Create a new user
   */
  async createUser(projectId: string, userData: CreateUserRequest): Promise<AppUser> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users`,
        userData,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to create user');
    } catch (error: any) {
      console.error('Error creating user:', error);
      throw new Error(error.message || 'Failed to create user');
    }
  }

  /**
   * Update a user
   */
  async updateUser(projectId: string, userId: string, updates: UpdateUserRequest): Promise<AppUser> {
    try {
      const response = await RequestUtils.put(
        `/api/auth/${projectId}/users/${userId}`,
        updates,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to update user');
    } catch (error: any) {
      console.error('Error updating user:', error);
      throw new Error(error.message || 'Failed to update user');
    }
  }

  /**
   * Delete a user
   */
  async deleteUser(projectId: string, userId: string, permanent: boolean = false): Promise<void> {
    try {
      const url = `/api/auth/${projectId}/users/${userId}${permanent ? '?permanent=true' : ''}`;
      const response = await RequestUtils.delete(url, this.getToken());

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete user');
      }
    } catch (error: any) {
      console.error('Error deleting user:', error);
      throw new Error(error.message || 'Failed to delete user');
    }
  }

  /**
   * Assign a role to a user
   */
  async assignRole(projectId: string, userId: string, roleId: number): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users/${userId}/roles`,
        { role_id: roleId },
        this.getToken()
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to assign role');
      }
    } catch (error: any) {
      console.error('Error assigning role:', error);
      throw new Error(error.message || 'Failed to assign role');
    }
  }

  /**
   * Remove a role from a user
   */
  async removeRole(projectId: string, userId: string, roleId: string): Promise<void> {
    try {
      const response = await RequestUtils.delete(
        `/api/auth/${projectId}/users/${userId}/roles/${roleId}`,
        this.getToken()
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to remove role');
      }
    } catch (error: any) {
      console.error('Error removing role:', error);
      throw new Error(error.message || 'Failed to remove role');
    }
  }

  /**
   * Get users by role
   */
  async getUsersByRole(projectId: string, roleId: string): Promise<AppUser[]> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/users/by-role/${roleId}`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get users by role');
    } catch (error: any) {
      console.error('Error getting users by role:', error);
      throw new Error(error.message || 'Failed to get users by role');
    }
  }
}

export default new AuthUsersService();

