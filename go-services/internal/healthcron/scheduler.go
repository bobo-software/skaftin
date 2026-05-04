package healthcron

import (
	"log/slog"
	"time"

	"github.com/robfig/cron/v3"
)

// six-field: second minute hour dom month dow (requires cron.WithSeconds).
const every30Seconds = "*/30 * * * * *"

// Scheduler runs a trivial periodic log so operators can confirm in-process cron is alive.
type Scheduler struct {
	c *cron.Cron
}

// New creates a scheduler that has not been started yet.
func New() *Scheduler {
	return &Scheduler{
		c: cron.New(cron.WithSeconds(), cron.WithLocation(time.UTC)),
	}
}

// Start registers the health tick and begins the cron runner.
func (s *Scheduler) Start() error {
	if _, err := s.c.AddFunc(every30Seconds, func() {
		slog.Info("✅ cron job health working")
	}); err != nil {
		return err
	}
	s.c.Start()
	return nil
}

// Stop halts the cron runner (waits for any running job to finish).
func (s *Scheduler) Stop() {
	s.c.Stop()
}
