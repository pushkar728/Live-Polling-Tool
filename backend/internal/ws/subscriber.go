package ws

import (
	"context"
	"log"

	"github.com/redis/go-redis/v9"
)

// StartRedisSubscriber listens on "poll:*:updates" and forwards every
// message straight into the Hub for the matching poll. This is the piece
// that makes the design horizontally scalable: it doesn't matter which
// backend instance handled the vote - every instance is subscribed here,
// so every instance's locally-connected WebSocket clients get the update.
func StartRedisSubscriber(ctx context.Context, client *redis.Client, hub *Hub) {
	pubsub := client.PSubscribe(ctx, "poll:*:updates")

	go func() {
		defer pubsub.Close()
		ch := pubsub.Channel()

		for msg := range ch {
			pollID := extractPollID(msg.Channel)
			if pollID == "" {
				continue
			}
			hub.Broadcast(pollID, []byte(msg.Payload))
		}
		log.Println("redis subscriber channel closed")
	}()

	log.Println("subscribed to redis channel poll:*:updates")
}

// extractPollID pulls "<id>" out of "poll:<id>:updates".
func extractPollID(channel string) string {
	const prefix = "poll:"
	const suffix = ":updates"
	if len(channel) < len(prefix)+len(suffix) {
		return ""
	}
	return channel[len(prefix) : len(channel)-len(suffix)]
}
