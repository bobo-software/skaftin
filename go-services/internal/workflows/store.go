package workflows

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles workflow DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new workflows Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func (s *Store) getProjectSchema(ctx context.Context, projectID int) (string, error) {
	var schema string
	if err := s.pool.QueryRow(ctx, "SELECT schema_name FROM skaftin_system_projects WHERE id = $1", projectID).Scan(&schema); err != nil {
		return "", err
	}
	return schema, nil
}

func (s *Store) listWorkflows(ctx context.Context, projectID int) ([]map[string]any, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name, description, enabled, schedule, cron_job_id, created_at, updated_at
		FROM skaftin_system_workflows
		WHERE project_id = $1
		ORDER BY id DESC
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []map[string]any
	for rows.Next() {
		var (
			id, pid int
			name    string
			desc    *string
			enabled bool
			sched   *string
			cronID  *int
			created time.Time
			updated time.Time
		)
		if err := rows.Scan(&id, &pid, &name, &desc, &enabled, &sched, &cronID, &created, &updated); err != nil {
			return nil, err
		}
		out = append(out, map[string]any{
			"id":          id,
			"project_id":  pid,
			"name":        name,
			"description": desc,
			"enabled":     enabled,
			"schedule":    sched,
			"cron_job_id": cronID,
			"created_at":  created,
			"updated_at":  updated,
		})
	}
	return out, rows.Err()
}

func (s *Store) loadWorkflow(ctx context.Context, workflowID int) (*WorkflowDefinition, error) {
	var (
		id, projectID int
		name          string
		description   *string
		enabled       bool
		schedule      *string
		cronJobID     *int
	)
	if err := s.pool.QueryRow(ctx, `
		SELECT id, project_id, name, description, enabled, schedule, cron_job_id
		FROM skaftin_system_workflows
		WHERE id = $1
	`, workflowID).Scan(&id, &projectID, &name, &description, &enabled, &schedule, &cronJobID); err != nil {
		return nil, err
	}

	nodeRows, err := s.pool.Query(ctx, `
		SELECT node_id, type, position_x, position_y, data
		FROM skaftin_system_workflow_nodes
		WHERE workflow_id = $1
		ORDER BY id ASC
	`, workflowID)
	if err != nil {
		return nil, err
	}
	defer nodeRows.Close()

	nodes := make([]WorkflowNode, 0)
	for nodeRows.Next() {
		var (
			nodeID string
			typ    string
			x, y   int
			raw    []byte
		)
		if err := nodeRows.Scan(&nodeID, &typ, &x, &y, &raw); err != nil {
			return nil, err
		}
		data := map[string]any{}
		if len(raw) > 0 {
			_ = json.Unmarshal(raw, &data)
		}
		nodes = append(nodes, WorkflowNode{
			ID:       nodeID,
			Type:     typ,
			Position: map[string]int{"x": x, "y": y},
			Data:     data,
		})
	}

	edgeRows, err := s.pool.Query(ctx, `
		SELECT id, source_node_id, target_node_id, source_handle, target_handle
		FROM skaftin_system_workflow_edges
		WHERE workflow_id = $1
		ORDER BY id ASC
	`, workflowID)
	if err != nil {
		return nil, err
	}
	defer edgeRows.Close()

	edges := make([]WorkflowEdge, 0)
	for edgeRows.Next() {
		var (
			idInt        int
			source, dest string
			sourceHandle *string
			targetHandle *string
		)
		if err := edgeRows.Scan(&idInt, &source, &dest, &sourceHandle, &targetHandle); err != nil {
			return nil, err
		}
		edges = append(edges, WorkflowEdge{
			ID:           fmt.Sprintf("%d", idInt),
			Source:       source,
			Target:       dest,
			SourceHandle: sourceHandle,
			TargetHandle: targetHandle,
		})
	}

	return &WorkflowDefinition{
		ID:          id,
		ProjectID:   projectID,
		Name:        name,
		Description: description,
		Enabled:     enabled,
		Schedule:    schedule,
		CronJobID:   cronJobID,
		Nodes:       nodes,
		Edges:       edges,
	}, nil
}

func (s *Store) createWorkflow(ctx context.Context, projectID int, userID string, in CreateWorkflowInput) (int, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	enabled := true
	if in.Enabled != nil {
		enabled = *in.Enabled
	}
	var workflowID int
	if err := tx.QueryRow(ctx, `
		INSERT INTO skaftin_system_workflows (project_id, name, description, enabled, schedule, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, projectID, in.Name, in.Description, enabled, in.Schedule, nullIfEmpty(userID)).Scan(&workflowID); err != nil {
		return 0, err
	}

	for _, n := range in.Nodes {
		raw, _ := json.Marshal(n.Data)
		if _, err := tx.Exec(ctx, `
			INSERT INTO skaftin_system_workflow_nodes (workflow_id, node_id, type, position_x, position_y, data)
			VALUES ($1, $2, $3, $4, $5, $6)
		`, workflowID, n.ID, n.Type, n.Position["x"], n.Position["y"], raw); err != nil {
			return 0, err
		}
	}

	for _, e := range in.Edges {
		if _, err := tx.Exec(ctx, `
			INSERT INTO skaftin_system_workflow_edges (workflow_id, source_node_id, target_node_id, source_handle, target_handle)
			VALUES ($1, $2, $3, $4, $5)
		`, workflowID, e.Source, e.Target, e.SourceHandle, e.TargetHandle); err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, err
	}
	return workflowID, nil
}

func (s *Store) updateWorkflow(ctx context.Context, workflowID int, in UpdateWorkflowInput) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	setCols := []string{"updated_at = NOW()"}
	args := []any{}
	argIdx := 1
	if in.Name != nil {
		setCols = append(setCols, fmt.Sprintf("name = $%d", argIdx))
		args = append(args, *in.Name)
		argIdx++
	}
	if in.Description != nil {
		setCols = append(setCols, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *in.Description)
		argIdx++
	}
	if in.Enabled != nil {
		setCols = append(setCols, fmt.Sprintf("enabled = $%d", argIdx))
		args = append(args, *in.Enabled)
		argIdx++
	}
	if in.ScheduleSet {
		setCols = append(setCols, fmt.Sprintf("schedule = $%d", argIdx))
		args = append(args, in.Schedule)
		argIdx++
	}
	args = append(args, workflowID)
	query := fmt.Sprintf("UPDATE skaftin_system_workflows SET %s WHERE id = $%d", joinCSV(setCols), argIdx)
	if _, err := tx.Exec(ctx, query, args...); err != nil {
		return err
	}

	if in.Nodes != nil {
		if _, err := tx.Exec(ctx, "DELETE FROM skaftin_system_workflow_nodes WHERE workflow_id = $1", workflowID); err != nil {
			return err
		}
		for _, n := range in.Nodes {
			raw, _ := json.Marshal(n.Data)
			if _, err := tx.Exec(ctx, `
				INSERT INTO skaftin_system_workflow_nodes (workflow_id, node_id, type, position_x, position_y, data)
				VALUES ($1, $2, $3, $4, $5, $6)
			`, workflowID, n.ID, n.Type, n.Position["x"], n.Position["y"], raw); err != nil {
				return err
			}
		}
	}

	if in.Edges != nil {
		if _, err := tx.Exec(ctx, "DELETE FROM skaftin_system_workflow_edges WHERE workflow_id = $1", workflowID); err != nil {
			return err
		}
		for _, e := range in.Edges {
			if _, err := tx.Exec(ctx, `
				INSERT INTO skaftin_system_workflow_edges (workflow_id, source_node_id, target_node_id, source_handle, target_handle)
				VALUES ($1, $2, $3, $4, $5)
			`, workflowID, e.Source, e.Target, e.SourceHandle, e.TargetHandle); err != nil {
				return err
			}
		}
	}

	return tx.Commit(ctx)
}

func (s *Store) deleteWorkflow(ctx context.Context, workflowID int) error {
	_, err := s.pool.Exec(ctx, "DELETE FROM skaftin_system_workflows WHERE id = $1", workflowID)
	return err
}

func (s *Store) createExecution(ctx context.Context, workflowID int, status string, triggeredBy string, input map[string]any, startedAt time.Time) (int, error) {
	raw, _ := json.Marshal(input)
	var id int
	err := s.pool.QueryRow(ctx, `
		INSERT INTO skaftin_system_workflow_executions (workflow_id, status, triggered_by, input_data, started_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, workflowID, status, triggeredBy, raw, startedAt).Scan(&id)
	return id, err
}

func (s *Store) updateExecution(ctx context.Context, executionID int, status string, result map[string]any, errMsg *string) error {
	raw, _ := json.Marshal(result)
	_, err := s.pool.Exec(ctx, `
		UPDATE skaftin_system_workflow_executions
		SET status = $2, completed_at = NOW(), result_data = $3, error_message = $4
		WHERE id = $1
	`, executionID, status, raw, errMsg)
	return err
}

func (s *Store) saveNodeExecution(ctx context.Context, executionID int, nodeID string, res NodeExecutionResult) error {
	raw, _ := json.Marshal(res.Data)
	var errMsg *string
	if res.Error != "" {
		errMsg = &res.Error
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO skaftin_system_workflow_node_executions
		(execution_id, node_id, status, result_data, error_message, execution_time_ms, started_at, completed_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
	`, executionID, nodeID, res.Status, raw, errMsg, nullIfZero(res.ExecutionTimeMS))
	return err
}

func (s *Store) listExecutions(ctx context.Context, workflowID, limit, offset int) ([]WorkflowExecution, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, workflow_id, status, started_at, completed_at, triggered_by, input_data, result_data, error_message, created_at
		FROM skaftin_system_workflow_executions
		WHERE workflow_id = $1
		ORDER BY started_at DESC
		LIMIT $2 OFFSET $3
	`, workflowID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []WorkflowExecution{}
	for rows.Next() {
		var (
			ex            WorkflowExecution
			inRaw, outRaw []byte
		)
		if err := rows.Scan(&ex.ID, &ex.WorkflowID, &ex.Status, &ex.StartedAt, &ex.CompletedAt, &ex.TriggeredBy, &inRaw, &outRaw, &ex.ErrorMsg, &ex.CreatedAt); err != nil {
			return nil, err
		}
		if len(inRaw) > 0 {
			_ = json.Unmarshal(inRaw, &ex.InputData)
		}
		if len(outRaw) > 0 {
			_ = json.Unmarshal(outRaw, &ex.ResultData)
		}
		out = append(out, ex)
	}
	return out, rows.Err()
}

func (s *Store) getExecution(ctx context.Context, executionID int) (*WorkflowExecution, error) {
	var (
		ex            WorkflowExecution
		inRaw, outRaw []byte
	)
	err := s.pool.QueryRow(ctx, `
		SELECT id, workflow_id, status, started_at, completed_at, triggered_by, input_data, result_data, error_message, created_at
		FROM skaftin_system_workflow_executions
		WHERE id = $1
	`, executionID).Scan(&ex.ID, &ex.WorkflowID, &ex.Status, &ex.StartedAt, &ex.CompletedAt, &ex.TriggeredBy, &inRaw, &outRaw, &ex.ErrorMsg, &ex.CreatedAt)
	if err != nil {
		return nil, err
	}
	if len(inRaw) > 0 {
		_ = json.Unmarshal(inRaw, &ex.InputData)
	}
	if len(outRaw) > 0 {
		_ = json.Unmarshal(outRaw, &ex.ResultData)
	}
	return &ex, nil
}

func (s *Store) getNodeExecutions(ctx context.Context, executionID int) ([]WorkflowNodeExecution, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT node_id, status, started_at, completed_at, result_data, error_message, execution_time_ms
		FROM skaftin_system_workflow_node_executions
		WHERE execution_id = $1
		ORDER BY started_at ASC
	`, executionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []WorkflowNodeExecution{}
	for rows.Next() {
		var (
			n   WorkflowNodeExecution
			raw []byte
		)
		if err := rows.Scan(&n.NodeID, &n.Status, &n.StartedAt, &n.CompletedAt, &raw, &n.ErrorMessage, &n.ExecutionTimeMS); err != nil {
			return nil, err
		}
		if len(raw) > 0 {
			_ = json.Unmarshal(raw, &n.ResultData)
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

func (s *Store) upsertSchedule(ctx context.Context, workflowID int, schedule string, enabled bool) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO skaftin_system_workflow_schedules (workflow_id, cron_job_id, schedule, enabled)
		VALUES ($1, $1, $2, $3)
		ON CONFLICT (workflow_id)
		DO UPDATE SET schedule = EXCLUDED.schedule, enabled = EXCLUDED.enabled, updated_at = NOW()
	`, workflowID, schedule, enabled)
	return err
}

func (s *Store) updateWorkflowSchedule(ctx context.Context, workflowID int, schedule *string, cronJobID *int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE skaftin_system_workflows
		SET schedule = $2, cron_job_id = $3, updated_at = NOW()
		WHERE id = $1
	`, workflowID, schedule, cronJobID)
	return err
}

func (s *Store) disableSchedule(ctx context.Context, workflowID int) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE skaftin_system_workflow_schedules
		SET enabled = false, updated_at = NOW()
		WHERE workflow_id = $1
	`, workflowID)
	return err
}

func (s *Store) listEnabledScheduledWorkflows(ctx context.Context) ([]struct {
	ID       int
	Schedule string
	Enabled  bool
}, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, schedule, enabled
		FROM skaftin_system_workflows
		WHERE schedule IS NOT NULL AND enabled = true
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []struct {
		ID       int
		Schedule string
		Enabled  bool
	}{}
	for rows.Next() {
		var row struct {
			ID       int
			Schedule string
			Enabled  bool
		}
		if err := rows.Scan(&row.ID, &row.Schedule, &row.Enabled); err != nil {
			return nil, err
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func nullIfZero(v int) any {
	if v == 0 {
		return nil
	}
	return v
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func joinCSV(parts []string) string {
	if len(parts) == 0 {
		return ""
	}
	out := parts[0]
	for i := 1; i < len(parts); i++ {
		out += ", " + parts[i]
	}
	return out
}

func isNotFoundErr(err error) bool {
	return err == pgx.ErrNoRows
}
