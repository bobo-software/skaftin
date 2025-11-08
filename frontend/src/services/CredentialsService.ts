import axios from 'axios';
import ApiRoutes from '../constants/ApiRoutes';

export interface ApiCredential {
  id: number;
  project_id: number;
  name: string;
  credential_type: 'api_key' | 'access_token';
  token: string;
  permissions: string[];
  is_active: boolean;
  last_used_at?: string;
  created_by: string;
  created_at: string;
  expires_at?: string;
}

export interface CreateCredentialRequest {
  name: string;
  credential_type: 'api_key' | 'access_token';
  permissions: string[];
  expires_in_days?: number;
}

export interface UpdateCredentialRequest {
  name?: string;
  permissions?: string[];
  is_active?: boolean;
}

export interface AvailablePermissions {
  database: string[];
  storage: string[];
  communications: string[];
  projects: string[];
  invitations: string[];
}

class CredentialsService {
  private getAuthHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Get available permissions
   */
  async getAvailablePermissions(): Promise<AvailablePermissions> {
    try {
      const response = await axios.get(ApiRoutes.CREDENTIALS.GET_PERMISSIONS, {
        headers: this.getAuthHeaders(),
        withCredentials: true,
      });

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to get permissions');
    } catch (error: any) {
      console.error('Error getting permissions:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to get permissions');
    }
  }

  /**
   * List all credentials for a project
   */
  async listCredentials(projectId: string): Promise<ApiCredential[]> {
    try {
      const response = await axios.get(ApiRoutes.CREDENTIALS.LIST(projectId), {
        headers: this.getAuthHeaders(),
        withCredentials: true,
      });

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to list credentials');
    } catch (error: any) {
      console.error('Error listing credentials:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to list credentials');
    }
  }

  /**
   * Create new API credential
   */
  async createCredential(projectId: string, data: CreateCredentialRequest): Promise<ApiCredential> {
    try {
      const response = await axios.post(
        ApiRoutes.CREDENTIALS.CREATE(projectId),
        data,
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
        }
      );

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to create credential');
    } catch (error: any) {
      console.error('Error creating credential:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to create credential');
    }
  }

  /**
   * Update credential
   */
  async updateCredential(
    projectId: string,
    credentialId: string,
    data: UpdateCredentialRequest
  ): Promise<ApiCredential> {
    try {
      const response = await axios.put(
        ApiRoutes.CREDENTIALS.UPDATE(projectId, credentialId),
        data,
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
        }
      );

      if (response.data.success) {
        return response.data.data;
      }

      throw new Error(response.data.error || 'Failed to update credential');
    } catch (error: any) {
      console.error('Error updating credential:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to update credential');
    }
  }

  /**
   * Delete/revoke credential
   */
  async deleteCredential(projectId: string, credentialId: string): Promise<void> {
    try {
      const response = await axios.delete(
        ApiRoutes.CREDENTIALS.DELETE(projectId, credentialId),
        {
          headers: this.getAuthHeaders(),
          withCredentials: true,
        }
      );

      if (!response.data.success) {
        throw new Error(response.data.error || 'Failed to delete credential');
      }
    } catch (error: any) {
      console.error('Error deleting credential:', error);
      throw new Error(error.response?.data?.error || error.message || 'Failed to delete credential');
    }
  }
}

export default new CredentialsService();

