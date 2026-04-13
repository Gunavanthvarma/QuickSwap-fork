package db

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/jackc/pgx/v5"
	"github.com/redis/go-redis/v9"
)

func TestEnsureAuctionCached_Hit(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx := context.Background()

	// Pre-populate auction in cache
	auctionID := "test_hit"
	mr.Set(fmt.Sprintf("auction:%s:price", auctionID), "10.0")

	mockDB := &MockDBQuerier{
		QueryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			t.Fatal("Database should not be queried on a cache hit")
			return &MockRow{}
		},
	}

	err := EnsureAuctionCached(ctx, rdb, mockDB, auctionID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEnsureAuctionCached_Miss(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx := context.Background()
	auctionID := "test_miss"
	expectedEndTime := time.Now().Add(1 * time.Hour)

	mockDB := &MockDBQuerier{
		QueryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return &MockRow{
				ScanFunc: func(dest ...any) error {
					*dest[0].(*float64) = 55.5
					*dest[1].(*time.Time) = expectedEndTime
					return nil
				},
			}
		},
	}

	err := EnsureAuctionCached(ctx, rdb, mockDB, auctionID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	mr.CheckGet(t, fmt.Sprintf("auction:%s:price", auctionID), "55.5")
	mr.CheckGet(t, fmt.Sprintf("auction:%s:end_time", auctionID), fmt.Sprintf("%d", expectedEndTime.Unix()))
}

func TestProcessBidWithTx_Success(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx := context.Background()
	auctionID := "test_bid"
	userID := "user123"

	// Setup initial state
	mr.Set(fmt.Sprintf("auction:%s:price", auctionID), "10.0")
	mr.Set(fmt.Sprintf("auction:%s:end_time", auctionID), fmt.Sprintf("%d", time.Now().Add(1*time.Hour).Unix()))

	err := ProcessBidWithTx(ctx, rdb, auctionID, userID, 20.0)
	if err != nil {
		t.Fatalf("unexpected error on valid bid: %v", err)
	}

	mr.CheckGet(t, fmt.Sprintf("auction:%s:price", auctionID), "20")
	mr.CheckGet(t, fmt.Sprintf("auction:%s:highest_bidder", auctionID), "user123")
}

func TestProcessBidWithTx_BidTooLow(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx := context.Background()
	auctionID := "test_bid_low"
	userID := "user123"

	// Setup initial state
	mr.Set(fmt.Sprintf("auction:%s:price", auctionID), "50.0")
	mr.Set(fmt.Sprintf("auction:%s:end_time", auctionID), fmt.Sprintf("%d", time.Now().Add(1*time.Hour).Unix()))

	err := ProcessBidWithTx(ctx, rdb, auctionID, userID, 40.0)
	if err == nil {
		t.Fatal("expected error on low bid, got nil")
	}

	mr.CheckGet(t, fmt.Sprintf("auction:%s:price", auctionID), "50.0")
}
