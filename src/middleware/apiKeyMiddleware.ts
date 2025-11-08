import { Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import ResponseUtils from '../utils/ResponseUtils';
import CredentialsController from '../controllers/CredentialsController';

export interface ApiKeyAuthenticatedRequest extends Request {
  credential?: {
    id: number;
    projectId: number;
    name: string;
    type: 'api_key' | 'access_token';
    permissions: string[];
  };
}

let pool: Pool;

/**
 * Initialize API key middleware with database pool
 */
export function initializeApiKeyMiddleware(dbPool: Pool) {
  pool = dbPool;
}

/**
 * Middleware to authenticate using API key or access token
 * Checks X-API-Key header for credentials
 */
export const authenticateApiKey = async (
  req: ApiKeyAuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    console.log('🔑 [authenticateApiKey] Checking for API key');
    console.log('  └─ Has X-API-Key header:', !!apiKey);

    if (!apiKey) {
      console.log('  └─ ❌ No API key provided');
      return ResponseUtils.error(res, 'API key required', null, null, 401);
    }

    console.log('  └─ Verifying credential...');
    const verification = await CredentialsController.verifyCredential(pool, apiKey);

    if (!verification.valid || !verification.credential) {
      console.log('  └─ ❌ Invalid credential:', verification.error);
      return ResponseUtils.error(res, verification.error || 'Invalid API key', null, null, 403);
    }

    console.log('  └─ ✅ Credential verified');
    console.log('     └─ Project ID:', verification.credential.project_id);
    console.log('     └─ Type:', verification.credential.credential_type);
    console.log('     └─ Permissions:', verification.credential.permissions);

    // Attach credential info to request
    req.credential = {
      id: verification.credential.id!,
      projectId: verification.credential.project_id,
      name: verification.credential.name,
      type: verification.credential.credential_type,
      permissions: verification.credential.permissions || [],
    };

    next();
  } catch (error: any) {
    console.error('  └─ ❌ API key authentication error:', error);
    return ResponseUtils.error(res, 'Authentication failed', error, null, 500);
  }
};

/**
 * Middleware to check if API key has a specific permission
 */
export const requirePermission = (permission: string) => {
  return (req: ApiKeyAuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.credential) {
      return ResponseUtils.error(res, 'Authentication required', null, null, 401);
    }

    console.log('🔐 [requirePermission] Checking permission:', permission);
    console.log('  └─ User permissions:', req.credential.permissions);

    if (!req.credential.permissions.includes(permission)) {
      console.log('  └─ ❌ Permission denied');
      return ResponseUtils.error(
        res,
        `Insufficient permissions. Required: ${permission}`,
        null,
        null,
        403
      );
    }

    console.log('  └─ ✅ Permission granted');
    next();
  };
};

/**
 * Combined middleware: Authenticate API key + Check permission
 */
export const authenticateWithPermission = (permission: string) => {
  return [authenticateApiKey, requirePermission(permission)];
};

