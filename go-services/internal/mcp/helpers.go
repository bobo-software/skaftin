package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"

	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
)

type endpointContextKey string

const clientEndpointContextKey endpointContextKey = "mcpClientEndpoint"

func textResult(v any) (*sdkmcp.CallToolResult, error) {
	b, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal result: %w", err)
	}
	return &sdkmcp.CallToolResult{
		Content: []sdkmcp.Content{
			&sdkmcp.TextContent{Text: string(b)},
		},
	}, nil
}

func errorResult(msg string) (*sdkmcp.CallToolResult, error) {
	payload := map[string]string{"error": msg}
	b, _ := json.MarshalIndent(payload, "", "  ")
	return &sdkmcp.CallToolResult{
		Content: []sdkmcp.Content{
			&sdkmcp.TextContent{Text: string(b)},
		},
		IsError: true,
	}, nil
}

// parseArgs unmarshals the raw JSON arguments from a CallToolRequest into a map.
func parseArgs(req *sdkmcp.CallToolRequest) (map[string]any, error) {
	if req.Params.Arguments == nil {
		return map[string]any{}, nil
	}
	var args map[string]any
	if err := json.Unmarshal(req.Params.Arguments, &args); err != nil {
		return nil, fmt.Errorf("unmarshal arguments: %w", err)
	}
	return args, nil
}

func parseProjectID(raw any) (int, error) {
	switch v := raw.(type) {
	case float64:
		return int(v), nil
	case int:
		return v, nil
	case string:
		n, err := strconv.Atoi(v)
		if err != nil {
			return 0, fmt.Errorf("invalid project ID %q", v)
		}
		return n, nil
	case json.Number:
		n, err := v.Int64()
		if err != nil {
			return 0, fmt.Errorf("invalid project ID %q", v)
		}
		return int(n), nil
	case nil:
		return 0, fmt.Errorf("projectId is required")
	default:
		return 0, fmt.Errorf("invalid project ID type: %T", raw)
	}
}

// resolveProjectID determines the effective project ID for a request.
// For client endpoint calls, the authenticated token project is authoritative.
// If projectId is supplied in args for client calls, it must match the token project.
// For admin endpoint calls, projectId must be provided in args.
func resolveProjectID(ctx context.Context, args map[string]any, clientEndpoint bool) (int, error) {
	if !clientEndpoint {
		return parseProjectID(args["projectId"])
	}

	authCtx, ok := ctx.Value(auth.AuthContextKey).(*model.AuthContext)
	if !ok || authCtx == nil {
		return 0, fmt.Errorf("authentication context not found for client MCP request")
	}

	tokenProjectID := authCtx.ProjectID
	if rawProjectID, exists := args["projectId"]; exists {
		requestProjectID, err := parseProjectID(rawProjectID)
		if err != nil {
			return 0, err
		}
		if requestProjectID != tokenProjectID {
			return 0, fmt.Errorf("projectId mismatch: request projectId %d does not match token projectId %d", requestProjectID, tokenProjectID)
		}
	}

	return tokenProjectID, nil
}

// projectIDFromArgs resolves project ID using the same rules as resolveProjectID,
// based on whether the request is on the client MCP endpoint (token-scoped).
func projectIDFromArgs(ctx context.Context, args map[string]any) (int, error) {
	return resolveProjectID(ctx, args, isClientEndpointContext(ctx))
}

func withClientEndpointContext(ctx context.Context, clientEndpoint bool) context.Context {
	return context.WithValue(ctx, clientEndpointContextKey, clientEndpoint)
}

func isClientEndpointContext(ctx context.Context) bool {
	if v, ok := ctx.Value(clientEndpointContextKey).(bool); ok {
		return v
	}
	return false
}

func getString(args map[string]any, key string) string {
	if v, ok := args[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getInt(args map[string]any, key string, defaultVal int) int {
	v, ok := args[key]
	if !ok {
		return defaultVal
	}
	switch n := v.(type) {
	case float64:
		return int(n)
	case int:
		return n
	case string:
		if i, err := strconv.Atoi(n); err == nil {
			return i
		}
	case json.Number:
		if i, err := n.Int64(); err == nil {
			return int(i)
		}
	}
	return defaultVal
}

func getBool(args map[string]any, key string, defaultVal bool) bool {
	v, ok := args[key]
	if !ok {
		return defaultVal
	}
	if b, ok := v.(bool); ok {
		return b
	}
	return defaultVal
}

func getStringSlice(args map[string]any, key string) []string {
	v, ok := args[key]
	if !ok {
		return nil
	}
	if arr, ok := v.([]any); ok {
		out := make([]string, 0, len(arr))
		for _, item := range arr {
			if s, ok := item.(string); ok {
				out = append(out, s)
			}
		}
		return out
	}
	return nil
}

func getMap(args map[string]any, key string) map[string]any {
	v, ok := args[key]
	if !ok {
		return nil
	}
	if m, ok := v.(map[string]any); ok {
		return m
	}
	return nil
}

func getMapSlice(args map[string]any, key string) []map[string]any {
	v, ok := args[key]
	if !ok {
		return nil
	}
	if arr, ok := v.([]any); ok {
		out := make([]map[string]any, 0, len(arr))
		for _, item := range arr {
			if m, ok := item.(map[string]any); ok {
				out = append(out, m)
			}
		}
		return out
	}
	return nil
}
