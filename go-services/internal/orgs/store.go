package orgs

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles database queries for organizations and members.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new orgs Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// Organization represents a row from skaftin_system_organizations.
type Organization struct {
	ID          int        `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description"`
	OwnerID     string     `json:"owner_id"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at"`
}

// Member represents a row from skaftin_system_organization_members.
type Member struct {
	ID             int       `json:"id"`
	OrganizationID int       `json:"organization_id"`
	UserID         string    `json:"user_id"`
	Role           string    `json:"role"`
	CreatedAt      time.Time `json:"created_at"`
}

// OrgWithRole is an organization joined with the user's role in it.
type OrgWithRole struct {
	Organization
	Role         string `json:"role"`
	ProjectCount int    `json:"projectCount"`
	MemberCount  int    `json:"memberCount"`
	IsOwner      bool   `json:"isOwner"`
}

const orgColumns = `id, name, description, owner_id, created_at, updated_at`
const memberColumns = `id, organization_id, user_id, role, created_at`

func scanOrg(row pgx.Row) (*Organization, error) {
	var o Organization
	err := row.Scan(&o.ID, &o.Name, &o.Description, &o.OwnerID, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &o, nil
}

func scanMember(row pgx.Row) (*Member, error) {
	var m Member
	err := row.Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &m, nil
}

func scanMemberRows(rows pgx.Rows) ([]Member, error) {
	out := make([]Member, 0)
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.OrganizationID, &m.UserID, &m.Role, &m.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// --- Organization queries ---

// GetOrgByID fetches a single organization.
func (s *Store) GetOrgByID(ctx context.Context, id int) (*Organization, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+orgColumns+` FROM skaftin_system_organizations WHERE id = $1`, id)
	return scanOrg(row)
}

// CreateOrg inserts a new organization.
func (s *Store) CreateOrg(ctx context.Context, name string, description *string, ownerID string) (*Organization, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO skaftin_system_organizations (name, description, owner_id)
		 VALUES ($1, $2, $3) RETURNING `+orgColumns,
		name, description, ownerID)
	return scanOrg(row)
}

// UpdateOrg updates an organization's name/description.
func (s *Store) UpdateOrg(ctx context.Context, id int, name *string, description *string, clearDesc bool) (*Organization, error) {
	setClauses := "updated_at = NOW()"
	args := []any{}
	argIdx := 1

	if name != nil {
		setClauses += fmt.Sprintf(", name = $%d", argIdx)
		args = append(args, *name)
		argIdx++
	}
	if clearDesc {
		setClauses += fmt.Sprintf(", description = $%d", argIdx)
		args = append(args, nil)
		argIdx++
	} else if description != nil {
		setClauses += fmt.Sprintf(", description = $%d", argIdx)
		args = append(args, *description)
		argIdx++
	}

	args = append(args, id)
	query := fmt.Sprintf(
		`UPDATE skaftin_system_organizations SET %s WHERE id = $%d RETURNING %s`,
		setClauses, argIdx, orgColumns,
	)
	row := s.pool.QueryRow(ctx, query, args...)
	return scanOrg(row)
}

// DeleteOrg removes an organization.
func (s *Store) DeleteOrg(ctx context.Context, id int) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM skaftin_system_organizations WHERE id = $1`, id)
	return err
}

// ListUserOrgs returns orgs the user is a member of, with their role, project count, and member count.
func (s *Store) ListUserOrgs(ctx context.Context, userID string) ([]OrgWithRole, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT o.`+orgColumns+`, om.role,
			(SELECT COUNT(*)::int FROM skaftin_system_projects p WHERE p.organization_id = o.id) AS project_count,
			(SELECT COUNT(*)::int FROM skaftin_system_organization_members m WHERE m.organization_id = o.id) AS member_count
		FROM skaftin_system_organization_members om
		INNER JOIN skaftin_system_organizations o ON om.organization_id = o.id
		WHERE om.user_id = $1
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]OrgWithRole, 0)
	for rows.Next() {
		var r OrgWithRole
		if err := rows.Scan(
			&r.ID, &r.Name, &r.Description, &r.OwnerID, &r.CreatedAt, &r.UpdatedAt,
			&r.Role, &r.ProjectCount, &r.MemberCount,
		); err != nil {
			return nil, err
		}
		r.IsOwner = r.OwnerID == userID
		out = append(out, r)
	}
	return out, rows.Err()
}

// GetProjectCount returns the project count for an org.
func (s *Store) GetProjectCount(ctx context.Context, orgID int) (int, error) {
	var count int
	err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*)::int FROM skaftin_system_projects WHERE organization_id = $1`, orgID).Scan(&count)
	return count, err
}

// --- Member queries ---

// GetMembership returns the membership record for a user in an org, or nil if not a member.
func (s *Store) GetMembership(ctx context.Context, orgID int, userID string) (*Member, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+memberColumns+` FROM skaftin_system_organization_members
		 WHERE organization_id = $1 AND user_id = $2`, orgID, userID)
	m, err := scanMember(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return m, err
}

// GetMemberByID returns a member by their membership row ID.
func (s *Store) GetMemberByID(ctx context.Context, memberID int) (*Member, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+memberColumns+` FROM skaftin_system_organization_members WHERE id = $1`, memberID)
	m, err := scanMember(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return m, err
}

// ListMembers returns all members of an org.
func (s *Store) ListMembers(ctx context.Context, orgID int) ([]Member, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT `+memberColumns+` FROM skaftin_system_organization_members WHERE organization_id = $1`, orgID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanMemberRows(rows)
}

// AddMember inserts a new member record.
func (s *Store) AddMember(ctx context.Context, orgID int, userID, role string) (*Member, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO skaftin_system_organization_members (organization_id, user_id, role)
		 VALUES ($1, $2, $3) RETURNING `+memberColumns,
		orgID, userID, role)
	return scanMember(row)
}

// UpdateMemberRole updates a member's role by membership row ID.
func (s *Store) UpdateMemberRole(ctx context.Context, memberID int, role string) (*Member, error) {
	row := s.pool.QueryRow(ctx,
		`UPDATE skaftin_system_organization_members SET role = $1 WHERE id = $2 RETURNING `+memberColumns,
		role, memberID)
	return scanMember(row)
}

// RemoveMember deletes a membership row.
func (s *Store) RemoveMember(ctx context.Context, memberID int) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM skaftin_system_organization_members WHERE id = $1`, memberID)
	return err
}
