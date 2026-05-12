package mcp

import (
	"testing"
)

func TestToolWithOptionalProjectIDInSchema_DropsRequiredWhenOnlyProjectId(t *testing.T) {
	tool := makeTool("x", "test", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"})
	out := toolWithOptionalProjectIDInSchema(tool)
	schema, ok := out.InputSchema.(map[string]any)
	if !ok {
		t.Fatalf("expected map inputSchema")
	}
	if _, has := schema["required"]; has {
		t.Fatalf("expected required key removed when only projectId was required")
	}
}

func TestToolWithOptionalProjectIDInSchema_KeepsOtherRequired(t *testing.T) {
	tool := makeTool("y", "test", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"foo":       {Type: "string", Desc: "Foo"},
	}, []string{"projectId", "foo"})
	out := toolWithOptionalProjectIDInSchema(tool)
	names := requiredFieldNamesFromSchema(out.InputSchema.(map[string]any))
	if len(names) != 1 || names[0] != "foo" {
		t.Fatalf("expected required [foo], got %#v", names)
	}
}
