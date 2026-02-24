package authmanagement

import (
	"context"
	"fmt"
	"log/slog"
)

func (s *Service) ListCustomFields(ctx context.Context, projectID int, includeInactive bool) ([]CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	fields, err := s.store.ListCustomFields(ctx, schema, includeInactive)
	if err != nil {
		return nil, err
	}
	if fields == nil {
		fields = []CustomField{}
	}
	return fields, nil
}

func (s *Service) GetCustomField(ctx context.Context, projectID, fieldID int) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetCustomField(ctx, schema, fieldID)
}

func (s *Service) CreateCustomField(ctx context.Context, projectID int, f CustomField) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	exists, err := s.store.CustomFieldExistsByName(ctx, schema, f.FieldName)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, fmt.Errorf("field with this name already exists")
	}
	if f.FieldType == "reference" && f.ReferenceTable != nil {
		tExists, _ := s.store.TableExists(ctx, schema, *f.ReferenceTable)
		if !tExists {
			return nil, fmt.Errorf("reference table does not exist")
		}
	}
	return s.store.CreateCustomField(ctx, schema, f)
}

func (s *Service) UpdateCustomField(ctx context.Context, projectID, fieldID int, fields map[string]any) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpdateCustomField(ctx, schema, fieldID, fields)
}

func (s *Service) DeleteCustomField(ctx context.Context, projectID, fieldID int, permanent bool) (*CustomField, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.DeleteCustomField(ctx, schema, fieldID, permanent)
}

func (s *Service) ApplyCustomField(ctx context.Context, projectID, fieldID int) error {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return err
	}
	field, err := s.store.GetCustomField(ctx, schema, fieldID)
	if err != nil || field == nil {
		return fmt.Errorf("custom field not found")
	}

	colType := "TEXT"
	var defaultVal *string
	switch field.FieldType {
	case "number":
		colType = "NUMERIC"
	case "boolean":
		colType = "BOOLEAN"
		d := "false"
		defaultVal = &d
	case "date":
		colType = "TIMESTAMP"
	case "reference":
		colType = "INTEGER"
	}

	exists, _ := s.store.ColumnExists(ctx, schema, "skaftin_system_users", field.FieldName)
	if exists {
		return fmt.Errorf("column %s already exists on users table", field.FieldName)
	}

	if err := s.store.ApplyCustomFieldColumn(ctx, schema, field.FieldName, colType, field.IsRequired, defaultVal); err != nil {
		return fmt.Errorf("failed to add column: %w", err)
	}

	if field.FieldType == "reference" && field.ReferenceTable != nil && field.ReferenceColumn != nil {
		if err := s.store.AddForeignKey(ctx, schema, field.FieldName, *field.ReferenceTable, *field.ReferenceColumn); err != nil {
			slog.Warn("failed to add FK constraint (non-fatal)", "error", err)
		}
	}

	return nil
}

func (s *Service) GetAvailableTables(ctx context.Context, projectID int) ([]map[string]any, error) {
	schema, err := s.resolveSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.GetAvailableTables(ctx, schema)
}
