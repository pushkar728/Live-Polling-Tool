package ws

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Hub keeps track of every open WebSocket connection, grouped by poll ID,
// and broadcasts result updates to everyone watching a given poll.
//
// How real-time works end-to-end:
//   1. A voter POSTs a vote to the REST API.
//   2. The handler does HINCRBY in Redis (atomic, so concurrent votes
//      never race each other) and PUBLISHes the new results on a Redis
//      pub/sub channel named "poll:<pollID>".
//   3. A single goroutine (started in main.go) subscribes to "poll:*" and
//      forwards every message it receives into this Hub.
//   4. The Hub fans that message out to every WebSocket client currently
//      connected for that poll ID.
//
// Routing through Redis pub/sub (rather than just calling hub.Broadcast
// directly from the vote handler) is what lets this scale to multiple
// backend instances behind a load balancer - any instance can receive a
// vote, and every instance's Hub gets notified via Redis.
type Hub struct {
	mu    sync.RWMutex
	rooms map[string]map[*websocket.Conn]struct{} // pollID -> set of connections
}

func NewHub() *Hub {
	return &Hub{
		rooms: make(map[string]map[*websocket.Conn]struct{}),
	}
}

func (h *Hub) Register(pollID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.rooms[pollID] == nil {
		h.rooms[pollID] = make(map[*websocket.Conn]struct{})
	}
	h.rooms[pollID][conn] = struct{}{}
}

func (h *Hub) Unregister(pollID string, conn *websocket.Conn) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if conns, ok := h.rooms[pollID]; ok {
		delete(conns, conn)
		if len(conns) == 0 {
			delete(h.rooms, pollID)
		}
	}
	_ = conn.Close()
}

// Broadcast sends the given payload (already-marshalled JSON bytes) to
// every connection currently watching pollID. Dead connections are
// cleaned up on the spot.
func (h *Hub) Broadcast(pollID string, payload []byte) {
	h.mu.RLock()
	conns := make([]*websocket.Conn, 0, len(h.rooms[pollID]))
	for conn := range h.rooms[pollID] {
		conns = append(conns, conn)
	}
	h.mu.RUnlock()

	for _, conn := range conns {
		if err := conn.WriteMessage(websocket.TextMessage, payload); err != nil {
			log.Printf("dropping dead websocket for poll %s: %v", pollID, err)
			h.Unregister(pollID, conn)
		}
	}
}

// BroadcastJSON is a small convenience wrapper so callers don't have to
// marshal manually every time.
func (h *Hub) BroadcastJSON(pollID string, v interface{}) {
	payload, err := json.Marshal(v)
	if err != nil {
		log.Printf("failed to marshal broadcast payload: %v", err)
		return
	}
	h.Broadcast(pollID, payload)
}
