import { Request } from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import CredentialsController from '../../controllers/CredentialsController';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

/**
 * Get header value with case-insensitive lookup
 */
export function getHeader(req: Request, headerName: string): string | undefined {
  if (!req.headers) {
    console.log(`⚠️  No headers object on request`);
    return undefined;
  }

  const lowerName = headerName.toLowerCase();

  // Try exact match first
  if (req.headers[headerName]) {
    return req.headers[headerName] as string;
  }

  // Try lowercase
  if (req.headers[lowerName]) {
    return req.headers[lowerName] as string;
  }

  // Try uppercase
  const upperName = headerName.toUpperCase();
  if (req.headers[upperName]) {
    return req.headers[upperName] as string;
  }

  // Try with first letter capitalized
  const capitalName = headerName.charAt(0).toUpperCase() + headerName.slice(1);
  if (req.headers[capitalName]) {
    return req.headers[capitalName] as string;
  }

  return undefined;
}

/**
 * Extract user ID from JWT token in request
 * Handles case-insensitive header lookup
 */
export function getUserIdFromRequest(req: Request): string | null {
  // Use the helper to get authorization header
  const authHeader = getHeader(req, 'authorization');

  if (!authHeader) {
    console.log('⚠️  No authorization header found in request');
    console.log('  └─ Available headers:', Object.keys(req.headers || {}).join(', '));
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    console.log('⚠️  Invalid authorization header format');
    return null;
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return decoded.userId?.toString() || null;
  } catch (error) {
    console.log('⚠️  Token verification failed:', error);
    return null;
  }
}

/**
 * Extract project ID from MCP key or API key in request
 * Checks Authorization header, x-access-token, and x-api-key headers
 * Priority: Authorization header (Bearer token) > x-access-token > x-api-key
 */
export async function getProjectIdFromRequest(
  req: Request,
  pool: Pool
): Promise<number | null> {
  // Check for MCP key or API key in headers
  const authHeader = getHeader(req, 'authorization');
  let credential: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    credential = authHeader.split(' ')[1];
  } else {
    const accessToken = getHeader(req, 'x-access-token');
    const apiKey = getHeader(req, 'x-api-key');
    credential = accessToken || apiKey;
  }

  if (!credential) {
    return null;
  }

  try {
    const verification = await CredentialsController.verifyCredential(pool, credential);

    if (verification.valid && verification.credential) {
      return verification.credential.project_id;
    }
  } catch (error) {
    console.error('Error verifying credential for project ID extraction:', error);
  }

  return null;
}

/**
 * Extract authentication context from request
 */
export interface AuthContext {
  userId: string | null;
  projectId: number | null;
}

/**
 * Extract both user ID and project ID from request
 */
export async function getAuthContext(req: Request, pool: Pool): Promise<AuthContext> {
  const [userId, projectId] = await Promise.all([
    Promise.resolve(getUserIdFromRequest(req)),
    getProjectIdFromRequest(req, pool),
  ]);

  return { userId, projectId };
}

