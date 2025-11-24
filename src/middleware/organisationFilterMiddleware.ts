import { Response, NextFunction } from 'express';
import { AppUserSuperTokensRequest } from './appUserSuperTokensMiddleware';

// Extended request type with organization filter
export interface OrganisationFilterRequest extends AppUserSuperTokensRequest {
  organisationFilter?: {
    field: string;
    value: number;
  };
}

/**
 * Middleware to automatically add organization filtering to requests
 * Only applies to non-admin users
 * For client-side API requests only (not admin app)
 */
export function organisationFilterMiddleware(
  req: OrganisationFilterRequest,
  res: Response,
  next: NextFunction
) {
  // Only apply to authenticated app users
  if (!req.appUser) {
    return next();
  }

  // Admin users bypass organization filtering
  if (req.appUser.is_admin) {
    return next();
  }

  // If no organization context, allow request (might be intentional for some endpoints)
  if (!req.appUser.organisation_name || req.appUser.organisation_id === null || req.appUser.organisation_id === undefined) {
    return next();
  }

  // Attach organization filter to request for use in controllers
  req.organisationFilter = {
    field: req.appUser.organisation_name,
    value: req.appUser.organisation_id,
  };

  next();
}

