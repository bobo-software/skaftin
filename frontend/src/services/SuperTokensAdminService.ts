import ApiRoutes from '../constants/ApiRoutes';
import RequestUtils from '../utils/RequestUtils';

export interface SuperTokensUser {
  id: string;
  emails?: string[];
  timeJoined?: number;
}

export interface RevokeSessionsResult {
  status: string;
  sessionHandlesRevoked: string[];
}

class SuperTokensAdminService {
  private getToken(): string {
    return localStorage.getItem('skaftin-token') || 'session-managed-by-supertokens';
  }

  async searchUsers(query: string): Promise<SuperTokensUser[]> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.ADMIN_SUPERTOKENS.SEARCH_USERS(query.trim()),
        this.getToken()
      );

      if (response.success) {
        return Array.isArray(response.data) ? response.data : [];
      }

      throw new Error(response.error || 'Failed to search SuperTokens users');
    } catch (error: any) {
      console.error('Error searching SuperTokens users:', error);
      throw new Error(error.message || 'Failed to search SuperTokens users');
    }
  }

  async getUser(userId: string): Promise<SuperTokensUser> {
    try {
      const response = await RequestUtils.get(
        ApiRoutes.ADMIN_SUPERTOKENS.GET_USER(userId),
        this.getToken()
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to fetch SuperTokens user');
    } catch (error: any) {
      console.error('Error fetching SuperTokens user:', error);
      throw new Error(error.message || 'Failed to fetch SuperTokens user');
    }
  }

  async revokeSessions(userId: string): Promise<RevokeSessionsResult> {
    try {
      const response = await RequestUtils.post(
        ApiRoutes.ADMIN_SUPERTOKENS.REVOKE_USER_SESSIONS(userId),
        this.getToken(),
        {}
      );

      if (response.success) {
        return response.data;
      }

      throw new Error(response.error || 'Failed to revoke sessions');
    } catch (error: any) {
      console.error('Error revoking SuperTokens sessions:', error);
      throw new Error(error.message || 'Failed to revoke sessions');
    }
  }

  async deleteUser(userId: string): Promise<void> {
    try {
      const response = await RequestUtils.delete(
        ApiRoutes.ADMIN_SUPERTOKENS.DELETE_USER(userId),
        this.getToken(),
        {}
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to delete SuperTokens user');
      }
    } catch (error: any) {
      console.error('Error deleting SuperTokens user:', error);
      throw new Error(error.message || 'Failed to delete SuperTokens user');
    }
  }
}

export default new SuperTokensAdminService();
