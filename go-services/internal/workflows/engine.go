package workflows

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/smtp"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Engine struct {
	pool  *pgxpool.Pool
	store *Store
}

func NewEngine(pool *pgxpool.Pool, store *Store) *Engine {
	return &Engine{pool: pool, store: store}
}

func (e *Engine) ExecuteWorkflow(ctx context.Context, workflowID int, inputs map[string]any, triggeredBy string) (*ExecutionResult, error) {
	workflow, err := e.store.loadWorkflow(ctx, workflowID)
	if err != nil {
		return nil, err
	}
	if !workflow.Enabled {
		return nil, fmt.Errorf("workflow %d is disabled", workflowID)
	}

	schema, err := e.store.getProjectSchema(ctx, workflow.ProjectID)
	if err != nil {
		return nil, err
	}

	executionID, err := e.store.createExecution(ctx, workflowID, "running", triggeredBy, inputs, time.Now().UTC())
	if err != nil {
		return nil, err
	}

	execCtx := &ExecutionContext{
		WorkflowID:  workflowID,
		ExecutionID: executionID,
		ProjectID:   workflow.ProjectID,
		SchemaName:  schema,
		Inputs:      inputs,
		NodeResults: map[string]NodeExecutionResult{},
		Variables:   map[string]any{},
		StartTime:   time.Now().UTC(),
	}

	client, err := e.pool.Acquire(ctx)
	if err != nil {
		return nil, err
	}
	defer client.Release()

	if _, err := client.Exec(ctx, fmt.Sprintf("SET search_path TO %s, public", pgx.Identifier{schema}.Sanitize())); err != nil {
		return nil, err
	}

	order := buildExecutionOrder(workflow.Nodes, workflow.Edges)
	if len(order) == 0 {
		msg := "no executable nodes found"
		_ = e.store.updateExecution(ctx, executionID, "failed", nil, &msg)
		return &ExecutionResult{ExecutionID: executionID, Status: "failed", Error: msg}, nil
	}

	status := "running"
	var execErr string
	var finalResult map[string]any

	for _, nodeID := range order {
		node, ok := findNode(workflow.Nodes, nodeID)
		if !ok {
			continue
		}
		nodeStart := time.Now()
		res, err := e.executeNode(ctx, client.Conn(), workflow, node, execCtx)
		if err != nil {
			res = NodeExecutionResult{
				NodeID:          node.ID,
				Status:          "fail",
				Error:           err.Error(),
				ExecutionTimeMS: int(time.Since(nodeStart).Milliseconds()),
				Timestamp:       time.Now().UTC().Format(time.RFC3339),
			}
		}
		execCtx.NodeResults[node.ID] = res
		_ = e.store.saveNodeExecution(ctx, executionID, node.ID, res)

		if node.Type == "forLoop" && res.Status == "success" {
			_ = e.executeLoopChildren(ctx, client.Conn(), workflow, node.ID, res, execCtx)
		}
		if res.Status == "fail" && node.Type != "condition" {
			status = "failed"
			execErr = fmt.Sprintf("node %s failed: %s", node.ID, res.Error)
			break
		}
	}

	if status == "running" {
		status = "completed"
	}
	if len(order) > 0 {
		if last, ok := execCtx.NodeResults[order[len(order)-1]]; ok {
			finalResult = last.Data
		}
	}
	var errPtr *string
	if execErr != "" {
		errPtr = &execErr
	}
	_ = e.store.updateExecution(ctx, executionID, status, finalResult, errPtr)

	return &ExecutionResult{
		ExecutionID: executionID,
		Status:      status,
		Result:      finalResult,
		Error:       execErr,
	}, nil
}

func (e *Engine) executeLoopChildren(ctx context.Context, conn *pgx.Conn, workflow *WorkflowDefinition, loopNodeID string, loopResult NodeExecutionResult, execCtx *ExecutionContext) error {
	itersRaw, ok := loopResult.Data["iterations"].([]any)
	if !ok {
		return nil
	}
	childIDs := []string{}
	for _, edge := range workflow.Edges {
		if edge.Source == loopNodeID {
			childIDs = append(childIDs, edge.Target)
		}
	}
	for _, it := range itersRaw {
		m, ok := it.(map[string]any)
		if !ok {
			continue
		}
		iterCtx := *execCtx
		varName, _ := m["variableName"].(string)
		index, _ := toInt(m["index"])
		iterCtx.IterationContext = &LoopIterationContext{
			Item:         m["item"],
			Index:        index,
			VariableName: varName,
		}
		for _, childID := range childIDs {
			node, ok := findNode(workflow.Nodes, childID)
			if !ok {
				continue
			}
			res, err := e.executeNode(ctx, conn, workflow, node, &iterCtx)
			if err != nil {
				res = NodeExecutionResult{
					NodeID:    node.ID,
					Status:    "fail",
					Error:     err.Error(),
					Timestamp: time.Now().UTC().Format(time.RFC3339),
				}
			}
			execCtx.NodeResults[node.ID] = res
			_ = e.store.saveNodeExecution(ctx, execCtx.ExecutionID, node.ID, res)
		}
	}
	return nil
}

func (e *Engine) executeNode(ctx context.Context, conn *pgx.Conn, workflow *WorkflowDefinition, node WorkflowNode, execCtx *ExecutionContext) (NodeExecutionResult, error) {
	start := time.Now()
	switch node.Type {
	case "start":
		return success(node.ID, map[string]any{"inputs": execCtx.Inputs, "message": "Workflow started"}, start), nil
	case "display":
		sourceID, _ := asString(node.Data["sourceNodeId"])
		keyPath, _ := asString(node.Data["keyPath"])
		if sourceID == "" {
			return success(node.ID, map[string]any{"displayed": map[string]any{"message": "No source node specified"}}, start), nil
		}
		source, ok := execCtx.NodeResults[sourceID]
		if !ok {
			return fail(node.ID, fmt.Sprintf("Source node %s not found", sourceID), start), nil
		}
		val := any(source.Data)
		if keyPath != "" {
			val = getByPath(source.Data, keyPath)
		}
		return success(node.ID, map[string]any{"displayed": val, "formatted": stringify(val)}, start), nil
	case "condition":
		expr, _ := asString(node.Data["condition"])
		if expr == "" {
			return fail(node.ID, "Condition expression is required", start), nil
		}
		resolved, err := substituteString(expr, execCtx)
		if err != nil {
			return fail(node.ID, err.Error(), start), nil
		}
		cond, err := evalCondition(resolved)
		if err != nil {
			return fail(node.ID, fmt.Sprintf("Failed to evaluate condition: %v", err), start), nil
		}
		return success(node.ID, map[string]any{"result": cond, "condition": resolved, "branch": ternary(cond, "true", "false")}, start), nil
	case "forLoop":
		sourceID, _ := asString(node.Data["sourceNodeId"])
		arrayPath, _ := asString(node.Data["arrayPath"])
		variableName, _ := asString(node.Data["itemVariableName"])
		if sourceID == "" {
			return fail(node.ID, "Source node ID is required", start), nil
		}
		src, ok := execCtx.NodeResults[sourceID]
		if !ok {
			return fail(node.ID, fmt.Sprintf("Source node %s not found or not executed", sourceID), start), nil
		}
		var arr []any
		if arrayPath != "" {
			v := getByPath(src.Data, arrayPath)
			if cast, ok := v.([]any); ok {
				arr = cast
			}
		} else if rows, ok := src.Data["rows"].([]any); ok {
			arr = rows
		}
		if variableName == "" {
			variableName = "item"
		}
		iters := make([]any, 0, len(arr))
		for i, item := range arr {
			iters = append(iters, map[string]any{"index": i, "item": item, "variableName": variableName})
		}
		return success(node.ID, map[string]any{"array": arr, "arrayLength": len(arr), "variableName": variableName, "iterations": iters}, start), nil
	case "dbSelect":
		return e.execDBSelect(ctx, conn, node, execCtx, start), nil
	case "dbInsert":
		return e.execDBInsert(ctx, conn, node, execCtx, start), nil
	case "dbUpdate":
		return e.execDBUpdate(ctx, conn, node, execCtx, start), nil
	case "dbDelete":
		return e.execDBDelete(ctx, conn, node, execCtx, start), nil
	case "httpRequest":
		return e.execHTTPRequest(ctx, node, execCtx, start), nil
	case "email":
		return e.execEmail(ctx, conn, node, execCtx, start), nil
	case "sms":
		return e.execSMS(ctx, conn, node, execCtx, start), nil
	default:
		return fail(node.ID, fmt.Sprintf("Unknown node type: %s", node.Type), start), nil
	}
}

func (e *Engine) execDBSelect(ctx context.Context, conn *pgx.Conn, node WorkflowNode, execCtx *ExecutionContext, start time.Time) NodeExecutionResult {
	table, _ := asString(node.Data["table"])
	if table == "" {
		return fail(node.ID, "Table name is required", start)
	}
	query := fmt.Sprintf("SELECT * FROM %s", quoteIdent(table))
	args := []any{}
	if wh, ok := node.Data["where"].([]any); ok && len(wh) > 0 {
		clauses := []string{}
		for i, c := range wh {
			cond, _ := c.(map[string]any)
			field, _ := asString(cond["field"])
			op, _ := asString(cond["operator"])
			val := substituteAny(cond["value"], execCtx)
			clauses = append(clauses, fmt.Sprintf("%s %s $%d", quoteIdent(field), op, len(args)+1))
			args = append(args, val)
			_ = i
		}
		query += " WHERE " + strings.Join(clauses, " AND ")
	}
	if orderBy, ok := node.Data["orderBy"].([]any); ok && len(orderBy) > 0 {
		parts := []string{}
		for _, o := range orderBy {
			m, _ := o.(map[string]any)
			f, _ := asString(m["field"])
			d, _ := asString(m["direction"])
			if d == "" {
				d = "ASC"
			}
			parts = append(parts, fmt.Sprintf("%s %s", quoteIdent(f), d))
		}
		query += " ORDER BY " + strings.Join(parts, ", ")
	}
	if limit, ok := toInt(node.Data["limit"]); ok && limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}
	rows, err := conn.Query(ctx, query, args...)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	defer rows.Close()
	data, err := pgx.CollectRows(rows, pgx.RowToMap)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	cols := []any{}
	if len(data) > 0 {
		for k := range data[0] {
			cols = append(cols, k)
		}
	}
	return success(node.ID, map[string]any{"rows": data, "rowCount": len(data), "columns": cols}, start)
}

func (e *Engine) execDBInsert(ctx context.Context, conn *pgx.Conn, node WorkflowNode, execCtx *ExecutionContext, start time.Time) NodeExecutionResult {
	table, _ := asString(node.Data["table"])
	if table == "" {
		return fail(node.ID, "Table name is required", start)
	}
	fm, ok := node.Data["fieldMappings"].([]any)
	if !ok || len(fm) == 0 {
		return fail(node.ID, "Field mappings are required", start)
	}
	cols := []string{}
	holders := []string{}
	args := []any{}
	for i, m := range fm {
		x, _ := m.(map[string]any)
		col, _ := asString(x["column"])
		cols = append(cols, quoteIdent(col))
		args = append(args, substituteAny(x["value"], execCtx))
		holders = append(holders, fmt.Sprintf("$%d", i+1))
	}
	query := fmt.Sprintf("INSERT INTO %s (%s) VALUES (%s) RETURNING *", quoteIdent(table), strings.Join(cols, ", "), strings.Join(holders, ", "))
	row, err := conn.Query(ctx, query, args...)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	defer row.Close()
	inserted, err := pgx.CollectRows(row, pgx.RowToMap)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	var first map[string]any
	if len(inserted) > 0 {
		first = inserted[0]
	}
	return success(node.ID, map[string]any{"inserted": first, "rowCount": len(inserted)}, start)
}

func (e *Engine) execDBUpdate(ctx context.Context, conn *pgx.Conn, node WorkflowNode, execCtx *ExecutionContext, start time.Time) NodeExecutionResult {
	table, _ := asString(node.Data["table"])
	updates, ok := node.Data["updates"].([]any)
	if table == "" || !ok || len(updates) == 0 {
		return fail(node.ID, "Table name and updates are required", start)
	}
	where, ok := node.Data["where"].([]any)
	if !ok || len(where) == 0 {
		return fail(node.ID, "WHERE conditions are required for UPDATE operations", start)
	}
	args := []any{}
	set := []string{}
	for _, u := range updates {
		m, _ := u.(map[string]any)
		field, _ := asString(m["field"])
		args = append(args, substituteAny(m["value"], execCtx))
		set = append(set, fmt.Sprintf("%s = $%d", quoteIdent(field), len(args)))
	}
	clauses := []string{}
	for _, c := range where {
		m, _ := c.(map[string]any)
		field, _ := asString(m["field"])
		op, _ := asString(m["operator"])
		val := substituteAny(m["value"], execCtx)
		if strings.EqualFold(op, "IN") || strings.EqualFold(op, "NOT IN") {
			arr, ok := val.([]any)
			if !ok {
				return fail(node.ID, "IN operator requires an array value", start)
			}
			hs := []string{}
			for _, av := range arr {
				args = append(args, av)
				hs = append(hs, fmt.Sprintf("$%d", len(args)))
			}
			clauses = append(clauses, fmt.Sprintf("%s %s (%s)", quoteIdent(field), op, strings.Join(hs, ", ")))
		} else {
			args = append(args, val)
			clauses = append(clauses, fmt.Sprintf("%s %s $%d", quoteIdent(field), op, len(args)))
		}
	}
	query := fmt.Sprintf("UPDATE %s SET %s WHERE %s RETURNING *", quoteIdent(table), strings.Join(set, ", "), strings.Join(clauses, " AND "))
	rows, err := conn.Query(ctx, query, args...)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	defer rows.Close()
	updated, err := pgx.CollectRows(rows, pgx.RowToMap)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	return success(node.ID, map[string]any{"updated": updated, "updatedCount": len(updated)}, start)
}

func (e *Engine) execDBDelete(ctx context.Context, conn *pgx.Conn, node WorkflowNode, execCtx *ExecutionContext, start time.Time) NodeExecutionResult {
	table, _ := asString(node.Data["table"])
	where, ok := node.Data["where"].([]any)
	if table == "" {
		return fail(node.ID, "Table name is required", start)
	}
	if !ok || len(where) == 0 {
		return fail(node.ID, "WHERE conditions are required for DELETE operations", start)
	}
	args := []any{}
	clauses := []string{}
	for _, c := range where {
		m, _ := c.(map[string]any)
		field, _ := asString(m["field"])
		op, _ := asString(m["operator"])
		val := substituteAny(m["value"], execCtx)
		if strings.EqualFold(op, "IN") || strings.EqualFold(op, "NOT IN") {
			arr, ok := val.([]any)
			if !ok {
				return fail(node.ID, "IN operator requires an array value", start)
			}
			hs := []string{}
			for _, av := range arr {
				args = append(args, av)
				hs = append(hs, fmt.Sprintf("$%d", len(args)))
			}
			clauses = append(clauses, fmt.Sprintf("%s %s (%s)", quoteIdent(field), op, strings.Join(hs, ", ")))
		} else {
			args = append(args, val)
			clauses = append(clauses, fmt.Sprintf("%s %s $%d", quoteIdent(field), op, len(args)))
		}
	}
	query := fmt.Sprintf("DELETE FROM %s WHERE %s", quoteIdent(table), strings.Join(clauses, " AND "))
	cmd, err := conn.Exec(ctx, query, args...)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	return success(node.ID, map[string]any{"deletedCount": int(cmd.RowsAffected())}, start)
}

func (e *Engine) execHTTPRequest(ctx context.Context, node WorkflowNode, execCtx *ExecutionContext, start time.Time) NodeExecutionResult {
	method, _ := asString(node.Data["method"])
	if method == "" {
		method = http.MethodGet
	}
	urlRaw, _ := asString(node.Data["url"])
	if urlRaw == "" {
		return fail(node.ID, "URL is required", start)
	}
	resolvedURL, err := substituteString(urlRaw, execCtx)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	var bodyReader io.Reader
	if method != http.MethodGet {
		body := substituteAny(node.Data["body"], execCtx)
		switch v := body.(type) {
		case string:
			bodyReader = strings.NewReader(v)
		default:
			raw, _ := json.Marshal(v)
			bodyReader = strings.NewReader(string(raw))
		}
	}
	req, err := http.NewRequestWithContext(ctx, method, resolvedURL, bodyReader)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	req.Header.Set("Content-Type", "application/json")
	if headers, ok := node.Data["headers"].(map[string]any); ok {
		for k, v := range headers {
			req.Header.Set(k, stringify(substituteAny(v, execCtx)))
		}
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	data := any(string(b))
	var parsed map[string]any
	if json.Unmarshal(b, &parsed) == nil {
		data = parsed
	}
	h := map[string]any{}
	for k, v := range resp.Header {
		h[k] = strings.Join(v, ", ")
	}
	return success(node.ID, map[string]any{
		"status":     resp.StatusCode,
		"statusText": resp.Status,
		"headers":    h,
		"data":       data,
	}, start)
}

func (e *Engine) execEmail(ctx context.Context, conn *pgx.Conn, node WorkflowNode, execCtx *ExecutionContext, start time.Time) NodeExecutionResult {
	templateID, ok := toInt(node.Data["templateId"])
	if !ok {
		return fail(node.ID, "Email template ID is required", start)
	}
	providerID, ok := toInt(node.Data["providerId"])
	if !ok {
		return fail(node.ID, "Email provider ID is required", start)
	}
	projectID, _ := toInt(node.Data["projectId"])
	if projectID == 0 {
		projectID = execCtx.ProjectID
	}
	recipientRaw, _ := asString(node.Data["recipientEmail"])
	if recipientRaw == "" {
		return fail(node.ID, "Recipient email is required", start)
	}
	recipient, err := substituteString(recipientRaw, execCtx)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}

	var subj string
	var htmlContent *string
	var textContent *string
	if err := conn.QueryRow(ctx, `
		SELECT subject, html_content, text_content
		FROM public.email_templates WHERE id = $1 AND project_id = $2
	`, templateID, projectID).Scan(&subj, &htmlContent, &textContent); err != nil {
		return fail(node.ID, fmt.Sprintf("Email template with ID %d not found", templateID), start)
	}
	var smtpHost, smtpUser, smtpPassword, fromEmail string
	var smtpPort int
	var isActive bool
	if err := conn.QueryRow(ctx, `
		SELECT smtp_host, smtp_port, smtp_user, smtp_password, from_email, is_active
		FROM public.email_providers WHERE id = $1 AND project_id = $2
	`, providerID, projectID).Scan(&smtpHost, &smtpPort, &smtpUser, &smtpPassword, &fromEmail, &isActive); err != nil {
		return fail(node.ID, fmt.Sprintf("Email provider with ID %d not found", providerID), start)
	}
	if !isActive {
		return fail(node.ID, "Email provider is not active", start)
	}
	subj, _ = substituteString(subj, execCtx)
	html := ""
	if htmlContent != nil {
		html, _ = substituteString(*htmlContent, execCtx)
	}
	text := ""
	if textContent != nil {
		text, _ = substituteString(*textContent, execCtx)
	}
	if text == "" {
		text = html
	}
	msg := []byte(fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n%s", fromEmail, recipient, subj, text))
	auth := smtp.PlainAuth("", smtpUser, smtpPassword, smtpHost)
	if err := smtp.SendMail(fmt.Sprintf("%s:%d", smtpHost, smtpPort), auth, fromEmail, []string{recipient}, msg); err != nil {
		return fail(node.ID, err.Error(), start)
	}
	return success(node.ID, map[string]any{"recipient": recipient, "templateId": templateID}, start)
}

func (e *Engine) execSMS(ctx context.Context, conn *pgx.Conn, node WorkflowNode, execCtx *ExecutionContext, start time.Time) NodeExecutionResult {
	templateID, ok := toInt(node.Data["templateId"])
	if !ok {
		return fail(node.ID, "SMS template ID is required", start)
	}
	providerID, ok := toInt(node.Data["providerId"])
	if !ok {
		return fail(node.ID, "SMS provider ID is required", start)
	}
	projectID, _ := toInt(node.Data["projectId"])
	if projectID == 0 {
		projectID = execCtx.ProjectID
	}
	destRaw, _ := asString(node.Data["recipientPhone"])
	if destRaw == "" {
		return fail(node.ID, "Recipient phone number is required", start)
	}
	destination, err := substituteString(destRaw, execCtx)
	if err != nil {
		return fail(node.ID, err.Error(), start)
	}
	var content string
	if err := conn.QueryRow(ctx, `
		SELECT content FROM public.sms_templates WHERE id = $1 AND project_id = $2
	`, templateID, projectID).Scan(&content); err != nil {
		return fail(node.ID, fmt.Sprintf("SMS template with ID %d not found", templateID), start)
	}
	content, _ = substituteString(content, execCtx)
	var (
		providerType string
		apiKey       *string
		apiSecret    *string
		postURL      *string
		phoneNumber  *string
	)
	if err := conn.QueryRow(ctx, `
		SELECT provider_type, api_key, api_secret, post_url, phone_number
		FROM public.sms_providers WHERE id = $1 AND project_id = $2 AND is_active = true
	`, providerID, projectID).Scan(&providerType, &apiKey, &apiSecret, &postURL, &phoneNumber); err != nil {
		return fail(node.ID, fmt.Sprintf("SMS provider with ID %d not found", providerID), start)
	}
	switch providerType {
	case "mymobileapi", "sa_mobile_sms":
		if apiKey == nil || apiSecret == nil || postURL == nil {
			return fail(node.ID, "Missing provider credentials", start)
		}
		payload := map[string]any{
			"messages": []map[string]any{{"content": content, "destination": destination}},
		}
		raw, _ := json.Marshal(payload)
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, *postURL, strings.NewReader(string(raw)))
		req.Header.Set("Content-Type", "application/json")
		req.SetBasicAuth(*apiKey, *apiSecret)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return fail(node.ID, err.Error(), start)
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fail(node.ID, string(body), start)
		}
	case "twilio":
		if apiKey == nil || apiSecret == nil {
			return fail(node.ID, "Missing Twilio credentials", start)
		}
		form := url.Values{}
		form.Set("To", normalizePhone(destination))
		form.Set("Body", content)
		if phoneNumber != nil && *phoneNumber != "" {
			form.Set("From", normalizePhone(*phoneNumber))
		}
		endpoint := fmt.Sprintf("https://api.twilio.com/2010-04-01/Accounts/%s/Messages.json", *apiKey)
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		req.SetBasicAuth(*apiKey, *apiSecret)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return fail(node.ID, err.Error(), start)
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			body, _ := io.ReadAll(resp.Body)
			return fail(node.ID, string(body), start)
		}
	default:
		return fail(node.ID, fmt.Sprintf("Unsupported SMS provider type: %s", providerType), start)
	}
	return success(node.ID, map[string]any{"recipient": destination, "templateId": templateID}, start)
}

func findNode(nodes []WorkflowNode, id string) (WorkflowNode, bool) {
	for _, n := range nodes {
		if n.ID == id {
			return n, true
		}
	}
	return WorkflowNode{}, false
}

func success(nodeID string, data map[string]any, start time.Time) NodeExecutionResult {
	return NodeExecutionResult{
		NodeID:          nodeID,
		Status:          "success",
		Data:            data,
		ExecutionTimeMS: int(time.Since(start).Milliseconds()),
		Timestamp:       time.Now().UTC().Format(time.RFC3339),
	}
}

func fail(nodeID string, message string, start time.Time) NodeExecutionResult {
	return NodeExecutionResult{
		NodeID:          nodeID,
		Status:          "fail",
		Error:           message,
		ExecutionTimeMS: int(time.Since(start).Milliseconds()),
		Timestamp:       time.Now().UTC().Format(time.RFC3339),
	}
}

func quoteIdent(name string) string {
	return pgx.Identifier{name}.Sanitize()
}

var varPattern = regexp.MustCompile(`\{\{([^}]+)\}\}`)

func substituteString(template string, ctx *ExecutionContext) (string, error) {
	out := template
	matches := varPattern.FindAllStringSubmatch(template, -1)
	for _, m := range matches {
		full := m[0]
		path := m[1]
		val, err := resolveVariable(path, ctx)
		if err != nil {
			return "", err
		}
		out = strings.ReplaceAll(out, full, stringify(val))
	}
	return out, nil
}

func substituteAny(v any, ctx *ExecutionContext) any {
	switch t := v.(type) {
	case string:
		if varPattern.MatchString(t) && strings.TrimSpace(t) == varPattern.FindString(t) {
			ref := varPattern.FindStringSubmatch(t)
			if len(ref) == 2 {
				if val, err := resolveVariable(ref[1], ctx); err == nil {
					return val
				}
			}
		}
		out, _ := substituteString(t, ctx)
		return out
	case []any:
		out := make([]any, 0, len(t))
		for _, item := range t {
			out = append(out, substituteAny(item, ctx))
		}
		return out
	case map[string]any:
		out := map[string]any{}
		for k, item := range t {
			out[k] = substituteAny(item, ctx)
		}
		return out
	default:
		return v
	}
}

func resolveVariable(path string, ctx *ExecutionContext) (any, error) {
	parts := strings.Split(path, ".")
	if len(parts) == 0 {
		return nil, errors.New("invalid variable reference")
	}
	if parts[0] == "inputs" {
		return getByPath(ctx.Inputs, strings.Join(parts[1:], ".")), nil
	}
	if ctx.IterationContext != nil && parts[0] == ctx.IterationContext.VariableName {
		return getByPath(ctx.IterationContext.Item, strings.Join(parts[1:], ".")), nil
	}
	nodeID := parts[0]
	res, ok := ctx.NodeResults[nodeID]
	if !ok {
		return nil, fmt.Errorf("Node result not found: %s", nodeID)
	}
	nodePath := strings.Join(parts[1:], ".")
	if nodePath == "" || nodePath == "data" {
		return res.Data, nil
	}
	return getByPath(res.Data, nodePath), nil
}

func getByPath(root any, path string) any {
	if path == "" {
		return root
	}
	cur := root
	for _, p := range strings.Split(path, ".") {
		if cur == nil {
			return nil
		}
		if idx, err := strconv.Atoi(p); err == nil {
			arr, ok := cur.([]any)
			if !ok || idx < 0 || idx >= len(arr) {
				return nil
			}
			cur = arr[idx]
			continue
		}
		obj, ok := cur.(map[string]any)
		if !ok {
			return nil
		}
		cur = obj[p]
	}
	return cur
}

func stringify(v any) string {
	switch t := v.(type) {
	case nil:
		return ""
	case string:
		return t
	default:
		raw, _ := json.Marshal(t)
		s := string(raw)
		s = strings.TrimPrefix(s, "\"")
		s = strings.TrimSuffix(s, "\"")
		return s
	}
}

func asString(v any) (string, bool) {
	s, ok := v.(string)
	return s, ok
}

func toInt(v any) (int, bool) {
	switch t := v.(type) {
	case int:
		return t, true
	case int32:
		return int(t), true
	case int64:
		return int(t), true
	case float64:
		return int(t), true
	case json.Number:
		i, err := t.Int64()
		return int(i), err == nil
	case string:
		i, err := strconv.Atoi(t)
		return i, err == nil
	default:
		return 0, false
	}
}

func evalCondition(expr string) (bool, error) {
	ops := []string{"!==", "===", ">=", "<=", "!=", "==", ">", "<"}
	for _, op := range ops {
		if strings.Contains(expr, op) {
			parts := strings.SplitN(expr, op, 2)
			left := parseScalar(strings.TrimSpace(parts[0]))
			right := parseScalar(strings.TrimSpace(parts[1]))
			return compare(left, right, op)
		}
	}
	return false, errors.New("invalid condition expression")
}

func parseScalar(s string) any {
	s = strings.TrimSpace(s)
	if strings.HasPrefix(s, "\"") && strings.HasSuffix(s, "\"") && len(s) >= 2 {
		return strings.Trim(s, "\"")
	}
	if strings.HasPrefix(s, "'") && strings.HasSuffix(s, "'") && len(s) >= 2 {
		return strings.Trim(s, "'")
	}
	if b, err := strconv.ParseBool(s); err == nil {
		return b
	}
	if f, err := strconv.ParseFloat(s, 64); err == nil {
		return f
	}
	return s
}

func compare(a any, b any, op string) (bool, error) {
	af, aNum := toFloat(a)
	bf, bNum := toFloat(b)
	if aNum && bNum {
		switch op {
		case ">", ">=":
			if op == ">" {
				return af > bf, nil
			}
			return af >= bf, nil
		case "<", "<=":
			if op == "<" {
				return af < bf, nil
			}
			return af <= bf, nil
		case "==", "===":
			return af == bf, nil
		case "!=", "!==":
			return af != bf, nil
		}
	}
	as := stringify(a)
	bs := stringify(b)
	switch op {
	case "==", "===":
		return as == bs, nil
	case "!=", "!==":
		return as != bs, nil
	case ">":
		return as > bs, nil
	case "<":
		return as < bs, nil
	case ">=":
		return as >= bs, nil
	case "<=":
		return as <= bs, nil
	}
	return false, errors.New("unsupported operator")
}

func toFloat(v any) (float64, bool) {
	switch t := v.(type) {
	case float64:
		return t, true
	case float32:
		return float64(t), true
	case int:
		return float64(t), true
	case int64:
		return float64(t), true
	case json.Number:
		f, err := t.Float64()
		return f, err == nil
	case string:
		f, err := strconv.ParseFloat(t, 64)
		return f, err == nil
	default:
		return 0, false
	}
}

func normalizePhone(p string) string {
	p = strings.TrimSpace(p)
	if strings.HasPrefix(p, "+") {
		return p
	}
	if strings.HasPrefix(p, "0") {
		return "+27" + strings.TrimPrefix(p, "0")
	}
	return "+" + p
}

func buildExecutionOrder(nodes []WorkflowNode, edges []WorkflowEdge) []string {
	forLoopChildren := map[string]bool{}
	for _, n := range nodes {
		if n.Type == "forLoop" {
			for _, e := range edges {
				if e.Source == n.ID {
					forLoopChildren[e.Target] = true
				}
			}
		}
	}

	graph := map[string][]string{}
	inDegree := map[string]int{}
	for _, n := range nodes {
		if forLoopChildren[n.ID] {
			continue
		}
		graph[n.ID] = []string{}
		inDegree[n.ID] = 0
	}
	for _, e := range edges {
		if forLoopChildren[e.Target] {
			continue
		}
		if _, ok := graph[e.Source]; ok {
			if _, ok2 := graph[e.Target]; ok2 {
				graph[e.Source] = append(graph[e.Source], e.Target)
				inDegree[e.Target]++
			}
		}
	}

	queue := []string{}
	for nodeID, d := range inDegree {
		if d == 0 {
			queue = append(queue, nodeID)
		}
	}
	out := []string{}
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		out = append(out, id)
		for _, nei := range graph[id] {
			inDegree[nei]--
			if inDegree[nei] == 0 {
				queue = append(queue, nei)
			}
		}
	}
	return out
}

func ternary[T any](cond bool, a, b T) T {
	if cond {
		return a
	}
	return b
}
