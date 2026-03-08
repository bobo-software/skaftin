package mcp

import (
	"encoding/json"
	"fmt"
	"net/http"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

type HTTPHandler struct {
	server         *Server
	clientEndpoint bool
	serverInfoName string
}

func NewHTTPHandler(server *Server, clientEndpoint bool) *HTTPHandler {
	name := "skaftin-mcp-server"
	if clientEndpoint {
		name = "skaftin-client-mcp-server"
	}
	return &HTTPHandler{
		server:         server,
		clientEndpoint: clientEndpoint,
		serverInfoName: name,
	}
}

func (h *HTTPHandler) RegisterRoutes(mux *http.ServeMux, base string) {
	mux.HandleFunc("GET "+base+"/tools", h.listTools)
	mux.HandleFunc("POST "+base+"/call", h.callTool)
	mux.HandleFunc("POST "+base+"/protocol", h.protocol)
}

func (h *HTTPHandler) listTools(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"tools": h.server.ListTools(h.clientEndpoint),
	})
}

func (h *HTTPHandler) callTool(w http.ResponseWriter, r *http.Request) {
	ctx := withClientEndpointContext(r.Context(), h.clientEndpoint)
	var req struct {
		Name      string         `json:"name"`
		Arguments map[string]any `json:"arguments"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"status":  "error",
			"message": "Invalid JSON request body",
			"data":    nil,
		})
		return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{
			"status":  "error",
			"message": "Tool name is required",
			"data":    nil,
		})
		return
	}

	if req.Arguments == nil {
		req.Arguments = map[string]any{}
	}
	if h.clientEndpoint {
		if pid, err := resolveProjectID(ctx, req.Arguments, true); err == nil {
			// Ensure tools receive a concrete projectId even when omitted by client callers.
			req.Arguments["projectId"] = fmt.Sprintf("%d", pid)
		} else {
			writeJSON(w, http.StatusForbidden, map[string]any{
				"status":  "error",
				"message": err.Error(),
				"data":    nil,
			})
			return
		}
	}

	result, err := h.server.CallTool(ctx, req.Name, req.Arguments, h.clientEndpoint)
	if err != nil {
		status := http.StatusInternalServerError
		if h.clientEndpoint {
			status = http.StatusForbidden
		}
		writeJSON(w, status, map[string]any{
			"status":  "error",
			"message": err.Error(),
			"data":    nil,
		})
		return
	}

	response := transformResultToHTTP(result)
	httpStatus := http.StatusOK
	if response["status"] == "error" {
		httpStatus = http.StatusInternalServerError
	}
	writeJSON(w, httpStatus, response)
}

func (h *HTTPHandler) protocol(w http.ResponseWriter, r *http.Request) {
	ctx := withClientEndpointContext(r.Context(), h.clientEndpoint)
	var req struct {
		JSONRPC string         `json:"jsonrpc"`
		ID      any            `json:"id"`
		Method  string         `json:"method"`
		Params  map[string]any `json:"params"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusOK, jsonRPCError(nil, -32600, "Invalid Request: malformed JSON", nil))
		return
	}
	if req.JSONRPC != "2.0" {
		writeJSON(w, http.StatusOK, jsonRPCError(req.ID, -32600, "Invalid Request: jsonrpc must be \"2.0\"", nil))
		return
	}

	switch req.Method {
	case "initialize":
		writeJSON(w, http.StatusOK, map[string]any{
			"jsonrpc": "2.0",
			"result": map[string]any{
				"protocolVersion": "2024-11-05",
				"capabilities": map[string]any{
					"tools": map[string]any{},
				},
				"serverInfo": map[string]any{
					"name":    h.serverInfoName,
					"version": "1.0.0",
				},
			},
			"id": req.ID,
		})
	case "tools/list":
		writeJSON(w, http.StatusOK, map[string]any{
			"jsonrpc": "2.0",
			"result": map[string]any{
				"tools": h.server.ListTools(h.clientEndpoint),
			},
			"id": req.ID,
		})
	case "tools/call":
		name, _ := req.Params["name"].(string)
		if name == "" {
			writeJSON(w, http.StatusOK, jsonRPCError(req.ID, -32602, "Invalid params: missing tool name", nil))
			return
		}
		args, _ := req.Params["arguments"].(map[string]any)
		if args == nil {
			args = map[string]any{}
		}
		if h.clientEndpoint {
			if pid, err := resolveProjectID(ctx, args, true); err == nil {
				// Keep downstream tool handlers compatible by always setting projectId.
				args["projectId"] = fmt.Sprintf("%d", pid)
			} else {
				writeJSON(w, http.StatusOK, jsonRPCError(req.ID, -32602, "Invalid params: "+err.Error(), nil))
				return
			}
		}

		result, err := h.server.CallTool(ctx, name, args, h.clientEndpoint)
		if err != nil {
			writeJSON(w, http.StatusOK, jsonRPCError(req.ID, -32000, err.Error(), nil))
			return
		}

		httpResp := transformResultToHTTP(result)
		if httpResp["status"] == "error" {
			writeJSON(w, http.StatusOK, jsonRPCError(req.ID, -32000, fmt.Sprint(httpResp["message"]), httpResp["data"]))
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{
			"jsonrpc": "2.0",
			"result": map[string]any{
				"content": []map[string]any{
					{
						"type": "text",
						"text": stringifyForJSONRPC(httpResp["data"]),
					},
				},
			},
			"id": req.ID,
		})
	default:
		writeJSON(w, http.StatusOK, jsonRPCError(req.ID, -32601, "Method not found: "+req.Method, nil))
	}
}

func transformResultToHTTP(result *sdkmcp.CallToolResult) map[string]any {
	resp := map[string]any{
		"status":  "success",
		"message": "Operation completed successfully",
		"data":    nil,
	}
	if result == nil {
		resp["status"] = "error"
		resp["message"] = "Tool execution failed"
		return resp
	}

	text := firstContentText(result)
	if result.IsError {
		resp["status"] = "error"
		resp["message"] = "Tool execution failed"
		if text != "" {
			var parsed map[string]any
			if err := json.Unmarshal([]byte(text), &parsed); err == nil {
				if msg, ok := parsed["error"].(string); ok && msg != "" {
					resp["message"] = msg
				} else if msg, ok := parsed["message"].(string); ok && msg != "" {
					resp["message"] = msg
				}
				resp["data"] = parsed
			} else {
				resp["message"] = text
			}
		}
		return resp
	}

	if text == "" {
		return resp
	}

	var parsed any
	if err := json.Unmarshal([]byte(text), &parsed); err != nil {
		resp["message"] = "Operation completed"
		resp["data"] = text
		return resp
	}

	resp["data"] = parsed
	if dataMap, ok := parsed.(map[string]any); ok {
		if msg, hasMsg := dataMap["message"].(string); hasMsg && msg != "" {
			resp["message"] = msg
			delete(dataMap, "message")
		}
		if errMsg, hasErr := dataMap["error"].(string); hasErr && errMsg != "" {
			resp["status"] = "error"
			resp["message"] = errMsg
			resp["data"] = dataMap
			return resp
		}
		if len(dataMap) == 1 {
			for _, v := range dataMap {
				switch v.(type) {
				case []any, map[string]any:
					resp["data"] = v
				}
			}
		}
	}
	return resp
}

func firstContentText(result *sdkmcp.CallToolResult) string {
	if result == nil || len(result.Content) == 0 || result.Content[0] == nil {
		return ""
	}
	if text, ok := result.Content[0].(*sdkmcp.TextContent); ok {
		return text.Text
	}

	b, err := json.Marshal(result.Content[0])
	if err != nil {
		return ""
	}

	var payload map[string]any
	if err := json.Unmarshal(b, &payload); err != nil {
		return ""
	}
	if text, ok := payload["text"].(string); ok {
		return text
	}
	return ""
}

func jsonRPCError(id any, code int, message string, data any) map[string]any {
	errPayload := map[string]any{
		"code":    code,
		"message": message,
	}
	if data != nil {
		errPayload["data"] = data
	}
	return map[string]any{
		"jsonrpc": "2.0",
		"error":   errPayload,
		"id":      id,
	}
}

func stringifyForJSONRPC(v any) string {
	if s, ok := v.(string); ok {
		return s
	}
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return "{}"
	}
	return string(b)
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}
