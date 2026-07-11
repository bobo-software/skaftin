package pushnotifications

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestValidateUserIDs(t *testing.T) {
	t.Parallel()

	_, err := validateUserIDs(nil)
	if err == nil {
		t.Fatal("expected error for empty user_ids")
	}

	_, err = validateUserIDs([]int{})
	if err == nil {
		t.Fatal("expected error for empty slice")
	}

	_, err = validateUserIDs([]int{0, 1})
	if err == nil {
		t.Fatal("expected error for non-positive id")
	}

	tooMany := make([]int, maxSendRecipients+1)
	for i := range tooMany {
		tooMany[i] = i + 1
	}
	_, err = validateUserIDs(tooMany)
	if err == nil {
		t.Fatal("expected error for over-limit user_ids")
	}

	got, err := validateUserIDs([]int{3, 1, 3, 2})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 3 || got[0] != 3 || got[1] != 1 || got[2] != 2 {
		t.Fatalf("dedupe/order mismatch: %v", got)
	}
}

func TestValidateTitleBodySound(t *testing.T) {
	t.Parallel()

	_, _, _, err := validateTitleBodySound("", "body", "")
	if err == nil {
		t.Fatal("expected error for empty title")
	}
	_, _, _, err = validateTitleBodySound("title", "  ", "")
	if err == nil {
		t.Fatal("expected error for empty body")
	}

	title, body, sound, err := validateTitleBodySound("  Hello ", " World ", "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if title != "Hello" || body != "World" || sound != "default" {
		t.Fatalf("got title=%q body=%q sound=%q", title, body, sound)
	}

	_, _, sound, err = validateTitleBodySound("t", "b", "custom")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if sound != "custom" {
		t.Fatalf("sound=%q want custom", sound)
	}
}

func TestUniqueInts(t *testing.T) {
	t.Parallel()
	got := uniqueInts([]int{1, 2, 1, 3, 2})
	if len(got) != 3 || got[0] != 1 || got[1] != 2 || got[2] != 3 {
		t.Fatalf("uniqueInts=%v", got)
	}
	if uniqueInts(nil) != nil {
		t.Fatal("expected nil for empty")
	}
}

func TestExpoClientSendChunks(t *testing.T) {
	t.Parallel()

	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var msgs []ExpoMessage
		if err := json.NewDecoder(r.Body).Decode(&msgs); err != nil {
			t.Errorf("decode: %v", err)
			http.Error(w, err.Error(), 400)
			return
		}
		tickets := make([]ExpoTicket, len(msgs))
		for i, m := range msgs {
			tickets[i] = ExpoTicket{Status: "ok", ID: fmt.Sprintf("ticket-%s", m.To)}
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": tickets})
	}))
	t.Cleanup(srv.Close)

	client := &ExpoClient{
		httpClient: srv.Client(),
		baseURL:    srv.URL,
	}

	n := expoMaxBatchSize + 25
	messages := make([]ExpoMessage, n)
	for i := range messages {
		messages[i] = ExpoMessage{
			To:    fmt.Sprintf("ExponentPushToken[%d]", i),
			Title: "t",
			Body:  "b",
			Data:  map[string]any{"screen": "reminders", "i": i},
			Sound: "default",
		}
	}

	tickets, err := client.Send(context.Background(), messages)
	if err != nil {
		t.Fatalf("Send: %v", err)
	}
	if got := int(calls.Load()); got != 2 {
		t.Fatalf("expected 2 chunk HTTP calls, got %d", got)
	}
	if len(tickets) != n {
		t.Fatalf("tickets=%d want %d", len(tickets), n)
	}
	for i, ticket := range tickets {
		want := fmt.Sprintf("ticket-ExponentPushToken[%d]", i)
		if ticket.ID != want || ticket.Status != "ok" {
			t.Fatalf("ticket[%d]=%+v want id %s", i, ticket, want)
		}
	}
}

func TestExpoClientSendEmpty(t *testing.T) {
	t.Parallel()
	client := NewExpoClient()
	tickets, err := client.Send(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if tickets != nil {
		t.Fatalf("expected nil tickets, got %v", tickets)
	}
}

func TestDispatchMapsDeepLinkData(t *testing.T) {
	t.Parallel()

	var gotMsgs []ExpoMessage
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&gotMsgs); err != nil {
			t.Errorf("decode: %v", err)
			http.Error(w, err.Error(), 400)
			return
		}
		tickets := []ExpoTicket{{Status: "ok", ID: "1"}}
		_ = json.NewEncoder(w).Encode(map[string]any{"data": tickets})
	}))
	t.Cleanup(srv.Close)

	svc := &Service{
		store: nil,
		expo: &ExpoClient{
			httpClient: srv.Client(),
			baseURL:    srv.URL,
		},
	}

	targets := []DeviceToken{{
		ID:            9,
		UserID:        42,
		ExpoPushToken: "ExponentPushToken[abc]",
	}}
	data := map[string]any{"screen": "reminders", "vehicleId": 7}
	result, err := svc.dispatch(context.Background(), "unused", targets, "Title", "Body", data, "default")
	if err != nil {
		t.Fatalf("dispatch: %v", err)
	}
	if result.Sent != 1 || result.TargetedTokens != 1 {
		t.Fatalf("result=%+v", result)
	}
	if len(gotMsgs) != 1 {
		t.Fatalf("messages=%d", len(gotMsgs))
	}
	if gotMsgs[0].Data["screen"] != "reminders" {
		t.Fatalf("data=%v", gotMsgs[0].Data)
	}
	// JSON numbers decode as float64 on the mock server.
	if gotMsgs[0].Data["vehicleId"] != float64(7) {
		t.Fatalf("vehicleId=%v (%T)", gotMsgs[0].Data["vehicleId"], gotMsgs[0].Data["vehicleId"])
	}
}
