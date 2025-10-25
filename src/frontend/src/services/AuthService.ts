import RequestUtils from '../utils/RequsetUtils';
import ApiRoutes from '../constants/ApiRoutes';

class AuthService {
  // Login user
  static async login(email: string, password: string): Promise<any> {
    return await RequestUtils.post(ApiRoutes.AUTH.LOGIN, '', {
      email,
      password
    });
  }

  // Register user
  static async register(email: string, password: string): Promise<any> {
    return await RequestUtils.post(ApiRoutes.AUTH.REGISTER, '', {
      email,
      password
    });
  }

  // Verify token
  static async verifyToken(token: string): Promise<any> {
    return await RequestUtils.get(ApiRoutes.AUTH.VERIFY, token);
  }

  // Get stored token
  static getStoredToken(): string | null {
    return localStorage.getItem('skaftin-token');
  }

  // Store token
  static storeToken(token: string): void {
    localStorage.setItem('skaftin-token', token);
  }

  // Remove token
  static removeToken(): void {
    localStorage.removeItem('skaftin-token');
  }

  // Check if user is authenticated
  static isAuthenticated(): boolean {
    return !!this.getStoredToken();
  }
}

export default AuthService;
