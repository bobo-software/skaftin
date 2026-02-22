package graphql

import (
	"time"

	gql "github.com/graphql-go/graphql"
	"github.com/graphql-go/graphql/language/ast"
)

// jsonScalar is a pass-through scalar for arbitrary JSON values.
var jsonScalar = gql.NewScalar(gql.ScalarConfig{
	Name:        "JSON",
	Description: "JSON custom scalar type",
	Serialize:   func(value any) any { return value },
	ParseValue:  func(value any) any { return value },
	ParseLiteral: func(valueAST ast.Value) any {
		return parseLiteralJSON(valueAST)
	},
})

func parseLiteralJSON(valueAST ast.Value) any {
	switch v := valueAST.(type) {
	case *ast.StringValue:
		return v.Value
	case *ast.IntValue:
		return v.Value
	case *ast.FloatValue:
		return v.Value
	case *ast.BooleanValue:
		return v.Value
	case *ast.ObjectValue:
		obj := make(map[string]any, len(v.Fields))
		for _, f := range v.Fields {
			obj[f.Name.Value] = parseLiteralJSON(f.Value)
		}
		return obj
	case *ast.ListValue:
		list := make([]any, len(v.Values))
		for i, val := range v.Values {
			list[i] = parseLiteralJSON(val)
		}
		return list
	default:
		return nil
	}
}

var dateTimeScalar = gql.NewScalar(gql.ScalarConfig{
	Name:        "DateTime",
	Description: "DateTime custom scalar type",
	Serialize: func(value any) any {
		if t, ok := value.(time.Time); ok {
			return t.Format(time.RFC3339Nano)
		}
		return value
	},
	ParseValue: func(value any) any {
		if s, ok := value.(string); ok {
			t, _ := time.Parse(time.RFC3339Nano, s)
			return t
		}
		return value
	},
	ParseLiteral: func(valueAST ast.Value) any {
		if v, ok := valueAST.(*ast.StringValue); ok {
			t, _ := time.Parse(time.RFC3339Nano, v.Value)
			return t
		}
		return nil
	},
})

var columnType = gql.NewObject(gql.ObjectConfig{
	Name: "Column",
	Fields: gql.Fields{
		"column_name":              &gql.Field{Type: gql.NewNonNull(gql.String)},
		"data_type":               &gql.Field{Type: gql.NewNonNull(gql.String)},
		"character_maximum_length": &gql.Field{Type: gql.Int},
		"is_nullable":             &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
		"column_default":          &gql.Field{Type: gql.String},
		"ordinal_position":        &gql.Field{Type: gql.NewNonNull(gql.Int)},
		"is_primary_key":          &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
	},
})

var tableType = gql.NewObject(gql.ObjectConfig{
	Name: "Table",
	Fields: gql.Fields{
		"table_name":   &gql.Field{Type: gql.NewNonNull(gql.String)},
		"table_schema": &gql.Field{Type: gql.NewNonNull(gql.String)},
		"table_type":   &gql.Field{Type: gql.String},
		"columns":      &gql.Field{Type: gql.NewList(gql.NewNonNull(columnType))},
	},
})

var rowType = gql.NewObject(gql.ObjectConfig{
	Name: "Row",
	Fields: gql.Fields{
		"data": &gql.Field{Type: gql.NewNonNull(jsonScalar)},
	},
})

var queryResultType = gql.NewObject(gql.ObjectConfig{
	Name: "QueryResult",
	Fields: gql.Fields{
		"rows":          &gql.Field{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(rowType)))},
		"rowCount":      &gql.Field{Type: gql.NewNonNull(gql.Int)},
		"columns":       &gql.Field{Type: gql.NewList(gql.NewNonNull(gql.String))},
		"executionTime": &gql.Field{Type: gql.Float},
	},
})

var mutationResultType = gql.NewObject(gql.ObjectConfig{
	Name: "MutationResult",
	Fields: gql.Fields{
		"success":  &gql.Field{Type: gql.NewNonNull(gql.Boolean)},
		"message":  &gql.Field{Type: gql.String},
		"data":     &gql.Field{Type: jsonScalar},
		"rowCount": &gql.Field{Type: gql.Int},
	},
})

var constraintType = gql.NewObject(gql.ObjectConfig{
	Name: "Constraint",
	Fields: gql.Fields{
		"constraint_name":        &gql.Field{Type: gql.NewNonNull(gql.String)},
		"constraint_type":        &gql.Field{Type: gql.NewNonNull(gql.String)},
		"column_name":            &gql.Field{Type: gql.String},
		"referenced_table_name":  &gql.Field{Type: gql.String},
		"referenced_column_name": &gql.Field{Type: gql.String},
		"update_rule":            &gql.Field{Type: gql.String},
		"delete_rule":            &gql.Field{Type: gql.String},
		"check_clause":           &gql.Field{Type: gql.String},
	},
})

var orderByInput = gql.NewInputObject(gql.InputObjectConfig{
	Name: "OrderByInput",
	Fields: gql.InputObjectConfigFieldMap{
		"field":     &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"direction": &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
	},
})

var columnDefinitionInput = gql.NewInputObject(gql.InputObjectConfig{
	Name: "ColumnDefinitionInput",
	Fields: gql.InputObjectConfigFieldMap{
		"name":         &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"type":         &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"nullable":     &gql.InputObjectFieldConfig{Type: gql.Boolean},
		"defaultValue": &gql.InputObjectFieldConfig{Type: gql.String},
		"primaryKey":   &gql.InputObjectFieldConfig{Type: gql.Boolean},
	},
})

var createTableInput = gql.NewInputObject(gql.InputObjectConfig{
	Name: "CreateTableInput",
	Fields: gql.InputObjectConfigFieldMap{
		"tableName": &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"columns":   &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.NewList(gql.NewNonNull(columnDefinitionInput)))},
	},
})

var addColumnInput = gql.NewInputObject(gql.InputObjectConfig{
	Name: "AddColumnInput",
	Fields: gql.InputObjectConfigFieldMap{
		"columnName":   &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"columnType":   &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"nullable":     &gql.InputObjectFieldConfig{Type: gql.Boolean},
		"defaultValue": &gql.InputObjectFieldConfig{Type: gql.String},
	},
})

var createForeignKeyInput = gql.NewInputObject(gql.InputObjectConfig{
	Name: "CreateForeignKeyInput",
	Fields: gql.InputObjectConfigFieldMap{
		"columnName":       &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"referencedTable":  &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"referencedColumn": &gql.InputObjectFieldConfig{Type: gql.NewNonNull(gql.String)},
		"onDelete":         &gql.InputObjectFieldConfig{Type: gql.String},
		"onUpdate":         &gql.InputObjectFieldConfig{Type: gql.String},
	},
})
