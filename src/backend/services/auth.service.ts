import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { pool } from '../db/connection';
import { config } from '../config/environment';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResult {
  success: boolean;
  user?: Omit<User, 'password_hash'>;
  token?: string;
  error?: string;
}

export class AuthService {
  async register(email: string, password: string): Promise<AuthResult> {
    try {
      // Check if user already exists
      const existingUser = await pool.query(
        'SELECT id FROM auth.users WHERE email = $1',
        [email]
      );

      if (existingUser.rows.length > 0) {
        return {
          success: false,
          error: 'User with this email already exists'
        };
      }

      // Hash password
      const saltRounds = config.security.bcryptRounds;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      // Create user
      const result = await pool.query(
        'INSERT INTO auth.users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at, updated_at',
        [email, passwordHash]
      );

      const user = result.rows[0];
      const token = this.generateToken(user.id);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        token
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  async login(email: string, password: string): Promise<AuthResult> {
    try {
      // Find user
      const result = await pool.query(
        'SELECT id, email, password_hash, created_at, updated_at FROM auth.users WHERE email = $1',
        [email]
      );

      if (result.rows.length === 0) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      const user = result.rows[0];

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid email or password'
        };
      }

      const token = this.generateToken(user.id);

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          created_at: user.created_at,
          updated_at: user.updated_at
        },
        token
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  async verifyToken(token: string): Promise<{ success: boolean; userId?: string; error?: string }> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as { userId: string };
      return {
        success: true,
        userId: decoded.userId
      };
    } catch (error) {
      return {
        success: false,
        error: 'Invalid token'
      };
    }
  }

  async getUserById(userId: string): Promise<Omit<User, 'password_hash'> | null> {
    try {
      const result = await pool.query(
        'SELECT id, email, created_at, updated_at FROM auth.users WHERE id = $1',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  private generateToken(userId: string): string {
    const payload = { userId };
    const secret = config.jwt.secret;
    const options: jwt.SignOptions = { expiresIn: '24h' };
    
    return jwt.sign(payload, secret, options);
  }
}
