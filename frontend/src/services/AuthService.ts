const API_BASE_URL = process.env.VITE_API_URL || 'http://coolify.bobosoftware.co.za:4006';

interface AuthResponse {
  status: 'success' | 'error';
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
    return localStorage.getItem('skaftin_token');
  }

  storeToken(token: string): void {
    localStorage.setItem('skaftin_token', token);
  }

  removeToken(): void {
    localStorage.removeItem('skaftin_token');
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
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.status === 'success' && data.data) {
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
        body: JSON.stringify({ email, password, full_name: fullName }),
      });

      const data: AuthResponse = await response.json();

      if (response.ok && data.status === 'success' && data.data) {
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

  logout(): void {
    this.removeToken();
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export default new AuthService();

