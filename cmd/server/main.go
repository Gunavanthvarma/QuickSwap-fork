package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"github.com/joho/godotenv"
	"github.com/quickswap/quickswap/internal/auth"
	"github.com/quickswap/quickswap/internal/db"
	"github.com/quickswap/quickswap/internal/handlers"

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

	// Static files (login page)
	fs := http.FileServer(http.Dir("frontend"))
	http.Handle("/", fs)

	// API routes
	mux := handlers.NewRouter(authClient, pgPool, redisClient)
	http.Handle("/api/", mux)

	addr := ":8082"
	log.Printf("QuickSwap auth server listening on %s", addr)
	if err := http.ListenAndServe(addr, corsMiddleware(http.DefaultServeMux)); err != nil {
		log.Fatal(err)
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}
