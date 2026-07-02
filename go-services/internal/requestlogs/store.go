package requestlogs

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/skaftin/go-services/internal/dbmetrics"
)

// Store handles database queries for request logs and related settings.
type Store struct {
	pool     *pgxpool.Pool
	recorder *dbmetrics.Recorder
}

// NewStore creates a new request logs Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{
		pool:     pool,
		recorder: dbmetrics.NewRecorder(pool),
	}
}

func (s *Store) query(ctx context.Context, projectID int, query string, args ...any) (pgx.Rows, error) {
	start := time.Now()
	rows, err := s.pool.Query(ctx, query, args...)
	if err == nil {
		s.captureMetric(ctx, projectID, query, 0, start)
	}
	return rows, err
}

func (s *Store) queryRow(ctx context.Context, projectID int, query string, args ...any) pgx.Row {
	start := time.Now()
	row := s.pool.QueryRow(ctx, query, args...)
	return dbmetrics.WrapRow(row, func(scanErr error) {
		rowsAffected := int64(0)
		if scanErr == nil {
			rowsAffected = 1
		}
		s.captureMetric(ctx, projectID, query, rowsAffected, start)
	})
}

func (s *Store) exec(ctx context.Context, projectID int, query string, args ...any) (pgconn.CommandTag, error) {
	start := time.Now()
	tag, err := s.pool.Exec(ctx, query, args...)
	rowsAffected := int64(0)
	if err == nil {
		rowsAffected = tag.RowsAffected()
	}
	s.captureMetric(ctx, projectID, query, rowsAffected, start)
	return tag, err
}

func (s *Store) captureMetric(ctx context.Context, projectID int, query string, rowsAffected int64, startedAt time.Time) {
	if s.recorder == nil || projectID <= 0 {
		return
	}
	s.recorder.Record(ctx, dbmetrics.Record{
		ProjectID:    projectID,
		Query:        query,
		RowsAffected: rowsAffected,
		Duration:     time.Since(startedAt),
	})
}

// RequestLog represents a row from public.skaftin_system_request_logs.
type RequestLog struct {
	ID             int             `json:"id"`
	ProjectID      int             `json:"project_id"`
	RequestID      *string         `json:"request_id"`
	Method         string          `json:"method"`
	URL            string          `json:"url"`
	StatusCode     *int            `json:"status_code"`
	RequestPayload json.RawMessage `json:"request_payload"`
	ResponseData   json.RawMessage `json:"response_data"`
	ErrorMessage   *string         `json:"error_message"`
	DurationMs     *int            `json:"duration_ms"`
	UserID         *int            `json:"user_id"`
	IPAddress      *string         `json:"ip_address"`
	UserAgent      *string         `json:"user_agent"`
	CreatedAt      time.Time       `json:"created_at"`
}

// CreateLogInput is the payload for inserting one request log row.
type CreateLogInput struct {
	ProjectID      int
	Method         string
	URL            string
	StatusCode     *int
	RequestPayload json.RawMessage
	ResponseData   json.RawMessage
	ErrorMessage   *string
	DurationMs     *int
	UserID         *int
	IPAddress      *string
	UserAgent      *string
}

// LogSettings holds the request-logging-related fields from settings_json.
type LogSettings struct {
	RequestLoggingEnabled bool   `json:"request_logging_enabled"`
	RequestLogRetention   string `json:"request_log_retention"`
}

// LogFilters holds the query parameters for listing logs.
type LogFilters struct {
	Limit      int
	Offset     int
	StatusCode *int
	Method     *string
	StartDate  *time.Time
	EndDate    *time.Time
	HasError   bool
	URLSearch  *string
}

// LogListResult holds the paginated list result.
type LogListResult struct {
	Logs       []RequestLog `json:"logs"`
	Pagination Pagination   `json:"pagination"`
}

// Pagination metadata for list responses.
type Pagination struct {
	Total   int  `json:"total"`
	Limit   int  `json:"limit"`
	Offset  int  `json:"offset"`
	HasMore bool `json:"has_more"`
}

// StatusCount holds a status category and its count.
type StatusCount struct {
	Category string `json:"category"`
	Count    int    `json:"count"`
}

// TopEndpoint holds aggregated data for a frequently-hit endpoint.
type TopEndpoint struct {
	URL           string `json:"url"`
	Method        string `json:"method"`
	Count         int    `json:"count"`
	AvgDurationMs int    `json:"avg_duration_ms"`
}

const logColumns = `id, project_id, request_id, method, url, status_code, request_payload, response_data, error_message, duration_ms, user_id, ip_address, user_agent, created_at`

func scanLog(row pgx.Row) (*RequestLog, error) {
	var l RequestLog
	err := row.Scan(
		&l.ID, &l.ProjectID, &l.RequestID, &l.Method, &l.URL,
		&l.StatusCode, &l.RequestPayload, &l.ResponseData,
		&l.ErrorMessage, &l.DurationMs, &l.UserID, &l.IPAddress,
		&l.UserAgent, &l.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &l, nil
}

func scanLogRows(rows pgx.Rows) ([]RequestLog, error) {
	out := make([]RequestLog, 0)
	for rows.Next() {
		var l RequestLog
		if err := rows.Scan(
			&l.ID, &l.ProjectID, &l.RequestID, &l.Method, &l.URL,
			&l.StatusCode, &l.RequestPayload, &l.ResponseData,
			&l.ErrorMessage, &l.DurationMs, &l.UserID, &l.IPAddress,
			&l.UserAgent, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// GetSettings reads request logging settings from skaftin_system_auth_settings.
func (s *Store) GetSettings(ctx context.Context, projectID int) (*LogSettings, error) {
	var raw json.RawMessage
	err := s.queryRow(ctx, projectID,
		`SELECT settings_json FROM skaftin_system_auth_settings WHERE project_id = $1`,
		projectID,
	).Scan(&raw)
	if err == pgx.ErrNoRows {
		return &LogSettings{
			RequestLoggingEnabled: false,
			RequestLogRetention:   "weekly",
		}, nil
	}
	if err != nil {
		return nil, err
	}

	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return nil, err
	}

	settings := &LogSettings{
		RequestLoggingEnabled: false,
		RequestLogRetention:   "weekly",
	}
	if v, ok := parsed["request_logging_enabled"].(bool); ok {
		settings.RequestLoggingEnabled = v
	}
	if v, ok := parsed["request_log_retention"].(string); ok && v != "" {
		settings.RequestLogRetention = v
	}
	return settings, nil
}

// IsLoggingEnabled checks if request logging is enabled for the project.
func (s *Store) IsLoggingEnabled(ctx context.Context, projectID int) (bool, error) {
	settings, err := s.GetSettings(ctx, projectID)
	if err != nil {
		return false, err
	}
	return settings.RequestLoggingEnabled, nil
}

// CreateLog inserts one request log entry.
func (s *Store) CreateLog(ctx context.Context, input CreateLogInput) (int, error) {
	var id int
	err := s.queryRow(ctx, input.ProjectID, `
		INSERT INTO public.skaftin_system_request_logs
			(project_id, method, url, status_code, request_payload, response_data, error_message, duration_ms, user_id, ip_address, user_agent)
		VALUES
			($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9, $10, $11)
		RETURNING id`,
		input.ProjectID,
		input.Method,
		input.URL,
		input.StatusCode,
		nilIfEmptyJSON(input.RequestPayload),
		nilIfEmptyJSON(input.ResponseData),
		input.ErrorMessage,
		input.DurationMs,
		input.UserID,
		input.IPAddress,
		input.UserAgent,
	).Scan(&id)
	if err != nil {
		return 0, err
	}
	return id, nil
}

func nilIfEmptyJSON(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return raw
}

// UpdateSettings merges request logging fields into settings_json.
func (s *Store) UpdateSettings(ctx context.Context, projectID int, enabled *bool, retention *string) (*LogSettings, error) {
	var raw json.RawMessage
	err := s.queryRow(ctx, projectID,
		`SELECT settings_json FROM skaftin_system_auth_settings WHERE project_id = $1`,
		projectID,
	).Scan(&raw)
	if err == pgx.ErrNoRows {
		return nil, fmt.Errorf("not found")
	}
	if err != nil {
		return nil, err
	}

	var parsed map[string]any
	if err := json.Unmarshal(raw, &parsed); err != nil {
		parsed = map[string]any{}
	}

	if enabled != nil {
		parsed["request_logging_enabled"] = *enabled
	}
	if retention != nil {
		parsed["request_log_retention"] = *retention
	}

	updated, err := json.Marshal(parsed)
	if err != nil {
		return nil, err
	}

	_, err = s.exec(ctx, projectID,
		`UPDATE skaftin_system_auth_settings SET settings_json = $1, updated_at = NOW() WHERE project_id = $2`,
		updated, projectID,
	)
	if err != nil {
		return nil, err
	}

	settings := &LogSettings{
		RequestLoggingEnabled: false,
		RequestLogRetention:   "weekly",
	}
	if v, ok := parsed["request_logging_enabled"].(bool); ok {
		settings.RequestLoggingEnabled = v
	}
	if v, ok := parsed["request_log_retention"].(string); ok && v != "" {
		settings.RequestLogRetention = v
	}
	return settings, nil
}

// ListLogs queries request logs with dynamic filtering and pagination.
func (s *Store) ListLogs(ctx context.Context, projectID int, f LogFilters) (*LogListResult, error) {
	conditions := []string{"project_id = $1"}
	args := []any{projectID}
	idx := 2

	if f.StatusCode != nil {
		conditions = append(conditions, fmt.Sprintf("status_code = $%d", idx))
		args = append(args, *f.StatusCode)
		idx++
	}
	if f.Method != nil {
		conditions = append(conditions, fmt.Sprintf("method = $%d", idx))
		args = append(args, *f.Method)
		idx++
	}
	if f.StartDate != nil {
		conditions = append(conditions, fmt.Sprintf("created_at >= $%d", idx))
		args = append(args, *f.StartDate)
		idx++
	}
	if f.EndDate != nil {
		conditions = append(conditions, fmt.Sprintf("created_at <= $%d", idx))
		args = append(args, *f.EndDate)
		idx++
	}
	if f.HasError {
		conditions = append(conditions, "(error_message IS NOT NULL OR status_code >= 400)")
	}
	if f.URLSearch != nil {
		conditions = append(conditions, fmt.Sprintf("url ILIKE $%d", idx))
		args = append(args, "%"+*f.URLSearch+"%")
		idx++
	}

	where := "WHERE " + conditions[0]
	for _, c := range conditions[1:] {
		where += " AND " + c
	}

	var total int
	err := s.queryRow(ctx, projectID,
		`SELECT COUNT(*) FROM public.skaftin_system_request_logs `+where, args...,
	).Scan(&total)
	if err != nil {
		return nil, err
	}

	query := fmt.Sprintf(
		`SELECT %s FROM public.skaftin_system_request_logs %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d`,
		logColumns, where, idx, idx+1,
	)
	args = append(args, f.Limit, f.Offset)

	rows, err := s.query(ctx, projectID, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	logs, err := scanLogRows(rows)
	if err != nil {
		return nil, err
	}
	if logs == nil {
		logs = []RequestLog{}
	}

	return &LogListResult{
		Logs: logs,
		Pagination: Pagination{
			Total:   total,
			Limit:   f.Limit,
			Offset:  f.Offset,
			HasMore: f.Offset+len(logs) < total,
		},
	}, nil
}

// GetLog retrieves a single request log by ID and project.
func (s *Store) GetLog(ctx context.Context, projectID, logID int) (*RequestLog, error) {
	row := s.queryRow(ctx, projectID,
		`SELECT `+logColumns+` FROM public.skaftin_system_request_logs WHERE id = $1 AND project_id = $2`,
		logID, projectID,
	)
	l, err := scanLog(row)
	if err == pgx.ErrNoRows {
		return nil, nil
	}
	return l, err
}

// Cleanup deletes request logs older than cutoff for the given project.
func (s *Store) Cleanup(ctx context.Context, projectID int, cutoff time.Time) (int64, error) {
	tag, err := s.exec(ctx, projectID,
		`DELETE FROM public.skaftin_system_request_logs WHERE project_id = $1 AND created_at < $2`,
		projectID, cutoff,
	)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// CountTotal returns the total log count for a project since startTime.
func (s *Store) CountTotal(ctx context.Context, projectID int, since time.Time) (int, error) {
	var count int
	err := s.queryRow(ctx, projectID,
		`SELECT COUNT(*) FROM public.skaftin_system_request_logs WHERE project_id = $1 AND created_at >= $2`,
		projectID, since,
	).Scan(&count)
	return count, err
}

// CountByStatusCategory returns request counts grouped by HTTP status category.
func (s *Store) CountByStatusCategory(ctx context.Context, projectID int, since time.Time) (map[string]int, error) {
	rows, err := s.query(ctx, projectID, `
		SELECT
			CASE
				WHEN status_code >= 200 AND status_code < 300 THEN '2xx'
				WHEN status_code >= 300 AND status_code < 400 THEN '3xx'
				WHEN status_code >= 400 AND status_code < 500 THEN '4xx'
				WHEN status_code >= 500 THEN '5xx'
				ELSE 'unknown'
			END AS category,
			COUNT(*) AS count
		FROM public.skaftin_system_request_logs
		WHERE project_id = $1 AND created_at >= $2
		GROUP BY category`, projectID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var cat string
		var cnt int
		if err := rows.Scan(&cat, &cnt); err != nil {
			return nil, err
		}
		out[cat] = cnt
	}
	return out, rows.Err()
}

// CountByMethod returns request counts grouped by HTTP method.
func (s *Store) CountByMethod(ctx context.Context, projectID int, since time.Time) (map[string]int, error) {
	rows, err := s.query(ctx, projectID,
		`SELECT method, COUNT(*) FROM public.skaftin_system_request_logs
		 WHERE project_id = $1 AND created_at >= $2
		 GROUP BY method`, projectID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := map[string]int{}
	for rows.Next() {
		var method string
		var cnt int
		if err := rows.Scan(&method, &cnt); err != nil {
			return nil, err
		}
		out[method] = cnt
	}
	return out, rows.Err()
}

// ResponseTimeStats holds avg/max/min duration values.
type ResponseTimeStats struct {
	AvgMs int `json:"avg_ms"`
	MaxMs int `json:"max_ms"`
	MinMs int `json:"min_ms"`
}

// GetResponseTimeStats returns avg, max, and min duration_ms.
func (s *Store) GetResponseTimeStats(ctx context.Context, projectID int, since time.Time) (*ResponseTimeStats, error) {
	var avgDur, maxDur, minDur *float64
	err := s.queryRow(ctx, projectID,
		`SELECT AVG(duration_ms), MAX(duration_ms), MIN(duration_ms)
		 FROM public.skaftin_system_request_logs
		 WHERE project_id = $1 AND created_at >= $2 AND duration_ms IS NOT NULL`,
		projectID, since,
	).Scan(&avgDur, &maxDur, &minDur)
	if err != nil {
		return nil, err
	}

	stats := &ResponseTimeStats{}
	if avgDur != nil {
		stats.AvgMs = int(*avgDur + 0.5)
	}
	if maxDur != nil {
		stats.MaxMs = int(*maxDur)
	}
	if minDur != nil {
		stats.MinMs = int(*minDur)
	}
	return stats, nil
}

// CountErrors returns the count of error requests (error_message IS NOT NULL OR status_code >= 400).
func (s *Store) CountErrors(ctx context.Context, projectID int, since time.Time) (int, error) {
	var count int
	err := s.queryRow(ctx, projectID,
		`SELECT COUNT(*) FROM public.skaftin_system_request_logs
		 WHERE project_id = $1 AND created_at >= $2 AND (error_message IS NOT NULL OR status_code >= 400)`,
		projectID, since,
	).Scan(&count)
	return count, err
}

// TopEndpoints returns the top 10 most requested endpoints by count.
func (s *Store) TopEndpoints(ctx context.Context, projectID int, since time.Time) ([]TopEndpoint, error) {
	rows, err := s.query(ctx, projectID,
		`SELECT url, method, COUNT(*) AS count, AVG(duration_ms) AS avg_duration
		 FROM public.skaftin_system_request_logs
		 WHERE project_id = $1 AND created_at >= $2
		 GROUP BY url, method
		 ORDER BY count DESC
		 LIMIT 10`, projectID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]TopEndpoint, 0)
	for rows.Next() {
		var ep TopEndpoint
		var avgDur *float64
		if err := rows.Scan(&ep.URL, &ep.Method, &ep.Count, &avgDur); err != nil {
			return nil, err
		}
		if avgDur != nil {
			ep.AvgDurationMs = int(*avgDur + 0.5)
		}
		out = append(out, ep)
	}
	if out == nil {
		out = []TopEndpoint{}
	}
	return out, rows.Err()
}
