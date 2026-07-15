package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

const userIDKey = "userID"

// GenerateToken and the claims struct live in the handlers/auth package in
// a real split, but keeping the JWT secret access in one place (here) means
// there's exactly one place that knows how to mint/verify tokens.
type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

// RequireAuth is Gin middleware: it rejects the request with 401 if there's
// no valid "Authorization: Bearer <token>" header, and otherwise stashes the
// authenticated user's ID in the Gin context for handlers to read.
func RequireAuth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing or malformed Authorization header"})
			return
		}

		tokenStr := strings.TrimPrefix(header, "Bearer ")
		claims := &Claims{}

		token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (interface{}, error) {
			return []byte(jwtSecret), nil
		})
		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid or expired token"})
			return
		}

		c.Set(userIDKey, claims.UserID)
		c.Next()
	}
}

// UserIDFromContext is how handlers read the authenticated user's ID after
// RequireAuth has run.
func UserIDFromContext(c *gin.Context) string {
	v, _ := c.Get(userIDKey)
	id, _ := v.(string)
	return id
}
