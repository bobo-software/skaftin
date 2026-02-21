package communications

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/pkg/httputil"
)

// Handler serves email and SMS communication endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new communications Handler.
func NewHandler(pool *pgxpool.Pool) *Handler {
	return &Handler{service: NewService(pool)}
}

func (h *Handler) RegisterProjectRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/communications/{projectId}/email/providers", h.ListEmailProviders)
	mux.HandleFunc("GET /api/communications/{projectId}/email/providers/{providerId}", h.GetEmailProvider)
	mux.HandleFunc("POST /api/communications/{projectId}/email/providers", h.CreateEmailProvider)
	mux.HandleFunc("PUT /api/communications/{projectId}/email/providers/{providerId}", h.UpdateEmailProvider)
	mux.HandleFunc("DELETE /api/communications/{projectId}/email/providers/{providerId}", h.DeleteEmailProvider)
	mux.HandleFunc("POST /api/communications/{projectId}/email/providers/{providerId}/test", h.TestEmailProvider)
	mux.HandleFunc("POST /api/communications/{projectId}/email/send", h.SendEmail)

	mux.HandleFunc("GET /api/communications/{projectId}/email/templates", h.ListEmailTemplates)
	mux.HandleFunc("GET /api/communications/{projectId}/email/templates/{templateId}", h.GetEmailTemplate)
	mux.HandleFunc("POST /api/communications/{projectId}/email/templates", h.CreateEmailTemplate)
	mux.HandleFunc("PUT /api/communications/{projectId}/email/templates/{templateId}", h.UpdateEmailTemplate)
	mux.HandleFunc("DELETE /api/communications/{projectId}/email/templates/{templateId}", h.DeleteEmailTemplate)

	mux.HandleFunc("GET /api/communications/{projectId}/sms/templates", h.ListSMSTemplates)
	mux.HandleFunc("GET /api/communications/{projectId}/sms/templates/{templateId}", h.GetSMSTemplate)
	mux.HandleFunc("POST /api/communications/{projectId}/sms/templates", h.CreateSMSTemplate)
	mux.HandleFunc("PUT /api/communications/{projectId}/sms/templates/{templateId}", h.UpdateSMSTemplate)
	mux.HandleFunc("DELETE /api/communications/{projectId}/sms/templates/{templateId}", h.DeleteSMSTemplate)

	mux.HandleFunc("GET /api/communications/{projectId}/sms/providers", h.ListSMSProviders)
	mux.HandleFunc("GET /api/communications/{projectId}/sms/providers/{providerId}", h.GetSMSProvider)
	mux.HandleFunc("POST /api/communications/{projectId}/sms/providers", h.CreateSMSProvider)
	mux.HandleFunc("PUT /api/communications/{projectId}/sms/providers/{providerId}", h.UpdateSMSProvider)
	mux.HandleFunc("DELETE /api/communications/{projectId}/sms/providers/{providerId}", h.DeleteSMSProvider)

	mux.HandleFunc("POST /api/communications/{projectId}/sms/send", h.SendSMS)
	mux.HandleFunc("POST /api/communications/{projectId}/sms/send-basic", h.SendSMSBasic)
	mux.HandleFunc("POST /api/communications/{projectId}/sms/check-status", h.CheckSMSStatus)

	mux.HandleFunc("POST /api/communications/{projectId}/whatsapp/send", h.SendWhatsApp)
	mux.HandleFunc("POST /api/communications/{projectId}/whatsapp/send-basic", h.SendWhatsAppBasic)
	mux.HandleFunc("POST /api/communications/{projectId}/whatsapp/template", h.SendWhatsAppTemplate)
}

func (h *Handler) RegisterPublicRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/communications/{projectId}/sms/webhook", h.SMSWebhook)
}

func parseProjectID(w http.ResponseWriter, r *http.Request) (int, bool) {
	id, err := strconv.Atoi(r.PathValue("projectId"))
	if err != nil || id <= 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": "Project ID is required"})
		return 0, false
	}
	return id, true
}

func parseIntPath(w http.ResponseWriter, r *http.Request, name, errMsg string) (int, bool) {
	v, err := strconv.Atoi(r.PathValue(name))
	if err != nil || v <= 0 {
		httputil.WriteJSON(w, http.StatusBadRequest, map[string]any{"success": false, "error": errMsg})
		return 0, false
	}
	return v, true
}

func isUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}

func (h *Handler) ListEmailProviders(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	data, err := h.service.ListEmailProviders(r.Context(), projectID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to list email providers", "message": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data, "count": len(data)})
}

func (h *Handler) GetEmailProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := parseIntPath(w, r, "providerId", "Invalid provider ID")
	if !ok {
		return
	}
	p, err := h.service.GetEmailProvider(r.Context(), projectID, providerID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to get email provider", "message": err.Error()})
		return
	}
	if p == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Email provider not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": p})
}

func (h *Handler) CreateEmailProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req EmailProvider
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.Name == "" || req.ProviderType == "" || req.SMTPHost == "" || req.SMTPPort == 0 || req.SMTPUser == "" || req.SMTPPassword == "" || req.FromEmail == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Missing required fields"})
		return
	}
	if req.IsActive == false {
		// keep explicit false when set, otherwise default true
	} else {
		req.IsActive = true
	}
	created, err := h.service.CreateEmailProvider(r.Context(), projectID, req)
	if err != nil {
		if isUniqueViolation(err) {
			httputil.WriteJSON(w, 409, map[string]any{"success": false, "error": "Email provider with this name already exists for this project"})
			return
		}
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to create email provider", "message": err.Error()})
		return
	}
	httputil.WriteJSON(w, 201, map[string]any{"success": true, "data": created, "message": "Email provider created successfully"})
}

func (h *Handler) UpdateEmailProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := parseIntPath(w, r, "providerId", "Invalid provider ID")
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	columnMap := map[string]string{
		"name":          "name",
		"provider_type": "provider_type",
		"smtp_host":     "smtp_host",
		"smtp_port":     "smtp_port",
		"smtp_secure":   "smtp_secure",
		"smtp_user":     "smtp_user",
		"smtp_password": "smtp_password",
		"from_email":    "from_email",
		"from_name":     "from_name",
		"is_active":     "is_active",
	}
	fields := map[string]any{}
	for k, v := range body {
		if col, ok := columnMap[k]; ok {
			fields[col] = v
		}
	}
	if len(fields) == 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "No fields to update"})
		return
	}
	updated, err := h.service.UpdateEmailProvider(r.Context(), projectID, providerID, fields)
	if err != nil {
		if isUniqueViolation(err) {
			httputil.WriteJSON(w, 409, map[string]any{"success": false, "error": "Email provider with this name already exists for this project"})
			return
		}
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to update email provider", "message": err.Error()})
		return
	}
	if updated == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Email provider not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": updated, "message": "Email provider updated successfully"})
}

func (h *Handler) DeleteEmailProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := parseIntPath(w, r, "providerId", "Invalid provider ID")
	if !ok {
		return
	}
	deleted, err := h.service.DeleteEmailProvider(r.Context(), projectID, providerID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to delete email provider", "message": err.Error()})
		return
	}
	if !deleted {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Email provider not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "message": "Email provider deleted successfully"})
}

func (h *Handler) TestEmailProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := parseIntPath(w, r, "providerId", "Invalid provider ID")
	if !ok {
		return
	}
	var body struct {
		TestEmail string `json:"test_email"`
	}
	_ = httputil.DecodeBody(r, &body)

	okConn, err := h.service.TestEmailProvider(r.Context(), projectID, providerID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Connection failed", "message": err.Error()})
		return
	}
	if okConn {
		if body.TestEmail != "" {
			_, sendErr := h.service.SendEmail(r.Context(), projectID, providerID, []string{body.TestEmail}, nil, nil, "Test Email", "Connection test successful", "<p>Connection test successful</p>", nil)
			if sendErr != nil {
				httputil.WriteJSON(w, 500, map[string]any{
					"success": false,
					"error":   "Connection failed",
					"message": sendErr.Error(),
				})
				return
			}
			httputil.WriteJSON(w, 200, map[string]any{
				"success":   true,
				"message":   "Connection successful and test email sent to " + body.TestEmail,
				"emailSent": true,
			})
			return
		}
		httputil.WriteJSON(w, 200, map[string]any{"success": true, "message": "Connection successful", "emailSent": false})
		return
	}
	httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Connection failed"})
}

func (h *Handler) SendEmail(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		ProviderID  int               `json:"provider_id"`
		To          any               `json:"to"`
		Subject     string            `json:"subject"`
		Text        string            `json:"text"`
		HTML        string            `json:"html"`
		CC          any               `json:"cc"`
		BCC         any               `json:"bcc"`
		Attachments []EmailAttachment `json:"attachments"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	var to []string
	switch t := req.To.(type) {
	case string:
		to = []string{t}
	case []any:
		for _, v := range t {
			if s, ok := v.(string); ok {
				to = append(to, s)
			}
		}
	}
	normalizeStringList := func(v any) []string {
		switch t := v.(type) {
		case string:
			if t == "" {
				return nil
			}
			return []string{t}
		case []any:
			out := make([]string, 0, len(t))
			for _, item := range t {
				if s, ok := item.(string); ok && s != "" {
					out = append(out, s)
				}
			}
			return out
		default:
			return nil
		}
	}

	cc := normalizeStringList(req.CC)
	bcc := normalizeStringList(req.BCC)

	if req.ProviderID == 0 || len(to) == 0 || req.Subject == "" || (req.Text == "" && req.HTML == "") {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Missing required fields: provider_id, to, subject, and either text or html"})
		return
	}
	data, err := h.service.SendEmail(r.Context(), projectID, req.ProviderID, to, cc, bcc, req.Subject, req.Text, req.HTML, req.Attachments)
	if err != nil {
		msg := err.Error()
		if msg == "Email provider not found" {
			httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": msg})
			return
		}
		if msg == "Email provider is not active" {
			httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": msg})
			return
		}
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to send email", "message": msg})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "message": "Email sent successfully", "data": data})
}

func (h *Handler) ListEmailTemplates(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	data, err := h.service.ListEmailTemplates(r.Context(), projectID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to list email templates", "message": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data, "count": len(data)})
}

func (h *Handler) GetEmailTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	templateID, ok := parseIntPath(w, r, "templateId", "Invalid template ID")
	if !ok {
		return
	}
	data, err := h.service.GetEmailTemplate(r.Context(), projectID, templateID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to get email template", "message": err.Error()})
		return
	}
	if data == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Email template not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) CreateEmailTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Name        string   `json:"name"`
		Subject     string   `json:"subject"`
		HTMLContent *string  `json:"html_content"`
		TextContent *string  `json:"text_content"`
		Variables   []string `json:"variables"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.Name == "" || req.Subject == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Name and subject are required"})
		return
	}
	data, err := h.service.CreateEmailTemplate(r.Context(), projectID, req.Name, req.Subject, req.HTMLContent, req.TextContent, req.Variables)
	if err != nil {
		if isUniqueViolation(err) {
			httputil.WriteJSON(w, 409, map[string]any{"success": false, "error": "Email template with this name already exists"})
			return
		}
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to create email template", "message": err.Error()})
		return
	}
	httputil.WriteJSON(w, 201, map[string]any{"success": true, "data": data})
}

func (h *Handler) UpdateEmailTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	templateID, ok := parseIntPath(w, r, "templateId", "Invalid template ID")
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	mapper := map[string]string{"name": "name", "subject": "subject", "html_content": "html_content", "text_content": "text_content", "variables": "variables"}
	fields := map[string]any{}
	for k, v := range body {
		if col, ok := mapper[k]; ok {
			fields[col] = v
		}
	}
	if len(fields) == 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "No fields to update"})
		return
	}
	if vars, ok := fields["variables"]; ok {
		if arr, ok := vars.([]any); ok {
			out := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					out = append(out, s)
				}
			}
			fields["variables"] = out
		}
	}
	data, err := h.service.UpdateEmailTemplate(r.Context(), projectID, templateID, fields)
	if err != nil {
		if isUniqueViolation(err) {
			httputil.WriteJSON(w, 409, map[string]any{"success": false, "error": "Email template with this name already exists"})
			return
		}
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to update email template", "message": err.Error()})
		return
	}
	if data == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Email template not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) DeleteEmailTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	templateID, ok := parseIntPath(w, r, "templateId", "Invalid template ID")
	if !ok {
		return
	}
	deleted, err := h.service.DeleteEmailTemplate(r.Context(), projectID, templateID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to delete email template", "message": err.Error()})
		return
	}
	if !deleted {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "Email template not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "message": "Email template deleted successfully"})
}

func (h *Handler) ListSMSTemplates(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	data, err := h.service.ListSMSTemplates(r.Context(), projectID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to list SMS templates", "message": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data, "count": len(data)})
}

func (h *Handler) GetSMSTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	templateID, ok := parseIntPath(w, r, "templateId", "Invalid template ID")
	if !ok {
		return
	}
	data, err := h.service.GetSMSTemplate(r.Context(), projectID, templateID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to get SMS template", "message": err.Error()})
		return
	}
	if data == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "SMS template not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) CreateSMSTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Name      string   `json:"name"`
		Content   string   `json:"content"`
		Variables []string `json:"variables"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.Name == "" || req.Content == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Name and content are required"})
		return
	}
	data, err := h.service.CreateSMSTemplate(r.Context(), projectID, req.Name, req.Content, req.Variables)
	if err != nil {
		if isUniqueViolation(err) {
			httputil.WriteJSON(w, 409, map[string]any{"success": false, "error": "SMS template with this name already exists"})
			return
		}
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to create SMS template", "message": err.Error()})
		return
	}
	httputil.WriteJSON(w, 201, map[string]any{"success": true, "data": data})
}

func (h *Handler) UpdateSMSTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	templateID, ok := parseIntPath(w, r, "templateId", "Invalid template ID")
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	mapper := map[string]string{"name": "name", "content": "content", "variables": "variables"}
	fields := map[string]any{}
	for k, v := range body {
		if col, ok := mapper[k]; ok {
			fields[col] = v
		}
	}
	if len(fields) == 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "No fields to update"})
		return
	}
	if vars, ok := fields["variables"]; ok {
		if arr, ok := vars.([]any); ok {
			out := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					out = append(out, s)
				}
			}
			fields["variables"] = out
		}
	}
	data, err := h.service.UpdateSMSTemplate(r.Context(), projectID, templateID, fields)
	if err != nil {
		if isUniqueViolation(err) {
			httputil.WriteJSON(w, 409, map[string]any{"success": false, "error": "SMS template with this name already exists"})
			return
		}
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to update SMS template", "message": err.Error()})
		return
	}
	if data == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "SMS template not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) DeleteSMSTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	templateID, ok := parseIntPath(w, r, "templateId", "Invalid template ID")
	if !ok {
		return
	}
	deleted, err := h.service.DeleteSMSTemplate(r.Context(), projectID, templateID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": "Failed to delete SMS template", "message": err.Error()})
		return
	}
	if !deleted {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "SMS template not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "message": "SMS template deleted successfully"})
}

func (h *Handler) ListSMSProviders(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	data, err := h.service.ListSMSProviders(r.Context(), projectID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) GetSMSProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := parseIntPath(w, r, "providerId", "Invalid provider ID")
	if !ok {
		return
	}
	data, err := h.service.GetSMSProvider(r.Context(), projectID, providerID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	if data == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "SMS provider not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) CreateSMSProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req SMSProvider
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.Name == "" || req.ProviderType == "" || req.APIKey == nil || req.APISecret == nil {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Missing required fields: name, provider_type, api_key, api_secret"})
		return
	}
	if req.ProviderType != "twilio" && (req.PostURL == nil || *req.PostURL == "") {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Missing required field: post_url (required for non-Twilio providers)"})
		return
	}
	if req.ProviderType == "twilio" && (req.MessagingServiceSID == nil || *req.MessagingServiceSID == "") && (req.PhoneNumber == nil || *req.PhoneNumber == "") {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "Twilio requires either messaging_service_sid or phone_number"})
		return
	}
	created, err := h.service.CreateSMSProvider(r.Context(), projectID, req)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 201, map[string]any{"success": true, "data": created})
}

func (h *Handler) UpdateSMSProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := parseIntPath(w, r, "providerId", "Invalid provider ID")
	if !ok {
		return
	}
	var body map[string]any
	if err := httputil.DecodeBody(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	allowed := map[string]bool{"name": true, "provider_type": true, "api_key": true, "api_secret": true, "post_url": true, "messaging_service_sid": true, "phone_number": true, "whatsapp_from": true, "is_active": true}
	fields := map[string]any{}
	for k, v := range body {
		if allowed[k] && v != nil && v != "" {
			fields[k] = v
		}
	}
	if len(fields) == 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "No fields to update"})
		return
	}
	updated, err := h.service.UpdateSMSProvider(r.Context(), projectID, providerID, fields)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	if updated == nil {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "SMS provider not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": updated})
}

func (h *Handler) DeleteSMSProvider(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	providerID, ok := parseIntPath(w, r, "providerId", "Invalid provider ID")
	if !ok {
		return
	}
	deleted, err := h.service.DeleteSMSProvider(r.Context(), projectID, providerID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	if !deleted {
		httputil.WriteJSON(w, 404, map[string]any{"success": false, "error": "SMS provider not found"})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true})
}

func (h *Handler) SendSMS(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Messages []SmsMessage `json:"messages"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if len(req.Messages) == 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "messages[] is required"})
		return
	}
	data, err := h.service.SendSMS(r.Context(), projectID, req.Messages)
	if err != nil {
		httputil.WriteJSON(w, 502, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) SendSMSBasic(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Message     string `json:"message"`
		Destination string `json:"destination"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.Message == "" || req.Destination == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "message and destination are required"})
		return
	}
	data, err := h.service.SendSMS(r.Context(), projectID, []SmsMessage{{Content: req.Message, Destination: req.Destination}})
	if err != nil {
		httputil.WriteJSON(w, 502, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) SMSWebhook(w http.ResponseWriter, r *http.Request) {
	httputil.WriteJSON(w, 200, map[string]any{"success": true})
}

func (h *Handler) SendWhatsApp(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Messages []SmsMessage `json:"messages"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if len(req.Messages) == 0 {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "messages[] is required"})
		return
	}
	data, err := h.service.SendWhatsApp(r.Context(), projectID, req.Messages)
	if err != nil {
		httputil.WriteJSON(w, 502, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) SendWhatsAppBasic(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Message     string `json:"message"`
		Destination string `json:"destination"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.Message == "" || req.Destination == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "message and destination are required"})
		return
	}
	data, err := h.service.SendWhatsApp(r.Context(), projectID, []SmsMessage{{Content: req.Message, Destination: req.Destination}})
	if err != nil {
		httputil.WriteJSON(w, 502, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) SendWhatsAppTemplate(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		Phone            string         `json:"phone"`
		ContentSID       string         `json:"contentSid"`
		ContentVariables map[string]any `json:"contentVariables"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.Phone == "" || req.ContentSID == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "phone and contentSid are required"})
		return
	}
	data, err := h.service.SendWhatsAppTemplate(r.Context(), projectID, WhatsAppTemplateMessage{
		Destination:      req.Phone,
		ContentSID:       req.ContentSID,
		ContentVariables: req.ContentVariables,
	})
	if err != nil {
		httputil.WriteJSON(w, 502, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}

func (h *Handler) CheckSMSStatus(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var req struct {
		MessageSID string `json:"messageSid"`
	}
	if err := httputil.DecodeBody(r, &req); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if req.MessageSID == "" {
		httputil.WriteJSON(w, 400, map[string]any{"success": false, "error": "messageSid is required"})
		return
	}
	data, err := h.service.GetMessageStatus(r.Context(), projectID, req.MessageSID)
	if err != nil {
		httputil.WriteJSON(w, 500, map[string]any{"success": false, "error": err.Error()})
		return
	}
	httputil.WriteJSON(w, 200, map[string]any{"success": true, "data": data})
}
