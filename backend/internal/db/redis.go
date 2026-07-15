package db

import (
	"context"
	"log"
	"time"

	"github.com/redis/go-redis/v9"
)

// ConnectRedis dials Redis once at startup. This client is shared by:
//   - the vote-counting logic (HINCRBY on a per-poll hash - this is the
//     actual source of truth for live counts, not a cache of Mongo)
//   - the pub/sub layer that fans vote updates out to every open
//     WebSocket connection, including ones on other server instances
func ConnectRedis(cfg *Config) *redis.Client {
	client := redis.NewClient(&redis.Options{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		log.Fatalf("failed to connect to redis: %v", err)
	}

	log.Println("connected to Redis")
	return client
}
