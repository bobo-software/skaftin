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
  console.log('🔍 [OrgFilter] Checking organization filter...');
  console.log('  └─ Has appUser:', !!req.appUser);
  
  // Only apply to authenticated app users
  if (!req.appUser) {
    console.log('  └─ ⚠️  No appUser found, skipping organization filter');
    return next();
  }

  console.log('  └─ App user:', req.appUser.email);
  console.log('  └─ Is admin:', req.appUser.is_admin);
  console.log('  └─ Organisation:', req.appUser.organisation_name, '=', req.appUser.organisation_id);

  // Admin users bypass organization filtering
  if (req.appUser.is_admin) {
    console.log('  └─ ✅ Admin user, bypassing organization filter');
    return next();
  }

  // If no organization context, allow request (might be intentional for some endpoints)
  if (!req.appUser.organisation_name || req.appUser.organisation_id === null || req.appUser.organisation_id === undefined) {
    console.log('  └─ ⚠️  No organization context, skipping filter');
    return next();
  }

  // Attach organization filter to request for use in controllers
  req.organisationFilter = {
    field: req.appUser.organisation_name,
    value: req.appUser.organisation_id,
  };

  console.log('  └─ ✅ Organization filter attached:', req.organisationFilter);

  next();
}

