package mcp

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
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
