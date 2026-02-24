package storage

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
)

func TestProjectID_UsesAuthContextFirst(t *testing.T) {
	req := httptest.NewRequest("GET", "/app-api/storage/buckets", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 88}))
	req.SetPathValue("projectId", "12")

	got, ok := projectID(httptest.NewRecorder(), req)
	if !ok {
		t.Fatalf("expected projectID to resolve from auth context")
	}
	if got != 88 {
		t.Fatalf("projectID = %d, want 88", got)
	}
}

func TestProjectID_FallsBackToPathValue(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/storage/42/buckets", nil)
	req.SetPathValue("projectId", "42")

	got, ok := projectID(httptest.NewRecorder(), req)
	if !ok {
		t.Fatalf("expected projectID to resolve from path value")
	}
	if got != 42 {
		t.Fatalf("projectID = %d, want 42", got)
	}
}

func TestRequireAuth_AllowsAPIKeyContext(t *testing.T) {
	req := httptest.NewRequest("GET", "/app-api/storage/buckets", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 7}))
	rec := httptest.NewRecorder()

	if ok := requireAuth(rec, req); !ok {
		t.Fatalf("expected requireAuth to allow API key context")
	}
}
