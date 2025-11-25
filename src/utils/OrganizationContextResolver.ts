import { Pool } from 'pg';

export interface OrganizationContext {
  organisation_name: string | null;
  organisation_id: number | null;
  is_admin: boolean;
}

interface User {
  id: number;
  organisation_id?: number | null;
}

interface Role {
  id: number;
  role_key: string;
  organisation_field_name?: string | null;
  organisation_lookup_table?: string | null;
  // organisation_lookup_field is deprecated - junction tables now use standard structure with organisation_id column
  organisation_lookup_field?: string | null;
}

/**
 * Resolves organization context for a user based on their roles
 * Supports three scenarios:
 * 1. Direct assignment: user.organisation_id + role.organisation_field_name
 * 2. User-scoped: role.organisation_field_name = "user_id"
 * 3. Junction table lookup: role has organisation_lookup_table
 * 
 * Junction tables must follow standard structure:
 * - id (PRIMARY KEY)
 * - user_id (INTEGER, references app user)
 * - organisation_id (INTEGER, the organization ID to use)
 * - created_at (TIMESTAMP)
 * - updated_at (TIMESTAMP)
 */
export class OrganizationContextResolver {
  /**
   * Resolve organization context for a user
   */
  static async resolveOrganisationContext(
    user: User,
    roles: Role[],
    pool: Pool,
    schemaName: string
  ): Promise<OrganizationContext> {
    console.log(`[OrganizationContextResolver] Resolving context for user ${user.id}`);
    console.log(`[OrganizationContextResolver] User organisation_id: ${user.organisation_id}`);
    console.log(`[OrganizationContextResolver] Roles:`, JSON.stringify(roles, null, 2));

    // Check if user has admin role (admin bypasses organization filtering)
    const hasAdminRole = roles.some(role => role.role_key === 'admin');
    if (hasAdminRole) {
      console.log(`[OrganizationContextResolver] User has admin role - bypassing organization filtering`);
      return {
        organisation_name: null,
        organisation_id: null,
        is_admin: true,
      };
    }

    // If no roles, return null context
    if (!roles || roles.length === 0) {
      console.log(`[OrganizationContextResolver] No roles found - no organization context`);
      return {
        organisation_name: null,
        organisation_id: null,
        is_admin: false,
      };
    }

    // Use the first role (or could prioritize by some logic)
    const primaryRole = roles[0];
    console.log(`[OrganizationContextResolver] Using primary role:`, JSON.stringify(primaryRole, null, 2));

    // If role doesn't have organisation_field_name, no organization context
    if (!primaryRole.organisation_field_name) {
      console.log(`[OrganizationContextResolver] Primary role has no organisation_field_name - no organization context`);
      return {
        organisation_name: null,
        organisation_id: null,
        is_admin: false,
      };
    }

    // Scenario 1: User-scoped (organisation_field_name = "user_id")
    if (primaryRole.organisation_field_name === 'user_id') {
      console.log(`[OrganizationContextResolver] User-scoped: using user_id = ${user.id}`);
      return {
        organisation_name: 'user_id',
        organisation_id: user.id,
        is_admin: false,
      };
    }

    // Scenario 2: Junction table lookup
    // Standard junction table structure: id (pk), user_id, <organisation_field_name>, created_at, updated_at
    // The junction table uses the SAME field name as the data tables (e.g., church_id, association_id)
    // This ensures consistency: if data tables use "church_id", junction table also uses "church_id"
    if (primaryRole.organisation_lookup_table) {
      try {
        // The junction table should have a column matching organisation_field_name
        // e.g., if organisation_field_name is "church_id", junction table should have "church_id"
        const orgFieldName = primaryRole.organisation_field_name;
        
        // Verify the column exists in the junction table
        const checkColumnQuery = `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = $1 
              AND table_name = $2 
              AND column_name = $3
          ) as exists
        `;
        
        const columnCheck = await pool.query(checkColumnQuery, [
          schemaName,
          primaryRole.organisation_lookup_table,
          orgFieldName
        ]);
        
        if (!columnCheck.rows[0].exists) {
          console.error(`[OrganizationContextResolver] Junction table "${primaryRole.organisation_lookup_table}" is missing required column "${orgFieldName}"`);
          console.error(`[OrganizationContextResolver] Junction table must have: id, user_id, ${orgFieldName}, created_at, updated_at`);
          return {
            organisation_name: null,
            organisation_id: null,
            is_admin: false,
          };
        }
        
        console.log(`[OrganizationContextResolver] Junction table lookup:`);
        console.log(`  - Table: ${primaryRole.organisation_lookup_table}`);
        console.log(`  - User ID: ${user.id}`);
        console.log(`  - Organisation field name: ${orgFieldName} (used in both junction table and data tables)`);
        console.log(`  - Query: SELECT ${orgFieldName} FROM ${primaryRole.organisation_lookup_table} WHERE user_id = $1`);
        
        const lookupQuery = `
          SELECT ${orgFieldName} as organisation_id
          FROM ${schemaName}.${primaryRole.organisation_lookup_table}
          WHERE user_id = $1
          LIMIT 1
        `;

        console.log(`[OrganizationContextResolver] Query: ${lookupQuery}`);

        const result = await pool.query(lookupQuery, [user.id]);
        console.log(`[OrganizationContextResolver] Lookup result:`, result.rows);

        if (result.rows.length > 0 && result.rows[0].organisation_id) {
          const orgId = result.rows[0].organisation_id;
          console.log(`[OrganizationContextResolver] Found organisation_id: ${orgId} from junction table`);
          return {
            organisation_name: primaryRole.organisation_field_name,
            organisation_id: orgId,
            is_admin: false,
          };
        }

        // No match in junction table
        console.log(`[OrganizationContextResolver] No match found in junction table`);
        return {
          organisation_name: null,
          organisation_id: null,
          is_admin: false,
        };
      } catch (error) {
        console.error('[OrganizationContextResolver] Error looking up organization from junction table:', error);
        return {
          organisation_name: null,
          organisation_id: null,
          is_admin: false,
        };
      }
    }

    // Scenario 3: Direct assignment (user has organisation_id)
    if (user.organisation_id) {
      console.log(`[OrganizationContextResolver] Direct assignment: using user.organisation_id = ${user.organisation_id}`);
      return {
        organisation_name: primaryRole.organisation_field_name,
        organisation_id: user.organisation_id,
        is_admin: false,
      };
    }

    // No organization context found
    console.log(`[OrganizationContextResolver] No organization context found - user has no organisation_id and no junction table`);
    return {
      organisation_name: null,
      organisation_id: null,
      is_admin: false,
    };
  }
}

