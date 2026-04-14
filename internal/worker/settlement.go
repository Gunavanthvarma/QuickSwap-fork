package worker

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/quickswap/quickswap/internal/db"
	"github.com/redis/go-redis/v9"
)

// createAuctionEndedNotifications inserts notifications for the seller and winner (if any)
// when an auction ends.
func createAuctionEndedNotifications(ctx context.Context, pg db.DBQuerier, auctionID, title, sellerID string, winnerID *string, winningPrice *float64) {
	insertNotif := func(userID, notifType, notifTitle, message string) {
		_, err := pg.Exec(ctx, `
			INSERT INTO notifications (user_id, type, title, message, listing_id)
			VALUES ($1, $2, $3, $4, $5)
		`, userID, notifType, notifTitle, message, auctionID)
		if err != nil {
			log.Printf("[Worker] Warning: failed to insert notification for user %s: %v", userID, err)
		}
	}

	if winnerID != nil && winningPrice != nil {
		// Notify seller — auction ended with a winner
		insertNotif(
			sellerID,
			"auction_ended_seller",
			"Your auction has ended",
			fmt.Sprintf("Your auction for \"%s\" has ended. Winning bid: $%.2f.", title, *winningPrice),
		)
		// Notify winner
		insertNotif(
			*winnerID,
			"auction_won",
			"You won an auction!",
			fmt.Sprintf("Congratulations! You won the auction for \"%s\" with a bid of $%.2f.", title, *winningPrice),
		)
	} else {
		// Notify seller — auction ended with no bids
		insertNotif(
			sellerID,
			"auction_ended_no_bids",
			"Your auction has ended",
			fmt.Sprintf("Your auction for \"%s\" has ended with no bids.", title),
		)
	}
}

// StartAuctionSettlementWorker runs a background job that checks the Redis ZSET for expired auctions.
func StartAuctionSettlementWorker(ctx context.Context, rdb *redis.Client, pg db.DBQuerier) {
	if rdb == nil || pg == nil {
		log.Println("[Worker] Warning: rdb or pg is nil. Auction settlement worker will not start.")
		return
	}

	// Ensure listings table has required settlement columns.
	_, err := pg.Exec(ctx, `
		ALTER TABLE listings
		ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active',
		ADD COLUMN IF NOT EXISTS winner_id UUID,
		ADD COLUMN IF NOT EXISTS winning_price NUMERIC;
	`)
	if err != nil {
		log.Printf("[Worker] Warning: could not verify/alter listings table schema: %v", err)
	}

	// Ensure notifications table exists.
	_, err = pg.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS notifications (
			id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			user_id    UUID NOT NULL,
			type       TEXT NOT NULL,
			title      TEXT NOT NULL,
			message    TEXT NOT NULL,
			listing_id UUID NOT NULL,
			is_read    BOOLEAN NOT NULL DEFAULT false,
			created_at TIMESTAMPTZ NOT NULL DEFAULT now()
		);
	`)
	if err != nil {
		log.Printf("[Worker] Warning: could not create notifications table: %v", err)
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

	// 3b. Fetch listing title and seller_id for notification messages.
	var listingTitle string
	var sellerID string
	fetchErr := pg.QueryRow(ctx, `
		SELECT title, seller_id FROM listings WHERE id = $1
	`, auctionID).Scan(&listingTitle, &sellerID)
	if fetchErr != nil {
		log.Printf("[Worker] Warning: could not fetch listing details for notifications (auction %s): %v", auctionID, fetchErr)
	} else {
		createAuctionEndedNotifications(ctx, pg, auctionID, listingTitle, sellerID, highestBidder, price)
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
