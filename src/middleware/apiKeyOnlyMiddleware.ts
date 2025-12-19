import { Request, Response, NextFunction } from 'express';
import ResponseUtils from '../utils/ResponseUtils';
import CredentialsController from '../controllers/CredentialsController';
import { Pool } from 'pg';

let pool: Pool;

export function initializeApiKeyOnlyMiddleware(dbPool: Pool) {
  pool = dbPool;
}

export interface ApiKeyOnlyRequest extends Request {
  credential?: {
    id: number;
    projectId: number;
    name: string;
    type: 'api_key' | 'access_token' | 'mcp_key';
    permissions: string[];
  };
  authType?: 'api_key';
  projectId?: number;
  schemaName?: string;
}

/**
 * Middleware that ONLY accepts API keys or access tokens
 * Does NOT fall back to SuperTokens authentication
 * Used for public endpoints that require API key but not user authentication
 */
export const apiKeyOnlyAuth = async (
  req: ApiKeyOnlyRequest,
  res: Response,
  next: NextFunction
) => {
  // Try API key authentication first
  const apiKey = req.headers['x-api-key'] as string;
  const accessToken = req.headers['authorization']?.startsWith('Bearer ') 
    ? req.headers['authorization'].split(' ')[1] 
    : null;

  console.log('🔑 [ApiKeyOnlyAuth] Checking authentication...');
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
          'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
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
          'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
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
          'SELECT schema_name FROM skaftin_system_projects WHERE id = $1',
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

  // No valid API key or access token found - reject request
  console.log('  └─ ❌ No valid API key or access token found');
  return ResponseUtils.error(
    res,
    'Authentication required. Provide X-API-Key header or Authorization Bearer token with valid API key or access token.',
    null,
    null,
    401
  );
};

/**
 * Middleware to verify project access for API key only auth
 * Project ID is extracted from API key/access token
 */
export const verifyProjectAccess = async (
  req: ApiKeyOnlyRequest,
  res: Response,
  next: NextFunction
) => {
  // For API key auth, projectId is already set from credential
  if (req.authType === 'api_key' && req.projectId) {
    console.log('  └─ ✅ Project access granted (API key):', req.projectId);
    return next();
  }

  // If no project context found
  if (!req.projectId) {
    return ResponseUtils.error(
      res,
      'Project context not found. Provide API key or access token.',
      null,
      null,
      400
    );
  }

  return next();
};

/**
 * Combined middleware: API key only auth + project access
 * For API keys/access tokens: Project is extracted automatically
 */
export const apiKeyOnlyAuthAndVerifyProject = [apiKeyOnlyAuth, verifyProjectAccess];
