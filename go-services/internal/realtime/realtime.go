package realtime

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/skaftin/go-services/internal/auth"
)

type AuthMode int

const (
	AuthModeAdminUnrestricted AuthMode = iota
	AuthModeAPIKeyScoped
)

const (
	messageTypeSubscribe      = "subscribe"
	messageTypeUnsubscribe    = "unsubscribe"
	messageTypeError          = "error"
	messageTypeSubscribed     = "subscribed"
	messageTypeUnsubscribed   = "unsubscribed"
	messageTypeDatabaseChange = "database-change"
	messageTypeProjectEvent   = "project-event"
)

type IncomingMessage struct {
	Type      string `json:"type"`
	ProjectID string `json:"projectId,omitempty"`
}

type OutgoingMessage struct {
	Type      string `json:"type"`
	ProjectID string `json:"projectId,omitempty"`
	Message   string `json:"message,omitempty"`
	Payload   any    `json:"payload,omitempty"`
}

type DatabaseEvent struct {
	Type      string `json:"type"`
	ProjectID string `json:"projectId"`
	TableName string `json:"tableName"`
	Data      any    `json:"data,omitempty"`
	OldData   any    `json:"oldData,omitempty"`
	Timestamp string `json:"timestamp"`
}

type ProjectEvent struct {
	Type      string `json:"type"`
	ProjectID string `json:"projectId"`
	Data      any    `json:"data"`
	Timestamp string `json:"timestamp"`
}

type client struct {
	conn              *websocket.Conn
	send              chan []byte
	projects          map[string]struct{}
	allowedProjectID  string
	allowedProjects   map[string]struct{}
	adminProjectScope bool
}

type Hub struct {
	mu         sync.RWMutex
	clients    map[*client]struct{}
	subscribed map[string]map[*client]struct{}
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*client]struct{}),
		subscribed: make(map[string]map[*client]struct{}),
	}
}

func (h *Hub) Register(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[c] = struct{}{}
}

func (h *Hub) Unregister(c *client) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.clients, c)
	for pid := range c.projects {
		if clients, ok := h.subscribed[pid]; ok {
			delete(clients, c)
			if len(clients) == 0 {
				delete(h.subscribed, pid)
			}
		}
	}
	close(c.send)
}

func (h *Hub) Subscribe(c *client, projectID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if _, ok := h.subscribed[projectID]; !ok {
		h.subscribed[projectID] = make(map[*client]struct{})
	}
	h.subscribed[projectID][c] = struct{}{}
	c.projects[projectID] = struct{}{}
}

func (h *Hub) Unsubscribe(c *client, projectID string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(c.projects, projectID)
	if clients, ok := h.subscribed[projectID]; ok {
		delete(clients, c)
		if len(clients) == 0 {
			delete(h.subscribed, projectID)
		}
	}
}

func (h *Hub) BroadcastDatabaseChange(event DatabaseEvent) {
	if event.Timestamp == "" {
		event.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	}

	h.broadcastToProject(event.ProjectID, OutgoingMessage{
		Type:      messageTypeDatabaseChange,
		ProjectID: event.ProjectID,
		Payload:   event,
	})
}

func (h *Hub) BroadcastProjectEvent(event ProjectEvent) {
	if event.Timestamp == "" {
		event.Timestamp = time.Now().UTC().Format(time.RFC3339Nano)
	}

	h.broadcastToProject(event.ProjectID, OutgoingMessage{
		Type:      messageTypeProjectEvent,
		ProjectID: event.ProjectID,
		Payload:   event,
	})
}

func (h *Hub) broadcastToProject(projectID string, msg OutgoingMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		slog.Error("failed to marshal realtime message", "error", err)
		return
	}

	h.mu.RLock()
	clients := h.subscribed[projectID]
	targets := make([]*client, 0, len(clients))
	for c := range clients {
		targets = append(targets, c)
	}
	h.mu.RUnlock()

	for _, c := range targets {
		select {
		case c.send <- data:
		default:
			// Slow client; drop message instead of blocking broadcaster.
		}
	}
}

type Handler struct {
	hub      *Hub
	mode     AuthMode
	upgrader websocket.Upgrader
}

func newHandler(hub *Hub, mode AuthMode, allowedOrigins []string) *Handler {
	allowed := make(map[string]struct{})
	for _, origin := range allowedOrigins {
		if origin != "" {
			allowed[origin] = struct{}{}
		}
	}

	return &Handler{
		hub: hub,
		mode: mode,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true
				}
				_, ok := allowed[origin]
				return ok
			},
		},
	}
}

func NewHandler(hub *Hub, allowedOrigins []string) *Handler {
	return newHandler(hub, AuthModeAdminUnrestricted, allowedOrigins)
}

func NewAPIKeyHandler(hub *Hub, allowedOrigins []string) *Handler {
	return newHandler(hub, AuthModeAPIKeyScoped, allowedOrigins)
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var userCtx = auth.GetUserContext(r)
	var authCtx = auth.GetAuthContext(r)
	slog.Info("websocket handshake received",
		"path", r.URL.Path,
		"query", r.URL.RawQuery,
		"remoteAddr", r.RemoteAddr,
		"origin", r.Header.Get("Origin"),
		"mode", h.mode.String(),
		"hasUserContext", userCtx != nil,
		"hasAuthContext", authCtx != nil,
	)
	if h.mode == AuthModeAPIKeyScoped && authCtx == nil {
		slog.Warn("websocket auth rejected: missing API key auth context",
			"path", r.URL.Path,
			"query", r.URL.RawQuery,
			"remoteAddr", r.RemoteAddr,
		)
		http.Error(w, "Authentication required", http.StatusUnauthorized)
		return
	}

	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Warn("realtime upgrade failed", "error", err)
		return
	}
	slog.Info("websocket upgrade successful",
		"path", r.URL.Path,
		"mode", h.mode.String(),
		"remoteAddr", r.RemoteAddr,
	)

	c := &client{
		conn:            conn,
		send:            make(chan []byte, 64),
		projects:        make(map[string]struct{}),
		allowedProjects: make(map[string]struct{}),
	}
	if h.mode == AuthModeAPIKeyScoped {
		c.allowedProjectID = strconv.Itoa(authCtx.ProjectID)
	} else if userCtx != nil {
		if userCtx.Role == "admin" {
			c.adminProjectScope = true
		} else {
			for _, pid := range userCtx.ProjectIDs {
				c.allowedProjects[strconv.Itoa(int(pid))] = struct{}{}
			}
		}
	}
	h.hub.Register(c)

	go h.writePump(c)
	h.readPump(c)
}

func (h *Handler) readPump(c *client) {
	defer func() {
		h.hub.Unregister(c)
		_ = c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	_ = c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	})

	for {
		_, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}

		var msg IncomingMessage
		if err := json.Unmarshal(data, &msg); err != nil {
			h.sendToClient(c, OutgoingMessage{Type: messageTypeError, Message: "Invalid JSON message"})
			continue
		}

		switch msg.Type {
		case messageTypeSubscribe:
			if msg.ProjectID == "" {
				h.sendToClient(c, OutgoingMessage{Type: messageTypeError, Message: "projectId is required"})
				continue
			}
			if !canSubscribeProject(c, msg.ProjectID) {
				slog.Warn("websocket subscribe rejected",
					"projectId", msg.ProjectID,
					"mode", h.mode.String(),
					"allowedProjectId", c.allowedProjectID,
					"adminScope", c.adminProjectScope,
				)
				h.sendToClient(c, OutgoingMessage{Type: messageTypeError, Message: "not authorized for requested project"})
				continue
			}
			h.hub.Subscribe(c, msg.ProjectID)
			slog.Info("websocket subscribed",
				"projectId", msg.ProjectID,
				"mode", h.mode.String(),
			)
			h.sendToClient(c, OutgoingMessage{Type: messageTypeSubscribed, ProjectID: msg.ProjectID})
		case messageTypeUnsubscribe:
			if msg.ProjectID == "" {
				h.sendToClient(c, OutgoingMessage{Type: messageTypeError, Message: "projectId is required"})
				continue
			}
			h.hub.Unsubscribe(c, msg.ProjectID)
			h.sendToClient(c, OutgoingMessage{Type: messageTypeUnsubscribed, ProjectID: msg.ProjectID})
		default:
			h.sendToClient(c, OutgoingMessage{Type: messageTypeError, Message: "Unknown message type"})
		}
	}
}

func (m AuthMode) String() string {
	switch m {
	case AuthModeAdminUnrestricted:
		return "admin_unrestricted"
	case AuthModeAPIKeyScoped:
		return "api_key_scoped"
	default:
		return "unknown"
	}
}

func canSubscribeProject(c *client, projectID string) bool {
	if c == nil {
		return false
	}
	if projectID == "" {
		return false
	}
	// API-key auth is project-scoped: allow subscriptions only to that project.
	if c.allowedProjectID != "" {
		return c.allowedProjectID == projectID
	}
	// Session-auth users can subscribe to authorized projects.
	if c.adminProjectScope {
		return true
	}
	_, ok := c.allowedProjects[projectID]
	return ok
}

func (h *Handler) writePump(c *client) {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		_ = c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				_ = c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (h *Handler) sendToClient(c *client, msg OutgoingMessage) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}
	select {
	case c.send <- data:
	default:
	}
}
