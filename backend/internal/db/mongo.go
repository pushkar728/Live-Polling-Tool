package db

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// ConnectMongo dials MongoDB once at startup and returns a *mongo.Database
// handle that every repository/handler reuses. The mongo driver already
// pools connections internally, so we don't need our own pool.
func ConnectMongo(cfg *Config) *mongo.Database {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	clientOpts := options.Client().ApplyURI(cfg.MongoURI)
	client, err := mongo.Connect(ctx, clientOpts)
	if err != nil {
		log.Fatalf("failed to connect to mongo: %v", err)
	}

	if err := client.Ping(ctx, nil); err != nil {
		log.Fatalf("mongo ping failed: %v", err)
	}

	log.Println("connected to MongoDB")

	database := client.Database(cfg.MongoDBName)
	ensureIndexes(database)

	return database
}

// ensureIndexes creates the indexes the app relies on for correctness and
// speed. Doing this at startup means a fresh database is always ready -
// no manual "run this in mongosh" step for whoever deploys this.
func ensureIndexes(database *mongo.Database) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	usersCol := database.Collection("users")
	_, err := usersCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys:    map[string]interface{}{"email": 1},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		log.Printf("warning: could not create users email index: %v", err)
	}

	pollsCol := database.Collection("polls")
	_, err = pollsCol.Indexes().CreateOne(ctx, mongo.IndexModel{
		Keys: map[string]interface{}{"shareCode": 1},
		Options: options.Index().SetUnique(true),
	})
	if err != nil {
		log.Printf("warning: could not create polls shareCode index: %v", err)
	}
}
