package authmanagement

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"reflect"
	"testing"

	"github.com/skaftin/go-services/internal/pkg/bulkresult"
)

func TestNormalizePositiveUniqueIDs(t *testing.T) {
	tests := []struct {
		name string
		in   []int
		want []int
	}{
		{name: "empty", in: nil, want: []int{}},
		{name: "dedupe preserve order", in: []int{3, 1, 3, 2, 1}, want: []int{3, 1, 2}},
		{name: "drop non-positive", in: []int{0, -1, 5, 0, 5}, want: []int{5}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := normalizePositiveUniqueIDs(tc.in)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("normalizePositiveUniqueIDs(%v) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}

func TestMissingUserIDs(t *testing.T) {
	tests := []struct {
		name      string
		requested []int
		found     []int
		want      []int
	}{
		{name: "all found", requested: []int{1, 2}, found: []int{2, 1}, want: []int{}},
		{name: "some missing", requested: []int{1, 2, 3}, found: []int{1}, want: []int{2, 3}},
		{name: "none found", requested: []int{9, 8}, found: nil, want: []int{9, 8}},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := missingUserIDs(tc.requested, tc.found)
			if !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("missingUserIDs(%v, %v) = %v, want %v", tc.requested, tc.found, got, tc.want)
			}
		})
	}
}

func TestGetUsersByIDsHandler_Validation(t *testing.T) {
	h := &Handler{}

	t.Run("empty body", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/auth/3/users/by-ids", bytes.NewReader([]byte(`{}`)))
		req.SetPathValue("projectId", "3")
		rec := httptest.NewRecorder()
		h.GetUsersByIDsHandler(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
	})

	t.Run("missing role_id", func(t *testing.T) {
		body, _ := json.Marshal(map[string]any{"user_ids": []int{1, 2}})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/3/users/by-ids", bytes.NewReader(body))
		req.SetPathValue("projectId", "3")
		rec := httptest.NewRecorder()
		h.GetUsersByIDsHandler(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
	})

	t.Run("over limit", func(t *testing.T) {
		ids := make([]int, bulkresult.MaxBatchSize+1)
		for i := range ids {
			ids[i] = i + 1
		}
		body, _ := json.Marshal(map[string]any{"role_id": 1, "user_ids": ids})
		req := httptest.NewRequest(http.MethodPost, "/api/auth/3/users/by-ids", bytes.NewReader(body))
		req.SetPathValue("projectId", "3")
		rec := httptest.NewRecorder()
		h.GetUsersByIDsHandler(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rec.Code, http.StatusBadRequest)
		}
		var payload map[string]any
		if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		msg, _ := payload["message"].(string)
		want := fmt.Sprintf("Maximum batch size is %d", bulkresult.MaxBatchSize)
		if msg != want {
			t.Fatalf("message = %q, want %q", msg, want)
		}
	})
}
