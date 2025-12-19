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
    token: string;
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
  token?: string;
  error?: string;
}

class AuthService {
  private getToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  storeToken(token: string): void {
    localStorage.setItem('skaftin-token', token);
  }

  removeToken(): void {
    localStorage.removeItem('skaftin-token');
  }

  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  async login(email: string, password: string): Promise<LoginResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // CRITICAL: Send/receive cookies
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.success && data.data) {
        this.storeToken(data.data.token);
        return {
          success: true,
          user: data.data.user,
          token: data.data.token,
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

  async register(email: string, password: string, fullName?: string): Promise<LoginResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // CRITICAL: Send/receive cookies
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.success && data.data) {
        this.storeToken(data.data.token);
        return {
          success: true,
          user: data.data.user,
          token: data.data.token,
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

  async logout(): Promise<void> {
    // Call backend to revoke SuperTokens session
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    // Clear localStorage
    this.removeToken();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }

  /**
   * App user login with multiple method support
   * Supports: email, phone, custom_field_1, custom_field_2
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
        // App users use session.accessToken instead of data.token
        const accessToken = (data.data as any).session?.accessToken || data.data.token;
        if (accessToken) {
          this.storeToken(accessToken);
        }
        return {
          success: true,
          user: data.data.user,
          token: accessToken,
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
        // App users use session.accessToken instead of data.token
        const accessToken = (data.data as any).session?.accessToken || data.data.token;
        if (accessToken) {
          this.storeToken(accessToken);
        }
        return {
          success: true,
          user: data.data.user,
          token: accessToken,
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
        // App users use session.accessToken instead of data.token
        const accessToken = (data.data as any).session?.accessToken || data.data.token;
        if (accessToken) {
          this.storeToken(accessToken);
        }
        return {
          success: true,
          user: data.data.user,
          token: accessToken,
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

