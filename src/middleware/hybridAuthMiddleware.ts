import { Request, Response, NextFunction } from 'express';
import { verifySession } from "supertokens-node/recipe/session/framework/express";
import { SessionRequest } from "supertokens-node/framework/express";
import ResponseUtils from '../utils/ResponseUtils';
import CredentialsController from '../controllers/CredentialsController';
import { Pool } from 'pg';

let pool: Pool;

export function initializeHybridAuthMiddleware(dbPool: Pool) {
  pool = dbPool;
}

export interface HybridAuthRequest extends SessionRequest {
  user?: {
    userId: string;
    email?: string;
    projectIds?: number[];
    role?: string;
  };
  credential?: {
    id: number;
    projectId: number;
    name: string;
    type: 'api_key' | 'access_token' | 'mcp_key';
    permissions: string[];
  };
  authType?: 'supertokens' | 'api_key';
}

/**
 * Hybrid middleware that accepts BOTH SuperTokens sessions AND API keys
 * Tries API key first, falls back to SuperTokens
 */
export const hybridAuth = async (
  req: HybridAuthRequest,
  res: Response,
  next: NextFunction
) => {
  // Try API key authentication first
  const apiKey = req.headers['x-api-key'] as string;
  const accessToken = req.headers['authorization']?.startsWith('Bearer ') 
    ? req.headers['authorization'].split(' ')[1] 
    : null;

  console.log('🔐 [HybridAuth] Checking authentication...');
  console.log('  └─ Has X-API-Key:', !!apiKey);
  console.log('  └─ Has Bearer token:', !!accessToken);

  // Attempt 1: API Key authentication
  if (apiKey) {
    console.log('  └─ Trying API key authentication...');
    try {
      const verification = await CredentialsController.verifyCredential(pool, apiKey);
      
      if (verification.valid && verification.credential) {
        console.log('  └─ ✅ API key valid');
        req.credential = {
          id: verification.credential.id!,
          projectId: verification.credential.project_id,
          name: verification.credential.name,
          type: verification.credential.credential_type,
          permissions: verification.credential.permissions || [],
        };
        req.authType = 'api_key';
        
        // Update last used timestamp
        await CredentialsController.updateLastUsed(pool, apiKey);
        
        return next();
      }
      
      console.log('  └─ ❌ API key invalid:', verification.error);
    } catch (error: any) {
      console.error('  └─ ❌ API key verification error:', error);
    }
  }

  // Attempt 2: Access Token authentication (Bearer token that's not MCP)
  if (accessToken && !accessToken.startsWith('mcp_')) {
    console.log('  └─ Trying access token authentication...');
    try {
      const verification = await CredentialsController.verifyCredential(pool, accessToken);
      
      if (verification.valid && verification.credential) {
        console.log('  └─ ✅ Access token valid');
        req.credential = {
          id: verification.credential.id!,
          projectId: verification.credential.project_id,
          name: verification.credential.name,
          type: verification.credential.credential_type,
          permissions: verification.credential.permissions || [],
        };
        req.authType = 'api_key';
        
        await CredentialsController.updateLastUsed(pool, accessToken);
        
        return next();
      }
      
      console.log('  └─ ❌ Access token invalid:', verification.error);
    } catch (error: any) {
      console.error('  └─ ❌ Access token verification error:', error);
    }
  }

  // Attempt 3: MCP Key authentication
  if (accessToken && accessToken.startsWith('mcp_')) {
    console.log('  └─ Trying MCP key authentication...');
    try {
      const verification = await CredentialsController.verifyCredential(pool, accessToken);
      
      if (verification.valid && verification.credential) {
        console.log('  └─ ✅ MCP key valid');
        req.credential = {
          id: verification.credential.id!,
          projectId: verification.credential.project_id,
          name: verification.credential.name,
          type: verification.credential.credential_type,
          permissions: verification.credential.permissions || [],
        };
        req.authType = 'api_key';
        
        await CredentialsController.updateLastUsed(pool, accessToken);
        
        return next();
      }
      
      console.log('  └─ ❌ MCP key invalid:', verification.error);
    } catch (error: any) {
      console.error('  └─ ❌ MCP key verification error:', error);
    }
  }

  // Attempt 4: SuperTokens session (fallback for Skaftin UI)
  console.log('  └─ Trying SuperTokens authentication...');
  return verifySession({ sessionRequired: false })(req, res, (err) => {
    if (err) {
      console.log('  └─ ❌ All authentication methods failed');
      return ResponseUtils.error(res, 'Authentication required. Provide X-API-Key header or valid session.', null, null, 401);
    }
    
    if (req.session) {
      console.log('  └─ ✅ SuperTokens session valid');
      req.authType = 'supertokens';
      return next();
    }
    
    console.log('  └─ ❌ No valid authentication found');
    return ResponseUtils.error(res, 'Authentication required. Provide X-API-Key header or valid session.', null, null, 401);
  });
};

/**
 * Middleware to verify project access for hybrid auth
 */
export const verifyProjectAccess = async (
  req: HybridAuthRequest,
  res: Response,
  next: NextFunction
) => {
  const { projectId } = req.params;

  if (!projectId) {
    return ResponseUtils.error(res, 'Project ID is required', null, null, 400);
  }

  // If authenticated via API key, check if credential belongs to this project
  if (req.authType === 'api_key' && req.credential) {
    if (req.credential.projectId.toString() !== projectId) {
      console.log('  └─ ❌ API key project mismatch');
      return ResponseUtils.error(
        res,
        'API key does not have access to this project',
        null,
        null,
        403
      );
    }
    console.log('  └─ ✅ Project access granted (API key)');
    return next();
  }

  // If authenticated via SuperTokens, verify user has access (existing logic)
  if (req.authType === 'supertokens' && req.session) {
    // SuperTokens project access verification logic would go here
    // For now, allow all authenticated SuperTokens users
    console.log('  └─ ✅ Project access granted (SuperTokens)');
    return next();
  }

  return ResponseUtils.error(res, 'Project access denied', null, null, 403);
};

/**
 * Combined middleware: Hybrid auth + project access
 */
export const hybridAuthAndVerifyProject = [hybridAuth, verifyProjectAccess];


