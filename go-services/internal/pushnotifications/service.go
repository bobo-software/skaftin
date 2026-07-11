package pushnotifications

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const maxSendRecipients = 100

var (
	// ErrPushPaused is returned when project push is turned off.
	ErrPushPaused = errors.New("push notifications are paused for this project")
	// ErrInvalidToken is returned for malformed Expo tokens.
	ErrInvalidToken = errors.New("invalid expo push token")
	// ErrNoTokens is returned when a send finds no devices for any target.
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
	if err := s.requireActive(ctx, projectID); err != nil {
		return nil, err
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

	result, err := s.dispatch(ctx, schema, targets, title, body, map[string]any{"type": "test"}, "default")
	if err != nil {
		return nil, err
	}
	// Preserve dashboard TestSend response keys.
	return map[string]any{
		"sent":     result.Sent,
		"targeted": result.TargetedTokens,
		"errors":   result.Errors,
		"tickets":  result.Tickets,
	}, nil
}

// Send fans out the same title/body/data to all tokens for the given user IDs.
func (s *Service) Send(ctx context.Context, projectID int, req SendPushRequest) (*SendResult, error) {
	if err := s.requireActive(ctx, projectID); err != nil {
		return nil, err
	}
	userIDs, err := validateUserIDs(req.UserIDs)
	if err != nil {
		return nil, err
	}
	title, body, sound, err := validateTitleBodySound(req.Title, req.Body, req.Sound)
	if err != nil {
		return nil, err
	}

	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	var (
		targets         []DeviceToken
		skippedNoTokens []int
	)
	for _, uid := range userIDs {
		toks, err := s.store.ListTokensForUser(ctx, schema, uid)
		if err != nil {
			return nil, err
		}
		if len(toks) == 0 {
			skippedNoTokens = append(skippedNoTokens, uid)
			continue
		}
		targets = append(targets, toks...)
	}
	if len(targets) == 0 {
		return nil, ErrNoTokens
	}

	result, err := s.dispatch(ctx, schema, targets, title, body, req.Data, sound)
	if err != nil {
		return nil, err
	}
	result.TargetedUsers = len(userIDs)
	result.SkippedNoTokens = skippedNoTokens
	return result, nil
}

// SendBatch sends per-recipient notifications (different title/body/data per user).
func (s *Service) SendBatch(ctx context.Context, projectID int, req BatchPushRequest) (*SendResult, error) {
	if err := s.requireActive(ctx, projectID); err != nil {
		return nil, err
	}
	if len(req.Notifications) == 0 {
		return nil, fmt.Errorf("notifications is required")
	}
	if len(req.Notifications) > maxSendRecipients {
		return nil, fmt.Errorf("notifications must contain at most %d items", maxSendRecipients)
	}

	schema, err := s.store.ProjectSchema(ctx, projectID)
	if err != nil {
		return nil, err
	}

	var (
		targets         []DeviceToken
		messages        []ExpoMessage
		skippedNoTokens []int
		seenUsers       = map[int]struct{}{}
	)
	for i, item := range req.Notifications {
		if item.UserID <= 0 {
			return nil, fmt.Errorf("notifications[%d]: user_id is required", i)
		}
		title, body, sound, err := validateTitleBodySound(item.Title, item.Body, item.Sound)
		if err != nil {
			return nil, fmt.Errorf("notifications[%d]: %w", i, err)
		}
		seenUsers[item.UserID] = struct{}{}
		toks, err := s.store.ListTokensForUser(ctx, schema, item.UserID)
		if err != nil {
			return nil, err
		}
		if len(toks) == 0 {
			skippedNoTokens = append(skippedNoTokens, item.UserID)
			continue
		}
		for _, t := range toks {
			targets = append(targets, t)
			messages = append(messages, ExpoMessage{
				To:    t.ExpoPushToken,
				Title: title,
				Body:  body,
				Data:  item.Data,
				Sound: sound,
			})
		}
	}
	if len(targets) == 0 {
		return nil, ErrNoTokens
	}

	result, err := s.dispatchMessages(ctx, schema, targets, messages)
	if err != nil {
		return nil, err
	}
	result.TargetedUsers = len(seenUsers)
	result.SkippedNoTokens = uniqueInts(skippedNoTokens)
	return result, nil
}

func (s *Service) requireActive(ctx context.Context, projectID int) error {
	settings, err := s.GetSettings(ctx, projectID)
	if err != nil {
		return err
	}
	if !settings.IsActive {
		return ErrPushPaused
	}
	return nil
}

func (s *Service) dispatch(ctx context.Context, schema string, targets []DeviceToken, title, body string, data map[string]any, sound string) (*SendResult, error) {
	messages := make([]ExpoMessage, 0, len(targets))
	for _, t := range targets {
		messages = append(messages, ExpoMessage{
			To:    t.ExpoPushToken,
			Title: title,
			Body:  body,
			Data:  data,
			Sound: sound,
		})
	}
	return s.dispatchMessages(ctx, schema, targets, messages)
}

func (s *Service) dispatchMessages(ctx context.Context, schema string, targets []DeviceToken, messages []ExpoMessage) (*SendResult, error) {
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
				"user_id":  tok.UserID,
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
			"user_id":  tok.UserID,
			"error":    msg,
		})
	}

	return &SendResult{
		TargetedTokens: len(targets),
		Sent:           sent,
		Errors:         errorsOut,
		Tickets:        tickets,
	}, nil
}

func validateUserIDs(ids []int) ([]int, error) {
	if len(ids) == 0 {
		return nil, fmt.Errorf("user_ids is required")
	}
	if len(ids) > maxSendRecipients {
		return nil, fmt.Errorf("user_ids must contain at most %d ids", maxSendRecipients)
	}
	out := make([]int, 0, len(ids))
	seen := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, fmt.Errorf("user_ids must contain positive integers")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out, nil
}

func validateTitleBodySound(title, body, sound string) (string, string, string, error) {
	title = strings.TrimSpace(title)
	body = strings.TrimSpace(body)
	if title == "" {
		return "", "", "", fmt.Errorf("title is required")
	}
	if body == "" {
		return "", "", "", fmt.Errorf("body is required")
	}
	sound = strings.TrimSpace(sound)
	if sound == "" {
		sound = "default"
	}
	return title, body, sound, nil
}

func uniqueInts(ids []int) []int {
	if len(ids) == 0 {
		return nil
	}
	seen := make(map[int]struct{}, len(ids))
	out := make([]int, 0, len(ids))
	for _, id := range ids {
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}
