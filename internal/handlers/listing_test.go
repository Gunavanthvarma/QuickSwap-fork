package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"github.com/quickswap/quickswap/internal/auth"
)

func setupListingMockServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/auth/v1/user":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"id": "user123", "email": "test@example.com"}`))
		case "/rest/v1/listings":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"id": "list1", "title": "Test Listing", "starting_bid": 10, "auction_end_time": "2050-01-01T00:00:00Z"}]`))
		case "/rest/v1/bids":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[]`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

func TestMyListingHandler(t *testing.T) {
	ts := setupListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")

	c := auth.NewClient(ts.URL, "anon")
	handler := myListingHandler(c)

	req1 := httptest.NewRequest("GET", "/api/mylistings", nil)
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized, got %d", rr1.Code)
	}

	req := httptest.NewRequest("GET", "/api/mylistings", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusOK {
		t.Errorf("Handler returned wrong status code: got %v want %v", status, http.StatusOK)
	}
}

func TestCreateListingHandler(t *testing.T) {
	ts := setupListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)

	c := auth.NewClient(ts.URL, "anon")
	handler := createListingHandler(c, nil)

	req1 := httptest.NewRequest("POST", "/api/createlisting", bytes.NewBuffer([]byte(`{}`)))
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1)
	if rr1.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401 Unauthorized, got %d", rr1.Code)
	}

	req := httptest.NewRequest("POST", "/api/createlisting", bytes.NewBuffer([]byte(`{"title": ""}`)))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Errorf("Expected 400 Bad Request for missing fields: got %v", status)
	}
}
