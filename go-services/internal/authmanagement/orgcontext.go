package authmanagement

import (
	"context"
	"fmt"
	"log/slog"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ResolveOrgContext determines the organization context for a user+role combination,
// matching the behaviour of OrganizationContextResolver.ts.
func ResolveOrgContext(ctx context.Context, pool *pgxpool.Pool, schema string, user *AppUser, roles []Role) OrgContext {
	if len(roles) == 0 {
		return OrgContext{}
	}

	for _, role := range roles {
		if role.RoleKey == "admin" {
			return OrgContext{IsAdmin: true}
		}
	}

	role := roles[0]
	if role.OrganisationFieldName == nil || *role.OrganisationFieldName == "" {
		return OrgContext{}
	}

	fieldName := *role.OrganisationFieldName

	// User-scoped scenario
	if fieldName == "user_id" {
		uid := fmt.Sprintf("%d", user.ID)
		name := "user_id"
		return OrgContext{OrganisationName: &name, OrganisationID: &uid}
	}

	// Junction table lookup
	if role.OrganisationLookupTable != nil && *role.OrganisationLookupTable != "" {
		orgID, err := lookupOrgFromJunction(ctx, pool, schema, *role.OrganisationLookupTable, fieldName, user.ID)
		if err != nil {
			slog.Warn("org junction lookup failed", "error", err)
			return OrgContext{}
		}
		if orgID != nil {
			return OrgContext{OrganisationName: &fieldName, OrganisationID: orgID}
		}
		return OrgContext{}
	}

	// Direct assignment from user.organisation_id
	if user.OrganisationID != nil && *user.OrganisationID != "" {
		return OrgContext{OrganisationName: &fieldName, OrganisationID: user.OrganisationID}
	}

	return OrgContext{}
}

func lookupOrgFromJunction(ctx context.Context, pool *pgxpool.Pool, schema, table, column string, userID int) (*string, error) {
	query := fmt.Sprintf(
		`SELECT %s FROM %s.%s WHERE user_id = $1 LIMIT 1`,
		pgx.Identifier{column}.Sanitize(),
		pgx.Identifier{schema}.Sanitize(),
		pgx.Identifier{table}.Sanitize(),
	)
	var orgID string
	err := pool.QueryRow(ctx, query, userID).Scan(&orgID)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &orgID, nil
}
