package mcp

import (
	"context"
	"testing"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
)

func TestResolveProjectID_AdminEndpointUsesArgs(t *testing.T) {
	pid, err := resolveProjectID(context.Background(), map[string]any{"projectId": "12"}, false)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if pid != 12 {
		t.Fatalf("expected pid 12, got %d", pid)
	}
}

func TestResolveProjectID_ClientEndpointUsesTokenWhenArgsMissing(t *testing.T) {
	ctx := context.WithValue(context.Background(), auth.AuthContextKey, &model.AuthContext{ProjectID: 42})
	pid, err := resolveProjectID(ctx, map[string]any{}, true)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if pid != 42 {
		t.Fatalf("expected pid 42, got %d", pid)
	}
}

func TestResolveProjectID_ClientEndpointRejectsMismatch(t *testing.T) {
	ctx := context.WithValue(context.Background(), auth.AuthContextKey, &model.AuthContext{ProjectID: 42})
	_, err := resolveProjectID(ctx, map[string]any{"projectId": "7"}, true)
	if err == nil {
		t.Fatalf("expected mismatch error")
	}
}
