package workflows

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves workflow engine endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new workflows Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

func (h *Handler) Service() *Service { return h.service }

func (h *Handler) SetScheduler(s *Scheduler) { h.service.SetScheduler(s) }

// RegisterRoutes registers this domain's routes on the given mux.
// Called from server/routes.go.
func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/workflows/{projectId}", h.listWorkflows)
	mux.HandleFunc("GET /api/workflows/{projectId}/{workflowId}", h.getWorkflow)
	mux.HandleFunc("POST /api/workflows/{projectId}", h.createWorkflow)
	mux.HandleFunc("PUT /api/workflows/{projectId}/{workflowId}", h.updateWorkflow)
	mux.HandleFunc("DELETE /api/workflows/{projectId}/{workflowId}", h.deleteWorkflow)
	mux.HandleFunc("POST /api/workflows/{projectId}/{workflowId}/execute", h.executeWorkflow)
	mux.HandleFunc("GET /api/workflows/{projectId}/{workflowId}/executions", h.getWorkflowExecutions)
	mux.HandleFunc("GET /api/workflows/{projectId}/{workflowId}/executions/{executionId}/logs", h.getExecutionLogs)
	mux.HandleFunc("POST /api/workflows/{projectId}/{workflowId}/schedule", h.scheduleWorkflow)
	mux.HandleFunc("DELETE /api/workflows/{projectId}/{workflowId}/schedule", h.unscheduleWorkflow)
}

func (h *Handler) listWorkflows(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	items, err := h.service.ListWorkflows(r.Context(), pid)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to list workflows")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflows fetched successfully", items)
}

func (h *Handler) getWorkflow(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID and Workflow ID are required")
		return
	}
	workflow, err := h.service.GetWorkflow(r.Context(), pid, wid)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get workflow")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflow fetched successfully", workflow)
}

func (h *Handler) createWorkflow(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	var body CreateWorkflowInput
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Name == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Workflow name is required")
		return
	}
	if len(body.Nodes) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Workflow must have at least one node")
		return
	}
	userID := ""
	if u := auth.GetUserContext(r); u != nil {
		userID = u.UserID
	}
	workflow, err := h.service.CreateWorkflow(r.Context(), pid, userID, body)
	if err != nil {
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to create workflow")
		return
	}
	httputil.WriteSuccess(w, http.StatusCreated, "Workflow created successfully", workflow)
}

func (h *Handler) updateWorkflow(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID and Workflow ID are required")
		return
	}
	var raw map[string]any
	if err := httputil.DecodeBody(r, &raw); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	in := UpdateWorkflowInput{}
	if v, ok := raw["name"].(string); ok {
		in.Name = &v
	}
	if v, ok := raw["description"].(string); ok {
		in.Description = &v
	}
	if v, ok := raw["enabled"].(bool); ok {
		in.Enabled = &v
	}
	if _, found := raw["schedule"]; found {
		in.ScheduleSet = true
		if raw["schedule"] == nil {
			in.Schedule = nil
		} else if v, ok := raw["schedule"].(string); ok {
			s := v
			in.Schedule = &s
		}
	}
	if v, ok := raw["nodes"]; ok {
		b, _ := jsonMarshal(v)
		_ = jsonUnmarshal(b, &in.Nodes)
	}
	if v, ok := raw["edges"]; ok {
		b, _ := jsonMarshal(v)
		_ = jsonUnmarshal(b, &in.Edges)
	}
	workflow, err := h.service.UpdateWorkflow(r.Context(), pid, wid, in)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to update workflow")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflow updated successfully", workflow)
}

func (h *Handler) deleteWorkflow(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID and Workflow ID are required")
		return
	}
	if err := h.service.DeleteWorkflow(r.Context(), pid, wid); err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to delete workflow")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflow deleted successfully", map[string]any{"workflowId": wid})
}

func (h *Handler) executeWorkflow(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID and Workflow ID are required")
		return
	}
	var body ExecuteWorkflowInput
	_ = httputil.DecodeBody(r, &body)
	result, err := h.service.ExecuteWorkflow(r.Context(), pid, wid, body)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to execute workflow")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflow execution started", result)
}

func (h *Handler) getWorkflowExecutions(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID and Workflow ID are required")
		return
	}
	limit := httputil.IntQuery(r.URL.Query().Get("limit"), 50)
	offset := httputil.IntQuery(r.URL.Query().Get("offset"), 0)
	execs, err := h.service.ListExecutions(r.Context(), pid, wid, limit, offset)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get workflow executions")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflow executions fetched successfully", execs)
}

func (h *Handler) getExecutionLogs(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID, Workflow ID, and Execution ID are required")
		return
	}
	eid, ok := httputil.PathInt(r, "executionId")
	if !ok || eid <= 0 {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID, Workflow ID, and Execution ID are required")
		return
	}
	logs, err := h.service.GetExecutionLogs(r.Context(), pid, wid, eid)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Execution not found")
			return
		}
		if stringsContains(err.Error(), "does not belong") {
			httputil.WriteError(w, http.StatusNotFound, "Execution does not belong to this workflow")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "Failed to get execution logs")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Execution logs fetched successfully", logs)
}

func (h *Handler) scheduleWorkflow(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID and Workflow ID are required")
		return
	}
	var body ScheduleWorkflowInput
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if body.Schedule == "" {
		httputil.WriteError(w, http.StatusBadRequest, "Schedule (cron expression) is required")
		return
	}
	result, err := h.service.ScheduleWorkflow(r.Context(), pid, wid, body.Schedule)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		httputil.WriteError(w, http.StatusBadRequest, "Failed to schedule workflow")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflow scheduled successfully", result)
}

func (h *Handler) unscheduleWorkflow(w http.ResponseWriter, r *http.Request) {
	pid, ok := httputil.ProjectID(w, r)
	if !ok {
		return
	}
	wid, ok := parseWorkflowID(r)
	if !ok {
		httputil.WriteError(w, http.StatusBadRequest, "Project ID and Workflow ID are required")
		return
	}
	result, err := h.service.UnscheduleWorkflow(r.Context(), pid, wid)
	if err != nil {
		if err == pgx.ErrNoRows {
			httputil.WriteError(w, http.StatusNotFound, "Workflow not found")
			return
		}
		httputil.WriteError(w, http.StatusBadRequest, "Failed to unschedule workflow")
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Workflow unscheduled successfully", result)
}

func parseWorkflowID(r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("workflowId"))
	return id, err == nil && id > 0
}

func jsonMarshal(v any) ([]byte, error) {
	return json.Marshal(v)
}

func jsonUnmarshal(data []byte, out any) error {
	return json.Unmarshal(data, out)
}

func stringsContains(s, sub string) bool {
	return strings.Contains(s, sub)
}
