package credentials

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var validCredentialTypes = map[string]bool{
	"api_key":      true,
	"access_token": true,
	"mcp_key":      true,
}

// AvailablePermissions defines the permission groups that can be assigned.
var AvailablePermissions = map[string][]string{
	"database":       {"database:read", "database:write", "database:delete"},
	"storage":        {"storage:read", "storage:write", "storage:delete"},
	"communications": {"communications:send", "communications:manage"},
	"projects":       {"projects:read", "projects:write"},
	"invitations":    {"invitations:send", "invitations:manage"},
	"mcp":            {"mcp:full_access"},
}

// Service contains business logic for credential management.
type Service struct {
	store *Store
}

// NewService creates a new credentials Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}

func generateToken(prefix string, byteLen int) string {
	b := make([]byte, byteLen)
	if _, err := rand.Read(b); err != nil {
		panic("crypto/rand failed: " + err.Error())
	}
	return prefix + hex.EncodeToString(b)
}

func tokenForType(credType string) string {
	switch credType {
	case "api_key":
		return generateToken("sk_", 32)
	case "access_token":
		return generateToken("sat_", 40)
	case "mcp_key":
		return generateToken("mcp_", 32)
	default:
		return generateToken("sk_", 32)
	}
}

func (s *Service) ListCredentials(ctx context.Context, projectID int) ([]CredentialRecord, error) {
	creds, err := s.store.ListByProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	if creds == nil {
		creds = []CredentialRecord{}
	}
	return creds, nil
}

type CreateRequest struct {
	Name           string   `json:"name"`
	CredentialType string   `json:"credential_type"`
	Permissions    []string `json:"permissions"`
	ExpiresInDays  *int     `json:"expires_in_days"`
}

func (s *Service) CreateCredential(ctx context.Context, projectID int, createdBy string, req CreateRequest) (*CredentialRecord, error) {
	if req.Name == "" || req.CredentialType == "" {
		return nil, fmt.Errorf("name and credential_type are required")
	}
	if !validCredentialTypes[req.CredentialType] {
		return nil, fmt.Errorf("invalid credential_type, must be api_key, access_token, or mcp_key")
	}

	if req.CredentialType == "mcp_key" {
		count, err := s.store.CountByTypeAndProject(ctx, projectID, "mcp_key")
		if err != nil {
			return nil, err
		}
		if count > 0 {
			return nil, &ConflictError{Message: "An MCP key already exists for this project. Please regenerate it instead."}
		}
	}

	token := tokenForType(req.CredentialType)

	var expiresAt *time.Time
	if req.ExpiresInDays != nil && *req.ExpiresInDays > 0 {
		t := time.Now().AddDate(0, 0, *req.ExpiresInDays)
		expiresAt = &t
	}

	if req.Permissions == nil {
		req.Permissions = []string{}
	}

	return s.store.Create(ctx, projectID, req.Name, req.CredentialType, token, createdBy, req.Permissions, expiresAt)
}

type UpdateRequest struct {
	Name        *string  `json:"name"`
	Permissions []string `json:"permissions"`
	IsActive    *bool    `json:"is_active"`
}

func (s *Service) UpdateCredential(ctx context.Context, credentialID, projectID int, req UpdateRequest) (*CredentialRecord, error) {
	updates := make(map[string]any)
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Permissions != nil {
		updates["permissions"] = req.Permissions
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if len(updates) == 0 {
		return nil, fmt.Errorf("no fields to update")
	}

	cred, err := s.store.Update(ctx, credentialID, projectID, updates)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &NotFoundError{Message: "Credential not found"}
		}
		return nil, err
	}
	return cred, nil
}

func (s *Service) DeleteCredential(ctx context.Context, credentialID, projectID int) error {
	deleted, err := s.store.Delete(ctx, credentialID, projectID)
	if err != nil {
		return err
	}
	if !deleted {
		return &NotFoundError{Message: "Credential not found"}
	}
	return nil
}

func (s *Service) GetMcpKey(ctx context.Context, projectID int) (*CredentialRecord, error) {
	cred, err := s.store.GetMcpKey(ctx, projectID)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, &NotFoundError{Message: "No MCP key found for this project"}
		}
		return nil, err
	}
	return cred, nil
}

func (s *Service) RegenerateMcpKey(ctx context.Context, projectID int, createdBy string) (*CredentialRecord, bool, error) {
	newToken := tokenForType("mcp_key")

	cred, err := s.store.RegenerateMcpKey(ctx, projectID, newToken)
	if err == nil {
		return cred, false, nil
	}

	if err == pgx.ErrNoRows {
		cred, err = s.store.CreateMcpKey(ctx, projectID, newToken, createdBy)
		if err != nil {
			return nil, false, err
		}
		return cred, true, nil
	}

	return nil, false, err
}

// ConflictError signals a 409 Conflict response.
type ConflictError struct{ Message string }

func (e *ConflictError) Error() string { return e.Message }

// NotFoundError signals a 404 Not Found response.
type NotFoundError struct{ Message string }

func (e *NotFoundError) Error() string { return e.Message }
