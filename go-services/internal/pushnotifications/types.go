package pushnotifications

import "time"

// PushSettings is the project-level pause/enable flag for Expo push.
type PushSettings struct {
	ID        int       `json:"id"`
	ProjectID int       `json:"project_id"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// DeviceToken is a registered Expo push token for a user device.
type DeviceToken struct {
	ID            int       `json:"id"`
	UserID        int       `json:"user_id"`
	Platform      string    `json:"platform"`
	ExpoPushToken string    `json:"expo_push_token"`
	DeviceName    *string   `json:"device_name,omitempty"`
	LastSeenAt    time.Time `json:"last_seen_at"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

// DeviceTokenListItem is a dashboard-safe view (token may be truncated).
type DeviceTokenListItem struct {
	ID             int       `json:"id"`
	UserID         int       `json:"user_id"`
	Platform       string    `json:"platform"`
	ExpoPushToken  string    `json:"expo_push_token"`
	TokenPreview   string    `json:"token_preview"`
	DeviceName     *string   `json:"device_name,omitempty"`
	LastSeenAt     time.Time `json:"last_seen_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// RegisterTokenRequest is the body for client token registration.
type RegisterTokenRequest struct {
	UserID        int     `json:"user_id"`
	Platform      string  `json:"platform"`
	ExpoPushToken string  `json:"expo_push_token"`
	DeviceName    *string `json:"device_name,omitempty"`
}

// UnregisterTokenRequest is the body for client token removal.
type UnregisterTokenRequest struct {
	ExpoPushToken string `json:"expo_push_token"`
}

// UpdateSettingsRequest is the body for pause/unpause.
type UpdateSettingsRequest struct {
	IsActive bool `json:"is_active"`
}

// TestPushRequest is the body for dashboard test sends.
type TestPushRequest struct {
	UserID  *int   `json:"user_id,omitempty"`
	TokenID *int   `json:"token_id,omitempty"`
	Title   string `json:"title"`
	Body    string `json:"body"`
}

// SendPushRequest is the body for App API same-payload fan-out sends.
type SendPushRequest struct {
	UserIDs []int          `json:"user_ids"`
	Title   string         `json:"title"`
	Body    string         `json:"body"`
	Data    map[string]any `json:"data,omitempty"`
	Sound   string         `json:"sound,omitempty"`
}

// BatchPushItem is one per-recipient notification in a batch send.
type BatchPushItem struct {
	UserID int            `json:"user_id"`
	Title  string         `json:"title"`
	Body   string         `json:"body"`
	Data   map[string]any `json:"data,omitempty"`
	Sound  string         `json:"sound,omitempty"`
}

// BatchPushRequest is the body for App API per-recipient batch sends.
type BatchPushRequest struct {
	Notifications []BatchPushItem `json:"notifications"`
}

// SendResult is the shared response for send, send-batch, and test sends.
type SendResult struct {
	TargetedUsers    int              `json:"targeted_users,omitempty"`
	TargetedTokens   int              `json:"targeted_tokens"`
	Sent             int              `json:"sent"`
	SkippedNoTokens  []int            `json:"skipped_no_tokens,omitempty"`
	Errors           []map[string]any `json:"errors"`
	Tickets          []ExpoTicket     `json:"tickets"`
	// Targeted is kept for dashboard TestSend backwards compatibility.
	Targeted int `json:"targeted,omitempty"`
}
