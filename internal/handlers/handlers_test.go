package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"context"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/quickswap/quickswap/internal/auth"
	"github.com/redis/go-redis/v9"
)

func setupHandlersMockServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth/v1/user":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"id": "user123", "email": "test@example.com"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func TestNewRouter(t *testing.T) {
	handler := NewRouter(nil, nil, nil)
	if handler == nil {
		t.Errorf("NewRouter returned nil")
	}
}

<<<<<<< HEAD
// MockRow implements pgx.Row
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

||||||| 387a7f0
=======
// MockRow implements pgx.Row
type MockRow struct {
	ScanFunc func(dest ...any) error
}

func (m *MockRow) Scan(dest ...any) error {
	if m.ScanFunc != nil {
		return m.ScanFunc(dest...)
	}
	return nil
}

type MockDBQuerier struct {
	ExecFunc     func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
	QueryRowFunc func(ctx context.Context, sql string, args ...any) pgx.Row
}

func (m *MockDBQuerier) Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
	if m.ExecFunc != nil {
		return m.ExecFunc(ctx, sql, arguments...)
	}
	return pgconn.CommandTag{}, nil
}

func (m *MockDBQuerier) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	if m.QueryRowFunc != nil {
		return m.QueryRowFunc(ctx, sql, args...)
	}
	return &MockRow{}
}

>>>>>>> af7912091123bce996561c5964ad2a32f637d03c
func TestBidHandler(t *testing.T) {
	ts := setupHandlersMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")

	c := auth.NewClient(ts.URL, "anon")
	
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()
	
	mockDB := &MockDBQuerier{
		QueryRowFunc: func(ctx context.Context, sql string, args ...any) pgx.Row {
			return &MockRow{
				ScanFunc: func(dest ...any) error {
					*dest[0].(*float64) = 10.0
					*dest[1].(*time.Time) = time.Now().Add(1 * time.Hour)
					return nil
				},
			}
		},
		ExecFunc: func(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error) {
			return pgconn.CommandTag{}, nil
		},
	}

	handler := bidHandler(c, mockDB, rdb)

	req1 := httptest.NewRequest("POST", "/api/auctions/123/bid", bytes.NewBuffer([]byte(`{"amount": 50}`)))
	req1.SetPathValue("id", "123")
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized, got %d", rr1.Code)
	}

	req2 := httptest.NewRequest("POST", "/api/auctions/123/bid", bytes.NewBuffer([]byte(`{"amount": 50}`)))
	req2.SetPathValue("id", "123")
	req2.Header.Set("Authorization", "Bearer validtoken")
	rr2 := httptest.NewRecorder()

	handler.ServeHTTP(rr2, req2)
	if rr2.Code != http.StatusOK {
		t.Errorf("Expected 200 OK on valid bid, got %d", rr2.Code)
	}

	mr.CheckGet(t, "auction:123:price", "50")
}

func TestSseAuctionHandler(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	defer rdb.Close()

	handler := sseAuctionHandler(rdb)

	req := httptest.NewRequest("GET", "/api/ws/auctions/test_sse", nil)
	req.SetPathValue("id", "test_sse")
	rr := httptest.NewRecorder()

	ctx, cancel := context.WithCancel(context.Background())
	req = req.WithContext(ctx)

	go func() {
		time.Sleep(50 * time.Millisecond)
		rdb.Publish(context.Background(), "auction:events:test_sse", `{"message": "hello"}`)
		time.Sleep(50 * time.Millisecond)
		cancel() // Ends the SSE connection naturally
	}()

	handler.ServeHTTP(rr, req)

	resp := rr.Result()
	if resp.StatusCode != http.StatusOK {
		t.Errorf("Expected 200 OK, got %d", resp.StatusCode)
	}
	
	body := rr.Body.String()
	if body == "" {
		t.Error("Expected SSE body, got empty string")
	}
}
