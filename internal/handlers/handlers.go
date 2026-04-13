package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

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
	mux.HandleFunc("/api/createlisting", createListingHandler(c, rdb))
	mux.HandleFunc("/api/mylistings", myListingHandler(c))
	mux.HandleFunc("/api/listing", singleListingHandler(c))
	mux.HandleFunc("/api/toplistings", topListingsHandler(c))

	// Register bids Api
	mux.HandleFunc("/api/mybids", myBidsHandler(c))

	mux.HandleFunc("POST /api/auctions/{id}/bid", bidHandler(c, pg, rdb))
	// Profile Settings Update Page
	mux.HandleFunc("/api/profile/update", updateProfileHandler(c))
	mux.HandleFunc("/api/profile/password", updatePasswordHandler(c))
	mux.HandleFunc("/api/profile/account", deleteAccountHandler(c))
	mux.HandleFunc("/api/profile/stats", profileStatsHandler(c))

	// Address routes
	mux.HandleFunc("/api/address", addressHandler(c))
	mux.HandleFunc("/api/address/{id}", addressByIDHandler(c))

	// Payment method routesx
	mux.HandleFunc("/api/add-payment", paymentHandler(c))
	mux.HandleFunc("/api/add-payment/{id}", paymentByIDHandler(c))

	mux.HandleFunc("GET /api/ws/auctions/{id}", sseAuctionHandler(rdb))

	// Notification routes
	mux.HandleFunc("GET /api/notifications", getNotificationsHandler(pg))
	mux.HandleFunc("GET /api/notifications/count", getNotificationCountHandler(pg))
	mux.HandleFunc("PUT /api/notifications/read-all", markAllNotificationsReadHandler(pg))
	mux.HandleFunc("PUT /api/notifications/{id}/read", markNotificationReadHandler(pg))
	mux.HandleFunc("DELETE /api/notifications/{id}", deleteNotificationHandler(pg))

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

		// 3. Sync bid to PostgreSQL asynchronously
		bidTime := time.Now()
		go func(aid, uid string, amt float64, t time.Time) {
			bgCtx := context.Background()
			query := `INSERT INTO bids (listing_id, user_id, bid_amount, timestamp) VALUES ($1, $2, $3, $4)`
			_, err := pg.Exec(bgCtx, query, aid, uid, amt, t)
			if err != nil {
				log.Printf("Failed to sync bid to db: aid=%s uid=%s err=%v", aid, uid, err)
			}
		}(auctionID, userID, req.Amount, bidTime)

		respondJSON(w, map[string]interface{}{
			"message": "Bid placed successfully",
		})
	}
}

// sseAuctionHandler sets up a Server-Sent Events (SSE) stream for real-time auction updates.
func sseAuctionHandler(rdb *redis.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auctionID := r.PathValue("id")
		if auctionID == "" {
			http.Error(w, "Auction ID is required", http.StatusBadRequest)
			return
		}

		// Set headers for SSE
		w.Header().Set("Content-Type", "text/event-stream")
		w.Header().Set("Cache-Control", "no-cache")
		w.Header().Set("Connection", "keep-alive")
		w.Header().Set("Access-Control-Allow-Origin", "*")

		flusher, ok := w.(http.Flusher)
		if !ok {
			http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
			return
		}

		ctx := r.Context()

		// Subscribe to the Redis Pub/Sub channel for this specific auction
		pubsub := rdb.Subscribe(ctx, fmt.Sprintf("auction:events:%s", auctionID))
		defer pubsub.Close()

		ch := pubsub.Channel()

		// Flush headers immediately so the client's EventSource 'open' event fires
		flusher.Flush()

		for {
			select {
			case <-ctx.Done():
				// Client disconnected
				log.Printf("[SSE] Connection closed for auction %s", auctionID)
				return
			case msg := <-ch:
				// Forward the JSON payload from Redis directly to the client as an SSE event
				fmt.Fprintf(w, "event: bid_update\ndata: %s\n\n", msg.Payload)
				flusher.Flush()
			}
		}
	}
}
