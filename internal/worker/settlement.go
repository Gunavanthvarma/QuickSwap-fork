package worker

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/quickswap/quickswap/internal/db"
	"github.com/redis/go-redis/v9"
)

// StartAuctionSettlementWorker runs a background job that checks the Redis ZSET for expired auctions.
func StartAuctionSettlementWorker(ctx context.Context, rdb *redis.Client, pg db.DBQuerier) {
	if rdb == nil || pg == nil {
		log.Println("[Worker] Warning: rdb or pg is nil. Auction settlement worker will not start.")
		return
	}

	// First, ensure the listings table has the required columns for settlement
	// (Safeguard in case they haven't been added to the database schema yet)
	_, err := pg.Exec(ctx, `
		ALTER TABLE listings 
		ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
		ADD COLUMN IF NOT EXISTS winner_id UUID,
		ADD COLUMN IF NOT EXISTS winning_price NUMERIC;
	`)
	if err != nil {
		log.Printf("[Worker] Warning: could not verify/alter listings table schema: %v", err)
	}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	log.Println("[Worker] Started auction settlement background worker...")

	for {
		select {
		case <-ctx.Done():
			log.Println("[Worker] Shutting down auction settlement worker.")
			return
		case <-ticker.C:
			processExpiredAuctions(ctx, rdb, pg)
		}
	}
}

func processExpiredAuctions(ctx context.Context, rdb *redis.Client, pg db.DBQuerier) {
	nowUnix := time.Now().Unix()

	// 1. Fetch expired auctions from the ZSET where score (end time) <= current time
	q := redis.ZRangeBy{
		Min: "-inf",
		Max: fmt.Sprintf("%d", nowUnix),
	}

	expiredAuctions, err := rdb.ZRangeByScore(ctx, "active_auctions", &q).Result()
	if err != nil {
		log.Printf("[Worker] Error fetching expired auctions from Redis: %v", err)
		return
	}

	if len(expiredAuctions) == 0 {
		return // Nothing to do
	}

	for _, auctionID := range expiredAuctions {
		settleAuction(ctx, rdb, pg, auctionID)
	}
}

func settleAuction(ctx context.Context, rdb *redis.Client, pg db.DBQuerier, auctionID string) {
	log.Printf("[Worker] Settling expired auction %s...", auctionID)

	priceKey := fmt.Sprintf("auction:%s:price", auctionID)
	highestBidderKey := fmt.Sprintf("auction:%s:highest_bidder", auctionID)
	endTimeKey := fmt.Sprintf("auction:%s:end_time", auctionID)
	participantsKey := fmt.Sprintf("auction:%s:participants", auctionID)

	// 2. Pull highest bidder and price
	var price *float64
	var highestBidder *string

	priceStr, err := rdb.Get(ctx, priceKey).Result()
	if err == nil {
		var p float64
		if _, scanErr := fmt.Sscanf(priceStr, "%f", &p); scanErr == nil {
			price = &p
		}
	} else if err != redis.Nil {
		log.Printf("[Worker] Warning getting price for %s: %v", auctionID, err)
	}

	bidder, err := rdb.Get(ctx, highestBidderKey).Result()
	if err == nil && bidder != "" {
		highestBidder = &bidder
	}

	// 3. Update PostgreSQL
	var updateErr error
	if highestBidder != nil && price != nil {
		_, updateErr = pg.Exec(ctx, `
			UPDATE listings 
			SET status = 'Ended', winner_id = $1, winning_price = $2 
			WHERE id = $3
		`, *highestBidder, *price, auctionID)
	} else {
		// Auction ended with no bids
		_, updateErr = pg.Exec(ctx, `
			UPDATE listings 
			SET status = 'Ended' 
			WHERE id = $1
		`, auctionID)
	}

	if updateErr != nil {
		log.Printf("[Worker] Error updating Postgres for auction %s: %v", auctionID, updateErr)
		// We avoid removing from ZSET if we failed to update DB, so it retries next time
		return
	}

	// 4. Clean up Redis Cache
	pipe := rdb.Pipeline()
	pipe.Del(ctx, priceKey, highestBidderKey, endTimeKey, participantsKey)
	pipe.ZRem(ctx, "active_auctions", auctionID)

	_, err = pipe.Exec(ctx)
	if err != nil {
		log.Printf("[Worker] Warning: failed to clean up Redis cache for %s: %v", auctionID, err)
	} else {
		log.Printf("[Worker] Successfully settled auction %s (Winner: %v, Price: %v)", auctionID, bidder, price)
	}
}
