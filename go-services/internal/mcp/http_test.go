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

func TestToolsList_ClientInputSchemaOmitsProjectIDFromRequired(t *testing.T) {
	srv := New(nil)
	adminHandler := NewHTTPHandler(srv, false)
	clientHandler := NewHTTPHandler(srv, true)

	adminMux := http.NewServeMux()
	adminHandler.RegisterRoutes(adminMux, "/api/mcp")
	clientMux := http.NewServeMux()
	clientHandler.RegisterRoutes(clientMux, "/app-api/mcp")

	adminRec := httptest.NewRecorder()
	adminMux.ServeHTTP(adminRec, httptest.NewRequest(http.MethodGet, "/api/mcp/tools", nil))
	clientRec := httptest.NewRecorder()
	clientMux.ServeHTTP(clientRec, httptest.NewRequest(http.MethodGet, "/app-api/mcp/tools", nil))

	if adminRec.Code != http.StatusOK || clientRec.Code != http.StatusOK {
		t.Fatalf("expected 200 for both tool lists, admin=%d client=%d", adminRec.Code, clientRec.Code)
	}

	var adminResp struct {
		Tools []struct {
			Name        string         `json:"name"`
			InputSchema map[string]any `json:"inputSchema"`
		} `json:"tools"`
	}
	var clientResp struct {
		Tools []struct {
			Name        string         `json:"name"`
			InputSchema map[string]any `json:"inputSchema"`
		} `json:"tools"`
	}
	if err := json.Unmarshal(adminRec.Body.Bytes(), &adminResp); err != nil {
		t.Fatalf("admin tools: %v", err)
	}
	if err := json.Unmarshal(clientRec.Body.Bytes(), &clientResp); err != nil {
		t.Fatalf("client tools: %v", err)
	}

	adminProj := requiredContainsProjectID(t, adminResp.Tools, "get_project_info")
	clientProj := requiredContainsProjectID(t, clientResp.Tools, "get_project_info")
	if !adminProj {
		t.Fatalf("expected admin get_project_info to list projectId as required")
	}
	if clientProj {
		t.Fatalf("expected client get_project_info not to list projectId as required")
	}

	adminBulk := requiredContainsProjectID(t, adminResp.Tools, "bulk_create_app_users")
	clientBulk := requiredContainsProjectID(t, clientResp.Tools, "bulk_create_app_users")
	if !adminBulk {
		t.Fatalf("expected admin bulk_create_app_users to list projectId as required")
	}
	if clientBulk {
		t.Fatalf("expected client bulk_create_app_users not to list projectId as required")
	}

	// Multi-field tool: projectId dropped, other required fields preserved
	clientBatch := requiredFieldNamesFromSchema(findToolSchema(t, clientResp.Tools, "execute_batch_operations"))
	hasOperations := false
	hasProj := false
	for _, f := range clientBatch {
		if f == "operations" {
			hasOperations = true
		}
		if f == "projectId" {
			hasProj = true
		}
	}
	if !hasOperations {
		t.Fatalf("expected client execute_batch_operations to still require operations, got %v", clientBatch)
	}
	if hasProj {
		t.Fatalf("expected client execute_batch_operations not to require projectId, got %v", clientBatch)
	}
}

func requiredContainsProjectID(t *testing.T, tools []struct {
	Name        string         `json:"name"`
	InputSchema map[string]any `json:"inputSchema"`
}, toolName string,
) bool {
	t.Helper()
	for _, tool := range tools {
		if tool.Name != toolName {
			continue
		}
		for _, f := range requiredFieldNamesFromSchema(tool.InputSchema) {
			if f == "projectId" {
				return true
			}
		}
		return false
	}
	t.Fatalf("tool %q not found in list", toolName)
	return false
}

func findToolSchema(t *testing.T, tools []struct {
	Name        string         `json:"name"`
	InputSchema map[string]any `json:"inputSchema"`
}, toolName string,
) map[string]any {
	t.Helper()
	for _, tool := range tools {
		if tool.Name == toolName {
			return tool.InputSchema
		}
	}
	t.Fatalf("tool %q not found", toolName)
	return nil
}

func requiredFieldNamesFromSchema(schema map[string]any) []string {
	raw, ok := schema["required"]
	if !ok || raw == nil {
		return nil
	}
	return requiredFieldNames(raw)
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
