import { signOut as superTokensSignOut } from 'supertokens-auth-react/recipe/session';

// Use empty string to make requests relative (will use Vite proxy)
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: {
      id: string;
      email: string;
      name?: string;
    };
    token?: string;
  };
  error?: string;
}

interface LoginResult {
  success: boolean;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
  error?: string;
}

/**
 * AuthService - Handles authentication operations
 * 
 * NOTE: Platform user auth (login/register/logout) now uses SuperTokens directly.
 * Use the exported functions from supertokens.ts for platform auth.
 * 
 * This service is primarily for:
 * - App user authentication (different from platform users)
 * - Password reset flows
 * - Legacy compatibility
 */
class AuthService {
  /**
   * Get headers for authenticated API requests
   * Uses credentials: 'include' to send HTTP-only cookies
   * No more localStorage tokens!
   */
  getAuthHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Logout using SuperTokens
   * This properly clears HTTP-only cookies and revokes the session
   */
  async logout(): Promise<void> {
    try {
      await superTokensSignOut();
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * @deprecated Use SuperTokens signIn/signUp directly instead
   * Kept for backward compatibility with some components
   */
  async login(email: string, password: string): Promise<LoginResult> {
    console.warn('AuthService.login is deprecated. Use signIn from supertokens.ts instead.');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.success && data.data) {
        return {
          success: true,
          user: data.data.user,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Login failed',
        };
      }
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * @deprecated Use SuperTokens signIn/signUp directly instead
   * Kept for backward compatibility with some components
   */
  async register(email: string, password: string, fullName?: string): Promise<LoginResult> {
    console.warn('AuthService.register is deprecated. Use signUp from supertokens.ts instead.');
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.success && data.data) {
        return {
          success: true,
          user: data.data.user,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Registration failed',
        };
      }
    } catch (error) {
      console.error('Register error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * App user login with multiple method support
   * Supports: email, phone, custom_field_1, custom_field_2
   * 
   * Note: App users use header-based tokens (returned in response) or HTTP-only cookies
   * No localStorage storage - tokens are managed via Authorization header or cookies
   */
  async appUserLogin(
    username: string, 
    password: string, 
    method: 'email' | 'phone' | 'custom_field_1' | 'custom_field_2',
    projectId?: number,
    apiKey?: string
  ): Promise<LoginResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key or access token if provided
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      // Build URL - support both with and without projectId
      let url = `${API_BASE_URL}/api/app-auth/auth/login`;
      if (projectId) {
        url = `${API_BASE_URL}/api/app-auth/${projectId}/auth/login`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ username, password, method }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.success && data.data) {
        // Session is managed via HTTP-only cookies (credentials: 'include')
        // For header-based auth, the token is returned in the response for the client to use
        return {
          success: true,
          user: data.data.user,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Login failed',
        };
      }
    } catch (error) {
      console.error('App user login error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Single credential login (passwordless)
   * Supports: email, phone, custom_field_1, custom_field_2
   * 
   * Note: Session is managed via HTTP-only cookies - no localStorage storage
   */
  async singleCredentialLogin(
    credential: string,
    method: 'email' | 'phone' | 'custom_field_1' | 'custom_field_2',
    projectId?: number,
    apiKey?: string
  ): Promise<LoginResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key or access token if provided
      if (apiKey) {
        headers['x-api-key'] = apiKey;
      }

      // Build URL - support both with and without projectId
      let url = `${API_BASE_URL}/api/app-auth/auth/single-credential-login`;
      if (projectId) {
        url = `${API_BASE_URL}/api/app-auth/${projectId}/auth/single-credential-login`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ credential, method }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.success && data.data) {
        // Session is managed via HTTP-only cookies (credentials: 'include')
        return {
          success: true,
          user: data.data.user,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Login failed',
        };
      }
    } catch (error) {
      console.error('Single credential login error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * App user registration with custom fields support
   * 
   * Note: Session is managed via HTTP-only cookies - no localStorage storage
   */
  async appUserRegister(
    name: string,
    email: string,
    password: string,
    options?: {
      phone?: string;
      custom_field_1?: string;
      custom_field_2?: string;
      metadata?: any;
      projectId?: number;
      apiKey?: string;
    }
  ): Promise<LoginResult> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key or access token if provided
      if (options?.apiKey) {
        headers['x-api-key'] = options.apiKey;
      }

      // Build URL - support both with and without projectId
      let url = `${API_BASE_URL}/api/app-auth/auth/register`;
      if (options?.projectId) {
        url = `${API_BASE_URL}/api/app-auth/${options.projectId}/auth/register`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          name,
          email,
          password,
          phone: options?.phone,
          custom_field_1: options?.custom_field_1,
          custom_field_2: options?.custom_field_2,
          metadata: options?.metadata,
        }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.success && data.data) {
        // Session is managed via HTTP-only cookies (credentials: 'include')
        return {
          success: true,
          user: data.data.user,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Registration failed',
        };
      }
    } catch (error) {
      console.error('App user registration error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Send forgot password OTP
   * Sends an OTP code to the user's email or phone
   */
  async sendForgotPasswordOTP(
    email: string,
    options?: {
      method?: 'email' | 'sms';
      projectId?: number;
      apiKey?: string;
    }
  ): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key or access token if provided
      if (options?.apiKey) {
        headers['x-api-key'] = options.apiKey;
      }

      // Build URL - support both with and without projectId
      let url = `${API_BASE_URL}/api/app-auth/auth/forgot-password`;
      if (options?.projectId) {
        url = `${API_BASE_URL}/api/app-auth/${options.projectId}/auth/forgot-password`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          email,
          method: options?.method || 'email',
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Failed to send OTP',
        };
      }
    } catch (error) {
      console.error('Send forgot password OTP error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Verify forgot password OTP
   * Verifies the OTP code and returns a reset token
   */
  async verifyForgotPasswordOTP(
    email: string,
    code: string,
    options?: {
      projectId?: number;
      apiKey?: string;
    }
  ): Promise<{ success: boolean; message?: string; data?: any; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key or access token if provided
      if (options?.apiKey) {
        headers['x-api-key'] = options.apiKey;
      }

      // Build URL - support both with and without projectId
      let url = `${API_BASE_URL}/api/app-auth/auth/verify-forgot-password-otp`;
      if (options?.projectId) {
        url = `${API_BASE_URL}/api/app-auth/${options.projectId}/auth/verify-forgot-password-otp`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ email, code }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          message: data.message,
          data: data.data,
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Failed to verify OTP',
        };
      }
    } catch (error) {
      console.error('Verify forgot password OTP error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }

  /**
   * Reset password
   * Changes the user's password after OTP verification
   */
  async resetPassword(
    email: string,
    resetToken: string,
    newPassword: string,
    options?: {
      projectId?: number;
      apiKey?: string;
    }
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      // Add API key or access token if provided
      if (options?.apiKey) {
        headers['x-api-key'] = options.apiKey;
      }

      // Build URL - support both with and without projectId
      let url = `${API_BASE_URL}/api/app-auth/auth/reset-password`;
      if (options?.projectId) {
        url = `${API_BASE_URL}/api/app-auth/${options.projectId}/auth/reset-password`;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          email,
          reset_token: resetToken,
          new_password: newPassword,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        return {
          success: true,
          message: data.message || 'Password reset successfully',
        };
      } else {
        return {
          success: false,
          error: data.message || data.error || 'Failed to reset password',
        };
      }
    } catch (error) {
      console.error('Reset password error:', error);
      return {
        success: false,
        error: 'Network error. Please try again.',
      };
    }
  }
}

export default new AuthService();

