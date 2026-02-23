package workflows

import "time"

type WorkflowNode struct {
	ID       string         `json:"id"`
	Type     string         `json:"type"`
	Position map[string]int `json:"position"`
	Data     map[string]any `json:"data"`
}

type WorkflowEdge struct {
	ID           string  `json:"id"`
	Source       string  `json:"source"`
	Target       string  `json:"target"`
	SourceHandle *string `json:"sourceHandle,omitempty"`
	TargetHandle *string `json:"targetHandle,omitempty"`
}

type WorkflowDefinition struct {
	ID          int            `json:"id"`
	ProjectID   int            `json:"projectId"`
	Name        string         `json:"name"`
	Description *string        `json:"description,omitempty"`
	Enabled     bool           `json:"enabled"`
	Schedule    *string        `json:"schedule,omitempty"`
	CronJobID   *int           `json:"cronJobId,omitempty"`
	Nodes       []WorkflowNode `json:"nodes"`
	Edges       []WorkflowEdge `json:"edges"`
}

type NodeExecutionResult struct {
	NodeID          string         `json:"nodeId"`
	Status          string         `json:"status"`
	Data            map[string]any `json:"data,omitempty"`
	Error           string         `json:"error,omitempty"`
	ExecutionTimeMS int            `json:"executionTimeMs,omitempty"`
	Timestamp       string         `json:"timestamp"`
}

type LoopIterationContext struct {
	Item         any
	Index        int
	VariableName string
}

type ExecutionContext struct {
	WorkflowID       int
	ExecutionID      int
	ProjectID        int
	SchemaName       string
	Inputs           map[string]any
	NodeResults      map[string]NodeExecutionResult
	Variables        map[string]any
	StartTime        time.Time
	IterationContext *LoopIterationContext
}

type CreateWorkflowInput struct {
	Name        string         `json:"name"`
	Description *string        `json:"description"`
	Enabled     *bool          `json:"enabled"`
	Schedule    *string        `json:"schedule"`
	Nodes       []WorkflowNode `json:"nodes"`
	Edges       []WorkflowEdge `json:"edges"`
}

type UpdateWorkflowInput struct {
	Name        *string        `json:"name"`
	Description *string        `json:"description"`
	Enabled     *bool          `json:"enabled"`
	Schedule    *string        `json:"schedule"`
	ScheduleSet bool           `json:"-"`
	Nodes       []WorkflowNode `json:"nodes"`
	Edges       []WorkflowEdge `json:"edges"`
}

type ExecuteWorkflowInput struct {
	Inputs      map[string]any `json:"inputs"`
	TriggeredBy string         `json:"triggeredBy"`
}

type ScheduleWorkflowInput struct {
	Schedule string `json:"schedule"`
}

type WorkflowExecution struct {
	ID          int            `json:"id"`
	WorkflowID  int            `json:"workflow_id"`
	Status      string         `json:"status"`
	StartedAt   time.Time      `json:"started_at"`
	CompletedAt *time.Time     `json:"completed_at"`
	TriggeredBy *string        `json:"triggered_by"`
	InputData   map[string]any `json:"input_data"`
	ResultData  map[string]any `json:"result_data"`
	ErrorMsg    *string        `json:"error_message"`
	CreatedAt   time.Time      `json:"created_at"`
}

type WorkflowNodeExecution struct {
	NodeID          string         `json:"node_id"`
	Status          string         `json:"status"`
	StartedAt       time.Time      `json:"started_at"`
	CompletedAt     *time.Time     `json:"completed_at"`
	ResultData      map[string]any `json:"result_data"`
	ErrorMessage    *string        `json:"error_message"`
	ExecutionTimeMS *int           `json:"execution_time_ms"`
}

type ExecutionResult struct {
	ExecutionID int            `json:"executionId"`
	Status      string         `json:"status"`
	Result      map[string]any `json:"result,omitempty"`
	Error       string         `json:"error,omitempty"`
}
