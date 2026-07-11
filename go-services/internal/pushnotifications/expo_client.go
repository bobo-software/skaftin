package pushnotifications

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	expoPushURL      = "https://exp.host/--/api/v2/push/send"
	expoMaxBatchSize = 100
)

// ExpoMessage is a single Expo push payload.
type ExpoMessage struct {
	To    string         `json:"to"`
	Title string         `json:"title,omitempty"`
	Body  string         `json:"body,omitempty"`
	Data  map[string]any `json:"data,omitempty"`
	Sound string         `json:"sound,omitempty"`
}

// ExpoTicket is one ticket from Expo's send response.
type ExpoTicket struct {
	Status  string `json:"status"`
	ID      string `json:"id,omitempty"`
	Message string `json:"message,omitempty"`
	Details *struct {
		Error string `json:"error,omitempty"`
	} `json:"details,omitempty"`
}

// ExpoClient sends push messages via the Expo Push API.
type ExpoClient struct {
	httpClient *http.Client
	baseURL    string
}

// NewExpoClient creates an Expo client with a reasonable timeout.
func NewExpoClient() *ExpoClient {
	return &ExpoClient{
		httpClient: &http.Client{Timeout: 15 * time.Second},
		baseURL:    expoPushURL,
	}
}

// Send pushes one or more messages and returns tickets in the same order.
// Messages are chunked to expoMaxBatchSize per HTTP request (Expo limit).
func (c *ExpoClient) Send(ctx context.Context, messages []ExpoMessage) ([]ExpoTicket, error) {
	if len(messages) == 0 {
		return nil, nil
	}
	out := make([]ExpoTicket, 0, len(messages))
	for start := 0; start < len(messages); start += expoMaxBatchSize {
		end := start + expoMaxBatchSize
		if end > len(messages) {
			end = len(messages)
		}
		tickets, err := c.sendChunk(ctx, messages[start:end])
		if err != nil {
			return nil, err
		}
		out = append(out, tickets...)
	}
	return out, nil
}

func (c *ExpoClient) sendChunk(ctx context.Context, messages []ExpoMessage) ([]ExpoTicket, error) {
	body, err := json.Marshal(messages)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("expo push api status %d: %s", resp.StatusCode, string(raw))
	}

	var parsed struct {
		Data []ExpoTicket `json:"data"`
	}
	if err := json.Unmarshal(raw, &parsed); err != nil {
		// Expo sometimes returns a single ticket object instead of an array.
		var single struct {
			Data ExpoTicket `json:"data"`
		}
		if err2 := json.Unmarshal(raw, &single); err2 != nil {
			return nil, fmt.Errorf("decode expo response: %w (body=%s)", err, string(raw))
		}
		return []ExpoTicket{single.Data}, nil
	}
	return parsed.Data, nil
}

func ticketDeviceNotRegistered(t ExpoTicket) bool {
	if t.Status != "error" {
		return false
	}
	if t.Details != nil && t.Details.Error == "DeviceNotRegistered" {
		return true
	}
	return false
}
