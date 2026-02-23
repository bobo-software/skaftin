package mcp

import (
	"context"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
	sdkmcp "github.com/modelcontextprotocol/go-sdk/mcp"
)

func registerCommunicationsTools(srv *sdkmcp.Server, pool *pgxpool.Pool) {
	reg := &commsTools{pool: pool}

	srv.AddTool(makeTool("list_skaftin_system_email_providers", "List all email providers configured for a project", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.listEmailProviders)

	srv.AddTool(makeTool("get_email_provider", "Get a specific email provider by ID", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"providerId": {Type: "string", Desc: "Provider ID"},
	}, []string{"projectId", "providerId"}), reg.getEmailProvider)

	srv.AddTool(makeTool("create_email_provider", "Create a new email provider (SMTP configuration)", map[string]prop{
		"projectId":     {Type: "string", Desc: "Project ID"},
		"name":          {Type: "string", Desc: "Provider name"},
		"provider_type": {Type: "string", Desc: "Provider type: nodemailer or mailtrap"},
		"smtp_host":     {Type: "string", Desc: "SMTP host"},
		"smtp_port":     {Type: "number", Desc: "SMTP port"},
		"smtp_secure":   {Type: "boolean", Desc: "Use SSL/TLS"},
		"smtp_user":     {Type: "string", Desc: "SMTP username"},
		"smtp_password": {Type: "string", Desc: "SMTP password"},
		"from_email":    {Type: "string", Desc: "From email address"},
		"from_name":     {Type: "string", Desc: "From display name"},
		"is_active":     {Type: "boolean", Desc: "Active status (default: true)"},
	}, []string{"projectId", "name", "provider_type", "smtp_host", "smtp_port", "smtp_user", "smtp_password", "from_email"}), reg.createEmailProvider)

	srv.AddTool(makeTool("update_email_provider", "Update an email provider", map[string]prop{
		"projectId":     {Type: "string", Desc: "Project ID"},
		"providerId":    {Type: "string", Desc: "Provider ID"},
		"name":          {Type: "string", Desc: "Updated name"},
		"smtp_host":     {Type: "string", Desc: "Updated SMTP host"},
		"smtp_port":     {Type: "number", Desc: "Updated SMTP port"},
		"smtp_user":     {Type: "string", Desc: "Updated SMTP username"},
		"smtp_password": {Type: "string", Desc: "Updated SMTP password"},
		"from_email":    {Type: "string", Desc: "Updated from email"},
		"from_name":     {Type: "string", Desc: "Updated from name"},
		"is_active":     {Type: "boolean", Desc: "Active status"},
	}, []string{"projectId", "providerId"}), reg.updateEmailProvider)

	srv.AddTool(makeTool("delete_email_provider", "Delete an email provider", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"providerId": {Type: "string", Desc: "Provider ID"},
	}, []string{"projectId", "providerId"}), reg.deleteEmailProvider)

	srv.AddTool(makeTool("test_email_connection", "Test SMTP connection for an email provider", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"providerId": {Type: "string", Desc: "Provider ID"},
	}, []string{"projectId", "providerId"}), reg.testEmailConnection)

	srv.AddTool(makeTool("send_email", "Send an email using a configured provider", map[string]prop{
		"projectId":   {Type: "string", Desc: "Project ID"},
		"provider_id": {Type: "number", Desc: "Email provider ID"},
		"to":          {Type: "string", Desc: "Recipient email address"},
		"subject":     {Type: "string", Desc: "Email subject"},
		"text":        {Type: "string", Desc: "Plain text content"},
		"html":        {Type: "string", Desc: "HTML content"},
	}, []string{"projectId", "provider_id", "to", "subject"}), reg.sendEmail)

	srv.AddTool(makeTool("list_sms_providers", "List all SMS providers for a project", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
	}, []string{"projectId"}), reg.listSmsProviders)

	srv.AddTool(makeTool("get_sms_provider", "Get a specific SMS provider by ID", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"providerId": {Type: "string", Desc: "Provider ID"},
	}, []string{"projectId", "providerId"}), reg.getSmsProvider)

	srv.AddTool(makeTool("create_sms_provider", "Create a new SMS provider", map[string]prop{
		"projectId":     {Type: "string", Desc: "Project ID"},
		"name":          {Type: "string", Desc: "Provider name"},
		"provider_type": {Type: "string", Desc: "Type: mymobileapi, sa_mobile_sms, or twilio"},
		"api_key":       {Type: "string", Desc: "API Key or Account SID"},
		"api_secret":    {Type: "string", Desc: "API Secret or Auth Token"},
		"post_url":      {Type: "string", Desc: "POST URL (for MyMobileAPI/SA Mobile SMS)"},
		"phone_number":  {Type: "string", Desc: "From phone number (Twilio)"},
		"whatsapp_from": {Type: "string", Desc: "WhatsApp sender number (Twilio)"},
		"is_active":     {Type: "boolean", Desc: "Active status (default: true)"},
	}, []string{"projectId", "name", "provider_type", "api_key", "api_secret"}), reg.createSmsProvider)

	srv.AddTool(makeTool("update_sms_provider", "Update an SMS provider", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"providerId": {Type: "string", Desc: "Provider ID"},
		"name":       {Type: "string", Desc: "Updated name"},
		"api_key":    {Type: "string", Desc: "Updated API key"},
		"api_secret": {Type: "string", Desc: "Updated API secret"},
		"is_active":  {Type: "boolean", Desc: "Active status"},
	}, []string{"projectId", "providerId"}), reg.updateSmsProvider)

	srv.AddTool(makeTool("delete_sms_provider", "Delete an SMS provider", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"providerId": {Type: "string", Desc: "Provider ID"},
	}, []string{"projectId", "providerId"}), reg.deleteSmsProvider)

	srv.AddTool(makeTool("send_sms", "Send SMS messages using configured provider", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"messages":  {Type: "array", Desc: "Array of {content, destination} objects"},
	}, []string{"projectId", "messages"}), reg.sendSms)

	srv.AddTool(makeTool("client_send_sms", "Client-safe: send SMS within project scope", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"messages":  {Type: "array", Desc: "Array of {content, destination} objects"},
	}, []string{"projectId", "messages"}), reg.sendSms)

	srv.AddTool(makeTool("send_whatsapp", "Send WhatsApp messages using Twilio provider", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"messages":  {Type: "array", Desc: "Array of {content, destination} objects"},
	}, []string{"projectId", "messages"}), reg.sendWhatsapp)

	srv.AddTool(makeTool("client_send_whatsapp", "Client-safe: send WhatsApp messages within project scope", map[string]prop{
		"projectId": {Type: "string", Desc: "Project ID"},
		"messages":  {Type: "array", Desc: "Array of {content, destination} objects"},
	}, []string{"projectId", "messages"}), reg.sendWhatsapp)

	srv.AddTool(makeTool("check_message_status", "Check delivery status of a sent message", map[string]prop{
		"projectId":  {Type: "string", Desc: "Project ID"},
		"messageSid": {Type: "string", Desc: "Twilio message SID"},
	}, []string{"projectId", "messageSid"}), reg.checkMessageStatus)
}

type commsTools struct {
	pool *pgxpool.Pool
}

func (c *commsTools) listEmailProviders(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	rows, err := c.pool.Query(ctx, `SELECT id, project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_active, created_at FROM skaftin_system_email_providers WHERE project_id = $1`, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (c *commsTools) getEmailProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	providerId := getString(args, "providerId")
	rows, err := c.pool.Query(ctx, `SELECT id, project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user, from_email, from_name, is_active, created_at FROM skaftin_system_email_providers WHERE id = $1 AND project_id = $2`, providerId, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Provider not found")
	}
	return textResult(result[0])
}

func (c *commsTools) createEmailProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	rows, err := c.pool.Query(ctx, `INSERT INTO skaftin_system_email_providers (project_id, name, provider_type, smtp_host, smtp_port, smtp_secure, smtp_user, smtp_password, from_email, from_name, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
		pid, getString(args, "name"), getString(args, "provider_type"), getString(args, "smtp_host"), getInt(args, "smtp_port", 587), getBool(args, "smtp_secure", false), getString(args, "smtp_user"), getString(args, "smtp_password"), getString(args, "from_email"), getString(args, "from_name"), getBool(args, "is_active", true))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "provider": collectRows(rows)})
}

func (c *commsTools) updateEmailProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	providerId := getString(args, "providerId")

	var setClauses []string
	var qArgs []any
	idx := 1
	for _, f := range []string{"name", "smtp_host", "smtp_user", "smtp_password", "from_email", "from_name"} {
		if v := getString(args, f); v != "" {
			setClauses = append(setClauses, fmt.Sprintf(`%s = $%d`, f, idx))
			qArgs = append(qArgs, v)
			idx++
		}
	}
	if v := getInt(args, "smtp_port", 0); v > 0 {
		setClauses = append(setClauses, fmt.Sprintf(`smtp_port = $%d`, idx))
		qArgs = append(qArgs, v)
		idx++
	}
	if _, ok := args["is_active"]; ok {
		setClauses = append(setClauses, fmt.Sprintf(`is_active = $%d`, idx))
		qArgs = append(qArgs, getBool(args, "is_active", true))
		idx++
	}
	if len(setClauses) == 0 {
		return errorResult("No fields to update")
	}

	qArgs = append(qArgs, providerId, pid)
	query := fmt.Sprintf(`UPDATE skaftin_system_email_providers SET %s WHERE id = $%d AND project_id = $%d RETURNING *`, strings.Join(setClauses, ", "), idx, idx+1)
	rows, err := c.pool.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "provider": collectRows(rows)})
}

func (c *commsTools) deleteEmailProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	providerId := getString(args, "providerId")
	tag, err := c.pool.Exec(ctx, `DELETE FROM skaftin_system_email_providers WHERE id = $1 AND project_id = $2`, providerId, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	if tag.RowsAffected() == 0 {
		return errorResult("Provider not found")
	}
	return textResult(map[string]any{"success": true, "message": "Email provider deleted"})
}

func (c *commsTools) testEmailConnection(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "Email connection testing requires SMTP client. Use the HTTP API."})
}

func (c *commsTools) listSmsProviders(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	rows, err := c.pool.Query(ctx, `SELECT id, project_id, name, provider_type, phone_number, whatsapp_from, is_active, created_at FROM public.sms_providers WHERE project_id = $1`, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(collectRows(rows))
}

func (c *commsTools) getSmsProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	providerId := getString(args, "providerId")
	rows, err := c.pool.Query(ctx, `SELECT id, project_id, name, provider_type, phone_number, whatsapp_from, is_active, created_at FROM public.sms_providers WHERE id = $1 AND project_id = $2`, providerId, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	result := collectRows(rows)
	if len(result) == 0 {
		return errorResult("Provider not found")
	}
	return textResult(result[0])
}

func (c *commsTools) createSmsProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	rows, err := c.pool.Query(ctx, `INSERT INTO public.sms_providers (project_id, name, provider_type, api_key, api_secret, post_url, phone_number, whatsapp_from, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
		pid, getString(args, "name"), getString(args, "provider_type"), getString(args, "api_key"), getString(args, "api_secret"), getString(args, "post_url"), getString(args, "phone_number"), getString(args, "whatsapp_from"), getBool(args, "is_active", true))
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "provider": collectRows(rows)})
}

func (c *commsTools) updateSmsProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	providerId := getString(args, "providerId")

	var setClauses []string
	var qArgs []any
	idx := 1
	for _, f := range []string{"name", "api_key", "api_secret"} {
		if v := getString(args, f); v != "" {
			setClauses = append(setClauses, fmt.Sprintf(`%s = $%d`, f, idx))
			qArgs = append(qArgs, v)
			idx++
		}
	}
	if _, ok := args["is_active"]; ok {
		setClauses = append(setClauses, fmt.Sprintf(`is_active = $%d`, idx))
		qArgs = append(qArgs, getBool(args, "is_active", true))
		idx++
	}
	if len(setClauses) == 0 {
		return errorResult("No fields to update")
	}

	qArgs = append(qArgs, providerId, pid)
	query := fmt.Sprintf(`UPDATE public.sms_providers SET %s WHERE id = $%d AND project_id = $%d RETURNING *`, strings.Join(setClauses, ", "), idx, idx+1)
	rows, err := c.pool.Query(ctx, query, qArgs...)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	defer rows.Close()
	return textResult(map[string]any{"success": true, "provider": collectRows(rows)})
}

func (c *commsTools) deleteSmsProvider(ctx context.Context, req *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	args, err := parseArgs(req)
	if err != nil {
		return errorResult(err.Error())
	}
	pid, err := parseProjectID(args["projectId"])
	if err != nil {
		return errorResult(err.Error())
	}
	providerId := getString(args, "providerId")
	tag, err := c.pool.Exec(ctx, `DELETE FROM public.sms_providers WHERE id = $1 AND project_id = $2`, providerId, pid)
	if err != nil {
		return errorResult(fmt.Sprintf("Failed: %v", err))
	}
	if tag.RowsAffected() == 0 {
		return errorResult("Provider not found")
	}
	return textResult(map[string]any{"success": true, "message": "SMS provider deleted"})
}

func (c *commsTools) sendEmail(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "Email sending requires SMTP client. Use the HTTP API at /api/communications/:projectId/send-email"})
}

func (c *commsTools) sendSms(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "SMS sending requires external provider client. Use the HTTP API at /api/communications/:projectId/send-sms"})
}

func (c *commsTools) sendWhatsapp(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "WhatsApp sending requires Twilio client. Use the HTTP API at /api/communications/:projectId/send-whatsapp"})
}

func (c *commsTools) checkMessageStatus(_ context.Context, _ *sdkmcp.CallToolRequest) (*sdkmcp.CallToolResult, error) {
	return textResult(map[string]any{"message": "Message status check requires Twilio client. Use the HTTP API at /api/communications/:projectId/message-status"})
}
