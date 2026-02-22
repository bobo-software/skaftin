package users

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/supertokens"
)

type Service struct {
	store *Store
	st    *supertokens.Client
}

func NewService(pool *pgxpool.Pool, st *supertokens.Client) *Service {
	return &Service{
		store: NewStore(pool),
		st:    st,
	}
}

type CurrentUser struct {
	ID         string    `json:"id"`
	Email      string    `json:"email"`
	ProjectIDs []float64 `json:"projectIds"`
	Role       string    `json:"role"`
}

func (svc *Service) GetCurrentUser(ctx context.Context, userID string, projectIDs []float64, role string) (*CurrentUser, error) {
	coreUser, err := svc.st.GetUserByID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("fetch user from supertokens: %w", err)
	}

	var email string
	if len(coreUser.Emails) > 0 {
		email = coreUser.Emails[0]
	}

	return &CurrentUser{
		ID:         userID,
		Email:      email,
		ProjectIDs: projectIDs,
		Role:       role,
	}, nil
}

func (svc *Service) ListAll(ctx context.Context) ([]User, error) {
	users, err := svc.store.ListAll(ctx)
	if err != nil {
		return nil, err
	}
	if users == nil {
		users = []User{}
	}
	return users, nil
}

func (svc *Service) Create(ctx context.Context, username, email string, fullName, lastName *string) (*User, error) {
	if strings.TrimSpace(username) == "" || strings.TrimSpace(email) == "" {
		return nil, fmt.Errorf("validation")
	}
	return svc.store.Create(ctx, username, email, fullName, lastName)
}

type ProfileUpdate struct {
	Name  *string `json:"name"`
	Email *string `json:"email"`
}

func (svc *Service) UpdateProfile(ctx context.Context, userID, currentEmail string, update ProfileUpdate) (*User, error) {
	dbUser, err := svc.store.GetByEmail(ctx, currentEmail)
	if err != nil {
		return nil, fmt.Errorf("db error: %w", err)
	}
	if dbUser == nil {
		return nil, fmt.Errorf("not found")
	}

	fields := map[string]any{}

	if update.Email != nil && *update.Email != currentEmail {
		resp, err := svc.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
			RecipeUserID: userID,
			Email:        *update.Email,
		})
		if err != nil {
			return nil, fmt.Errorf("supertokens email update: %w", err)
		}
		if resp.Status != "OK" {
			return nil, fmt.Errorf("supertokens email update failed: %s", resp.Status)
		}
		fields["email"] = *update.Email
	}

	if update.Name != nil {
		fields["full_name"] = *update.Name
	}

	return svc.store.Update(ctx, dbUser.ID, fields)
}

func (svc *Service) ChangePassword(ctx context.Context, userID, email, currentPassword, newPassword string) error {
	if currentPassword == "" || newPassword == "" {
		return fmt.Errorf("validation: passwords required")
	}
	if len(newPassword) < 8 {
		return fmt.Errorf("validation: password too short")
	}
	if currentPassword == newPassword {
		return fmt.Errorf("validation: same password")
	}

	signInResp, err := svc.st.SignIn(ctx, "public", email, currentPassword)
	if err != nil || signInResp.Status != "OK" {
		return fmt.Errorf("wrong password")
	}

	resp, err := svc.st.UpdateEmailOrPassword(ctx, supertokens.UpdatePasswordRequest{
		RecipeUserID: userID,
		Password:     newPassword,
	})
	if err != nil {
		return fmt.Errorf("supertokens password update: %w", err)
	}
	if resp.Status != "OK" {
		return fmt.Errorf("supertokens password update failed: %s", resp.Status)
	}

	return nil
}

func (svc *Service) DeleteAccount(ctx context.Context, userID string) error {
	if err := svc.store.DeleteOrgMemberships(ctx, userID); err != nil {
		return fmt.Errorf("delete org memberships: %w", err)
	}

	if err := svc.store.DeleteProjectMemberships(ctx, userID); err != nil {
		return fmt.Errorf("delete project memberships: %w", err)
	}

	if _, err := svc.st.RevokeAllSessionsForUser(ctx, userID); err != nil {
		return fmt.Errorf("revoke sessions: %w", err)
	}

	if err := svc.st.DeleteUser(ctx, userID); err != nil {
		return fmt.Errorf("delete supertokens user: %w", err)
	}

	return nil
}
