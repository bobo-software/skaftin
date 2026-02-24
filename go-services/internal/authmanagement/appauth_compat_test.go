package authmanagement

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
)

func TestLoginFromAppAPI_Success(t *testing.T) {
	var gotProjectID int
	var gotBody map[string]any

	h := &Handler{
		loginFunc: func(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
			gotProjectID = projectID
			gotBody = body
			return map[string]any{"accessToken": "token-123"}, nil
		},
	}

	reqBody := map[string]any{
		"username": "alice@example.com",
		"password": "secret",
		"method":   "email",
	}
	b, _ := json.Marshal(reqBody)
	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/login", bytes.NewReader(b))
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 42}))
	rec := httptest.NewRecorder()

	h.LoginFromAppAPI(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d. body=%s", rec.Code, http.StatusOK, rec.Body.String())
	}
	if gotProjectID != 42 {
		t.Fatalf("projectID = %d, want 42", gotProjectID)
	}
	if gotBody["credential"] != "alice@example.com" {
		t.Fatalf("credential = %v, want alice@example.com", gotBody["credential"])
	}
}

func TestLoginFromAppAPI_MissingAuthContext(t *testing.T) {
	h := &Handler{
		loginFunc: func(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
			t.Fatal("loginFunc should not be called without auth context")
			return nil, nil
		},
	}

	req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/login", bytes.NewReader([]byte(`{}`)))
	rec := httptest.NewRecorder()

	h.LoginFromAppAPI(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusUnauthorized)
	}
}

func TestLoginFromAppAPI_LoginErrors(t *testing.T) {
	tests := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{name: "invalid credentials", err: errors.New("invalid credentials"), wantStatus: http.StatusUnauthorized},
		{name: "invalid credentials sentinel", err: ErrInvalidCredentials, wantStatus: http.StatusUnauthorized},
		{name: "auth disabled", err: errors.New("authentication is disabled"), wantStatus: http.StatusForbidden},
		{name: "auth disabled sentinel", err: ErrAuthenticationClosed, wantStatus: http.StatusForbidden},
		{name: "other", err: errors.New("credentials are required"), wantStatus: http.StatusBadRequest},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h := &Handler{
				loginFunc: func(ctx context.Context, projectID int, body map[string]any) (map[string]any, error) {
					return nil, tc.err
				},
			}

			req := httptest.NewRequest(http.MethodPost, "/app-api/auth/auth/login", bytes.NewReader([]byte(`{"username":"u","password":"p"}`)))
			req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 9}))
			rec := httptest.NewRecorder()

			h.LoginFromAppAPI(rec, req)

			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d. body=%s", rec.Code, tc.wantStatus, rec.Body.String())
			}
		})
	}
}
