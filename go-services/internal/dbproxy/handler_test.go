package dbproxy

import (
	"context"
	"net/http/httptest"
	"testing"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
)

func TestProjectID_UsesAuthContextFirst(t *testing.T) {
	req := httptest.NewRequest("GET", "/app-api/database/tables", nil)
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 77}))
	req.SetPathValue("projectId", "12")

	got, ok := projectID(req)
	if !ok {
		t.Fatalf("expected projectID to resolve from auth context")
	}
	if got != 77 {
		t.Fatalf("projectID = %d, want 77", got)
	}
}

func TestProjectID_FallsBackToPathValue(t *testing.T) {
	req := httptest.NewRequest("GET", "/api/database/42/tables", nil)
	req.SetPathValue("projectId", "42")

	got, ok := projectID(req)
	if !ok {
		t.Fatalf("expected projectID to resolve from path value")
	}
	if got != 42 {
		t.Fatalf("projectID = %d, want 42", got)
	}
}

func TestProjectID_FailsWithoutContextOrPath(t *testing.T) {
	req := httptest.NewRequest("GET", "/app-api/database/tables", nil)

	_, ok := projectID(req)
	if ok {
		t.Fatalf("expected projectID resolution to fail without context and path value")
	}
}
