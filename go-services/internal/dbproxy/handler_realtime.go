package dbproxy

import (
	"strconv"
	"time"

	"github.com/skaftin/go-services/internal/realtime"
)

func (h *Handler) emitDatabaseEvent(projectID int, eventType, tableName string, data any, oldData any) {
	if h.rt == nil {
		return
	}

	h.rt.BroadcastDatabaseChange(realtime.DatabaseEvent{
		Type:      eventType,
		ProjectID: strconv.Itoa(projectID),
		TableName: tableName,
		Data:      data,
		OldData:   oldData,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (h *Handler) emitProjectEvent(projectID int, eventType string, data any) {
	if h.rt == nil {
		return
	}

	h.rt.BroadcastProjectEvent(realtime.ProjectEvent{
		Type:      eventType,
		ProjectID: strconv.Itoa(projectID),
		Data:      data,
		Timestamp: time.Now().UTC().Format(time.RFC3339Nano),
	})
}
