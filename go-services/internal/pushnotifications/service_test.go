package pushnotifications

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestExpoClientSendParsesTickets(t *testing.T) {
	t.Parallel()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Fatalf("method %s", r.Method)
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"data": []map[string]any{
				{"status": "ok", "id": "ticket-1"},
			},
		})
	}))
	defer srv.Close()

	client := &ExpoClient{
		httpClient: srv.Client(),
		baseURL:    srv.URL,
	}
	tickets, err := client.Send(context.Background(), []ExpoMessage{{
		To: "ExponentPushToken[abc]", Title: "Hi", Body: "Test",
	}})
	if err != nil {
		t.Fatal(err)
	}
	if len(tickets) != 1 || tickets[0].Status != "ok" || tickets[0].ID != "ticket-1" {
		t.Fatalf("unexpected tickets: %#v", tickets)
	}
}

func TestServiceErrorsExported(t *testing.T) {
	t.Parallel()
	if ErrPushPaused == nil || ErrInvalidToken == nil || ErrNoTokens == nil {
		t.Fatal("expected sentinel errors")
	}
}
