package analytics

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// OverviewResult combines summaries from all three metric domains.
type OverviewResult struct {
	API      *APIOverview     `json:"api"`
	Database *DBOverview      `json:"database"`
	Storage  *StorageOverview `json:"storage"`
}

// APIMetricsResult holds time series and top endpoints for API metrics.
type APIMetricsResult struct {
	TimeSeries   []APITimeSeriesRow `json:"timeSeries"`
	TopEndpoints []TopEndpoint      `json:"topEndpoints"`
}

// DBMetricsResult holds time series, top tables, and slow queries.
type DBMetricsResult struct {
	TimeSeries  []DBTimeSeriesRow `json:"timeSeries"`
	TopTables   []TopTable        `json:"topTables"`
	SlowQueries []SlowQuery       `json:"slowQueries"`
}

// StorageMetricsResult holds time series and operation breakdown.
type StorageMetricsResult struct {
	TimeSeries         []StorageTimeSeriesRow `json:"timeSeries"`
	OperationBreakdown []StorageBreakdownRow  `json:"operationBreakdown"`
}

// Service contains business logic for metric aggregation.
type Service struct {
	store *Store
}

// NewService creates a new analytics Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}

func timeRange(days int) (time.Time, time.Time) {
	end := time.Now().UTC()
	start := end.AddDate(0, 0, -days)
	return start, end
}

func resolveGroupBy(groupBy string, days int) string {
	if groupBy == "hour" || groupBy == "day" {
		return groupBy
	}
	if days <= 7 {
		return "hour"
	}
	return "day"
}

// GetOverview returns combined API, database, and storage summaries.
func (s *Service) GetOverview(ctx context.Context, projectID, days int) (*OverviewResult, error) {
	start, end := timeRange(days)

	api, err := s.store.GetAPIOverview(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}
	db, err := s.store.GetDBOverview(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}
	st, err := s.store.GetStorageOverview(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}

	return &OverviewResult{API: api, Database: db, Storage: st}, nil
}

// GetAPIMetrics returns API time series and top endpoints.
func (s *Service) GetAPIMetrics(ctx context.Context, projectID, days int, groupBy string) (*APIMetricsResult, error) {
	start, end := timeRange(days)
	gb := resolveGroupBy(groupBy, days)

	ts, err := s.store.GetAPITimeSeries(ctx, projectID, start, end, gb)
	if err != nil {
		return nil, err
	}
	top, err := s.store.GetTopEndpoints(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}

	if ts == nil {
		ts = []APITimeSeriesRow{}
	}
	if top == nil {
		top = []TopEndpoint{}
	}
	return &APIMetricsResult{TimeSeries: ts, TopEndpoints: top}, nil
}

// GetDatabaseMetrics returns DB time series, top tables, and slow queries.
func (s *Service) GetDatabaseMetrics(ctx context.Context, projectID, days int, groupBy string) (*DBMetricsResult, error) {
	start, end := timeRange(days)
	gb := resolveGroupBy(groupBy, days)

	ts, err := s.store.GetDBTimeSeries(ctx, projectID, start, end, gb)
	if err != nil {
		return nil, err
	}
	tables, err := s.store.GetTopTables(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}
	slow, err := s.store.GetSlowQueries(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}

	if ts == nil {
		ts = []DBTimeSeriesRow{}
	}
	if tables == nil {
		tables = []TopTable{}
	}
	if slow == nil {
		slow = []SlowQuery{}
	}
	return &DBMetricsResult{TimeSeries: ts, TopTables: tables, SlowQueries: slow}, nil
}

// GetStorageMetrics returns storage time series and operation breakdown.
func (s *Service) GetStorageMetrics(ctx context.Context, projectID, days int, groupBy string) (*StorageMetricsResult, error) {
	start, end := timeRange(days)
	gb := resolveGroupBy(groupBy, days)

	ts, err := s.store.GetStorageTimeSeries(ctx, projectID, start, end, gb)
	if err != nil {
		return nil, err
	}
	breakdown, err := s.store.GetStorageBreakdown(ctx, projectID, start, end)
	if err != nil {
		return nil, err
	}

	if ts == nil {
		ts = []StorageTimeSeriesRow{}
	}
	if breakdown == nil {
		breakdown = []StorageBreakdownRow{}
	}
	return &StorageMetricsResult{TimeSeries: ts, OperationBreakdown: breakdown}, nil
}
