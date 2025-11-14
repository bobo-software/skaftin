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
  projectId?: number;
  schemaName?: string;
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
        
        // Set projectId and schemaName from credential
        req.projectId = verification.credential.project_id;
        const schemaResult = await pool.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [req.projectId]
        );
        if (schemaResult.rows.length > 0) {
          req.schemaName = schemaResult.rows[0].schema_name;
        }
        
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
        
        // Set projectId and schemaName from credential
        req.projectId = verification.credential.project_id;
        const schemaResult = await pool.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [req.projectId]
        );
        if (schemaResult.rows.length > 0) {
          req.schemaName = schemaResult.rows[0].schema_name;
        }
        
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
        
        // Set projectId and schemaName from credential
        req.projectId = verification.credential.project_id;
        const schemaResult = await pool.query(
          'SELECT schema_name FROM projects WHERE id = $1',
          [req.projectId]
        );
        if (schemaResult.rows.length > 0) {
          req.schemaName = schemaResult.rows[0].schema_name;
        }
        
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
 * Project ID is extracted from API key or can be provided in URL params (for SuperTokens)
 */
export const verifyProjectAccess = async (
  req: HybridAuthRequest,
  res: Response,
  next: NextFunction
) => {
  // For API key auth, projectId is already set from credential
  if (req.authType === 'api_key' && req.projectId) {
    console.log('  └─ ✅ Project access granted (API key):', req.projectId);
    return next();
  }

  // For SuperTokens, check URL param or use project from session
  if (req.authType === 'supertokens' && req.session) {
    const projectId = req.params.projectId ? parseInt(req.params.projectId) : null;
    
    if (projectId) {
      req.projectId = projectId;
      // Get schema name
      const schemaResult = await pool.query(
        'SELECT schema_name FROM projects WHERE id = $1',
        [projectId]
      );
      if (schemaResult.rows.length > 0) {
        req.schemaName = schemaResult.rows[0].schema_name;
      }
    }
    
    console.log('  └─ ✅ Project access granted (SuperTokens)');
    return next();
  }

  // If no project context found
  if (!req.projectId) {
    return ResponseUtils.error(
      res,
      'Project context not found. Provide API key or project ID in URL.',
      null,
      null,
      400
    );
  }

  return next();
};

/**
 * Combined middleware: Hybrid auth + project access
 * For API keys: Project is extracted automatically
 * For SuperTokens: Project ID can be in URL params
 */
export const hybridAuthAndVerifyProject = [hybridAuth, verifyProjectAccess];


