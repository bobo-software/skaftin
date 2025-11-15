import jwt, { JwtPayload } from 'jsonwebtoken';

export default class CommonUtils {

  static GenerateRandomString() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 20; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    result = result.slice(0, 5) + '-' + result.slice(5, 10) + '-' + result.slice(10, 20);
    return result;
  };

  static GenerateRandomInviteString() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 10; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      result += characters[randomIndex];
    }
    result = result.slice(0, 3) + '-' + result.slice(3, 6) + '-' + result.slice(6, 10);
    return result;
  };


  static GenerateTempPassword = () => {
    const numbers = [Math.floor(Math.random() * 10), Math.floor(Math.random() * 10), Math.floor(Math.random() * 10), Math.floor(Math.random() * 10)];
    return numbers.join('');
  }


  public static verifyToken(token: string): JwtPayload | string {
    const secret: any = process.env.JWT_SECRET;
    if (!secret) {
      console.log('JWT_SECRET environment variable is not set');
      throw new Error('JWT_SECRET environment variable is not set');
    }

    try {
      return jwt.verify(token, secret);
    } catch (err) {
      throw new Error('Invalid token');
    }
  }



  public static extractTokenFromHeader(authHeader: string | null): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Unauthorized');
    }
    return authHeader.split(' ')[1];
  }

  public static handleAuthHeader(req: any): any {
    try {
      const authHeader = req.headers.authorization;
      console.log('Auth header:', authHeader);
      
      const token = this.extractTokenFromHeader(authHeader);
      console.log('Extracted token:', token ? 'Found' : 'Not found');

      if (!token) {
        throw new Error('Unauthorized');
      }

      const decodedToken = this.verifyToken(token);
      console.log('Decoded token:', decodedToken);
      return decodedToken;
    } catch (error: unknown) {
      // Return null on auth failure, let the controller handle the response
      console.log('Auth error:', error);
      return null;
    }
  };

  static generateOTP() {
    const digits = '123456789';
    let OTP = '';
    for (let i = 0; i < 5; i++) {
      OTP += digits[Math.floor(Math.random() * 9)];
    }
    return OTP;
  }

  /**
   * Create route path with conditional admin prefix
   * Reduces repetition when defining routes for both admin and client
   */
  static createRoutePath(path: string, isAdmin: boolean): string {
    if (isAdmin && !path.includes('/:projectId')) {
      // For admin routes, check if we need to add projectId prefix
      // Most admin paths already include it, so we preserve the original
      return path;
    }
    return path;
  }

  /**
   * Check if a string path contains project ID parameter
   */
  static hasProjectIdParam(path: string): boolean {
    return path.includes('/:projectId');
  }

  /**
   * Add project ID prefix to a path if it doesn't already have it
   */
  static addProjectIdPrefix(path: string): string {
    if (this.hasProjectIdParam(path)) {
      return path;
    }
    return `/:projectId${path}`;
  }

  /**
   * Remove project ID prefix from a path if it exists
   */
  static removeProjectIdPrefix(path: string): string {
    return path.replace(/^\/:projectId/, '');
  }
}
