package handlers

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/quickswap/quickswap/internal/auth"
)

// Extended mock that handles profiles and per-method listing responses.
func setupExtendedListingMockServer() *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/auth/v1/user":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"id": "user123", "email": "test@example.com"}`))
		case "/rest/v1/listings":
			switch r.Method {
			case http.MethodGet:
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[{"id":"list1","title":"Test","seller_id":"user123","starting_bid":10,"auction_end_time":"2050-01-01T00:00:00Z","images":["img.jpg"]}]`))
			case http.MethodPatch:
				w.WriteHeader(http.StatusOK)
				w.Write([]byte(`[{"id":"list1","title":"Updated"}]`))
			case http.MethodDelete:
				w.WriteHeader(http.StatusNoContent)
			default:
				w.WriteHeader(http.StatusMethodNotAllowed)
			}
		case "/rest/v1/profiles":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"first_name":"John","last_name":"Doe"}]`))
		case "/rest/v1/bids":
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`[{"user_id":"user456","bid_amount":20}]`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
}

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

// ---- Single Listing (GET / PUT / DELETE) ----

func TestGetSingleListing_NoID(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("GET", "/api/listing", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for missing id, got %d", rr.Code)
	}
}

func TestGetSingleListing_Valid(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("GET", "/api/listing?id=list1", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestGetSingleListing_NoToken(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	// No token is allowed for GET (caller_id stays empty)
	req := httptest.NewRequest("GET", "/api/listing?id=list1", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200 (GET is public), got %d", rr.Code)
	}
}

func TestUpdateListing_NoToken(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("PUT", "/api/listing?id=list1", bytes.NewBuffer([]byte(`{}`)))
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestUpdateListing_NoID(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("PUT", "/api/listing", bytes.NewBuffer([]byte(`{}`)))
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for missing id, got %d", rr.Code)
	}
}

func TestUpdateListing_Valid(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	body := []byte(`{"title":"Updated","description":"desc","category":"Electronics","images":["img.jpg"],"auction_end_time":"2050-01-01T00:00:00Z","location":"Chennai"}`)
	req := httptest.NewRequest("PUT", "/api/listing?id=list1", bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer validtoken")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestDeleteListing_NoToken(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("DELETE", "/api/listing?id=list1", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Errorf("Expected 401, got %d", rr.Code)
	}
}

func TestDeleteListing_NoID(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("DELETE", "/api/listing", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Errorf("Expected 400 for missing id, got %d", rr.Code)
	}
}

func TestDeleteListing_Valid(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")
	os.Setenv("SUPABASE_SERVICE_KEY", "service")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("DELETE", "/api/listing?id=list1", nil)
	req.Header.Set("Authorization", "Bearer validtoken")
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Errorf("Expected 200, got %d", rr.Code)
	}
}

func TestSingleListingHandler_MethodNotAllowed(t *testing.T) {
	ts := setupExtendedListingMockServer()
	defer ts.Close()
	os.Setenv("SUPABASE_URL", ts.URL)
	os.Setenv("SUPABASE_ANON_KEY", "anon")

	c := auth.NewClient(ts.URL, "anon")
	handler := singleListingHandler(c)

	req := httptest.NewRequest("POST", "/api/listing?id=list1", nil)
	rr := httptest.NewRecorder()
	handler.ServeHTTP(rr, req)
	if rr.Code != http.StatusMethodNotAllowed {
		t.Errorf("Expected 405, got %d", rr.Code)
	}
}
