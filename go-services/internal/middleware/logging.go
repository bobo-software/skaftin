package middleware

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"
)

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

// Hijack implements http.Hijacker, required for WebSocket upgrades.
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hj, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return hj.Hijack()
	}
	return nil, nil, fmt.Errorf("underlying ResponseWriter does not support hijacking")
}

// Flush implements http.Flusher, required for streaming/SSE responses.
func (rw *responseWriter) Flush() {
	if fl, ok := rw.ResponseWriter.(http.Flusher); ok {
		fl.Flush()
	}
}

// Logging returns middleware that logs each incoming request with its
// method, path, status code, and duration.
func Logging(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &responseWriter{ResponseWriter: w, statusCode: http.StatusOK}

		next.ServeHTTP(wrapped, r)

		routeLabel, routeEmoji := classifyRoute(r.URL.Path)
		fmt.Printf("%s request method=%s path=%s route_type=%s status=%d duration=%s ip=%s\n",
			routeEmoji,
			r.Method,
			r.URL.Path,
			routeLabel,
			wrapped.statusCode,
			time.Since(start).String(),
			r.RemoteAddr,
		)
	})
}

func classifyRoute(path string) (string, string) {
	switch {
	case strings.HasPrefix(path, "/app-api/"):
		return "app-api", "🟣"
	case strings.HasPrefix(path, "/app-api-2/"):
		return "app-api-2", "🟪"
	case strings.HasPrefix(path, "/api/"):
		return "api", "🔵"
	default:
		return "other", "⚪"
	}
}
