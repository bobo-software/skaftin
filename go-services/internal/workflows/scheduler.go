package workflows

import (
	"context"
	"log/slog"
	"sync"
	"time"

	"github.com/robfig/cron/v3"
)

type Scheduler struct {
	cron    *cron.Cron
	service *Service
	mu      sync.Mutex
	entries map[int]cron.EntryID
}

func NewScheduler(service *Service) *Scheduler {
	c := cron.New(cron.WithLocation(time.UTC))
	c.Start()
	return &Scheduler{
		cron:    c,
		service: service,
		entries: map[int]cron.EntryID{},
	}
}

func (s *Scheduler) LoadAll(ctx context.Context) error {
	items, err := s.service.store.listEnabledScheduledWorkflows(ctx)
	if err != nil {
		return err
	}
	for _, it := range items {
		s.Schedule(ctx, it.ID, it.Schedule)
	}
	return nil
}

func (s *Scheduler) Schedule(ctx context.Context, workflowID int, schedule string) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if eid, ok := s.entries[workflowID]; ok {
		s.cron.Remove(eid)
		delete(s.entries, workflowID)
	}
	eid, err := s.cron.AddFunc(schedule, func() {
		_, runErr := s.service.engine.ExecuteWorkflow(context.Background(), workflowID, map[string]any{}, "cron")
		if runErr != nil {
			slog.Error("workflow cron execution failed", "workflowId", workflowID, "error", runErr)
		}
	})
	if err != nil {
		slog.Error("failed to schedule workflow", "workflowId", workflowID, "schedule", schedule, "error", err)
		return
	}
	s.entries[workflowID] = eid
}

func (s *Scheduler) Unschedule(workflowID int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if eid, ok := s.entries[workflowID]; ok {
		s.cron.Remove(eid)
		delete(s.entries, workflowID)
	}
}

func (s *Scheduler) Stop() {
	s.cron.Stop()
}
