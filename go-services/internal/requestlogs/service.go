package requestlogs

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

var validRetentions = map[string]bool{
	"daily": true, "weekly": true, "monthly": true, "disabled": true,
}

// Service contains business logic for request log operations.
type Service struct {
	store *Store
}

// NewService creates a new request logs Service.
func NewService(pool *pgxpool.Pool) *Service {
	return &Service{store: NewStore(pool)}
}

func (svc *Service) GetSettings(ctx context.Context, projectID int) (*LogSettings, error) {
	return svc.store.GetSettings(ctx, projectID)
}

func (svc *Service) UpdateSettings(ctx context.Context, projectID int, enabled *bool, retention *string) (*LogSettings, error) {
	if retention != nil && !validRetentions[*retention] {
		return nil, fmt.Errorf("invalid retention")
	}
	return svc.store.UpdateSettings(ctx, projectID, enabled, retention)
}

// StatsResult is the full stats response returned by GetStats.
type StatsResult struct {
	TimeRange     TimeRange         `json:"time_range"`
	TotalRequests int               `json:"total_requests"`
	ErrorCount    int               `json:"error_count"`
	ByStatus      map[string]int    `json:"by_status"`
	ByMethod      map[string]int    `json:"by_method"`
	ResponseTime  ResponseTimeStats `json:"response_time"`
	TopEndpoints  []TopEndpoint     `json:"top_endpoints"`
}

// TimeRange describes the window used for stats.
type TimeRange struct {
	Hours int    `json:"hours"`
	Start string `json:"start"`
	End   string `json:"end"`
}

func (svc *Service) GetStats(ctx context.Context, projectID int, hours int) (*StatsResult, error) {
	if hours <= 0 {
		hours = 24
	}
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	total, err := svc.store.CountTotal(ctx, projectID, since)
	if err != nil {
		return nil, err
	}

	byStatus, err := svc.store.CountByStatusCategory(ctx, projectID, since)
	if err != nil {
		return nil, err
	}

	byMethod, err := svc.store.CountByMethod(ctx, projectID, since)
	if err != nil {
		return nil, err
	}

	respTime, err := svc.store.GetResponseTimeStats(ctx, projectID, since)
	if err != nil {
		return nil, err
	}

	errorCount, err := svc.store.CountErrors(ctx, projectID, since)
	if err != nil {
		return nil, err
	}

	topEndpoints, err := svc.store.TopEndpoints(ctx, projectID, since)
	if err != nil {
		return nil, err
	}

	return &StatsResult{
		TimeRange: TimeRange{
			Hours: hours,
			Start: since.UTC().Format(time.RFC3339),
			End:   time.Now().UTC().Format(time.RFC3339),
		},
		TotalRequests: total,
		ErrorCount:    errorCount,
		ByStatus:      byStatus,
		ByMethod:      byMethod,
		ResponseTime:  *respTime,
		TopEndpoints:  topEndpoints,
	}, nil
}

func (svc *Service) ListLogs(ctx context.Context, projectID int, f LogFilters) (*LogListResult, error) {
	if f.Limit <= 0 {
		f.Limit = 50
	}
	if f.Limit > 500 {
		f.Limit = 500
	}
	if f.Method != nil {
		upper := strings.ToUpper(*f.Method)
		f.Method = &upper
	}
	return svc.store.ListLogs(ctx, projectID, f)
}

func (svc *Service) GetLog(ctx context.Context, projectID, logID int) (*RequestLog, error) {
	return svc.store.GetLog(ctx, projectID, logID)
}

func (svc *Service) Cleanup(ctx context.Context, projectID int, olderThanDays int) (int64, time.Time, error) {
	if olderThanDays <= 0 {
		olderThanDays = 7
	}
	cutoff := time.Now().Add(-time.Duration(olderThanDays) * 24 * time.Hour)
	deleted, err := svc.store.Cleanup(ctx, projectID, cutoff)
	return deleted, cutoff, err
}
