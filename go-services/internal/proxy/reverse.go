package proxy

import (
	"log/slog"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
)

// NewReverseProxy creates a reverse proxy that forwards requests to the
// Node.js backend. It passes through all headers, cookies, and the request
// body unchanged. It also handles WebSocket upgrade requests.
func NewReverseProxy(targetURL string) (*httputil.ReverseProxy, error) {
	target, err := url.Parse(targetURL)
	if err != nil {
		return nil, err
	}

	proxy := httputil.NewSingleHostReverseProxy(target)

	// Customize the Director to preserve the original request
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)

		// Preserve the original Host header (important for SuperTokens cookie domain)
		req.Host = req.Header.Get("X-Forwarded-Host")
		if req.Host == "" {
			req.Host = target.Host
		}

		// Set forwarding headers
		if clientIP := req.Header.Get("X-Real-IP"); clientIP == "" {
			if remoteAddr := req.RemoteAddr; remoteAddr != "" {
				ip := remoteAddr
				if idx := strings.LastIndex(ip, ":"); idx != -1 {
					ip = ip[:idx]
				}
				req.Header.Set("X-Real-IP", ip)
			}
		}

		if xff := req.Header.Get("X-Forwarded-For"); xff == "" {
			req.Header.Set("X-Forwarded-For", req.Header.Get("X-Real-IP"))
		}

		if proto := req.Header.Get("X-Forwarded-Proto"); proto == "" {
			req.Header.Set("X-Forwarded-Proto", "https")
		}
	}

	// Customize error handling
	proxy.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		slog.Error("proxy error",
			"error", err,
			"path", r.URL.Path,
			"method", r.Method,
		)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		w.Write([]byte(`{"success":false,"error":"Backend service unavailable"}`))
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		// Strip CORS headers from Node.js responses — Go's CORS middleware
		// handles these. Duplicate headers cause browsers to reject the response.
		resp.Header.Del("Access-Control-Allow-Origin")
		resp.Header.Del("Access-Control-Allow-Methods")
		resp.Header.Del("Access-Control-Allow-Headers")
		resp.Header.Del("Access-Control-Allow-Credentials")
		resp.Header.Del("Access-Control-Expose-Headers")
		resp.Header.Del("Access-Control-Max-Age")
		return nil
	}

	return proxy, nil
}

// WebSocketAwareHandler wraps the reverse proxy to handle both regular HTTP
// requests and WebSocket upgrade requests (used by Socket.IO).
func WebSocketAwareHandler(proxy *httputil.ReverseProxy, targetURL string) http.Handler {
	target, _ := url.Parse(targetURL)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check if this is a WebSocket upgrade request
		if isWebSocketUpgrade(r) {
			slog.Info("proxying WebSocket upgrade",
				"path", r.URL.Path,
			)
			// For WebSocket upgrades, use the standard reverse proxy which
			// supports HTTP hijacking for WebSocket connections
			r.URL.Host = target.Host
			r.URL.Scheme = target.Scheme
		}

		proxy.ServeHTTP(w, r)
	})
}

func isWebSocketUpgrade(r *http.Request) bool {
	return strings.EqualFold(r.Header.Get("Upgrade"), "websocket") ||
		strings.EqualFold(r.Header.Get("Connection"), "upgrade")
}
