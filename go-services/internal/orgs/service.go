package orgs

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

var validRoles = map[string]bool{
	"admin": true, "dev": true, "member": true, "viewer": true,
}

// Service contains business logic for organization operations.
type Service struct {
	store *Store
}

// NewService creates a new orgs Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}

// --- Organization CRUD ---

func (svc *Service) ListUserOrgs(ctx context.Context, userID string) ([]OrgWithRole, error) {
	return svc.store.ListUserOrgs(ctx, userID)
}

// OrgDetail holds the full organization detail returned by GetOrgByID.
type OrgDetail struct {
	Organization
	Members      []Member `json:"members"`
	MemberCount  int      `json:"memberCount"`
	ProjectCount int      `json:"projectCount"`
	UserRole     string   `json:"userRole"`
	IsOwner      bool     `json:"isOwner"`
}

func (svc *Service) GetOrgDetail(ctx context.Context, orgID int, userID string) (*OrgDetail, error) {
	membership, err := svc.store.GetMembership(ctx, orgID, userID)
	if err != nil {
		return nil, err
	}
	if membership == nil {
		return nil, fmt.Errorf("forbidden")
	}

	org, err := svc.store.GetOrgByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("not found")
	}

	members, err := svc.store.ListMembers(ctx, orgID)
	if err != nil {
		return nil, err
	}
	if members == nil {
		members = []Member{}
	}

	projectCount, err := svc.store.GetProjectCount(ctx, orgID)
	if err != nil {
		projectCount = 0
	}

	return &OrgDetail{
		Organization: *org,
		Members:      members,
		MemberCount:  len(members),
		ProjectCount: projectCount,
		UserRole:     membership.Role,
		IsOwner:      org.OwnerID == userID,
	}, nil
}

func (svc *Service) CreateOrg(ctx context.Context, name, description, userID string) (*Organization, error) {
	trimmedName := strings.TrimSpace(name)
	if trimmedName == "" {
		return nil, fmt.Errorf("Organization name is required")
	}

	var descPtr *string
	if d := strings.TrimSpace(description); d != "" {
		descPtr = &d
	}

	org, err := svc.store.CreateOrg(ctx, trimmedName, descPtr, userID)
	if err != nil {
		return nil, err
	}

	if _, err := svc.store.AddMember(ctx, org.ID, userID, "admin"); err != nil {
		return nil, fmt.Errorf("failed to add creator as admin: %w", err)
	}

	return org, nil
}

func (svc *Service) UpdateOrg(ctx context.Context, orgID int, userID string, name *string, description *string, descExplicit bool) (*Organization, error) {
	membership, err := svc.store.GetMembership(ctx, orgID, userID)
	if err != nil || membership == nil {
		return nil, fmt.Errorf("forbidden")
	}

	org, err := svc.store.GetOrgByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("not found")
	}

	if membership.Role != "admin" && org.OwnerID != userID {
		return nil, fmt.Errorf("permission denied")
	}

	var trimmedName *string
	if name != nil {
		n := strings.TrimSpace(*name)
		if n != "" {
			trimmedName = &n
		}
	}

	clearDesc := false
	var trimmedDesc *string
	if descExplicit {
		if description == nil || strings.TrimSpace(*description) == "" {
			clearDesc = true
		} else {
			d := strings.TrimSpace(*description)
			trimmedDesc = &d
		}
	}

	return svc.store.UpdateOrg(ctx, orgID, trimmedName, trimmedDesc, clearDesc)
}

func (svc *Service) DeleteOrg(ctx context.Context, orgID int, userID string) error {
	org, err := svc.store.GetOrgByID(ctx, orgID)
	if err != nil {
		return fmt.Errorf("not found")
	}
	if org.OwnerID != userID {
		return fmt.Errorf("only owner")
	}
	return svc.store.DeleteOrg(ctx, orgID)
}

// --- Member management ---

func (svc *Service) ListMembers(ctx context.Context, orgID int, userID string) ([]Member, error) {
	membership, err := svc.store.GetMembership(ctx, orgID, userID)
	if err != nil || membership == nil {
		return nil, fmt.Errorf("forbidden")
	}
	return svc.store.ListMembers(ctx, orgID)
}

// isAdminOrOwner checks if the user is an admin member or the org owner.
func (svc *Service) isAdminOrOwner(ctx context.Context, orgID int, userID string) error {
	membership, err := svc.store.GetMembership(ctx, orgID, userID)
	if err != nil || membership == nil {
		return fmt.Errorf("forbidden")
	}
	if membership.Role == "admin" {
		return nil
	}
	org, err := svc.store.GetOrgByID(ctx, orgID)
	if err != nil || org.OwnerID != userID {
		return fmt.Errorf("only admins and owners")
	}
	return nil
}

func (svc *Service) AddMemberByUserID(ctx context.Context, orgID int, requesterID, targetUserID, role string) (*Member, error) {
	if !validRoles[role] {
		return nil, fmt.Errorf("invalid role")
	}
	if err := svc.isAdminOrOwner(ctx, orgID, requesterID); err != nil {
		return nil, err
	}

	existing, err := svc.store.GetMembership(ctx, orgID, targetUserID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, fmt.Errorf("already member")
	}

	return svc.store.AddMember(ctx, orgID, targetUserID, role)
}

func (svc *Service) UpdateMemberRole(ctx context.Context, orgID, memberID int, requesterID, role string) (*Member, error) {
	if !validRoles[role] {
		return nil, fmt.Errorf("invalid role")
	}
	if err := svc.isAdminOrOwner(ctx, orgID, requesterID); err != nil {
		return nil, err
	}

	org, err := svc.store.GetOrgByID(ctx, orgID)
	if err != nil {
		return nil, fmt.Errorf("not found")
	}

	target, err := svc.store.GetMemberByID(ctx, memberID)
	if err != nil || target == nil {
		return nil, fmt.Errorf("member not found")
	}

	if target.UserID == org.OwnerID {
		return nil, fmt.Errorf("cannot change owner role")
	}

	return svc.store.UpdateMemberRole(ctx, memberID, role)
}

func (svc *Service) RemoveMember(ctx context.Context, orgID, memberID int, requesterID string) error {
	membership, err := svc.store.GetMembership(ctx, orgID, requesterID)
	if err != nil || membership == nil {
		return fmt.Errorf("forbidden")
	}

	org, err := svc.store.GetOrgByID(ctx, orgID)
	if err != nil {
		return fmt.Errorf("not found")
	}

	target, err := svc.store.GetMemberByID(ctx, memberID)
	if err != nil || target == nil {
		return fmt.Errorf("member not found")
	}

	if target.UserID == org.OwnerID {
		return fmt.Errorf("cannot remove owner")
	}

	// Only admin, owner, or self can remove
	if membership.Role != "admin" && org.OwnerID != requesterID && target.UserID != requesterID {
		return fmt.Errorf("permission denied")
	}

	return svc.store.RemoveMember(ctx, memberID)
}
