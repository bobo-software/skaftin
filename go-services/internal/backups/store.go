package backups

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ProjectInfo holds basic project metadata needed for backup operations.
type ProjectInfo struct {
	ID          int
	Name        string
	Description string
	SchemaName  string
}

// BackupSchedule represents a row in skaftin_system_backup_schedules.
type BackupSchedule struct {
	ID               int        `json:"id"`
	ProjectID        int        `json:"project_id"`
	Name             string     `json:"name"`
	Description      *string    `json:"description"`
	Schedule         string     `json:"schedule"`
	Enabled          bool       `json:"enabled"`
	BackupNamePrefix *string    `json:"backup_name_prefix"`
	RetentionDays    *int       `json:"retention_days"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	CreatedBy        *string    `json:"created_by"`
	LastRunAt        *time.Time `json:"last_run_at"`
	NextRunAt        *time.Time `json:"next_run_at"`
	BackupType       string     `json:"backup_type"`
	RetentionPolicy  string     `json:"retention_policy"`
	RetentionValue   *int       `json:"retention_value"`
}

// Store handles database operations for the backups domain.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new backups Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) GetProjectSchema(ctx context.Context, projectID int) (string, error) {
	var schema string
	err := s.pool.QueryRow(ctx,
		`SELECT schema_name FROM skaftin_system_projects WHERE id = $1`, projectID,
	).Scan(&schema)
	if err != nil {
		return "", fmt.Errorf("project lookup: %w", err)
	}
	return schema, nil
}

func (s *Store) GetProjectInfo(ctx context.Context, projectID int) (*ProjectInfo, error) {
	var p ProjectInfo
	var desc *string
	err := s.pool.QueryRow(ctx,
		`SELECT id, name, COALESCE(description, ''), schema_name FROM skaftin_system_projects WHERE id = $1`, projectID,
	).Scan(&p.ID, &p.Name, &desc, &p.SchemaName)
	if err != nil {
		return nil, fmt.Errorf("project lookup: %w", err)
	}
	if desc != nil {
		p.Description = *desc
	}
	return &p, nil
}

const scheduleColumns = `id, project_id, name, description, schedule, enabled,
	backup_name_prefix, retention_days, created_at, updated_at, created_by,
	last_run_at, next_run_at,
	COALESCE(backup_type, 'database'), COALESCE(retention_policy, 'keep_all'), retention_value`

func scanSchedule(row pgx.Row) (*BackupSchedule, error) {
	var bs BackupSchedule
	err := row.Scan(
		&bs.ID, &bs.ProjectID, &bs.Name, &bs.Description, &bs.Schedule, &bs.Enabled,
		&bs.BackupNamePrefix, &bs.RetentionDays, &bs.CreatedAt, &bs.UpdatedAt, &bs.CreatedBy,
		&bs.LastRunAt, &bs.NextRunAt,
		&bs.BackupType, &bs.RetentionPolicy, &bs.RetentionValue,
	)
	if err != nil {
		return nil, err
	}
	return &bs, nil
}

func (s *Store) ListSchedules(ctx context.Context, projectID int) ([]BackupSchedule, error) {
	rows, err := s.pool.Query(ctx,
		fmt.Sprintf(`SELECT %s FROM skaftin_system_backup_schedules WHERE project_id = $1 ORDER BY created_at`, scheduleColumns),
		projectID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]BackupSchedule, 0)
	for rows.Next() {
		bs, err := scanSchedule(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *bs)
	}
	return result, rows.Err()
}

func (s *Store) GetSchedule(ctx context.Context, scheduleID, projectID int) (*BackupSchedule, error) {
	row := s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT %s FROM skaftin_system_backup_schedules WHERE id = $1 AND project_id = $2`, scheduleColumns),
		scheduleID, projectID,
	)
	return scanSchedule(row)
}

func (s *Store) GetScheduleByID(ctx context.Context, scheduleID int) (*BackupSchedule, error) {
	row := s.pool.QueryRow(ctx,
		fmt.Sprintf(`SELECT %s FROM skaftin_system_backup_schedules WHERE id = $1`, scheduleColumns),
		scheduleID,
	)
	return scanSchedule(row)
}

func (s *Store) GetEnabledSchedules(ctx context.Context) ([]BackupSchedule, error) {
	rows, err := s.pool.Query(ctx,
		fmt.Sprintf(`SELECT %s FROM skaftin_system_backup_schedules WHERE enabled = true`, scheduleColumns),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]BackupSchedule, 0)
	for rows.Next() {
		bs, err := scanSchedule(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, *bs)
	}
	return result, rows.Err()
}

type CreateScheduleParams struct {
	ProjectID        int
	Name             string
	Description      *string
	Schedule         string
	BackupNamePrefix *string
	RetentionDays    *int
	CreatedBy        *string
	BackupType       string
	RetentionPolicy  string
	RetentionValue   *int
}

func (s *Store) CreateSchedule(ctx context.Context, p CreateScheduleParams) (*BackupSchedule, error) {
	row := s.pool.QueryRow(ctx,
		fmt.Sprintf(`INSERT INTO skaftin_system_backup_schedules
			(project_id, name, description, schedule, enabled, backup_name_prefix, retention_days,
			 created_by, backup_type, retention_policy, retention_value)
			VALUES ($1, $2, $3, $4, true, $5, $6, $7, $8, $9, $10)
			RETURNING %s`, scheduleColumns),
		p.ProjectID, p.Name, p.Description, p.Schedule, p.BackupNamePrefix, p.RetentionDays,
		p.CreatedBy, p.BackupType, p.RetentionPolicy, p.RetentionValue,
	)
	return scanSchedule(row)
}

type UpdateScheduleParams struct {
	Name             *string
	Description      *string
	Schedule         *string
	Enabled          *bool
	BackupNamePrefix *string
	RetentionDays    *int
	BackupType       *string
	RetentionPolicy  *string
	RetentionValue   *int
}

func (s *Store) UpdateSchedule(ctx context.Context, scheduleID int, p UpdateScheduleParams) (*BackupSchedule, error) {
	row := s.pool.QueryRow(ctx,
		fmt.Sprintf(`UPDATE skaftin_system_backup_schedules SET
			name = COALESCE($2, name),
			description = COALESCE($3, description),
			schedule = COALESCE($4, schedule),
			enabled = COALESCE($5, enabled),
			backup_name_prefix = COALESCE($6, backup_name_prefix),
			retention_days = COALESCE($7, retention_days),
			backup_type = COALESCE($8, backup_type),
			retention_policy = COALESCE($9, retention_policy),
			retention_value = COALESCE($10, retention_value),
			updated_at = NOW()
		WHERE id = $1
		RETURNING %s`, scheduleColumns),
		scheduleID, p.Name, p.Description, p.Schedule, p.Enabled,
		p.BackupNamePrefix, p.RetentionDays, p.BackupType, p.RetentionPolicy, p.RetentionValue,
	)
	return scanSchedule(row)
}

func (s *Store) DeleteSchedule(ctx context.Context, scheduleID int) error {
	_, err := s.pool.Exec(ctx,
		`DELETE FROM skaftin_system_backup_schedules WHERE id = $1`, scheduleID,
	)
	return err
}

func (s *Store) UpdateScheduleLastRun(ctx context.Context, scheduleID int) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE skaftin_system_backup_schedules SET last_run_at = NOW(), updated_at = NOW() WHERE id = $1`,
		scheduleID,
	)
	return err
}

func (s *Store) UpdateScheduleNextRun(ctx context.Context, scheduleID int, nextRun *time.Time) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE skaftin_system_backup_schedules SET next_run_at = $2 WHERE id = $1`,
		scheduleID, nextRun,
	)
	return err
}
