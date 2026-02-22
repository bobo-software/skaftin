package authmanagement

import (
	"net/http"

	"github.com/skaftin/go-services/internal/pkg/httputil"
)

func (h *Handler) ListCustomFieldsHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	includeInactive := r.URL.Query().Get("include_inactive") == "true"
	fields, err := h.service.ListCustomFields(r.Context(), projectID, includeInactive)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Custom fields fetched successfully", fields)
}

func (h *Handler) GetCustomFieldHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	fieldID, ok := parsePathInt(r, "fieldId")
	if !ok {
		httputil.WriteError(w, 400, "Field ID is required")
		return
	}
	field, err := h.service.GetCustomField(r.Context(), projectID, fieldID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if field == nil {
		httputil.WriteError(w, 404, "Custom field not found")
		return
	}
	httputil.WriteSuccess(w, 200, "Custom field fetched successfully", field)
}

func (h *Handler) CreateCustomFieldHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	var body CustomField
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	if body.FieldName == "" || body.FieldLabel == "" || body.FieldType == "" {
		httputil.WriteError(w, 400, "field_name, field_label, and field_type are required")
		return
	}
	field, err := h.service.CreateCustomField(r.Context(), projectID, body)
	if err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 201, "Field created successfully", field)
}

func (h *Handler) UpdateCustomFieldHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	fieldID, ok := parsePathInt(r, "fieldId")
	if !ok {
		httputil.WriteError(w, 400, "Field ID is required")
		return
	}
	var body map[string]any
	if err := httputil.ReadJSON(r, &body); err != nil {
		httputil.WriteError(w, 400, "Invalid request body")
		return
	}
	allowed := map[string]bool{
		"field_label": true, "field_type": true, "is_required": true, "default_value": true,
		"options": true, "reference_table": true, "reference_column": true,
		"validation_rules": true, "display_order": true, "is_active": true,
	}
	fields := make(map[string]any)
	for k, v := range body {
		if allowed[k] {
			fields[k] = v
		}
	}
	field, err := h.service.UpdateCustomField(r.Context(), projectID, fieldID, fields)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Field updated successfully", field)
}

func (h *Handler) DeleteCustomFieldHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	fieldID, ok := parsePathInt(r, "fieldId")
	if !ok {
		httputil.WriteError(w, 400, "Field ID is required")
		return
	}
	permanent := r.URL.Query().Get("permanent") == "true"
	field, err := h.service.DeleteCustomField(r.Context(), projectID, fieldID, permanent)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	if field == nil {
		httputil.WriteError(w, 404, "Custom field not found")
		return
	}
	httputil.WriteSuccess(w, 200, "Custom field deleted", field)
}

func (h *Handler) ApplyCustomFieldHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	fieldID, ok := parsePathInt(r, "fieldId")
	if !ok {
		httputil.WriteError(w, 400, "Field ID is required")
		return
	}
	if err := h.service.ApplyCustomField(r.Context(), projectID, fieldID); err != nil {
		httputil.WriteError(w, 400, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Custom field applied to users table", nil)
}

func (h *Handler) GetAvailableTablesHandler(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parseProjectID(w, r)
	if !ok {
		return
	}
	tables, err := h.service.GetAvailableTables(r.Context(), projectID)
	if err != nil {
		httputil.WriteError(w, 500, err.Error())
		return
	}
	httputil.WriteSuccess(w, 200, "Available tables fetched successfully", tables)
}
