import RequestUtils from '../utils/RequestUtils';

export interface AppUser {
  id: number;
  supertokens_user_id?: string;
  name: string;
  last_name?: string;
  email: string;
  phone?: string;
  custom_field_1?: string;
  custom_field_2?: string;
  metadata?: any;
  is_active: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  deletion_requested_at?: string;
  deletion_scheduled_at?: string;
  deletion_reason?: string;
  deleted_at?: string;
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
  last_name?: string;
  email: string;
  password: string;
  phone?: string;
  custom_field_1?: string;
  custom_field_2?: string;
  metadata?: any;
  role_ids?: number[];
}

export interface UpdateUserRequest {
  name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  custom_field_1?: string;
  custom_field_2?: string;
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

export interface OTPStatus {
  id: number;
  otp_code: string;
  otp_method: 'email' | 'sms';
  destination: string;
  status: 'pending' | 'verified' | 'expired' | 'failed';
  expires_at: string;
  verified_at?: string;
  attempts: number;
  metadata?: {
    attempted_at?: string;
    otp_method?: string;
    destination?: string;
    delivery_status?: 'pending_attempt' | 'sent' | 'failed';
    delivery_error?: string;
    [key: string]: any;
  };
  updated_at?: string;
  created_at: string;
}

export interface UserPasswordStatus {
  has_password: boolean;
  password?: string;
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
      metadata?: Record<string, unknown>;
    }
  ): Promise<UsersListResponse> {
    try {
      const roleIDNum =
        options?.role_id !== undefined && options.role_id !== ''
          ? Number(options.role_id)
          : undefined;
      const payload: Record<string, unknown> = {};
      if (options?.search) payload.search = options.search;
      if (roleIDNum !== undefined && !Number.isNaN(roleIDNum)) payload.role_id = roleIDNum;
      if (options?.is_active !== undefined) payload.is_active = options.is_active;
      if (options?.page) payload.page = options.page;
      if (options?.limit) payload.limit = options.limit;
      if (options?.metadata && Object.keys(options.metadata).length > 0) {
        payload.metadata = options.metadata;
      }

      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users/list`,
        this.getToken(),
        payload
      );

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
   * Get user password (admin only - hidden feature)
   */
  async getUserPassword(projectId: string, userId: string): Promise<UserPasswordStatus> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/users/${userId}/password`,
        this.getToken()
      );

      if (response.success) {
        return {
          has_password: !!response.data?.has_password || !!response.data?.password,
          password: response.data?.password,
        };
      }

      throw new Error(response.error || 'Failed to get user password');
    } catch (error: any) {
      console.error('Error getting user password:', error);
      throw new Error(error.message || 'Failed to get user password');
    }
  }

  /**
   * Set/Create user password (admin only - hidden feature)
   */
  async setUserPassword(projectId: string, userId: string, password: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users/${userId}/password`,
        this.getToken(),
        { password }
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to set user password');
      }
    } catch (error: any) {
      console.error('Error setting user password:', error);
      throw new Error(error.message || 'Failed to set user password');
    }
  }

  /**
   * Verify a candidate password against a user's stored password hash.
   */
  async verifyUserPassword(projectId: string, userId: string, password: string): Promise<{ valid: boolean; has_password: boolean }> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users/${userId}/password/verify`,
        this.getToken(),
        { password }
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to verify user password');
    } catch (error: any) {
      console.error('Error verifying user password:', error);
      throw new Error(error.message || 'Failed to verify user password');
    }
  }

  /**
   * Create a new user
   */
  async createUser(projectId: string, userData: CreateUserRequest): Promise<AppUser> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users`,
        this.getToken(),
        userData
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
        this.getToken(),
        updates
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
      const response = await RequestUtils.delete(url, this.getToken(), {});

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
        this.getToken(),
        { role_id: roleId }
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
        this.getToken(),
        {}
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

  /**
   * Get OTP verification status for a user
   */
  async getUserOTPStatus(projectId: string, userId: string): Promise<OTPStatus[]> {
    try {
      const response = await RequestUtils.get(
        `/api/auth/${projectId}/users/${userId}/otp-status`,
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to get OTP status');
    } catch (error: any) {
      console.error('Error getting OTP status:', error);
      throw new Error(error.message || 'Failed to get OTP status');
    }
  }

  /**
   * Resend OTP to a user
   */
  async resendOTP(projectId: string, userId: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users/${userId}/resend-otp`,
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to resend OTP');
      }
    } catch (error: any) {
      console.error('Error resending OTP:', error);
      throw new Error(error.message || 'Failed to resend OTP');
    }
  }

  /**
   * Manually verify a user without OTP
   */
  async manuallyVerifyUser(projectId: string, userId: string): Promise<void> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users/${userId}/manual-verify`,
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to manually verify user');
      }
    } catch (error: any) {
      console.error('Error manually verifying user:', error);
      throw new Error(error.message || 'Failed to manually verify user');
    }
  }

  /**
   * Export users as SQL dump
   */
  async exportUsers(projectId: string): Promise<void> {
    try {
      const token = this.getToken();
      const API_BASE = import.meta.env.VITE_API_URL || '';
      
      const response = await fetch(`${API_BASE}/api/auth/${projectId}/users/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to export users');
      }

      // Get the blob
      const blob = await response.blob();
      
      // Extract filename from Content-Disposition header or use default
      let fileName = 'users-export.sql';
      const contentDisposition = response.headers.get('Content-Disposition');
      if (contentDisposition) {
        // Handle both quoted and unquoted filenames
        // Match: filename="value" or filename=value or filename*=UTF-8''value
        const quotedMatch = /filename[*]?=['"]([^'"]+)['"]/i.exec(contentDisposition);
        const unquotedMatch = /filename[*]?=([^'";\s]+)/i.exec(contentDisposition);
        if (quotedMatch && quotedMatch[1]) {
          fileName = quotedMatch[1];
        } else if (unquotedMatch && unquotedMatch[1]) {
          fileName = unquotedMatch[1];
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error exporting users:', error);
      throw new Error(error.message || 'Failed to export users');
    }
  }

  /**
   * Import users from SQL dump
   */
  async importUsers(projectId: string, sqlContent: string, clearExisting: boolean = false): Promise<{ success: boolean; result?: any }> {
    try {
      const response = await RequestUtils.post(
        `/api/auth/${projectId}/users/import`,
        this.getToken(),
        { sqlContent, clearExisting }
      );

      if (response.success) {
        return { success: true, result: response.data };
      } else {
        throw new Error(response.message || 'Failed to import users');
      }
    } catch (error: any) {
      console.error('Error importing users:', error);
      throw new Error(error.message || 'Failed to import users');
    }
  }
}

export default new AuthUsersService();

