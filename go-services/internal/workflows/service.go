package workflows

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Service contains business logic for workflow execution, scheduling, and variable resolution.
type Service struct {
	store     *Store
	engine    *Engine
	scheduler *Scheduler
}

// NewService creates a new workflows Service.
func NewService(pool *pgxpool.Pool) *Service {
	store := NewStore(pool)
	engine := NewEngine(pool, store)
	return &Service{
		store:  store,
		engine: engine,
	}
}

func (s *Service) SetScheduler(scheduler *Scheduler) {
	s.scheduler = scheduler
}

func (s *Service) ListWorkflows(ctx context.Context, projectID int) ([]map[string]any, error) {
	return s.store.listWorkflows(ctx, projectID)
}

func (s *Service) GetWorkflow(ctx context.Context, projectID, workflowID int) (*WorkflowDefinition, error) {
	wf, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if wf.ProjectID != projectID {
		return nil, pgx.ErrNoRows
	}
	return wf, nil
}

func (s *Service) CreateWorkflow(ctx context.Context, projectID int, userID string, in CreateWorkflowInput) (*WorkflowDefinition, error) {
	id, err := s.store.createWorkflow(ctx, projectID, userID, in)
	if err != nil {
		return nil, err
	}
	if in.Schedule != nil && *in.Schedule != "" && s.scheduler != nil {
		s.scheduler.Schedule(ctx, id, *in.Schedule)
	}
	return s.store.loadWorkflow(ctx, id)
}

func (s *Service) UpdateWorkflow(ctx context.Context, projectID, workflowID int, in UpdateWorkflowInput) (*WorkflowDefinition, error) {
	existing, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if existing.ProjectID != projectID {
		return nil, pgx.ErrNoRows
	}
	if err := s.store.updateWorkflow(ctx, workflowID, in); err != nil {
		return nil, err
	}

	if in.ScheduleSet && s.scheduler != nil {
		if in.Schedule != nil && *in.Schedule != "" {
			s.scheduler.Schedule(ctx, workflowID, *in.Schedule)
		} else {
			s.scheduler.Unschedule(workflowID)
		}
	}
	return s.store.loadWorkflow(ctx, workflowID)
}

func (s *Service) DeleteWorkflow(ctx context.Context, projectID, workflowID int) error {
	existing, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return err
	}
	if existing.ProjectID != projectID {
		return pgx.ErrNoRows
	}
	if s.scheduler != nil {
		s.scheduler.Unschedule(workflowID)
	}
	return s.store.deleteWorkflow(ctx, workflowID)
}

func (s *Service) ExecuteWorkflow(ctx context.Context, projectID, workflowID int, in ExecuteWorkflowInput) (*ExecutionResult, error) {
	existing, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if existing.ProjectID != projectID {
		return nil, pgx.ErrNoRows
	}
	if in.Inputs == nil {
		in.Inputs = map[string]any{}
	}
	if in.TriggeredBy == "" {
		in.TriggeredBy = "manual"
	}
	return s.engine.ExecuteWorkflow(ctx, workflowID, in.Inputs, in.TriggeredBy)
}

func (s *Service) ListExecutions(ctx context.Context, projectID, workflowID, limit, offset int) ([]WorkflowExecution, error) {
	existing, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if existing.ProjectID != projectID {
		return nil, pgx.ErrNoRows
	}
	return s.store.listExecutions(ctx, workflowID, limit, offset)
}

func (s *Service) GetExecutionLogs(ctx context.Context, projectID, workflowID, executionID int) (map[string]any, error) {
	existing, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if existing.ProjectID != projectID {
		return nil, pgx.ErrNoRows
	}
	exec, err := s.store.getExecution(ctx, executionID)
	if err != nil {
		return nil, err
	}
	if exec.WorkflowID != workflowID {
		return nil, fmt.Errorf("execution does not belong to this workflow")
	}
	nodeExecs, err := s.store.getNodeExecutions(ctx, executionID)
	if err != nil {
		return nil, err
	}
	nodeMap := map[string]WorkflowNode{}
	for _, n := range existing.Nodes {
		nodeMap[n.ID] = n
	}
	logs := make([]map[string]any, 0, len(nodeExecs))
	for _, ne := range nodeExecs {
		n := nodeMap[ne.NodeID]
		logs = append(logs, map[string]any{
			"nodeId":          ne.NodeID,
			"nodeType":        n.Type,
			"nodeData":        n.Data,
			"status":          ne.Status,
			"startedAt":       ne.StartedAt,
			"completedAt":     ne.CompletedAt,
			"executionTimeMs": ne.ExecutionTimeMS,
			"resultData":      ne.ResultData,
			"errorMessage":    ne.ErrorMessage,
		})
	}
	return map[string]any{
		"execution": exec,
		"nodeLogs":  logs,
	}, nil
}

func (s *Service) ScheduleWorkflow(ctx context.Context, projectID, workflowID int, schedule string) (map[string]any, error) {
	existing, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if existing.ProjectID != projectID {
		return nil, pgx.ErrNoRows
	}
	if schedule == "" {
		return nil, fmt.Errorf("schedule (cron expression) is required")
	}
	if s.scheduler != nil {
		s.scheduler.Schedule(ctx, workflowID, schedule)
	}
	if err := s.store.updateWorkflowSchedule(ctx, workflowID, &schedule, nil); err != nil {
		return nil, err
	}
	if err := s.store.upsertSchedule(ctx, workflowID, schedule, true); err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}

func (s *Service) UnscheduleWorkflow(ctx context.Context, projectID, workflowID int) (map[string]any, error) {
	existing, err := s.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if existing.ProjectID != projectID {
		return nil, pgx.ErrNoRows
	}
	if s.scheduler != nil {
		s.scheduler.Unschedule(workflowID)
	}
	if err := s.store.updateWorkflowSchedule(ctx, workflowID, nil, nil); err != nil {
		return nil, err
	}
	if err := s.store.disableSchedule(ctx, workflowID); err != nil {
		return nil, err
	}
	return map[string]any{"success": true}, nil
}
