package communications

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store handles provider and template DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new communications Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

func projectKey(projectID int) string {
	return fmt.Sprintf("%d", projectID)
}

func parseVariables(raw []byte) []string {
	if len(raw) == 0 {
		return []string{}
	}
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		return arr
	}
	var generic []any
	if err := json.Unmarshal(raw, &generic); err == nil {
		out := make([]string, 0, len(generic))
		for _, v := range generic {
			out = append(out, fmt.Sprintf("%v", v))
		}
		return out
	}
	return []string{}
}

func (s *Store) ListEmailProviders(ctx context.Context, projectID int) ([]EmailProvider, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user,
		       from_email, from_name, is_active, created_at, updated_at
		FROM public.skaftin_system_email_providers
		WHERE project_id = $1
		ORDER BY created_at DESC
	`, projectKey(projectID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]EmailProvider, 0)
	for rows.Next() {
		var p EmailProvider
		if err := rows.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.SMTPHost, &p.SMTPPort, &p.SMTPSecure, &p.SMTPUser, &p.FromEmail, &p.FromName, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetEmailProvider(ctx context.Context, projectID int, providerID int, includePassword bool) (*EmailProvider, error) {
	query := `
		SELECT id, project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user, %s,
		       from_email, from_name, is_active, created_at, updated_at
		FROM public.skaftin_system_email_providers
		WHERE id = $1 AND project_id = $2
	`
	passwordCol := "NULL::text"
	if includePassword {
		passwordCol = "smtp_password"
	}
	row := s.pool.QueryRow(ctx, fmt.Sprintf(query, passwordCol), providerID, projectKey(projectID))
	var p EmailProvider
	if err := row.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.SMTPHost, &p.SMTPPort, &p.SMTPSecure, &p.SMTPUser, &p.SMTPPassword, &p.FromEmail, &p.FromName, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (s *Store) CreateEmailProvider(ctx context.Context, projectID int, in EmailProvider) (*EmailProvider, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO public.skaftin_system_email_providers
		(project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
		RETURNING id, project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_active, created_at, updated_at
	`, projectKey(projectID), in.Name, in.ProviderType, in.SMTPHost, in.SMTPPort, in.SMTPSecure, in.SMTPUser, in.SMTPPassword, in.FromEmail, in.FromName, in.IsActive)
	var p EmailProvider
	if err := row.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.SMTPHost, &p.SMTPPort, &p.SMTPSecure, &p.SMTPUser, &p.FromEmail, &p.FromName, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *Store) UpdateEmailProvider(ctx context.Context, projectID, providerID int, fields map[string]any) (*EmailProvider, error) {
	set := make([]string, 0, len(fields)+1)
	args := make([]any, 0, len(fields)+2)
	i := 1
	for k, v := range fields {
		set = append(set, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, v)
		i++
	}
	set = append(set, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, providerID, projectKey(projectID))
	row := s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE public.skaftin_system_email_providers
		SET %s
		WHERE id = $%d AND project_id = $%d
		RETURNING id, project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_active, created_at, updated_at
	`, strings.Join(set, ", "), i, i+1), args...)
	var p EmailProvider
	if err := row.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.SMTPHost, &p.SMTPPort, &p.SMTPSecure, &p.SMTPUser, &p.FromEmail, &p.FromName, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (s *Store) DeleteEmailProvider(ctx context.Context, projectID, providerID int) (bool, error) {
	cmd, err := s.pool.Exec(ctx, "DELETE FROM public.skaftin_system_email_providers WHERE id = $1 AND project_id = $2", providerID, projectKey(projectID))
	if err != nil {
		return false, err
	}
	return cmd.RowsAffected() > 0, nil
}

func (s *Store) ListEmailTemplates(ctx context.Context, projectID int) ([]EmailTemplate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name, subject, html_content, text_content, variables, created_at, updated_at
		FROM public.skaftin_system_email_templates
		WHERE project_id = $1
		ORDER BY created_at DESC
	`, projectKey(projectID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]EmailTemplate, 0)
	for rows.Next() {
		var t EmailTemplate
		var varsRaw []byte
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Subject, &t.HTMLContent, &t.TextContent, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Variables = parseVariables(varsRaw)
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) GetEmailTemplate(ctx context.Context, projectID, templateID int) (*EmailTemplate, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, project_id, name, subject, html_content, text_content, variables, created_at, updated_at
		FROM public.skaftin_system_email_templates
		WHERE id = $1 AND project_id = $2
	`, templateID, projectKey(projectID))
	var t EmailTemplate
	var varsRaw []byte
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Subject, &t.HTMLContent, &t.TextContent, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.Variables = parseVariables(varsRaw)
	return &t, nil
}

func (s *Store) CreateEmailTemplate(ctx context.Context, projectID int, name, subject string, htmlContent, textContent *string, variables []string) (*EmailTemplate, error) {
	varsJSON, _ := json.Marshal(variables)
	row := s.pool.QueryRow(ctx, `
		INSERT INTO public.skaftin_system_email_templates (project_id, name, subject, html_content, text_content, variables)
		VALUES ($1,$2,$3,$4,$5,$6)
		RETURNING id, project_id, name, subject, html_content, text_content, variables, created_at, updated_at
	`, projectKey(projectID), name, subject, htmlContent, textContent, varsJSON)
	var t EmailTemplate
	var varsRaw []byte
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Subject, &t.HTMLContent, &t.TextContent, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, err
	}
	t.Variables = parseVariables(varsRaw)
	return &t, nil
}

func (s *Store) UpdateEmailTemplate(ctx context.Context, projectID, templateID int, fields map[string]any) (*EmailTemplate, error) {
	set := make([]string, 0, len(fields)+1)
	args := make([]any, 0, len(fields)+2)
	i := 1
	for k, v := range fields {
		set = append(set, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, v)
		i++
	}
	set = append(set, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, templateID, projectKey(projectID))
	row := s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE public.skaftin_system_email_templates
		SET %s
		WHERE id = $%d AND project_id = $%d
		RETURNING id, project_id, name, subject, html_content, text_content, variables, created_at, updated_at
	`, strings.Join(set, ", "), i, i+1), args...)
	var t EmailTemplate
	var varsRaw []byte
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Subject, &t.HTMLContent, &t.TextContent, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.Variables = parseVariables(varsRaw)
	return &t, nil
}

func (s *Store) DeleteEmailTemplate(ctx context.Context, projectID, templateID int) (bool, error) {
	cmd, err := s.pool.Exec(ctx, "DELETE FROM public.skaftin_system_email_templates WHERE id = $1 AND project_id = $2", templateID, projectKey(projectID))
	if err != nil {
		return false, err
	}
	return cmd.RowsAffected() > 0, nil
}

func (s *Store) ListSMSTemplates(ctx context.Context, projectID int) ([]SMSTemplate, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name, content, variables, created_at, updated_at
		FROM public.skaftin_system_sms_templates
		WHERE project_id = $1
		ORDER BY created_at DESC
	`, projectKey(projectID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]SMSTemplate, 0)
	for rows.Next() {
		var t SMSTemplate
		var varsRaw []byte
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Content, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		t.Variables = parseVariables(varsRaw)
		out = append(out, t)
	}
	return out, rows.Err()
}

func (s *Store) GetSMSTemplate(ctx context.Context, projectID, templateID int) (*SMSTemplate, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, project_id, name, content, variables, created_at, updated_at
		FROM public.skaftin_system_sms_templates
		WHERE id = $1 AND project_id = $2
	`, templateID, projectKey(projectID))
	var t SMSTemplate
	var varsRaw []byte
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Content, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.Variables = parseVariables(varsRaw)
	return &t, nil
}

func (s *Store) CreateSMSTemplate(ctx context.Context, projectID int, name, content string, variables []string) (*SMSTemplate, error) {
	varsJSON, _ := json.Marshal(variables)
	row := s.pool.QueryRow(ctx, `
		INSERT INTO public.skaftin_system_sms_templates (project_id, name, content, variables)
		VALUES ($1,$2,$3,$4)
		RETURNING id, project_id, name, content, variables, created_at, updated_at
	`, projectKey(projectID), name, content, varsJSON)
	var t SMSTemplate
	var varsRaw []byte
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Content, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, err
	}
	t.Variables = parseVariables(varsRaw)
	return &t, nil
}

func (s *Store) UpdateSMSTemplate(ctx context.Context, projectID, templateID int, fields map[string]any) (*SMSTemplate, error) {
	set := make([]string, 0, len(fields)+1)
	args := make([]any, 0, len(fields)+2)
	i := 1
	for k, v := range fields {
		set = append(set, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, v)
		i++
	}
	set = append(set, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, templateID, projectKey(projectID))
	row := s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE public.skaftin_system_sms_templates
		SET %s
		WHERE id = $%d AND project_id = $%d
		RETURNING id, project_id, name, content, variables, created_at, updated_at
	`, strings.Join(set, ", "), i, i+1), args...)
	var t SMSTemplate
	var varsRaw []byte
	if err := row.Scan(&t.ID, &t.ProjectID, &t.Name, &t.Content, &varsRaw, &t.CreatedAt, &t.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	t.Variables = parseVariables(varsRaw)
	return &t, nil
}

func (s *Store) DeleteSMSTemplate(ctx context.Context, projectID, templateID int) (bool, error) {
	cmd, err := s.pool.Exec(ctx, "DELETE FROM public.skaftin_system_sms_templates WHERE id = $1 AND project_id = $2", templateID, projectKey(projectID))
	if err != nil {
		return false, err
	}
	return cmd.RowsAffected() > 0, nil
}

func (s *Store) ListSMSProviders(ctx context.Context, projectID int) ([]SMSProvider, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name, provider_type, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active, created_at, updated_at
		FROM public.sms_providers
		WHERE project_id = $1
		ORDER BY created_at DESC
	`, projectKey(projectID))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]SMSProvider, 0)
	for rows.Next() {
		var p SMSProvider
		if err := rows.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.PostURL, &p.MessagingServiceSID, &p.PhoneNumber, &p.WhatsAppFrom, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetSMSProvider(ctx context.Context, projectID, providerID int, includeSecrets bool) (*SMSProvider, error) {
	secrets := "NULL::text, NULL::text"
	if includeSecrets {
		secrets = "api_key, api_secret"
	}
	row := s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT id, project_id, name, provider_type, %s, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active, created_at, updated_at
		FROM public.sms_providers
		WHERE id = $1 AND project_id = $2
	`, secrets), providerID, projectKey(projectID))
	var p SMSProvider
	if err := row.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.APIKey, &p.APISecret, &p.PostURL, &p.MessagingServiceSID, &p.PhoneNumber, &p.WhatsAppFrom, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (s *Store) CreateSMSProvider(ctx context.Context, projectID int, p SMSProvider) (*SMSProvider, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO public.sms_providers (project_id, name, provider_type, api_key, api_secret, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,COALESCE($10,true))
		RETURNING id, project_id, name, provider_type, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active, created_at, updated_at
	`, projectKey(projectID), p.Name, p.ProviderType, p.APIKey, p.APISecret, p.PostURL, p.MessagingServiceSID, p.PhoneNumber, p.WhatsAppFrom, p.IsActive)
	var out SMSProvider
	if err := row.Scan(&out.ID, &out.ProjectID, &out.Name, &out.ProviderType, &out.PostURL, &out.MessagingServiceSID, &out.PhoneNumber, &out.WhatsAppFrom, &out.IsActive, &out.CreatedAt, &out.UpdatedAt); err != nil {
		return nil, err
	}
	return &out, nil
}

func (s *Store) UpdateSMSProvider(ctx context.Context, projectID, providerID int, fields map[string]any) (*SMSProvider, error) {
	set := make([]string, 0, len(fields)+1)
	args := make([]any, 0, len(fields)+2)
	i := 1
	for k, v := range fields {
		set = append(set, fmt.Sprintf("%s = $%d", k, i))
		args = append(args, v)
		i++
	}
	set = append(set, "updated_at = CURRENT_TIMESTAMP")
	args = append(args, providerID, projectKey(projectID))
	row := s.pool.QueryRow(ctx, fmt.Sprintf(`
		UPDATE public.sms_providers
		SET %s
		WHERE id = $%d AND project_id = $%d
		RETURNING id, project_id, name, provider_type, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active, created_at, updated_at
	`, strings.Join(set, ", "), i, i+1), args...)
	var p SMSProvider
	if err := row.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.PostURL, &p.MessagingServiceSID, &p.PhoneNumber, &p.WhatsAppFrom, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}

func (s *Store) DeleteSMSProvider(ctx context.Context, projectID, providerID int) (bool, error) {
	cmd, err := s.pool.Exec(ctx, `DELETE FROM public.sms_providers WHERE id = $1 AND project_id = $2`, providerID, projectKey(projectID))
	if err != nil {
		return false, err
	}
	return cmd.RowsAffected() > 0, nil
}

func (s *Store) GetActiveSMSProvider(ctx context.Context, projectID int) (*SMSProvider, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, project_id, name, provider_type, api_key, api_secret, post_url, messaging_service_sid, phone_number, whatsapp_from, is_active, created_at, updated_at
		FROM public.sms_providers
		WHERE project_id = $1 AND is_active = true
		ORDER BY updated_at DESC, id DESC
		LIMIT 1
	`, projectKey(projectID))
	var p SMSProvider
	if err := row.Scan(&p.ID, &p.ProjectID, &p.Name, &p.ProviderType, &p.APIKey, &p.APISecret, &p.PostURL, &p.MessagingServiceSID, &p.PhoneNumber, &p.WhatsAppFrom, &p.IsActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &p, nil
}
