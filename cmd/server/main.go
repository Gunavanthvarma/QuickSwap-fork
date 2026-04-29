package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
	"github.com/joho/godotenv"
	"github.com/quickswap/quickswap/internal/auth"
	"github.com/quickswap/quickswap/internal/db"
	"github.com/quickswap/quickswap/internal/handlers"
	"github.com/quickswap/quickswap/internal/worker"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Printf("Note: .env file not found, using env vars")
	}

	url := os.Getenv("SUPABASE_URL")
	key := os.Getenv("SUPABASE_ANON_KEY")
	if url == "" || key == "" {
		log.Fatal("SUPABASE_URL and SUPABASE_ANON_KEY must be set")
	}

	authClient := auth.NewClient(url, key)

	// Initialize Database (PostgreSQL/Supabase)
	ctx := context.Background()
	pgPool, err := db.NewPostgresPool(ctx)
	if err != nil {
		log.Printf("Warning: Could not connect to PostgreSQL: %v (Check DATABASE_URL in .env)", err)
	} else {
		defer pgPool.Close()
	}

	// Initialize Redis
	redisClient, err := db.NewRedisClient(ctx)
	if err != nil {
		log.Printf("Warning: Could not connect to Redis: %v (Check REDIS_URL in .env)", err)
	} else {
		defer redisClient.Close()
	}

	_ = pgPool      // Keep for future use in handlers
	_ = redisClient // Keep for future use in handlers

	// Start Auction Background Worker
	go worker.StartAuctionSettlementWorker(ctx, redisClient, pgPool)

	// Static files (login page)
	fs := http.FileServer(http.Dir("frontend"))
	http.Handle("/", fs)

	// API routes
	mux := handlers.NewRouter(authClient, pgPool, redisClient)
	http.Handle("/api/", mux)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8082"
	}
	addr := ":" + port

	srv := &http.Server{
		Addr:    addr,
		Handler: corsMiddleware(requestLogger(http.DefaultServeMux)),
	}

	go func() {
		log.Printf("QuickSwap auth server listening on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("listen: %s\n", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	// The context is used to inform the server it has 5 seconds to finish
	// the request it is currently handling
	ctxShutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctxShutdown); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}

	log.Println("Server exiting gracefully")
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowedOrigin := os.Getenv("FRONTEND_URL")
		if allowedOrigin == "" {
			allowedOrigin = "*" // Fallback for local development
		}

		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		
		// If credentials are required (e.g., cookies), Access-Control-Allow-Origin cannot be "*"
		// and we might need: w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// requestLogger logs the HTTP method, URL path, and latency of every incoming request
func requestLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		log.Printf("[%s] %s - %v", r.Method, r.URL.Path, time.Since(start))
	})
}
