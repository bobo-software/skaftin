package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/model"
	"github.com/skaftin/go-services/internal/requestlogs"
)

type stubRequestLogService struct {
	mu sync.Mutex

	enabled bool
	blockCh chan struct{}
	calls   []requestlogs.CreateLogInput
}

func (s *stubRequestLogService) IsLoggingEnabled(_ context.Context, _ int) (bool, error) {
	return s.enabled, nil
}

func (s *stubRequestLogService) CreateLog(_ context.Context, input requestlogs.CreateLogInput) (int, error) {
	if s.blockCh != nil {
		<-s.blockCh
	}
	s.mu.Lock()
	s.calls = append(s.calls, input)
	s.mu.Unlock()
	return 1, nil
}

func (s *stubRequestLogService) callCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.calls)
}

func (s *stubRequestLogService) lastCall() requestlogs.CreateLogInput {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.calls[len(s.calls)-1]
}

func withAuthContext(req *http.Request, projectID int) *http.Request {
	ctx := context.WithValue(req.Context(), auth.AuthContextKey, &model.AuthContext{
		ProjectID: projectID,
	})
	return req.WithContext(ctx)
}

func TestRequestLoggerLogsEnabledRoute(t *testing.T) {
	svc := &stubRequestLogService{enabled: true}
	rl := newRequestLoggerWithService(svc, 8)
	t.Cleanup(rl.Close)

	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{"ok": true})
	})

	body := []byte(`{"hello":"world"}`)
	req := httptest.NewRequest(http.MethodPost, "/app-api/database/tables/create", bytes.NewReader(body))
	req = withAuthContext(req, 42)
	rec := httptest.NewRecorder()

	rl.Middleware(next).ServeHTTP(rec, req)

	deadline := time.Now().Add(300 * time.Millisecond)
	for time.Now().Before(deadline) {
		if svc.callCount() > 0 {
			break
		}
		time.Sleep(5 * time.Millisecond)
	}
	if svc.callCount() == 0 {
		t.Fatalf("expected a request log entry to be written")
	}

	entry := svc.lastCall()
	if entry.ProjectID != 42 {
		t.Fatalf("expected project id 42, got %d", entry.ProjectID)
	}
	if entry.Method != http.MethodPost {
		t.Fatalf("expected method POST, got %s", entry.Method)
	}
	if entry.StatusCode == nil || *entry.StatusCode != http.StatusCreated {
		t.Fatalf("expected status %d, got %#v", http.StatusCreated, entry.StatusCode)
	}
	if len(entry.RequestPayload) == 0 {
		t.Fatalf("expected request payload to be captured")
	}
}

func TestRequestLoggerSkipsWhenDisabled(t *testing.T) {
	svc := &stubRequestLogService{enabled: false}
	rl := newRequestLoggerWithService(svc, 8)
	t.Cleanup(rl.Close)

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"ok"}`))
	})

	req := httptest.NewRequest(http.MethodGet, "/app-api/storage/buckets", nil)
	req = withAuthContext(req, 99)
	rec := httptest.NewRecorder()

	rl.Middleware(next).ServeHTTP(rec, req)
	time.Sleep(50 * time.Millisecond)

	if svc.callCount() != 0 {
		t.Fatalf("expected zero log writes when logging is disabled, got %d", svc.callCount())
	}
}

func TestRequestLoggerQueueFullDoesNotBlockRequest(t *testing.T) {
	block := make(chan struct{})
	svc := &stubRequestLogService{enabled: true, blockCh: block}
	rl := newRequestLoggerWithService(svc, 1)
	t.Cleanup(func() {
		close(block)
		rl.Close()
	})

	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"message":"ok"}`))
	})
	handler := rl.Middleware(next)

	first := withAuthContext(httptest.NewRequest(http.MethodGet, "/app-api/database/tables", nil), 1)
	handler.ServeHTTP(httptest.NewRecorder(), first)

	second := withAuthContext(httptest.NewRequest(http.MethodGet, "/app-api/database/tables", nil), 1)
	handler.ServeHTTP(httptest.NewRecorder(), second)

	third := withAuthContext(httptest.NewRequest(http.MethodGet, "/app-api/database/tables", nil), 1)
	start := time.Now()
	handler.ServeHTTP(httptest.NewRecorder(), third)
	elapsed := time.Since(start)

	if elapsed > 100*time.Millisecond {
		t.Fatalf("expected non-blocking request handling with full queue, took %s", elapsed)
	}
}
