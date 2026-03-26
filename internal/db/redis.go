package db

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// NewRedisClient creates a new Redis client using the REDIS_URL environment variable.
// If REDIS_URL is not set, it defaults to localhost:6379.
func NewRedisClient(ctx context.Context) (*redis.Client, error) {
	addr := os.Getenv("REDIS_URL")
	if addr == "" {
		// Default to localhost if not set
		addr = "localhost:6379"
		log.Println("REDIS_URL not set, defaulting to localhost:6379")
	}

	var opt *redis.Options
	var err error

	// Try to parse as URL first, then fall back to simple address
	if opt, err = redis.ParseURL(addr); err != nil {
		opt = &redis.Options{
			Addr: addr,
		}
	}

	client := redis.NewClient(opt)

	// Verify connection
	if err := client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("unable to connect to Redis at %s: %v", addr, err)
	}

	log.Printf("Successfully connected to Redis at %s", addr)
	return client, nil
}

// EnsureAuctionCached fetches auction data from Postgres if missing in Redis.
// It uses a Redis Pipeline to set both price and end_time atomically in the cache.
func EnsureAuctionCached(ctx context.Context, rdb *redis.Client, pg *pgxpool.Pool, auctionID string) error {
	priceKey := fmt.Sprintf("auction:%s:price", auctionID)

	// Step 1: Check if already cached
	_, err := rdb.Get(ctx, priceKey).Result()
	if err == nil {
		log.Printf("[Redis] Cache HIT for auction %s", auctionID)
		return nil // Cache hit! Fast path.
	} else if err != redis.Nil {
		return fmt.Errorf("redis error checking cache: %w", err)
	}

	// Step 2: Cache miss, fetch starting state from Postgres
	log.Printf("[Redis] Cache MISS for auction %s. Fetching from PostgreSQL...", auctionID)
	var startPrice float64
	var endTime time.Time

	query := `
		SELECT 
			COALESCE((SELECT bid_amount FROM bids WHERE listing_id = $1 ORDER BY bid_amount DESC LIMIT 1), starting_bid), 
			auction_end_time 
		FROM listings 
		WHERE id = $1
	`
	err = pg.QueryRow(ctx, query, auctionID).Scan(&startPrice, &endTime)
	if err != nil {
		return fmt.Errorf("failed to fetch auction from db: %w", err)
	}

	// Step 3: Save to Redis using a pipeline to guarantee both keys are written together
	pipe := rdb.Pipeline()
	pipe.Set(ctx, priceKey, startPrice, 0)
	pipe.Set(ctx, fmt.Sprintf("auction:%s:end_time", auctionID), endTime.Unix(), 0)

	_, err = pipe.Exec(ctx)
	if err != nil {
		return fmt.Errorf("failed to cache auction in redis: %w", err)
	}

	return nil
}

// ProcessBidWithTx atomicly validates and processes a highest bid using Redis Optimistic Locking.
func ProcessBidWithTx(ctx context.Context, rdb *redis.Client, auctionID string, userID string, amount float64) error {
	priceKey := fmt.Sprintf("auction:%s:price", auctionID)
	endTimeKey := fmt.Sprintf("auction:%s:end_time", auctionID)
	highestBidderKey := fmt.Sprintf("auction:%s:highest_bidder", auctionID)

	const maxRetries = 100

	txf := func(tx *redis.Tx) error {
		// Read end_time
		endTimeUnix, err := tx.Get(ctx, endTimeKey).Int64()
		if err == nil {
			if time.Now().Unix() > endTimeUnix {
				return fmt.Errorf("Auction Ended: current time is past auction end time")
			}
		} else if err != redis.Nil {
			return fmt.Errorf("redis error getting end_time: %w", err)
		}

		// Read current price
		currentPrice, err := tx.Get(ctx, priceKey).Float64()
		if err == nil {
			log.Printf("[Redis] Validating bid for auction %s: processing amount $%.2f against current highest bid $%.2f", auctionID, amount, currentPrice)
			if amount <= currentPrice {
				return fmt.Errorf("Bid Too Low: amount must be greater than current price")
			}
		} else if err != redis.Nil {
			return fmt.Errorf("redis error getting price: %w", err)
		} else if err == redis.Nil {
			// If price doesn't exist, we could reject or just continue.
			// We continue assuming amount > 0.
			if amount <= 0 {
				return fmt.Errorf("Bid Too Low: amount must be greater than current price")
			}
		}

		// Execution: Create a pipeline
		_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Set(ctx, priceKey, amount, 0)
			pipe.Set(ctx, highestBidderKey, userID, 0)

			participantsKey := fmt.Sprintf("auction:%s:participants", auctionID)
			pipe.SAdd(ctx, participantsKey, userID)
			return nil
		})

		return err
	}

	for i := 0; i < maxRetries; i++ {
		err := rdb.Watch(ctx, txf, priceKey)
		if err == nil {
			log.Printf("[Redis] SUCCESS: New highest bid placed for auction %s by user %s: $%.2f", auctionID, userID, amount)
			return nil
		}
		if err == redis.TxFailedErr {
			log.Printf("[Redis] RACE CONDITION DETECTED for auction %s! Retrying bid placement...", auctionID)
			continue // Retry on race condition
		}
		return err
	}

	return fmt.Errorf("reached maximum number of retries processing bid")
}
