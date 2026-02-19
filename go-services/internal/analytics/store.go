package analytics

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// ---------------------------------------------------------------------------
// Model types
// ---------------------------------------------------------------------------

type APIOverview struct {
	TotalRequests   int     `json:"totalRequests"`
	AvgResponseTime float64 `json:"avgResponseTime"`
	ErrorCount      int     `json:"errorCount"`
	SuccessCount    int     `json:"successCount"`
	ErrorRate       float64 `json:"errorRate"`
}

type DBOverview struct {
	TotalQueries      int     `json:"totalQueries"`
	AvgExecutionTime  float64 `json:"avgExecutionTime"`
	TotalRowsAffected int     `json:"totalRowsAffected"`
}

type StorageOverview struct {
	TotalOperations   int   `json:"totalOperations"`
	UploadCount       int   `json:"uploadCount"`
	DownloadCount     int   `json:"downloadCount"`
	TotalStorageBytes int64 `json:"totalStorageBytes"`
	UniqueFiles       int   `json:"uniqueFiles"`
}

type APITimeSeriesRow struct {
	Time            time.Time `json:"time"`
	RequestCount    int       `json:"requestCount"`
	AvgResponseTime float64   `json:"avgResponseTime"`
	ErrorCount      int       `json:"errorCount"`
}

type TopEndpoint struct {
	Endpoint        string  `json:"endpoint"`
	Method          string  `json:"method"`
	RequestCount    int     `json:"requestCount"`
	AvgResponseTime float64 `json:"avgResponseTime"`
	ErrorCount      int     `json:"errorCount"`
}

type DBTimeSeriesRow struct {
	Time              time.Time `json:"time"`
	QueryCount        int       `json:"queryCount"`
	AvgExecutionTime  float64   `json:"avgExecutionTime"`
	TotalRowsAffected int       `json:"totalRowsAffected"`
}

type TopTable struct {
	TableName         string  `json:"tableName"`
	QueryType         string  `json:"queryType"`
	QueryCount        int     `json:"queryCount"`
	AvgExecutionTime  float64 `json:"avgExecutionTime"`
	TotalRowsAffected int     `json:"totalRowsAffected"`
}

type SlowQuery struct {
	TableName       *string   `json:"tableName"`
	QueryType       string    `json:"queryType"`
	ExecutionTimeMs int       `json:"executionTimeMs"`
	RowsAffected    int       `json:"rowsAffected"`
	CreatedAt       time.Time `json:"createdAt"`
}

type StorageTimeSeriesRow struct {
	Time           time.Time `json:"time"`
	OperationCount int       `json:"operationCount"`
	UploadCount    int       `json:"uploadCount"`
	DownloadCount  int       `json:"downloadCount"`
	TotalBytes     int64     `json:"totalBytes"`
}

type StorageBreakdownRow struct {
	OperationType  string  `json:"operationType"`
	OperationCount int     `json:"operationCount"`
	TotalBytes     int64   `json:"totalBytes"`
	AvgFileSize    float64 `json:"avgFileSize"`
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

// Store handles analytics DB queries.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new analytics Store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// dateTrunc returns a validated DATE_TRUNC literal for use in SQL.
func dateTrunc(groupBy string) string {
	if groupBy == "day" {
		return "DATE_TRUNC('day', created_at)"
	}
	return "DATE_TRUNC('hour', created_at)"
}

// ---------------------------------------------------------------------------
// Overview queries
// ---------------------------------------------------------------------------

func (s *Store) GetAPIOverview(ctx context.Context, projectID int, start, end time.Time) (*APIOverview, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int                                          AS total_requests,
			COALESCE(AVG(response_time_ms), 0)                    AS avg_response_time,
			COUNT(CASE WHEN status_code >= 400 THEN 1 END)::int   AS error_count,
			COUNT(CASE WHEN status_code < 400 THEN 1 END)::int    AS success_count
		FROM public.skaftin_system_api_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND endpoint LIKE '/app-api/%'`,
		projectID, start, end,
	)

	var o APIOverview
	if err := row.Scan(&o.TotalRequests, &o.AvgResponseTime, &o.ErrorCount, &o.SuccessCount); err != nil {
		return nil, err
	}
	if o.TotalRequests > 0 {
		o.ErrorRate = float64(o.ErrorCount) / float64(o.TotalRequests) * 100
	}
	return &o, nil
}

func (s *Store) GetDBOverview(ctx context.Context, projectID int, start, end time.Time) (*DBOverview, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int                              AS total_queries,
			COALESCE(AVG(execution_time_ms), 0)        AS avg_execution_time,
			COALESCE(SUM(rows_affected), 0)::int       AS total_rows_affected
		FROM public.skaftin_system_database_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3`,
		projectID, start, end,
	)

	var o DBOverview
	if err := row.Scan(&o.TotalQueries, &o.AvgExecutionTime, &o.TotalRowsAffected); err != nil {
		return nil, err
	}
	return &o, nil
}

func (s *Store) GetStorageOverview(ctx context.Context, projectID int, start, end time.Time) (*StorageOverview, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			COUNT(*)::int                                                AS total_operations,
			COUNT(CASE WHEN operation_type = 'upload' THEN 1 END)::int   AS upload_count,
			COUNT(CASE WHEN operation_type = 'download' THEN 1 END)::int AS download_count,
			COALESCE(SUM(file_size_bytes), 0)::bigint                    AS total_storage_bytes,
			COUNT(DISTINCT file_path)::int                               AS unique_files
		FROM public.skaftin_system_storage_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND success = true`,
		projectID, start, end,
	)

	var o StorageOverview
	if err := row.Scan(&o.TotalOperations, &o.UploadCount, &o.DownloadCount, &o.TotalStorageBytes, &o.UniqueFiles); err != nil {
		return nil, err
	}
	return &o, nil
}

// ---------------------------------------------------------------------------
// API metrics queries
// ---------------------------------------------------------------------------

func (s *Store) GetAPITimeSeries(ctx context.Context, projectID int, start, end time.Time, groupBy string) ([]APITimeSeriesRow, error) {
	q := fmt.Sprintf(`
		SELECT
			%s                                                     AS time_period,
			COUNT(*)::int                                          AS request_count,
			COALESCE(AVG(response_time_ms), 0)                    AS avg_response_time,
			COUNT(CASE WHEN status_code >= 400 THEN 1 END)::int   AS error_count
		FROM public.skaftin_system_api_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND endpoint LIKE '/app-api/%%'
		GROUP BY time_period
		ORDER BY time_period ASC`, dateTrunc(groupBy))

	rows, err := s.pool.Query(ctx, q, projectID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []APITimeSeriesRow
	for rows.Next() {
		var r APITimeSeriesRow
		if err := rows.Scan(&r.Time, &r.RequestCount, &r.AvgResponseTime, &r.ErrorCount); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *Store) GetTopEndpoints(ctx context.Context, projectID int, start, end time.Time) ([]TopEndpoint, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			endpoint,
			method,
			COUNT(*)::int                                          AS request_count,
			COALESCE(AVG(response_time_ms), 0)                    AS avg_response_time,
			COUNT(CASE WHEN status_code >= 400 THEN 1 END)::int   AS error_count
		FROM public.skaftin_system_api_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND endpoint LIKE '/app-api/%'
		GROUP BY endpoint, method
		ORDER BY request_count DESC
		LIMIT 10`,
		projectID, start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []TopEndpoint
	for rows.Next() {
		var r TopEndpoint
		if err := rows.Scan(&r.Endpoint, &r.Method, &r.RequestCount, &r.AvgResponseTime, &r.ErrorCount); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// Database metrics queries
// ---------------------------------------------------------------------------

func (s *Store) GetDBTimeSeries(ctx context.Context, projectID int, start, end time.Time, groupBy string) ([]DBTimeSeriesRow, error) {
	q := fmt.Sprintf(`
		SELECT
			%s                                         AS time_period,
			COUNT(*)::int                              AS query_count,
			COALESCE(AVG(execution_time_ms), 0)        AS avg_execution_time,
			COALESCE(SUM(rows_affected), 0)::int       AS total_rows_affected
		FROM public.skaftin_system_database_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		GROUP BY time_period
		ORDER BY time_period ASC`, dateTrunc(groupBy))

	rows, err := s.pool.Query(ctx, q, projectID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []DBTimeSeriesRow
	for rows.Next() {
		var r DBTimeSeriesRow
		if err := rows.Scan(&r.Time, &r.QueryCount, &r.AvgExecutionTime, &r.TotalRowsAffected); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *Store) GetTopTables(ctx context.Context, projectID int, start, end time.Time) ([]TopTable, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			table_name,
			query_type,
			COUNT(*)::int                              AS query_count,
			COALESCE(AVG(execution_time_ms), 0)        AS avg_execution_time,
			COALESCE(SUM(rows_affected), 0)::int       AS total_rows_affected
		FROM public.skaftin_system_database_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND table_name IS NOT NULL
		GROUP BY table_name, query_type
		ORDER BY query_count DESC
		LIMIT 10`,
		projectID, start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []TopTable
	for rows.Next() {
		var r TopTable
		if err := rows.Scan(&r.TableName, &r.QueryType, &r.QueryCount, &r.AvgExecutionTime, &r.TotalRowsAffected); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *Store) GetSlowQueries(ctx context.Context, projectID int, start, end time.Time) ([]SlowQuery, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			table_name,
			query_type,
			execution_time_ms::int,
			COALESCE(rows_affected, 0)::int,
			created_at
		FROM public.skaftin_system_database_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND execution_time_ms > 1000
		ORDER BY execution_time_ms DESC
		LIMIT 20`,
		projectID, start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []SlowQuery
	for rows.Next() {
		var r SlowQuery
		if err := rows.Scan(&r.TableName, &r.QueryType, &r.ExecutionTimeMs, &r.RowsAffected, &r.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// ---------------------------------------------------------------------------
// Storage metrics queries
// ---------------------------------------------------------------------------

func (s *Store) GetStorageTimeSeries(ctx context.Context, projectID int, start, end time.Time, groupBy string) ([]StorageTimeSeriesRow, error) {
	q := fmt.Sprintf(`
		SELECT
			%s                                                           AS time_period,
			COUNT(*)::int                                                AS operation_count,
			COUNT(CASE WHEN operation_type = 'upload' THEN 1 END)::int   AS upload_count,
			COUNT(CASE WHEN operation_type = 'download' THEN 1 END)::int AS download_count,
			COALESCE(SUM(file_size_bytes), 0)::bigint                    AS total_bytes
		FROM public.skaftin_system_storage_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND success = true
		GROUP BY time_period
		ORDER BY time_period ASC`, dateTrunc(groupBy))

	rows, err := s.pool.Query(ctx, q, projectID, start, end)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []StorageTimeSeriesRow
	for rows.Next() {
		var r StorageTimeSeriesRow
		if err := rows.Scan(&r.Time, &r.OperationCount, &r.UploadCount, &r.DownloadCount, &r.TotalBytes); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

func (s *Store) GetStorageBreakdown(ctx context.Context, projectID int, start, end time.Time) ([]StorageBreakdownRow, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT
			operation_type,
			COUNT(*)::int                              AS operation_count,
			COALESCE(SUM(file_size_bytes), 0)::bigint  AS total_bytes,
			COALESCE(AVG(file_size_bytes), 0)          AS avg_file_size
		FROM public.skaftin_system_storage_metrics
		WHERE project_id = $1
		  AND created_at >= $2
		  AND created_at <= $3
		  AND success = true
		GROUP BY operation_type
		ORDER BY operation_count DESC`,
		projectID, start, end,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []StorageBreakdownRow
	for rows.Next() {
		var r StorageBreakdownRow
		if err := rows.Scan(&r.OperationType, &r.OperationCount, &r.TotalBytes, &r.AvgFileSize); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}
