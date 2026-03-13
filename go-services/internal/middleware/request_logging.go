package middleware

import (
	"bufio"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/realtime"
	"github.com/skaftin/go-services/internal/requestlogs"
)

const (
	requestLogCacheTTL     = time.Minute
	requestLogQueueSize    = 512
	requestLogPayloadLimit = 10_000
)

type requestLogService interface {
	IsLoggingEnabled(ctx context.Context, projectID int) (bool, error)
	CreateLog(ctx context.Context, input requestlogs.CreateLogInput) (int, error)
}

type requestLogEventBroadcaster interface {
	BroadcastProjectEvent(event realtime.ProjectEvent)
}

type cachedRequestLogSetting struct {
	enabled   bool
	timestamp time.Time
}

// RequestLogger writes request logs for app-facing routes without blocking
// request execution.
type RequestLogger struct {
	service requestLogService

	queue       chan requestlogs.CreateLogInput
	done        chan struct{}
	broadcaster requestLogEventBroadcaster

	cache        map[int]cachedRequestLogSetting
	cacheMu      sync.RWMutex
	refreshing   map[int]struct{}
	refreshingMu sync.Mutex
}

// NewRequestLogger constructs request logging middleware backed by DB settings.
func NewRequestLogger(pool *pgxpool.Pool) *RequestLogger {
	svc := requestlogs.NewService(pool)
	return newRequestLoggerWithService(svc, requestLogQueueSize)
}

func newRequestLoggerWithService(svc requestLogService, queueSize int) *RequestLogger {
	if queueSize <= 0 {
		queueSize = requestLogQueueSize
	}
	rl := &RequestLogger{
		service:    svc,
		queue:      make(chan requestlogs.CreateLogInput, queueSize),
		done:       make(chan struct{}),
		cache:      make(map[int]cachedRequestLogSetting),
		refreshing: make(map[int]struct{}),
	}
	go rl.worker()
	return rl
}

// Close stops the background worker.
func (rl *RequestLogger) Close() {
	close(rl.done)
}

// SetRealtimeBroadcaster attaches an optional project-event broadcaster for
// realtime log notifications.
func (rl *RequestLogger) SetRealtimeBroadcaster(b requestLogEventBroadcaster) {
	rl.broadcaster = b
}

func (rl *RequestLogger) emitRequestLogCreated(entry requestlogs.CreateLogInput, logID int) {
	if rl.broadcaster == nil {
		return
	}

	payload := map[string]any{
		"logId":      logID,
		"method":     entry.Method,
		"url":        entry.URL,
		"statusCode": entry.StatusCode,
		"createdAt":  time.Now().UTC().Format(time.RFC3339Nano),
	}

	rl.broadcaster.BroadcastProjectEvent(realtime.ProjectEvent{
		Type:      "request_log_created",
		ProjectID: strconv.Itoa(entry.ProjectID),
		Data:      payload,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (rl *RequestLogger) worker() {
	for {
		select {
		case <-rl.done:
			return
		case entry := <-rl.queue:
			// Logging should never impact serving requests.
			logID, err := rl.service.CreateLog(context.Background(), entry)
			if err != nil {
				slog.Warn("request log insert failed", "error", err, "path", entry.URL)
				continue
			}
			rl.emitRequestLogCreated(entry, logID)
		}
	}
}

func shouldLogPath(path string) bool {
	if strings.HasPrefix(path, "/app-api/") || strings.HasPrefix(path, "/app-api-2/") {
		return !strings.Contains(path, "/request-logs")
	}
	return false
}

func (rl *RequestLogger) refreshLoggingSettingAsync(projectID int) {
	rl.refreshingMu.Lock()
	if _, exists := rl.refreshing[projectID]; exists {
		rl.refreshingMu.Unlock()
		return
	}
	rl.refreshing[projectID] = struct{}{}
	rl.refreshingMu.Unlock()

	go func() {
		defer func() {
			rl.refreshingMu.Lock()
			delete(rl.refreshing, projectID)
			rl.refreshingMu.Unlock()
		}()

		enabled, err := rl.service.IsLoggingEnabled(context.Background(), projectID)
		if err != nil {
			slog.Warn("failed to refresh request logging settings", "projectId", projectID, "error", err)
			return
		}

		rl.cacheMu.Lock()
		rl.cache[projectID] = cachedRequestLogSetting{
			enabled:   enabled,
			timestamp: time.Now(),
		}
		rl.cacheMu.Unlock()
	}()
}

func (rl *RequestLogger) loggingEnabled(projectID int) bool {
	now := time.Now()

	rl.cacheMu.RLock()
	cached, ok := rl.cache[projectID]
	rl.cacheMu.RUnlock()
	if ok && now.Sub(cached.timestamp) < requestLogCacheTTL {
		return cached.enabled
	}

	// Never block request handling on settings I/O.
	rl.refreshLoggingSettingAsync(projectID)
	if ok {
		return cached.enabled
	}
	return false
}

func parseUserID(r *http.Request) *int {
	if user := auth.GetUserContext(r); user != nil {
		if id, err := strconv.Atoi(user.UserID); err == nil && id > 0 {
			return &id
		}
	}
	return nil
}

func sanitizeJSONPayload(raw []byte) json.RawMessage {
	if len(raw) == 0 {
		return nil
	}

	if len(raw) > requestLogPayloadLimit {
		truncated := map[string]any{
			"_truncated":     true,
			"_original_size": len(raw),
			"_preview":       string(raw[:requestLogPayloadLimit]),
		}
		b, _ := json.Marshal(truncated)
		return b
	}

	var asJSON any
	if err := json.Unmarshal(raw, &asJSON); err == nil {
		return raw
	}

	wrapped := map[string]any{"_raw": string(raw)}
	b, _ := json.Marshal(wrapped)
	return b
}

func enqueueNonBlocking(queue chan requestlogs.CreateLogInput, entry requestlogs.CreateLogInput) {
	select {
	case queue <- entry:
	default:
		slog.Warn("dropping request log: queue full", "path", entry.URL)
	}
}

// Middleware records app-api request logs asynchronously when enabled.
func (rl *RequestLogger) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !shouldLogPath(r.URL.Path) {
			next.ServeHTTP(w, r)
			return
		}

		authCtx := auth.GetAuthContext(r)
		if authCtx == nil || authCtx.ProjectID <= 0 {
			next.ServeHTTP(w, r)
			return
		}
		projectID := authCtx.ProjectID

		if !rl.loggingEnabled(projectID) {
			next.ServeHTTP(w, r)
			return
		}

		start := time.Now()
		bodyCapture := newBodyCapture(r.Body, requestLogPayloadLimit)
		if r.Body != nil {
			r.Body = bodyCapture
		}
		wrapped := newResponseCaptureWriter(w, requestLogPayloadLimit)

		next.ServeHTTP(wrapped, r)

		duration := int(time.Since(start).Milliseconds())
		statusCode := wrapped.statusCode
		if statusCode == 0 {
			statusCode = http.StatusOK
		}

		method := r.Method
		urlPath := r.URL.Path
		userID := parseUserID(r)
		ipAddress := stringPtr(r.RemoteAddr)
		userAgent := stringPtr(r.UserAgent())
		requestPayloadRaw := append([]byte(nil), bodyCapture.Bytes()...)
		responsePayloadRaw := append([]byte(nil), wrapped.Bytes()...)

		go func() {
			var errMsg *string
			if statusCode >= 400 {
				msg := "request failed"
				if s := extractErrorMessage(responsePayloadRaw); s != "" {
					msg = s
				}
				errMsg = &msg
			}

			entry := requestlogs.CreateLogInput{
				ProjectID:      projectID,
				Method:         method,
				URL:            urlPath,
				StatusCode:     &statusCode,
				RequestPayload: sanitizeJSONPayload(requestPayloadRaw),
				ResponseData:   sanitizeJSONPayload(responsePayloadRaw),
				ErrorMessage:   errMsg,
				DurationMs:     &duration,
				UserID:         userID,
				IPAddress:      ipAddress,
				UserAgent:      userAgent,
			}
			enqueueNonBlocking(rl.queue, entry)
		}()
	})
}

func stringPtr(s string) *string {
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &s
}

type bodyCapture struct {
	rc    io.ReadCloser
	limit int
	buf   []byte
}

func newBodyCapture(rc io.ReadCloser, limit int) *bodyCapture {
	return &bodyCapture{rc: rc, limit: limit}
}

func (b *bodyCapture) Read(p []byte) (int, error) {
	if b.rc == nil {
		return 0, io.EOF
	}
	n, err := b.rc.Read(p)
	if n > 0 && len(b.buf) < b.limit {
		remaining := b.limit - len(b.buf)
		if n < remaining {
			remaining = n
		}
		b.buf = append(b.buf, p[:remaining]...)
	}
	return n, err
}

func (b *bodyCapture) Close() error {
	if b.rc == nil {
		return nil
	}
	return b.rc.Close()
}

func (b *bodyCapture) Bytes() []byte {
	return b.buf
}

type responseCaptureWriter struct {
	http.ResponseWriter
	statusCode int
	limit      int
	body       []byte
}

func newResponseCaptureWriter(w http.ResponseWriter, limit int) *responseCaptureWriter {
	return &responseCaptureWriter{ResponseWriter: w, limit: limit}
}

func (rw *responseCaptureWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseCaptureWriter) Write(p []byte) (int, error) {
	if rw.statusCode == 0 {
		rw.statusCode = http.StatusOK
	}
	if len(rw.body) < rw.limit {
		remaining := rw.limit - len(rw.body)
		if len(p) < remaining {
			remaining = len(p)
		}
		rw.body = append(rw.body, p[:remaining]...)
	}
	return rw.ResponseWriter.Write(p)
}

func (rw *responseCaptureWriter) Bytes() []byte {
	return rw.body
}

func extractErrorMessage(raw []byte) string {
	if len(raw) == 0 {
		return ""
	}
	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return ""
	}
	if msg, ok := parsed["message"].(string); ok && msg != "" {
		return msg
	}
	if msg, ok := parsed["error"].(string); ok && msg != "" {
		return msg
	}
	return ""
}

func (rw *responseCaptureWriter) Flush() {
	if fl, ok := rw.ResponseWriter.(http.Flusher); ok {
		fl.Flush()
	}
}

func (rw *responseCaptureWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hj, ok := rw.ResponseWriter.(http.Hijacker); ok {
		return hj.Hijack()
	}
	return nil, nil, http.ErrNotSupported
}
