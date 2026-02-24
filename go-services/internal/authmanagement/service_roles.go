package authmanagement

import (
	"context"
	"encoding/json"
	"fmt"
)

func (s *Service) ListRoles(ctx context.Context, projectID int, includeUserCount bool) ([]Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	roles, err := s.store.ListRoles(ctx, schema, includeUserCount)
	if err != nil {
		return nil, err
	}
	if roles == nil {
		roles = []Role{}
	}
	return roles, nil
}

func (s *Service) GetRole(ctx context.Context, projectID, roleID int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetRole(ctx, schema, roleID)
}

func (s *Service) CreateRole(ctx context.Context, projectID int, roleName, roleKey string, description *string, permissions json.RawMessage, sessionDuration int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	existing, err := s.store.GetRoleByKey(ctx, schema, roleKey)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("role with this key already exists")
	}
	return s.store.CreateRole(ctx, schema, roleName, roleKey, description, permissions, sessionDuration)
}

func (s *Service) UpdateRole(ctx context.Context, projectID, roleID int, fields map[string]any) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	role, err := s.store.GetRole(ctx, schema, roleID)
	if err != nil || role == nil {
		return nil, fmt.Errorf("role not found")
	}
	if role.IsSystemRole {
		delete(fields, "role_name")
		delete(fields, "description")
	}
	if len(fields) == 0 {
		return role, nil
	}
	return s.store.UpdateRole(ctx, schema, roleID, fields)
}

func (s *Service) DeleteRole(ctx context.Context, projectID, roleID int) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	role, err := s.store.GetRole(ctx, schema, roleID)
	if err != nil || role == nil {
		return fmt.Errorf("role not found")
	}
	if role.IsSystemRole {
		return fmt.Errorf("cannot delete system role")
	}
	count, err := s.store.CountUsersWithRole(ctx, schema, roleID)
	if err != nil {
		return err
	}
	if count > 0 {
		return fmt.Errorf("cannot delete role with %d assigned users", count)
	}
	ok, err := s.store.DeleteRole(ctx, schema, roleID)
	if err != nil {
		return err
	}
	if !ok {
		return fmt.Errorf("role not found")
	}
	return nil
}

func (s *Service) GetRolePermissions(ctx context.Context, projectID, roleID int) (json.RawMessage, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetRolePermissions(ctx, schema, roleID)
}

func (s *Service) UpdateRolePermissions(ctx context.Context, projectID, roleID int, perms json.RawMessage) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdateRolePermissions(ctx, schema, roleID, perms)
}

func (s *Service) UpdateSessionDuration(ctx context.Context, projectID, roleID, minutes int) (*Role, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdateSessionDuration(ctx, schema, roleID, minutes)
}

func (s *Service) VerifyOrgContext(ctx context.Context, projectID, roleID int) (map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	role, err := s.store.GetRole(ctx, schema, roleID)
	if err != nil || role == nil {
		return nil, fmt.Errorf("role not found")
	}

	result := map[string]any{
		"role": map[string]any{
			"id": role.ID, "role_name": role.RoleName, "role_key": role.RoleKey,
			"organisation_field_name":   role.OrganisationFieldName,
			"organisation_lookup_table": role.OrganisationLookupTable,
			"organisation_lookup_field": role.OrganisationLookupField,
		},
		"configuration": map[string]any{},
		"status":        "valid",
		"issues":        []string{},
		"scenarios":     []map[string]any{},
	}

	if role.OrganisationFieldName == nil || *role.OrganisationFieldName == "" {
		result["status"] = "incomplete"
		result["issues"] = []string{"No organisation_field_name configured"}
		return result, nil
	}

	fieldName := *role.OrganisationFieldName
	if fieldName == "user_id" {
		result["scenarios"] = []map[string]any{{"type": "user_scoped", "description": "Each user is their own organisation"}}
		return result, nil
	}

	if role.OrganisationLookupTable != nil && *role.OrganisationLookupTable != "" {
		table := *role.OrganisationLookupTable
		exists, _ := s.store.TableExists(ctx, schema, table)
		if !exists {
			result["status"] = "error"
			result["issues"] = []string{fmt.Sprintf("Lookup table %s does not exist", table)}
			return result, nil
		}
		colExists, _ := s.store.ColumnExists(ctx, schema, table, fieldName)
		if !colExists {
			result["status"] = "error"
			result["issues"] = []string{fmt.Sprintf("Column %s not found in table %s", fieldName, table)}
			return result, nil
		}
		result["scenarios"] = []map[string]any{{"type": "junction_table", "table": table, "column": fieldName}}
	} else {
		result["scenarios"] = []map[string]any{{"type": "direct_assignment", "field": fieldName}}
	}

	return result, nil
}
