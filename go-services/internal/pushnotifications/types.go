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
