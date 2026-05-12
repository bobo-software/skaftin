package mcp

import (
	"encoding/json"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

// toolWithOptionalProjectIDInSchema returns a shallow copy of t with InputSchema
// adjusted so "projectId" is not listed in required, when the schema declares a
// projectId property. Used only for client MCP tool listings; admin listings
// keep the original schema.
func toolWithOptionalProjectIDInSchema(t *sdkmcp.Tool) *sdkmcp.Tool {
	if t == nil || t.InputSchema == nil {
		return t
	}
	b, err := json.Marshal(t.InputSchema)
	if err != nil {
		return t
	}
	var schema map[string]any
	if err := json.Unmarshal(b, &schema); err != nil {
		return t
	}
	props, _ := schema["properties"].(map[string]any)
	if props == nil {
		return t
	}
	if _, ok := props["projectId"]; !ok {
		return t
	}
	filterProjectIDFromRequiredList(schema)
	out := *t
	out.InputSchema = schema
	return &out
}

func filterProjectIDFromRequiredList(schema map[string]any) {
	raw, ok := schema["required"]
	if !ok || raw == nil {
		return
	}
	names := requiredFieldNames(raw)
	if len(names) == 0 {
		return
	}
	filtered := make([]string, 0, len(names))
	for _, name := range names {
		if name != "projectId" {
			filtered = append(filtered, name)
		}
	}
	if len(filtered) == 0 {
		delete(schema, "required")
	} else {
		schema["required"] = filtered
	}
}

func requiredFieldNames(raw any) []string {
	switch v := raw.(type) {
	case []string:
		return v
	case []any:
		out := make([]string, 0, len(v))
		for _, x := range v {
			if s, ok := x.(string); ok {
				out = append(out, s)
			}
		}
		return out
	default:
		return nil
	}
}
