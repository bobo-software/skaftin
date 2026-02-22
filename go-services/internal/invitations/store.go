package invitations

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Invitation struct {
	ID                 int        `json:"id"`
	ProjectID          int        `json:"project_id"`
	Email              string     `json:"email"`
	InviteCode         string     `json:"invite_code"`
	Role               string     `json:"role"`
	Status             string     `json:"status"`
	InvitedBy          string     `json:"invited_by"`
	ExpiresAt          time.Time  `json:"expires_at"`
	CreatedAt          *time.Time `json:"created_at"`
	AcceptedAt         *time.Time `json:"accepted_at"`
	ProjectName        string     `json:"project_name,omitempty"`
	ProjectDescription *string    `json:"project_description,omitempty"`
}

type Member struct {
	ID          int        `json:"id"`
	ProjectID   int        `json:"project_id"`
	UserID      string     `json:"user_id"`
	Role        string     `json:"role"`
	InvitedBy   *string    `json:"invited_by"`
	JoinedAt    *time.Time `json:"joined_at"`
	ProjectName string     `json:"project_name,omitempty"`
}

type Store struct {
	pool *pgxpool.Pool
}

func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) GetByCode(ctx context.Context, code string) (*Invitation, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT i.id, i.project_id, i.email, i.invite_code, i.role, i.status,
		       i.invited_by, i.expires_at, i.created_at, i.accepted_at,
		       p.name, p.description
		FROM skaftin_system_project_invitations i
		JOIN skaftin_system_projects p ON i.project_id = p.id
		WHERE i.invite_code = $1`, code)

	var inv Invitation
	err := row.Scan(
		&inv.ID, &inv.ProjectID, &inv.Email, &inv.InviteCode, &inv.Role, &inv.Status,
		&inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt, &inv.AcceptedAt,
		&inv.ProjectName, &inv.ProjectDescription,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &inv, err
}

func (s *Store) GetByID(ctx context.Context, id int) (*Invitation, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, project_id, email, invite_code, role, status,
		       invited_by, expires_at, created_at, accepted_at
		FROM skaftin_system_project_invitations
		WHERE id = $1`, id)

	var inv Invitation
	err := row.Scan(
		&inv.ID, &inv.ProjectID, &inv.Email, &inv.InviteCode, &inv.Role, &inv.Status,
		&inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt, &inv.AcceptedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &inv, err
}

func (s *Store) ListByProject(ctx context.Context, projectID int, status string) ([]Invitation, error) {
	query := `
		SELECT i.id, i.project_id, i.email, i.invite_code, i.role, i.status,
		       i.invited_by, i.expires_at, i.created_at, i.accepted_at,
		       p.name
		FROM skaftin_system_project_invitations i
		JOIN skaftin_system_projects p ON i.project_id = p.id
		WHERE i.project_id = $1`
	args := []any{projectID}

	if status != "" {
		query += ` AND i.status = $2`
		args = append(args, status)
	}
	query += ` ORDER BY i.created_at DESC`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Invitation, 0)
	for rows.Next() {
		var inv Invitation
		if err := rows.Scan(
			&inv.ID, &inv.ProjectID, &inv.Email, &inv.InviteCode, &inv.Role, &inv.Status,
			&inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt, &inv.AcceptedAt,
			&inv.ProjectName,
		); err != nil {
			return nil, err
		}
		list = append(list, inv)
	}
	return list, rows.Err()
}

func (s *Store) FindPendingByEmail(ctx context.Context, projectID int, email string) (*Invitation, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, status
		FROM skaftin_system_project_invitations
		WHERE project_id = $1 AND email = $2 AND status = 'pending'`, projectID, email)

	var inv Invitation
	err := row.Scan(&inv.ID, &inv.Status)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return &inv, err
}

func (s *Store) CleanupNonPending(ctx context.Context, projectID int, email string) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM skaftin_system_project_invitations
		WHERE project_id = $1 AND email = $2 AND status != 'pending'`, projectID, email)
	return err
}

func (s *Store) IsMemberByEmail(ctx context.Context, projectID int, email string) (bool, error) {
	var id int
	err := s.pool.QueryRow(ctx, `
		SELECT pm.id FROM skaftin_system_project_members pm
		JOIN skaftin_system_users u ON pm.user_id = u.user_id
		WHERE pm.project_id = $1 AND u.email = $2`, projectID, email).Scan(&id)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) GetProjectName(ctx context.Context, projectID int) (string, error) {
	var name string
	err := s.pool.QueryRow(ctx, `SELECT name FROM skaftin_system_projects WHERE id = $1`, projectID).Scan(&name)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return name, err
}

func (s *Store) Create(ctx context.Context, projectID int, email, code, role, invitedBy string, expiresAt time.Time) (*Invitation, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO skaftin_system_project_invitations
		  (project_id, email, invite_code, role, invited_by, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id, project_id, email, invite_code, role, status, invited_by, expires_at, created_at, accepted_at`,
		projectID, email, code, role, invitedBy, expiresAt)

	var inv Invitation
	err := row.Scan(
		&inv.ID, &inv.ProjectID, &inv.Email, &inv.InviteCode, &inv.Role, &inv.Status,
		&inv.InvitedBy, &inv.ExpiresAt, &inv.CreatedAt, &inv.AcceptedAt,
	)
	return &inv, err
}

func (s *Store) MarkExpired(ctx context.Context, id int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE skaftin_system_project_invitations SET status = 'expired' WHERE id = $1`, id)
	return err
}

func (s *Store) Revoke(ctx context.Context, id, projectID int) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		UPDATE skaftin_system_project_invitations
		SET status = 'rejected'
		WHERE id = $1 AND project_id = $2 AND status = 'pending'`, id, projectID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (s *Store) Delete(ctx context.Context, id int) error {
	_, err := s.pool.Exec(ctx, `
		DELETE FROM skaftin_system_project_invitations WHERE id = $1`, id)
	return err
}

// ---- Members ----

func (s *Store) ListMembers(ctx context.Context, projectID int) ([]Member, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT pm.id, pm.project_id, pm.user_id, pm.role, pm.invited_by, pm.joined_at,
		       p.name
		FROM skaftin_system_project_members pm
		JOIN skaftin_system_projects p ON pm.project_id = p.id
		WHERE pm.project_id = $1
		ORDER BY pm.joined_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	list := make([]Member, 0)
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.ProjectID, &m.UserID, &m.Role, &m.InvitedBy, &m.JoinedAt, &m.ProjectName); err != nil {
			return nil, err
		}
		list = append(list, m)
	}
	return list, rows.Err()
}

func (s *Store) IsMember(ctx context.Context, projectID int, userID string) (bool, error) {
	var id int
	err := s.pool.QueryRow(ctx, `
		SELECT id FROM skaftin_system_project_members
		WHERE project_id = $1 AND user_id = $2`, projectID, userID).Scan(&id)
	if err == pgx.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return true, nil
}

func (s *Store) InsertMember(ctx context.Context, projectID int, userID, role, invitedBy string) (*Member, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO skaftin_system_project_members (project_id, user_id, role, invited_by)
		VALUES ($1, $2, $3, $4)
		RETURNING id, project_id, user_id, role, invited_by, joined_at`,
		projectID, userID, role, invitedBy)

	var m Member
	err := row.Scan(&m.ID, &m.ProjectID, &m.UserID, &m.Role, &m.InvitedBy, &m.JoinedAt)
	return &m, err
}

func (s *Store) RemoveMember(ctx context.Context, id, projectID int) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM skaftin_system_project_members
		WHERE id = $1 AND project_id = $2`, id, projectID)
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

func (s *Store) AddOrgMember(ctx context.Context, projectID int, userID string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO skaftin_system_organization_members (organization_id, user_id, role)
		SELECT p.organization_id, $2, 'member'
		FROM skaftin_system_projects p
		WHERE p.id = $1 AND p.organization_id IS NOT NULL
		ON CONFLICT (organization_id, user_id) DO NOTHING`, projectID, userID)
	return err
}

func (s *Store) GetUserEmail(ctx context.Context, userID string) (string, error) {
	var email string
	err := s.pool.QueryRow(ctx, `SELECT email FROM skaftin_system_users WHERE user_id = $1`, userID).Scan(&email)
	if err == pgx.ErrNoRows {
		return "", nil
	}
	return email, err
}
