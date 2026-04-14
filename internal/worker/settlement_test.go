package worker

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/redis/go-redis/v9"
)

type MockRow struct {
	ScanFunc func(dest ...any) error
}

func (m *MockRow) Scan(dest ...any) error {
	if m.ScanFunc != nil {
		return m.ScanFunc(dest...)
	}
	return nil
}

type MockRows struct {
	pgx.Rows
}

func (m *MockRows) Close() {}
func (m *MockRows) Err() error { return nil }
func (m *MockRows) Next() bool { return false }
func (m *MockRows) Scan(dest ...any) error { return nil }

type MockDBQuerier struct {
	ExecFunc     func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryFunc    func(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
}

func (m *MockDBQuerier) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	if m.ExecFunc != nil {
		return m.ExecFunc(ctx, sql, arguments...)
	}
	return pgconn.CommandTag{}, nil
}

func (m *MockDBQuerier) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	if m.QueryFunc != nil {
		return m.QueryFunc(ctx, sql, args...)
	}
	return &MockRows{}, nil
}

func (m *MockDBQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.QueryRowFunc != nil {
		return m.QueryRowFunc(ctx, sql, args...)
	}
	return &MockRow{}
}

func TestProcessExpiredAuctions(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx := context.Background()
	auctionID := "test_settlement"

	// Setup expired auction in redis
	mr.ZAdd("active_auctions", float64(time.Now().Unix()-1000), auctionID)
	mr.Set(fmt.Sprintf("auction:%s:price", auctionID), "150.0")
	mr.Set(fmt.Sprintf("auction:%s:highest_bidder", auctionID), "winner123")
	mr.Set(fmt.Sprintf("auction:%s:end_time", auctionID), "0")
	mr.SAdd(fmt.Sprintf("auction:%s:participants", auctionID), "winner123")

	execCalled := false
	mockDB := &MockDBQuerier{
		ExecFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
			execCalled = true
			if len(arguments) != 3 {
				t.Errorf("Expected 3 arguments for update, got %d", len(arguments))
			}
			if arguments[0] != "winner123" || arguments[1] != 150.0 || arguments[2] != auctionID {
				t.Errorf("Unexpected arguments passed to Exec: %v", arguments)
			}
			return pgconn.CommandTag{}, nil
		},
	}

	processExpiredAuctions(ctx, rdb, mockDB)

	if !execCalled {
		t.Fatal("Expected PostgreSQL Exec to be called to finalize auction, but it wasn't")
	}

	// Verify Redis cleanup
	if mr.Exists(fmt.Sprintf("auction:%s:price", auctionID)) {
		t.Error("Redis price key should have been deleted")
	}
	if b, _ := mr.ZScore("active_auctions", auctionID); b != 0 {
		t.Error("Auction should have been removed from active_auctions ZSET")
	}
}

func TestProcessExpiredAuctions_DBFailRetainsRedis(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	ctx := context.Background()
	auctionID := "test_settlement_fail"

	mr.ZAdd("active_auctions", float64(time.Now().Unix()-1000), auctionID)
	mr.Set(fmt.Sprintf("auction:%s:price", auctionID), "100.0")

	mockDB := &MockDBQuerier{
		ExecFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
			return pgconn.CommandTag{}, fmt.Errorf("database down") // Simulate failure
		},
	}

	processExpiredAuctions(ctx, rdb, mockDB)

	// Since DB failed, it should skip redis deletion
	if !mr.Exists(fmt.Sprintf("auction:%s:price", auctionID)) {
		t.Error("Redis price key should NOT have been deleted because DB update failed")
	}
}
