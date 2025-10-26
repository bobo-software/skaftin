import { Request, Response, NextFunction } from 'express';
import { verifySession } from 'supertokens-node/recipe/session/framework/express';

export interface AuthenticatedRequest extends Request {
  session?: any;
}

// Use SuperTokens session verification
export const authenticateToken = verifySession();
