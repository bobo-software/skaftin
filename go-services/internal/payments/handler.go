package payments

import (
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/auth"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves payment provider endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new payments Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

func (h *Handler) RegisterSessionRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/payments/handle_fnb_payment", h.HandleFNBPayment)
}

func (h *Handler) RegisterProjectRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/payments/{projectId}/providers", h.ListProviders)
	mux.HandleFunc("GET /api/payments/{projectId}/providers/{providerId}", h.GetProvider)
	mux.HandleFunc("POST /api/payments/{projectId}/providers", h.CreateProvider)
	mux.HandleFunc("PUT /api/payments/{projectId}/providers/{providerId}", h.UpdateProvider)
	mux.HandleFunc("DELETE /api/payments/{projectId}/providers/{providerId}", h.DeleteProvider)
	mux.HandleFunc("POST /api/payments/{projectId}/providers/{providerId}/test", h.TestProvider)
	mux.HandleFunc("GET /api/payments/{projectId}/transactions", h.ListTransactions)
	mux.HandleFunc("GET /api/payments/{projectId}/transactions/{transactionId}", h.GetTransaction)
}

func (h *Handler) RegisterWebhookRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/payments/webhook/payfast/{projectId}", h.PayFastWebhook)
	mux.HandleFunc("POST /api/payments/webhook/{providerType}/{projectId}", h.GenericWebhook)
}

func (h *Handler) ListProviders(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providers, err := h.service.ListProviders(r.Context(), projectID)
	if err != nil {
		slog.Error("failed to list providers", "error", err, "projectId", projectID)
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to list payment providers",
			"message": err.Error(),
		})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    providers,
		"count":   len(providers),
	})
}

func (h *Handler) GetProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := httputil.PathInt(r, "providerId")
	if !ok {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "Invalid project ID or provider ID"})
		return
	}
	provider, err := h.service.GetProvider(r.Context(), projectID, providerID)
	if err != nil {
		slog.Error("failed to get provider", "error", err, "projectId", projectID, "providerId", providerID)
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to get payment provider",
			"message": err.Error(),
		})
		return
	}
	if provider == nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{"success": false, "error": "Payment provider not found"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "data": provider})
}

func (h *Handler) CreateProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Name         string         `json:"name"`
		ProviderType ProviderType   `json:"provider_type"`
		MerchantID   *string        `json:"merchant_id"`
		MerchantKey  *string        `json:"merchant_key"`
		Passphrase   *string        `json:"passphrase"`
		APIKey       *string        `json:"api_key"`
		APISecret    *string        `json:"api_secret"`
		PublicKey    *string        `json:"public_key"`
		ReturnURL    *string        `json:"return_url"`
		CancelURL    *string        `json:"cancel_url"`
		NotifyURL    *string        `json:"notify_url"`
		SandboxMode  *bool          `json:"sandbox_mode"`
		IsActive     *bool          `json:"is_active"`
		Metadata     map[string]any `json:"metadata"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Name == "" || req.ProviderType == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"error":   "Missing required fields: name and provider_type are required",
		})
		return
	}
	if req.ProviderType != ProviderTypePayFast && req.ProviderType != ProviderTypeFNBPay {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"error":   "Invalid provider_type. Must be one of: payfast, fnb_pay",
		})
		return
	}

	created, err := h.service.CreateProvider(r.Context(), CreateProviderRequest{
		ProjectID:    projectID,
		Name:         req.Name,
		ProviderType: req.ProviderType,
		MerchantID:   req.MerchantID,
		MerchantKey:  req.MerchantKey,
		Passphrase:   req.Passphrase,
		APIKey:       req.APIKey,
		APISecret:    req.APISecret,
		PublicKey:    req.PublicKey,
		ReturnURL:    req.ReturnURL,
		CancelURL:    req.CancelURL,
		NotifyURL:    req.NotifyURL,
		SandboxMode:  req.SandboxMode,
		IsActive:     req.IsActive,
		Metadata:     req.Metadata,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httputil.WriteJSON(w, http.StatusConflict, map[string]any{
				"success": false,
				"error":   "A payment provider with this name already exists for this project",
			})
			return
		}
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to create payment provider",
			"message": err.Error(),
		})
		return
	}
	httputil.WriteJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"data":    created,
		"message": "Payment provider created successfully",
	})
}

func (h *Handler) UpdateProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := httputil.PathInt(r, "providerId")
	if !ok {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "Invalid project ID or provider ID"})
		return
	}

	var req struct {
		Name        *string        `json:"name"`
		MerchantID  *string        `json:"merchant_id"`
		MerchantKey *string        `json:"merchant_key"`
		Passphrase  *string        `json:"passphrase"`
		APIKey      *string        `json:"api_key"`
		APISecret   *string        `json:"api_secret"`
		PublicKey   *string        `json:"public_key"`
		ReturnURL   *string        `json:"return_url"`
		CancelURL   *string        `json:"cancel_url"`
		NotifyURL   *string        `json:"notify_url"`
		SandboxMode *bool          `json:"sandbox_mode"`
		IsActive    *bool          `json:"is_active"`
		Metadata    map[string]any `json:"metadata"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	updated, err := h.service.UpdateProvider(r.Context(), projectID, providerID, UpdateProviderRequest{
		Name:        req.Name,
		MerchantID:  req.MerchantID,
		MerchantKey: req.MerchantKey,
		Passphrase:  req.Passphrase,
		APIKey:      req.APIKey,
		APISecret:   req.APISecret,
		PublicKey:   req.PublicKey,
		ReturnURL:   req.ReturnURL,
		CancelURL:   req.CancelURL,
		NotifyURL:   req.NotifyURL,
		SandboxMode: req.SandboxMode,
		IsActive:    req.IsActive,
		Metadata:    req.Metadata,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httputil.WriteJSON(w, http.StatusConflict, map[string]any{
				"success": false,
				"error":   "A payment provider with this name already exists for this project",
			})
			return
		}
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to update payment provider",
			"message": err.Error(),
		})
		return
	}
	if updated == nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{"success": false, "error": "Payment provider not found"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    updated,
		"message": "Payment provider updated successfully",
	})
}

func (h *Handler) DeleteProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := httputil.PathInt(r, "providerId")
	if !ok {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "Invalid project ID or provider ID"})
		return
	}
	deleted, err := h.service.DeleteProvider(r.Context(), projectID, providerID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to delete payment provider",
			"message": err.Error(),
		})
		return
	}
	if !deleted {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{"success": false, "error": "Payment provider not found"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "message": "Payment provider deleted successfully"})
}

func (h *Handler) TestProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := httputil.PathInt(r, "providerId")
	if !ok {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "Invalid project ID or provider ID"})
		return
	}
	result, err := h.service.TestProvider(r.Context(), projectID, providerID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to test payment provider",
			"message": err.Error(),
		})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, result)
}

func (h *Handler) ListTransactions(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	q := r.URL.Query()
	var startDate *time.Time
	var endDate *time.Time
	if v := q.Get("start_date"); v != "" {
		if parsed, err := time.Parse(time.RFC3339, v); err == nil {
			startDate = &parsed
		}
	}
	if v := q.Get("end_date"); v != "" {
		if parsed, err := time.Parse(time.RFC3339, v); err == nil {
			endDate = &parsed
		}
	}
	opts := TransactionListOptions{
		Status:      q.Get("status"),
		PaymentType: q.Get("payment_type"),
		Limit:       httputil.IntQuery(q.Get("limit"), 0),
		Offset:      httputil.IntQuery(q.Get("offset"), 0),
		StartDate:   startDate,
		EndDate:     endDate,
	}
	transactions, total, err := h.service.ListTransactions(r.Context(), projectID, opts)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to list transactions",
			"message": err.Error(),
		})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"data":    transactions,
		"total":   total,
		"count":   len(transactions),
	})
}

func (h *Handler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	transactionID := r.PathValue("transactionId")
	if transactionID == "" {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "Transaction ID is required"})
		return
	}
	tx, err := h.service.GetTransaction(r.Context(), projectID, transactionID)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success": false,
			"error":   "Failed to get transaction",
			"message": err.Error(),
		})
		return
	}
	if tx == nil {
		httputil.WriteJSON(w, http.StatusNotFound, map[string]any{"success": false, "error": "Transaction not found"})
		return
	}
	httputil.WriteJSON(w, http.StatusOK, map[string]any{"success": true, "data": tx})
}

func (h *Handler) HandleFNBPayment(w http.ResponseWriter, r *http.Request) {
	user := auth.RequireUser(w, r)
	if user == nil {
		return
	}
	var req struct {
		ProjectID   any     `json:"project_id"`
		ProviderID  *int    `json:"provider_id"`
		Description string  `json:"description"`
		Amount      float64 `json:"amount"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	projectID, err := normalizeProjectID(req.ProjectID)
	if err != nil || projectID <= 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"success":   false,
			"message":   "project_id (positive integer) is required",
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		})
		return
	}

	var provider *PaymentProviderRecord
	if req.ProviderID != nil {
		provider, err = h.service.GetProvider(r.Context(), projectID, *req.ProviderID)
	} else {
		provider, err = h.service.GetProviderByType(r.Context(), projectID, ProviderTypeFNBPay)
	}
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success":   false,
			"message":   err.Error(),
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		})
		return
	}
	if provider == nil || provider.ProviderType != ProviderTypeFNBPay {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"success":   false,
			"message":   "No active FNB payment provider found for this project. Add an FNB provider in the dashboard.",
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		})
		return
	}

	config := FNBProviderConfig{
		BaseURL:   stringMetadata(provider.Metadata, "fnb_base_url"),
		APIKey3D:  stringMetadata(provider.Metadata, "fnb_api_key_3d"),
		APIInst3D: stringMetadata(provider.Metadata, "fnb_api_inst_3d"),
		SecretKey: stringMetadata(provider.Metadata, "fnb_secret_key"),
	}
	if provider.ReturnURL != nil {
		config.ReturnURL = *provider.ReturnURL
	}

	result, err := h.service.InitiateFNBPayment(r.Context(), user.UserID, req.Description, req.Amount, config)
	if err != nil {
		httputil.WriteJSON(w, http.StatusInternalServerError, map[string]any{
			"success":   false,
			"message":   err.Error(),
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		})
		return
	}

	if result.Success {
		httputil.WriteJSON(w, http.StatusOK, map[string]any{
			"success": true,
			"message": "Redirect to complete payment",
			"data": map[string]any{
				"url":       result.URL,
				"reference": result.Reference,
			},
			"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
		})
		return
	}

	status := http.StatusInternalServerError
	switch result.Code {
	case "DUPLICATE":
		status = http.StatusConflict
	case "VALIDATION_ERROR":
		status = http.StatusBadRequest
	case "CONFIG_ERROR":
		status = http.StatusBadRequest
	}
	httputil.WriteJSON(w, status, map[string]any{
		"success":   false,
		"message":   result.Error,
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func normalizeProjectID(v any) (int, error) {
	switch t := v.(type) {
	case float64:
		return int(t), nil
	case int:
		return t, nil
	case string:
		return strconv.Atoi(t)
	default:
		return 0, errors.New("invalid project_id")
	}
}

func stringMetadata(metadata map[string]any, key string) string {
	if metadata == nil {
		return ""
	}
	if v, ok := metadata[key].(string); ok {
		return v
	}
	return ""
}

func (h *Handler) PayFastWebhook(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || projectID <= 0 {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}

	rawBody, err := io.ReadAll(io.LimitReader(r.Body, 1<<20))
	if err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	parsed := map[string]string{}
	values, err := url.ParseQuery(string(rawBody))
	if err == nil {
		for k, vv := range values {
			if len(vv) > 0 {
				parsed[k] = vv[0]
			}
		}
	}
	if len(parsed) == 0 {
		_ = r.ParseForm()
		for k, vv := range r.Form {
			if len(vv) > 0 {
				parsed[k] = vv[0]
			}
		}
	}
	if len(parsed) == 0 {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	result, err := h.service.ProcessWebhook(r.Context(), projectID, ProviderTypePayFast, string(rawBody), parsed)
	if err != nil {
		slog.Error("failed to process PayFast webhook", "error", err, "projectId", projectID)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if result.Valid {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
		return
	}
	http.Error(w, result.Error, http.StatusBadRequest)
}

func (h *Handler) GenericWebhook(w http.ResponseWriter, r *http.Request) {
	providerType := r.PathValue("providerType")
	projectIDStr := r.PathValue("projectId")
	if _, err := strconv.Atoi(projectIDStr); err != nil {
		http.Error(w, "Invalid project ID", http.StatusBadRequest)
		return
	}
	if providerType != string(ProviderTypeFNBPay) {
		http.Error(w, "Invalid provider type", http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}

func parseProjectID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || id <= 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{
			"success": false,
			"error":   "Invalid project ID",
		})
		return 0, false
	}
	return id, true
}
