package mcp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
)

func TestProtocolInitialize(t *testing.T) {
	srv := New(nil)
	handler := NewHTTPHandler(srv, false)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux, "/api/mcp")

	body := []byte(`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/mcp/protocol", bytes.NewReader(body))
	rec := httptest.NewRecorder()
	mux.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if resp["jsonrpc"] != "2.0" {
		t.Fatalf("expected jsonrpc 2.0, got %v", resp["jsonrpc"])
	}
}

func TestToolsListFilteringByEndpoint(t *testing.T) {
	srv := New(nil)
	adminHandler := NewHTTPHandler(srv, false)
	clientHandler := NewHTTPHandler(srv, true)

	adminMux := http.NewServeMux()
	adminHandler.RegisterRoutes(adminMux, "/api/mcp")
	clientMux := http.NewServeMux()
	clientHandler.RegisterRoutes(clientMux, "/app-api/mcp")

	adminReq := httptest.NewRequest(http.MethodGet, "/api/mcp/tools", nil)
	adminRec := httptest.NewRecorder()
	adminMux.ServeHTTP(adminRec, adminReq)
	if adminRec.Code != http.StatusOK {
		t.Fatalf("expected admin tools 200, got %d", adminRec.Code)
	}

	clientReq := httptest.NewRequest(http.MethodGet, "/app-api/mcp/tools", nil)
	clientRec := httptest.NewRecorder()
	clientMux.ServeHTTP(clientRec, clientReq)
	if clientRec.Code != http.StatusOK {
		t.Fatalf("expected client tools 200, got %d", clientRec.Code)
	}

	var adminResp struct {
		Tools []struct {
			Name string `json:"name"`
		} `json:"tools"`
	}
	var clientResp struct {
		Tools []struct {
			Name string `json:"name"`
		} `json:"tools"`
	}

	if err := json.Unmarshal(adminRec.Body.Bytes(), &adminResp); err != nil {
		t.Fatalf("failed to parse admin tools response: %v", err)
	}
	if err := json.Unmarshal(clientRec.Body.Bytes(), &clientResp); err != nil {
		t.Fatalf("failed to parse client tools response: %v", err)
	}

	adminHasCredentials := false
	for _, tool := range adminResp.Tools {
		if tool.Name == "get_mcp_key" {
			adminHasCredentials = true
			break
		}
	}
	if !adminHasCredentials {
		t.Fatalf("expected admin tool list to include get_mcp_key")
	}

	clientHasCredentials := false
	for _, tool := range clientResp.Tools {
		if tool.Name == "get_mcp_key" {
			clientHasCredentials = true
			break
		}
	}
	if clientHasCredentials {
		t.Fatalf("did not expect client tool list to include get_mcp_key")
	}
}

func TestClientCallTool_AllowsOmittedProjectIDWhenTokenContextExists(t *testing.T) {
	srv := New(nil)
	clientHandler := NewHTTPHandler(srv, true)

	clientMux := http.NewServeMux()
	clientHandler.RegisterRoutes(clientMux, "/app-api/mcp")

	body := []byte(`{"name":"unknown_tool","arguments":{}}`)
	req := httptest.NewRequest(http.MethodPost, "/app-api/mcp/call", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 7}))
	rec := httptest.NewRecorder()
	clientMux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for unknown tool on client endpoint, got %d", rec.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	msg, _ := resp["message"].(string)
	if msg == "" {
		t.Fatalf("expected error message in response")
	}
	if msg == "projectId is required" {
		t.Fatalf("expected token-scoped project resolution to avoid projectId-required errors")
	}
}

func TestClientCallTool_RejectsProjectIDMismatch(t *testing.T) {
	srv := New(nil)
	clientHandler := NewHTTPHandler(srv, true)

	clientMux := http.NewServeMux()
	clientHandler.RegisterRoutes(clientMux, "/app-api/mcp")

	body := []byte(`{"name":"unknown_tool","arguments":{"projectId":"99"}}`)
	req := httptest.NewRequest(http.MethodPost, "/app-api/mcp/call", bytes.NewReader(body))
	req = req.WithContext(context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{ProjectID: 7}))
	rec := httptest.NewRecorder()
	clientMux.ServeHTTP(rec, req)

	if rec.Code != http.StatusForbidden {
		t.Fatalf("expected 403 for project mismatch, got %d", rec.Code)
	}

	var resp map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	msg, _ := resp["message"].(string)
	if msg == "" {
		t.Fatalf("expected mismatch error message in response")
	}
	if msg != "projectId mismatch: request projectId 99 does not match token projectId 7" {
		t.Fatalf("unexpected mismatch message: %s", msg)
	}
}
