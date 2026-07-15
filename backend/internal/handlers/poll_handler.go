package handlers

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/redis/go-redis/v9"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"

	"live-polling-backend/internal/middleware"
	"live-polling-backend/internal/models"
	"live-polling-backend/internal/ws"
)

type PollHandler struct {
	pollsCol *mongo.Collection
	redis    *redis.Client
	hub      *ws.Hub
}

func NewPollHandler(pollsCol *mongo.Collection, redisClient *redis.Client, hub *ws.Hub) *PollHandler {
	return &PollHandler{pollsCol: pollsCol, redis: redisClient, hub: hub}
}

func redisCountsKey(pollID string) string {
	return fmt.Sprintf("poll:%s:counts", pollID)
}

func redisChannel(pollID string) string {
	return fmt.Sprintf("poll:%s:updates", pollID)
}

// generateShareCode makes a short, URL-safe code so share links look like
// /vote/8f3a1c2b instead of a raw 24-char Mongo ObjectID.
func generateShareCode() (string, error) {
	b := make([]byte, 5)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// CreatePoll validates the request, builds option IDs, writes the poll
// definition to Mongo, and seeds Redis with zeroed counts so the first
// GET /results never has to special-case "no votes yet".
func (h *PollHandler) CreatePoll(c *gin.Context) {
	var req models.CreatePollRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := middleware.UserIDFromContext(c)
	ownerID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user"})
		return
	}

	options := make([]models.PollOption, len(req.Options))
	for i, text := range req.Options {
		options[i] = models.PollOption{ID: fmt.Sprintf("opt_%d", i+1), Text: text}
	}

	shareCode, err := generateShareCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not generate share link"})
		return
	}

	poll := models.Poll{
		OwnerID:    ownerID,
		Question:   req.Question,
		Options:    options,
		ShareCode:  shareCode,
		IsOpen:     true,
		AllowMulti: req.AllowMulti,
		CreatedAt:  time.Now().Unix(),
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	res, err := h.pollsCol.InsertOne(ctx, poll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not create poll"})
		return
	}
	poll.ID = res.InsertedID.(primitive.ObjectID)

	// Seed the Redis hash: field per option, all starting at 0. This is
	// the "real work" Redis is doing - it's the live source of truth for
	// counts, not just a cache.
	countsKey := redisCountsKey(poll.ID.Hex())
	pipe := h.redis.Pipeline()
	for _, opt := range options {
		pipe.HSetNX(ctx, countsKey, opt.ID, 0)
	}
	if _, err := pipe.Exec(ctx); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not initialize live counts"})
		return
	}

	c.JSON(http.StatusCreated, poll)
}

// GetPoll returns the poll definition (question + options), used by the
// voting page to render the form.
func (h *PollHandler) GetPoll(c *gin.Context) {
	shareCode := c.Param("shareCode")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	err := h.pollsCol.FindOne(ctx, bson.M{"shareCode": shareCode}).Decode(&poll)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
		return
	}

	c.JSON(http.StatusOK, poll)
}

// ListMyPolls returns every poll the logged-in user created, for their dashboard.
func (h *PollHandler) ListMyPolls(c *gin.Context) {
	userID := middleware.UserIDFromContext(c)
	ownerID, err := primitive.ObjectIDFromHex(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid user"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	cursor, err := h.pollsCol.Find(ctx, bson.M{"ownerId": ownerID})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not fetch polls"})
		return
	}
	defer cursor.Close(ctx)

	polls := []models.Poll{}
	if err := cursor.All(ctx, &polls); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read polls"})
		return
	}

	c.JSON(http.StatusOK, polls)
}

// Vote is the hot path. It:
//  1. Validates the poll exists, is open, and the option is real.
//  2. Increments the Redis counter atomically (HINCRBY - safe under
//     concurrent requests, no lost updates even with thousands of
//     simultaneous voters).
//  3. Reads back the fresh totals and publishes them on the poll's Redis
//     pub/sub channel, which the subscriber goroutine forwards to every
//     connected WebSocket client via the Hub.
func (h *PollHandler) Vote(c *gin.Context) {
	shareCode := c.Param("shareCode")

	var req models.VoteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	if err := h.pollsCol.FindOne(ctx, bson.M{"shareCode": shareCode}).Decode(&poll); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
		return
	}

	if !poll.IsOpen {
		c.JSON(http.StatusConflict, gin.H{"error": "this poll is closed"})
		return
	}

	validOption := false
	for _, opt := range poll.Options {
		if opt.ID == req.OptionID {
			validOption = true
			break
		}
	}
	if !validOption {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid option for this poll"})
		return
	}

	countsKey := redisCountsKey(poll.ID.Hex())
	if _, err := h.redis.HIncrBy(ctx, countsKey, req.OptionID, 1).Result(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not record vote"})
		return
	}

	results, err := h.buildResults(ctx, &poll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "vote recorded but could not build results"})
		return
	}

	// Publish so every server instance's subscriber picks this up and
	// broadcasts to its own locally-connected WebSocket clients.
	payload, _ := json.Marshal(results)
	h.redis.Publish(ctx, redisChannel(poll.ID.Hex()), payload)

	c.JSON(http.StatusOK, results)
}

// GetResults is a plain REST fallback (useful for the initial page load
// before the WebSocket connects, or for anyone polling instead of using
// sockets).
func (h *PollHandler) GetResults(c *gin.Context) {
	shareCode := c.Param("shareCode")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	if err := h.pollsCol.FindOne(ctx, bson.M{"shareCode": shareCode}).Decode(&poll); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
		return
	}

	results, err := h.buildResults(ctx, &poll)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "could not read results"})
		return
	}

	c.JSON(http.StatusOK, results)
}

func (h *PollHandler) buildResults(ctx context.Context, poll *models.Poll) (*models.PollResults, error) {
	countsKey := redisCountsKey(poll.ID.Hex())
	raw, err := h.redis.HGetAll(ctx, countsKey).Result()
	if err != nil {
		return nil, err
	}

	counts := make(map[string]int64, len(poll.Options))
	var total int64
	for _, opt := range poll.Options {
		var v int64
		if s, ok := raw[opt.ID]; ok {
			fmt.Sscanf(s, "%d", &v)
		}
		counts[opt.ID] = v
		total += v
	}

	return &models.PollResults{
		PollID:     poll.ID.Hex(),
		Question:   poll.Question,
		IsOpen:     poll.IsOpen,
		Options:    poll.Options,
		Counts:     counts,
		TotalVotes: total,
	}, nil
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	// Kept permissive because polls are meant to be shared publicly by
	// link; there's no session/cookie to protect here on the vote/watch
	// side (only poll creation is authenticated).
	CheckOrigin: func(r *http.Request) bool { return true },
}

// WatchPoll upgrades the HTTP request to a WebSocket and registers the
// connection with the Hub so it starts receiving live result broadcasts.
// It also sends one initial snapshot immediately so the UI has data before
// the first vote comes in.
func (h *PollHandler) WatchPoll(c *gin.Context) {
	shareCode := c.Param("shareCode")

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	var poll models.Poll
	if err := h.pollsCol.FindOne(ctx, bson.M{"shareCode": shareCode}).Decode(&poll); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "poll not found"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	pollID := poll.ID.Hex()
	h.hub.Register(pollID, conn)

	if results, err := h.buildResults(ctx, &poll); err == nil {
		h.hub.BroadcastJSON(pollID, results)
	}

	// Block reading from the client. We don't expect the client to send
	// anything meaningful, but reading is how gorilla/websocket detects
	// the connection closing so we can clean it up.
	go func() {
		defer h.hub.Unregister(pollID, conn)
		for {
			if _, _, err := conn.ReadMessage(); err != nil {
				return
			}
		}
	}()
}

// ClosePoll lets the owner stop accepting votes.
func (h *PollHandler) ClosePoll(c *gin.Context) {
	pollIDHex := c.Param("id")
	pollID, err := primitive.ObjectIDFromHex(pollIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid poll id"})
		return
	}

	userID := middleware.UserIDFromContext(c)
	ownerID, _ := primitive.ObjectIDFromHex(userID)

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	res, err := h.pollsCol.UpdateOne(ctx,
		bson.M{"_id": pollID, "ownerId": ownerID},
		bson.M{"$set": bson.M{"isOpen": false}},
	)
	if err != nil || res.MatchedCount == 0 {
		c.JSON(http.StatusForbidden, gin.H{"error": "poll not found or you don't own it"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "poll closed"})
}
