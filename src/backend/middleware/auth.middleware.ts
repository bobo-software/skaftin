import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    created_at: string;
    updated_at: string;
  };
}

export const authenticateToken = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const result = await authService.verifyToken(token);

    if (result.success && result.userId) {
      const user = await authService.getUserById(result.userId);
      
      if (user) {
        req.user = user;
        next();
      } else {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
    } else {
      return res.status(401).json({
        success: false,
        error: result.error || 'Invalid token'
      });
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};
