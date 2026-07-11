package pushnotifications

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves Expo push settings, token registry, and test send endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a push notifications Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

// RegisterProjectRoutes mounts dashboard (JWT + project access) routes.
func (h *Handler) RegisterProjectRoutes(mux *http.ServeMux) {
	base := "/api/communications/{projectId}/push"
	mux.HandleFunc("GET "+base+"/settings", h.GetSettings)
	mux.HandleFunc("PUT "+base+"/settings", h.UpdateSettings)
	mux.HandleFunc("GET "+base+"/tokens", h.ListTokens)
	mux.HandleFunc("POST "+base+"/test", h.TestSend)
}

// RegisterAppAPIRoutes mounts client (API key) routes.
func (h *Handler) RegisterAppAPIRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /app-api/communications/push/register", h.RegisterToken)
	mux.HandleFunc("DELETE /app-api/communications/push/unregister", h.UnregisterToken)
	mux.HandleFunc("POST /app-api/communications/push/send", h.Send)
	mux.HandleFunc("POST /app-api/communications/push/send-batch", h.SendBatch)
	// Also accept project-scoped paths used by some clients.
	mux.HandleFunc("POST /app-api/communications/{projectId}/push/register", h.RegisterToken)
	mux.HandleFunc("DELETE /app-api/communications/{projectId}/push/unregister", h.UnregisterToken)
	mux.HandleFunc("POST /app-api/communications/{projectId}/push/send", h.Send)
	mux.HandleFunc("POST /app-api/communications/{projectId}/push/send-batch", h.SendBatch)
}

func parseProjectID(w http.ResponseWriter, r *http.Request) (int, bool) {
	if authCtx := auth.GetAuthContext(r); authCtx != nil && authCtx.ProjectID > 0 {
		return authCtx.ProjectID, true
	}
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || id <= 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "Project ID is required"})
		return 0, false
	}
	return id, true
}

func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	settings, err := h.service.GetSettings(r.Context(), projectID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false, "error": "Failed to load push settings", "message": err.Error(),
		})
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Push settings retrieved successfully", settings)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body UpdateSettingsRequest
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	settings, err := h.service.UpdateSettings(r.Context(), projectID, body.IsActive)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false, "error": "Failed to update push settings", "message": err.Error(),
		})
		return
	}
	msg := "Push notifications paused"
	if settings.IsActive {
		msg = "Push notifications enabled"
	}
	httputil.WriteSuccess(w, http.StatusOK, msg, settings)
}

func (h *Handler) ListTokens(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	tokens, err := h.service.ListTokens(r.Context(), projectID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false, "error": "Failed to list push tokens", "message": err.Error(),
		})
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Push tokens listed successfully", tokens)
}

func (h *Handler) TestSend(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body TestPushRequest
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	result, err := h.service.TestSend(r.Context(), projectID, body)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Test push sent", result)
}

func (h *Handler) RegisterToken(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body RegisterTokenRequest
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	token, err := h.service.RegisterToken(r.Context(), projectID, body)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Push token registered", token)
}

func (h *Handler) UnregisterToken(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body UnregisterTokenRequest
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	deleted, err := h.service.UnregisterToken(r.Context(), projectID, body.ExpoPushToken)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Push token unregistered", map[string]any{"deleted": deleted})
}

func (h *Handler) Send(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body SendPushRequest
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	result, err := h.service.Send(r.Context(), projectID, body)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Push notifications sent", result)
}

func (h *Handler) SendBatch(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body BatchPushRequest
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	result, err := h.service.SendBatch(r.Context(), projectID, body)
	if err != nil {
		writeServiceError(w, err)
		return
	}
	httputil.WriteSuccess(w, http.StatusOK, "Push notifications sent", result)
}

func writeServiceError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrPushPaused):
		httputil.WriteJSON(w, http.StatusForbidden, map[string]any{
			"success": false,
			"error":   err.Error(),
			"message": "Push notifications are paused for this project",
		})
	case errors.Is(err, ErrInvalidToken):
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"success": false, "error": err.Error(),
		})
	case errors.Is(err, ErrNoTokens):
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{
			"success": false, "error": err.Error(),
		})
	default:
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"success": false, "error": err.Error(),
		})
	}
}
