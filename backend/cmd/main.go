package main

import (
	"context"
	"log"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"

	"live-polling-backend/internal/db"
	"live-polling-backend/internal/handlers"
	"live-polling-backend/internal/routes"
	"live-polling-backend/internal/ws"
)

func main() {
	cfg := db.LoadConfig()

	if cfg.JWTSecret == "" {
		log.Fatal("JWT_SECRET is not set - refusing to start with an insecure default")
	}

	mongoDatabase := db.ConnectMongo(cfg)
	redisClient := db.ConnectRedis(cfg)

	hub := ws.NewHub()
	ws.StartRedisSubscriber(context.Background(), redisClient, hub)

	usersCol := mongoDatabase.Collection("users")
	pollsCol := mongoDatabase.Collection("polls")

	authHandler := handlers.NewAuthHandler(usersCol, cfg.JWTSecret)
	pollHandler := handlers.NewPollHandler(pollsCol, redisClient, hub)

	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{cfg.FrontendOrigin},
		AllowMethods:     []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		AllowCredentials: true,
	}))

	routes.RegisterRoutes(r, authHandler, pollHandler, cfg.JWTSecret)

	log.Printf("server starting on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("server failed: %v", err)
	}
}
