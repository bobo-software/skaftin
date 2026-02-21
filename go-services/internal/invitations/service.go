package invitations

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/communications"
)

type Service struct {
	store       *Store
	comms       *communications.Service
	frontendURL string
}

func NewService(pool *pgxpool.Pool, comms *communications.Service, frontendURL string) *Service {
	return &Service{
		store:       NewStore(pool),
		comms:       comms,
		frontendURL: strings.TrimRight(frontendURL, "/"),
	}
}

func generateInviteCode() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Service) GetInvitationByCode(ctx context.Context, code string) (*Invitation, int, error) {
	inv, err := s.store.GetByCode(ctx, code)
	if err != nil {
		return nil, 500, fmt.Errorf("failed to get invitation: %w", err)
	}
	if inv == nil {
		return nil, 404, errors.New("Invitation not found")
	}

	if time.Now().After(inv.ExpiresAt) {
		_ = s.store.MarkExpired(ctx, inv.ID)
		return nil, 410, errors.New("Invitation has expired")
	}

	if inv.Status == "accepted" {
		return nil, 409, errors.New("Invitation has already been accepted")
	}

	return inv, 0, nil
}

func (s *Service) ListInvitations(ctx context.Context, projectID int, status string) ([]Invitation, error) {
	list, err := s.store.ListByProject(ctx, projectID, status)
	if err != nil {
		return nil, fmt.Errorf("failed to list invitations: %w", err)
	}
	if list == nil {
		list = []Invitation{}
	}
	return list, nil
}

func (s *Service) CreateInvitation(ctx context.Context, projectID int, email, role, invitedBy string, emailProviderID int) (*Invitation, string, error) {
	if email == "" {
		return nil, "", errors.New("Email is required")
	}
	if role == "" {
		role = "member"
	}

	existing, err := s.store.FindPendingByEmail(ctx, projectID, email)
	if err != nil {
		return nil, "", fmt.Errorf("failed to check existing invitation: %w", err)
	}
	if existing != nil {
		return nil, "", errors.New("Invitation already exists for this email")
	}

	if err := s.store.CleanupNonPending(ctx, projectID, email); err != nil {
		slog.Warn("failed to cleanup old invitations", "error", err)
	}

	isMember, err := s.store.IsMemberByEmail(ctx, projectID, email)
	if err != nil {
		return nil, "", fmt.Errorf("failed to check membership: %w", err)
	}
	if isMember {
		return nil, "", errors.New("User is already a member of this project")
	}

	projectName, err := s.store.GetProjectName(ctx, projectID)
	if err != nil {
		return nil, "", fmt.Errorf("failed to get project: %w", err)
	}
	if projectName == "" {
		return nil, "", errors.New("Project not found")
	}

	code, err := generateInviteCode()
	if err != nil {
		return nil, "", fmt.Errorf("failed to generate invite code: %w", err)
	}

	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	inv, err := s.store.Create(ctx, projectID, email, code, role, invitedBy, expiresAt)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create invitation: %w", err)
	}

	inviteLink := fmt.Sprintf("%s/invite/%s", s.frontendURL, code)

	if emailProviderID > 0 && s.comms != nil {
		s.sendInvitationEmail(ctx, projectID, emailProviderID, email, projectName, code)
	}

	return inv, inviteLink, nil
}

func (s *Service) sendInvitationEmail(ctx context.Context, projectID, providerID int, recipientEmail, projectName, inviteCode string) {
	inviteLink := fmt.Sprintf("%s/invite/%s", s.frontendURL, inviteCode)

	subject := fmt.Sprintf("You've been invited to join %s", projectName)

	text := fmt.Sprintf(
		"You've been invited to join %s!\n\nInvite Code: %s\n\nClick this link to accept: %s\n\nThis invitation expires in 7 days.",
		projectName, inviteCode, inviteLink,
	)

	html := fmt.Sprintf(`<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #4F46E5;">You've been invited!</h1>
  <p>You've been invited to join the project <strong>%s</strong> on Skaftin Platform.</p>
  <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
    <p style="margin: 0;"><strong>Invite Code:</strong></p>
    <p style="font-size: 24px; font-weight: bold; color: #4F46E5; margin: 10px 0;">%s</p>
  </div>
  <p>Click the button below to accept the invitation:</p>
  <a href="%s" style="display: inline-block; background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0;">Accept Invitation</a>
  <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
    This invitation will expire in 7 days.<br/>
    If you didn't expect this invitation, you can safely ignore this email.
  </p>
  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 20px 0;">
  <p style="color: #6B7280; font-size: 12px;">Skaftin Platform - Project Collaboration Made Easy</p>
</div>`, projectName, inviteCode, inviteLink)

	_, err := s.comms.SendEmail(ctx, projectID, providerID, []string{recipientEmail}, nil, nil, subject, text, html, nil)
	if err != nil {
		slog.Error("failed to send invitation email", "error", err, "email", recipientEmail)
	}
}

func (s *Service) AcceptInvitation(ctx context.Context, code, userID string) (*Member, int, error) {
	if userID == "" {
		return nil, 401, errors.New("User not authenticated")
	}

	inv, err := s.store.GetByCode(ctx, code)
	if err != nil {
		return nil, 500, fmt.Errorf("failed to get invitation: %w", err)
	}
	if inv == nil {
		return nil, 404, errors.New("Invitation not found")
	}

	if time.Now().After(inv.ExpiresAt) {
		_ = s.store.MarkExpired(ctx, inv.ID)
		return nil, 410, errors.New("Invitation has expired")
	}

	if inv.Status == "accepted" {
		return nil, 409, errors.New("Invitation has already been accepted")
	}

	userEmail, err := s.store.GetUserEmail(ctx, userID)
	if err != nil {
		return nil, 500, fmt.Errorf("failed to get user email: %w", err)
	}
	if userEmail != "" && !strings.EqualFold(userEmail, inv.Email) {
		return nil, 403, errors.New("This invitation is for a different email address")
	}

	already, err := s.store.IsMember(ctx, inv.ProjectID, userID)
	if err != nil {
		return nil, 500, fmt.Errorf("failed to check membership: %w", err)
	}
	if already {
		return nil, 409, errors.New("You are already a member of this project")
	}

	member, err := s.store.InsertMember(ctx, inv.ProjectID, userID, inv.Role, inv.InvitedBy)
	if err != nil {
		return nil, 500, fmt.Errorf("failed to add member: %w", err)
	}

	if err := s.store.AddOrgMember(ctx, inv.ProjectID, userID); err != nil {
		slog.Warn("failed to add user to organization", "error", err)
	}

	if err := s.store.Delete(ctx, inv.ID); err != nil {
		slog.Warn("failed to delete accepted invitation", "error", err)
	}

	return member, 0, nil
}

func (s *Service) RevokeInvitation(ctx context.Context, id, projectID int) (bool, error) {
	revoked, err := s.store.Revoke(ctx, id, projectID)
	if err != nil {
		return false, fmt.Errorf("failed to revoke invitation: %w", err)
	}
	return revoked, nil
}

func (s *Service) ListMembers(ctx context.Context, projectID int) ([]Member, error) {
	list, err := s.store.ListMembers(ctx, projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to list members: %w", err)
	}
	if list == nil {
		list = []Member{}
	}
	return list, nil
}

func (s *Service) RemoveMember(ctx context.Context, id, projectID int) (bool, error) {
	removed, err := s.store.RemoveMember(ctx, id, projectID)
	if err != nil {
		return false, fmt.Errorf("failed to remove member: %w", err)
	}
	return removed, nil
}
