package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/quickswap/quickswap/internal/auth"
	"github.com/quickswap/quickswap/internal/db"
	"github.com/redis/go-redis/v9"
)

// NewRouter returns an http.Handler with auth routes registered.
func NewRouter(c *auth.Client, pg *pgxpool.Pool, rdb *redis.Client) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/auth/login", loginHandler(c))
	mux.HandleFunc("/api/auth/signup", signupHandler(c))
	mux.HandleFunc("/api/auth/logout", logoutHandler(c))
	mux.HandleFunc("/api/auth/me", meHandler(c))
	mux.HandleFunc("/api/profile", profileHandler(c))

	// Register listing route
	mux.HandleFunc("/api/createlisting", createListingHandler(c))
	mux.HandleFunc("/api/mylistings", myListingHandler(c))
	mux.HandleFunc("/api/listing", singleListingHandler(c))

	// Register bids Api
	mux.HandleFunc("/api/mybids", myBidsHandler(c))
	mux.HandleFunc("/api/toplistings", topListingsHandler(c))

	mux.HandleFunc("POST /api/auctions/{id}/bid", bidHandler(c, pg, rdb))
	// Profile Settings Update Page

	mux.HandleFunc("/api/profile/update", updateProfileHandler(c))
	return mux
}

func bidHandler(c *auth.Client, pg *pgxpool.Pool, rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auctionID := r.PathValue("id")
		if auctionID == "" {
			respondError(w, "Auction ID is required", http.StatusBadRequest)
			return
		}

		token := r.Header.Get("Authorization")
		if len(token) > 7 && token[:7] == "Bearer " {
			token = token[7:]
		}
		if token == "" {
			respondError(w, "Authorization header required", http.StatusUnauthorized)
			return
		}

		// Validate token by calling Supabase user endpoint
		reqAuth, _ := http.NewRequest("GET", os.Getenv("SUPABASE_URL")+"/auth/v1/user", nil)
		reqAuth.Header.Set("apikey", os.Getenv("SUPABASE_ANON_KEY"))
		reqAuth.Header.Set("Authorization", "Bearer "+token)

		resp, err := http.DefaultClient.Do(reqAuth)
		if err != nil {
			respondError(w, "Failed to get user", http.StatusInternalServerError)
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			respondError(w, "Invalid or expired token", http.StatusUnauthorized)
			return
		}

		var userResp struct {
			ID string `json:"id"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&userResp); err != nil {
			respondError(w, "Invalid response", http.StatusInternalServerError)
			return
		}

		userID := userResp.ID

		var req struct {
			Amount float64 `json:"amount"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			respondError(w, "Invalid request body", http.StatusBadRequest)
			return
		}

		ctx := r.Context()

		// 1. Ensure auction is cached
		if err := db.EnsureAuctionCached(ctx, rdb, pg, auctionID); err != nil {
			log.Printf("Error caching auction %s: %v", auctionID, err)
			respondError(w, "Auction not found or error loading auction", http.StatusNotFound)
			return
		}

		// 2. Process Bid
		if err := db.ProcessBidWithTx(ctx, rdb, auctionID, userID, req.Amount); err != nil {
			// If error, return 400 Bad Request
			respondError(w, err.Error(), http.StatusBadRequest)
			return
		}

		respondJSON(w, map[string]interface{}{
			"message": "Bid placed successfully",
		})
	}
}
