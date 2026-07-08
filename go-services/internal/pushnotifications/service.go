package pushnotifications

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrPushPaused is returned when project push is turned off.
	ErrPushPaused = errors.New("push notifications are paused for this project")
	// ErrInvalidToken is returned for malformed Expo tokens.
	ErrInvalidToken = errors.New("invalid expo push token")
	// ErrNoTokens is returned when a test send finds no devices.
	ErrNoTokens = errors.New("no registered push tokens for the requested target")
)

// Service contains push notification business logic.
type Service struct {
	store *Store
	expo  *ExpoClient
}

// NewService creates a push notifications Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{
		store: NewStore(pool),
		expo:  NewExpoClient(),
	}
}

// GetSettings ensures the project token table and returns pause/enable settings.
func (s *Service) GetSettings(ctx context.Context, projectID int) (*PushSettings, error) {
	if _, err := s.store.ProjectSchema(ctx, projectID); err != nil {
		return nil, err
	}
	return s.store.GetOrCreateSettings(ctx, projectID)
}

// UpdateSettings sets is_active without deleting tokens.
func (s *Service) UpdateSettings(ctx context.Context, projectID int, isActive bool) (*PushSettings, error) {
	if _, err := s.store.ProjectSchema(ctx, projectID); err != nil {
		return nil, err
	}
	return s.store.UpdateSettings(ctx, projectID, isActive)
}

// ListTokens returns dashboard token rows with previews.
func (s *Service) ListTokens(ctx context.Context, projectID int) ([]DeviceTokenListItem, error) {
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	tokens, err := s.store.ListTokens(ctx, schema)
	if err != nil {
		return nil, err
	}
	out := make([]DeviceTokenListItem, 0, len(tokens))
	for _, t := range tokens {
		item := toListItem(t)
		// Prefer truncated preview in list JSON; keep full token for ops but UI should show preview.
		item.ExpoPushToken = item.TokenPreview
		out = append(out, item)
	}
	return out, nil
}

// RegisterToken upserts a device token when push is active.
func (s *Service) RegisterToken(ctx context.Context, projectID int, req RegisterTokenRequest) (*DeviceToken, error) {
	settings, err := s.GetSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !settings.IsActive {
		return nil, ErrPushPaused
	}

	platform, err := normalizePlatform(req.Platform)
	if err != nil {
		return nil, err
	}
	token := strings.TrimSpace(req.ExpoPushToken)
	if !isValidExpoToken(token) {
		return nil, ErrInvalidToken
	}
	if req.UserID <= 0 {
		return nil, fmt.Errorf("user_id is required")
	}

	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}
	return s.store.UpsertToken(ctx, schema, req.UserID, platform, token, req.DeviceName)
}

// UnregisterToken removes a token by value (logout); allowed even when paused.
func (s *Service) UnregisterToken(ctx context.Context, projectID int, expoToken string) (bool, error) {
	token := strings.TrimSpace(expoToken)
	if token == "" {
		return false, fmt.Errorf("expo_push_token is required")
	}
	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return false, err
	}
	return s.store.DeleteTokenByValue(ctx, schema, token)
}

// TestSend sends a test notification to a token and/or all tokens for a user.
func (s *Service) TestSend(ctx context.Context, projectID int, req TestPushRequest) (map[string]any, error) {
	settings, err := s.GetSettings(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if !settings.IsActive {
		return nil, ErrPushPaused
	}
	if req.UserID == nil && req.TokenID == nil {
		return nil, fmt.Errorf("user_id or token_id is required")
	}

	title := strings.TrimSpace(req.Title)
	body := strings.TrimSpace(req.Body)
	if title == "" {
		title = "Test notification"
	}
	if body == "" {
		body = "This is a test push from Skaftin Communications."
	}

	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	var targets []DeviceToken
	if req.TokenID != nil {
		t, err := s.store.GetTokenByID(ctx, schema, *req.TokenID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return nil, ErrNoTokens
			}
			return nil, err
		}
		targets = append(targets, *t)
	} else if req.UserID != nil {
		targets, err = s.store.ListTokensForUser(ctx, schema, *req.UserID)
		if err != nil {
			return nil, err
		}
	}
	if len(targets) == 0 {
		return nil, ErrNoTokens
	}

	messages := make([]ExpoMessage, 0, len(targets))
	for _, t := range targets {
		messages = append(messages, ExpoMessage{
			To:    t.ExpoPushToken,
			Title: title,
			Body:  body,
			Sound: "default",
			Data:  map[string]any{"type": "test"},
		})
	}

	tickets, err := s.expo.Send(ctx, messages)
	if err != nil {
		return nil, err
	}

	sent := 0
	errorsOut := make([]map[string]any, 0)
	for i, ticket := range tickets {
		if i >= len(targets) {
			break
		}
		tok := targets[i]
		if ticketDeviceNotRegistered(ticket) {
			_ = s.store.DeleteTokenByID(ctx, schema, tok.ID)
			errorsOut = append(errorsOut, map[string]any{
				"token_id": tok.ID,
				"error":    "DeviceNotRegistered",
			})
			continue
		}
		if ticket.Status == "ok" {
			sent++
			continue
		}
		msg := ticket.Message
		if ticket.Details != nil && ticket.Details.Error != "" {
			msg = ticket.Details.Error
		}
		errorsOut = append(errorsOut, map[string]any{
			"token_id": tok.ID,
			"error":    msg,
		})
	}

	return map[string]any{
		"sent":     sent,
		"targeted": len(targets),
		"errors":   errorsOut,
		"tickets":  tickets,
	}, nil
}
