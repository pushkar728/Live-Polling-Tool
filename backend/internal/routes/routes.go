package routes

import (
	"github.com/gin-gonic/gin"

	"live-polling-backend/internal/handlers"
	"live-polling-backend/internal/middleware"
)

// RegisterRoutes wires every endpoint. Grouping makes the auth boundary
// visually obvious: anything under the "authenticated" group requires a
// valid JWT, everything else (voting, watching results) is public by
// design since polls are shared via link, not login.
func RegisterRoutes(r *gin.Engine, authHandler *handlers.AuthHandler, pollHandler *handlers.PollHandler, jwtSecret string) {
	api := r.Group("/api")

	api.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// --- Public auth endpoints ---
	api.POST("/auth/signup", authHandler.Signup)
	api.POST("/auth/login", authHandler.Login)

	// --- Public poll endpoints (anyone with the link can view/vote) ---
	api.GET("/polls/:shareCode", pollHandler.GetPoll)
	api.POST("/polls/:shareCode/vote", pollHandler.Vote)
	api.GET("/polls/:shareCode/results", pollHandler.GetResults)
	api.GET("/polls/:shareCode/watch", pollHandler.WatchPoll) // upgrades to WebSocket

	// --- Authenticated endpoints (poll creation/management) ---
	authenticated := api.Group("/")
	authenticated.Use(middleware.RequireAuth(jwtSecret))
	{
		authenticated.POST("/polls", pollHandler.CreatePoll)
		authenticated.GET("/my-polls", pollHandler.ListMyPolls)
		authenticated.PATCH("/polls/:id/close", pollHandler.ClosePoll)
	}
}
