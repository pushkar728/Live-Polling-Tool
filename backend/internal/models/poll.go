package models

import "go.mongodb.org/mongo-driver/bson/primitive"

// PollOption is embedded inside Poll in Mongo. Note there's no "votes"
// count stored here - that's intentional. Live vote counts live in Redis
// (a hash keyed by poll ID -> option ID -> count) because that's what
// needs to be fast and frequently written under concurrent voting.
// Mongo holds the durable, slow-changing definition of the poll; Redis
// holds the hot, fast-changing counts. We periodically/finally sync
// Redis counts back into Mongo so results survive a Redis restart.
type PollOption struct {
	ID   string `bson:"id" json:"id"`
	Text string `bson:"text" json:"text"`
}

type Poll struct {
	ID          primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OwnerID     primitive.ObjectID `bson:"ownerId" json:"ownerId"`
	Question    string             `bson:"question" json:"question"`
	Options     []PollOption       `bson:"options" json:"options"`
	ShareCode   string             `bson:"shareCode" json:"shareCode"`
	IsOpen      bool               `bson:"isOpen" json:"isOpen"`
	AllowMulti  bool               `bson:"allowMulti" json:"allowMulti"` // can a voter pick more than one option
	CreatedAt   int64              `bson:"createdAt" json:"createdAt"`
}

type CreatePollRequest struct {
	Question   string   `json:"question" binding:"required,min=3,max=280"`
	Options    []string `json:"options" binding:"required,min=2,max=10,dive,required,min=1,max=120"`
	AllowMulti bool     `json:"allowMulti"`
}

type VoteRequest struct {
	OptionID string `json:"optionId" binding:"required"`
}

// PollResults is what we send over the WebSocket and REST results endpoint.
// Counts are read live from Redis, never from Mongo, while a poll is open.
type PollResults struct {
	PollID     string         `json:"pollId"`
	Question   string         `json:"question"`
	IsOpen     bool           `json:"isOpen"`
	Options    []PollOption   `json:"options"`
	Counts     map[string]int64 `json:"counts"`
	TotalVotes int64          `json:"totalVotes"`
}
