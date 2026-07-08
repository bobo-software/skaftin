package supertokens

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestUpdateEmailOrPasswordUsesUserIDForCDI214(t *testing.T) {
	t.Parallel()

	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut || r.URL.Path != "/recipe/user" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if err := json.Unmarshal(raw, &gotBody); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"OK"}`))
	}))
	t.Cleanup(server.Close)

	client := NewClient(server.URL, "")
	resp, err := client.UpdateEmailOrPassword(context.Background(), UpdatePasswordRequest{
		RecipeUserID: "user-123",
		Password:     "new-password",
	})
	if err != nil {
		t.Fatalf("UpdateEmailOrPassword: %v", err)
	}
	if resp.Status != "OK" {
		t.Fatalf("status = %q, want OK", resp.Status)
	}
	if gotBody["userId"] != "user-123" {
		t.Fatalf("userId = %#v, want user-123", gotBody["userId"])
	}
	if _, ok := gotBody["recipeUserId"]; ok {
		t.Fatalf("unexpected recipeUserId in request body: %#v", gotBody)
	}
}

func TestUpdateEmailOrPasswordFallsBackToRecipeUserID(t *testing.T) {
	t.Parallel()

	var calls []map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		var body map[string]any
		if err := json.Unmarshal(raw, &body); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		calls = append(calls, body)

		if _, ok := body["userId"]; ok {
			w.WriteHeader(http.StatusBadRequest)
			_, _ = w.Write([]byte("Field name 'userId' is invalid in JSON input"))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"OK"}`))
	}))
	t.Cleanup(server.Close)

	client := NewClient(server.URL, "")
	resp, err := client.UpdateEmailOrPassword(context.Background(), UpdatePasswordRequest{
		RecipeUserID: "user-123",
		Password:     "new-password",
		Email:        "user@example.com",
	})
	if err != nil {
		t.Fatalf("UpdateEmailOrPassword: %v", err)
	}
	if resp.Status != "OK" {
		t.Fatalf("status = %q, want OK", resp.Status)
	}
	if len(calls) != 2 {
		t.Fatalf("calls = %d, want 2", len(calls))
	}
	if calls[0]["userId"] != "user-123" {
		t.Fatalf("first call userId = %#v", calls[0]["userId"])
	}
	if calls[1]["recipeUserId"] != "user-123" {
		t.Fatalf("second call recipeUserId = %#v", calls[1]["recipeUserId"])
	}
	if calls[1]["email"] != "user@example.com" {
		t.Fatalf("second call email = %#v", calls[1]["email"])
	}
}

func TestIsUnknownUserIDFieldError(t *testing.T) {
	t.Parallel()

	cases := []struct {
		msg  string
		want bool
	}{
		{msg: "Field name 'userId' is invalid in JSON input", want: true},
		{msg: "Field name 'recipeUserId' is invalid in JSON input", want: true},
		{msg: "UNKNOWN_USER_ID_ERROR", want: false},
	}
	for _, tc := range cases {
		got := isUnknownUserIDFieldError(fmtError(tc.msg))
		if got != tc.want {
			t.Fatalf("%q: got %v, want %v", tc.msg, got, tc.want)
		}
	}
}

type fmtError string

func (e fmtError) Error() string { return string(e) }
